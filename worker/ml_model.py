import json
import logging
import os
import re
from collections import Counter
from pathlib import Path
from threading import Lock

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.linear_model import LogisticRegression
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.pipeline import Pipeline

from .nlp_pipeline import TextPreprocessor
from .text_utils import word_tokens

logger = logging.getLogger(__name__)


class SemanticAnalyzer:
    def __init__(self):
        self.enabled = os.environ.get("ENABLE_TRANSFORMER_MODELS", "true").lower() in {"1", "true", "yes", "on"}
        self.model_name = os.environ.get("SENTENCE_TRANSFORMER_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
        self.model = None
        self.lock = Lock()

        if not self.enabled:
            return

        try:
            from sentence_transformers import SentenceTransformer

            self.model = SentenceTransformer(self.model_name)
        except Exception as exc:
            self.enabled = False
            logger.warning("Transformer embedding model is unavailable; falling back to TF-IDF only: %s", exc)

    def embed(self, text):
        if not self.enabled or self.model is None:
            return None

        chunks = self._chunk_text(text)
        if not chunks:
            return None

        with self.lock:
            vectors = self.model.encode(chunks, normalize_embeddings=True, convert_to_numpy=True, show_progress_bar=False)

        if vectors.ndim == 1:
            embedding = vectors
        else:
            embedding = vectors.mean(axis=0)

        norm = np.linalg.norm(embedding)
        if norm == 0:
            return None
        return embedding / norm

    def similarity(self, left, right):
        left_embedding = self.embed(left)
        right_embedding = self.embed(right)
        if left_embedding is None or right_embedding is None:
            return None
        return float(np.dot(left_embedding, right_embedding))

    def rank(self, query_text, documents):
        query_embedding = self.embed(query_text)
        if query_embedding is None:
            return None

        document_embeddings = []
        for document in documents:
            document_embedding = self.embed(document)
            if document_embedding is None:
                return None
            document_embeddings.append(document_embedding)

        matrix = np.vstack(document_embeddings)
        scores = matrix @ query_embedding
        return scores

    def _chunk_text(self, text, max_chars=1200, max_chunks=10):
        paragraphs = [item.strip() for item in re.split(r"\n{2,}|\r\n", text) if item.strip()]
        chunks = []
        current = ""

        for paragraph in paragraphs or [text]:
            if len(current) + len(paragraph) + 1 <= max_chars:
                current = f"{current}\n{paragraph}".strip()
            else:
                if current:
                    chunks.append(current)
                current = paragraph[:max_chars]
            if len(chunks) >= max_chunks:
                break

        if current and len(chunks) < max_chunks:
            chunks.append(current)

        return chunks[:max_chunks]


class CareerModel:
    def __init__(self, jobs_path=None):
        self.jobs_path = jobs_path or Path(__file__).resolve().parent / "data" / "job_descriptions.json"
        self.preprocessor = TextPreprocessor()
        self.semantic = SemanticAnalyzer()
        self.model_lock = Lock()
        self.jobs = self._load_jobs()
        self.job_corpus = [job["description"] for job in self.jobs]
        self.categories = sorted({job["category"] for job in self.jobs})
        self.category_corpus = {
            category: " ".join(job["description"] for job in self.jobs if job["category"] == category)
            for category in self.categories
        }
        self.pipeline = self._train_model()
        self.quality_model = CVQualityModel(self.preprocessor, self.semantic)

    def _load_jobs(self):
        with open(self.jobs_path, "r", encoding="utf-8") as file:
            return json.load(file)

    def _train_model(self):
        texts = [self.preprocessor.to_document(job["description"]) for job in self.jobs]
        labels = [job["category"] for job in self.jobs]
        pipeline = Pipeline(
            steps=[
                ("tfidf", TfidfVectorizer(max_features=5000, ngram_range=(1, 2), min_df=1)),
                ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced")),
            ]
        )
        pipeline.fit(texts, labels)
        return pipeline

    def score_text(self, text):
        document = self.preprocessor.to_document(text)
        if not document.strip():
            raise ValueError("No usable text was extracted from the CV.")

        with self.model_lock:
            probabilities = self.pipeline.predict_proba([document])[0]
            classes = self.pipeline.named_steps["classifier"].classes_

        tfidf_scores = {str(label): float(probabilities[index]) for index, label in enumerate(classes)}
        semantic_scores = self._semantic_category_scores(text)
        combined_scores = self._combine_category_scores(tfidf_scores, semantic_scores)
        category = max(combined_scores, key=combined_scores.get)
        raw_confidence = float(combined_scores[category])
        evidence_boost = self._career_evidence_boost(text, category)
        calibrated_confidence = self._calibrate_career_confidence(raw_confidence, evidence_boost)

        return {
            "predicted_category": category,
            "confidence": round(calibrated_confidence, 4),
            "raw_confidence": round(raw_confidence, 4),
            "career_evidence_boost": round(evidence_boost, 4),
            "score": max(0, min(100, int(round(calibrated_confidence * 100)))),
            "tfidf_confidence": round(tfidf_scores.get(category, 0), 4),
            "semantic_confidence": round(semantic_scores.get(category, 0), 4) if semantic_scores else None,
            "semantic_enabled": bool(semantic_scores),
            "category_scores": [
                {
                    "category": label,
                    "combined": round(float(score), 4),
                    "tfidf": round(tfidf_scores.get(label, 0), 4),
                    "semantic": round(semantic_scores.get(label, 0), 4) if semantic_scores else None,
                }
                for label, score in sorted(combined_scores.items(), key=lambda item: item[1], reverse=True)
            ],
        }

    def match_jobs(self, text, limit=5):
        cv_document = self.preprocessor.to_document(text)
        job_documents = [self.preprocessor.to_document(job["description"]) for job in self.jobs]
        documents = [cv_document] + job_documents

        if not cv_document.strip():
            return []

        vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2), min_df=1)
        matrix = vectorizer.fit_transform(documents)
        lexical_similarities = cosine_similarity(matrix[0:1], matrix[1:]).flatten()
        semantic_similarities = self.semantic.rank(text, [job["description"] for job in self.jobs])

        if semantic_similarities is not None:
            semantic_percent = np.clip(semantic_similarities * 100, 0, 100)
            lexical_percent = np.clip(lexical_similarities * 100, 0, 100)
            combined_similarities = (semantic_percent * 0.7) + (lexical_percent * 0.3)
        else:
            semantic_percent = None
            lexical_percent = np.clip(lexical_similarities * 100, 0, 100)
            combined_similarities = lexical_percent

        ranked_indexes = combined_similarities.argsort()[::-1][:limit]

        matches = []
        for index in ranked_indexes:
            job = self.jobs[index]
            semantic_value = round(float(semantic_percent[index]), 2) if semantic_percent is not None else None
            lexical_value = round(float(lexical_percent[index]), 2)
            combined_value = round(float(combined_similarities[index]), 2)
            matches.append(
                {
                    "title": job["title"],
                    "category": job["category"],
                    "similarity": combined_value,
                    "semantic_similarity": semantic_value,
                    "lexical_similarity": lexical_value,
                    "match_reasons": self._match_reasons(text, job["description"], semantic_value, lexical_value),
                    "description": job["description"],
                }
            )
        return matches

    def score_quality(self, text):
        return self.quality_model.score(text)

    def _semantic_category_scores(self, text):
        scores = self.semantic.rank(text, [self.category_corpus[category] for category in self.categories])
        if scores is None:
            return {}

        normalized = np.clip(scores, 0, 1)
        total = normalized.sum()
        if total == 0:
            return {}
        return {category: float(normalized[index] / total) for index, category in enumerate(self.categories)}

    def _combine_category_scores(self, tfidf_scores, semantic_scores):
        if not semantic_scores:
            return tfidf_scores

        combined = {}
        for category in self.categories:
            combined[category] = (tfidf_scores.get(category, 0) * 0.45) + (semantic_scores.get(category, 0) * 0.55)
        total = sum(combined.values())
        if total:
            combined = {category: score / total for category, score in combined.items()}
        return combined

    def _career_evidence_boost(self, text, category):
        cv_terms = set(self.preprocessor.preprocess_tokens(text))
        category_terms = self.preprocessor.preprocess_tokens(self.category_corpus.get(category, ""))
        important_terms = [term for term, _count in Counter(category_terms).most_common(30)]
        if not important_terms:
            return 0

        overlap = sum(1 for term in important_terms if term in cv_terms)
        overlap_ratio = overlap / len(important_terms)
        length_signal = min(len(cv_terms) / 220, 1.0)
        return min(0.18, (overlap_ratio * 0.14) + (length_signal * 0.04))

    def _calibrate_career_confidence(self, confidence, evidence_boost):
        relaxed = confidence + evidence_boost
        if confidence >= 0.30:
            relaxed += 0.08
        elif confidence >= 0.22:
            relaxed += 0.12
        else:
            relaxed += 0.16

        # Keep weak matches from looking perfect, but avoid under-scoring plausible CVs.
        return max(confidence, min(0.92, relaxed))

    def _match_reasons(self, cv_text, job_description, semantic_value, lexical_value):
        cv_tokens = set(self.preprocessor.preprocess_tokens(cv_text))
        job_tokens = self.preprocessor.preprocess_tokens(job_description)
        shared_terms = []
        for token in job_tokens:
            if token in cv_tokens and token not in shared_terms:
                shared_terms.append(token)
            if len(shared_terms) >= 6:
                break

        reasons = []
        if semantic_value is not None:
            reasons.append(f"Transformer semantic similarity: {semantic_value}%.")
        reasons.append(f"Lexical TF-IDF overlap: {lexical_value}%.")
        if shared_terms:
            reasons.append(f"Shared role vocabulary: {', '.join(shared_terms)}.")
        else:
            reasons.append("Low exact vocabulary overlap; add more role-specific evidence if this role is relevant.")
        return reasons


class CVQualityModel:
    SCORE_BY_LABEL = {
        "weak": 35,
        "average": 62,
        "strong": 88,
    }

    def __init__(self, preprocessor, semantic, training_path=None):
        self.preprocessor = preprocessor
        self.semantic = semantic
        self.training_path = training_path or Path(__file__).resolve().parent / "data" / "cv_quality_training.json"
        self.model_lock = Lock()
        self.examples = self._load_examples()
        self.pipeline = self._train_model()

    def _load_examples(self):
        with open(self.training_path, "r", encoding="utf-8") as file:
            return json.load(file)

    def _train_model(self):
        texts = [self.preprocessor.to_document(item["text"]) for item in self.examples]
        labels = [item["label"] for item in self.examples]
        pipeline = Pipeline(
            steps=[
                ("tfidf", TfidfVectorizer(max_features=3500, ngram_range=(1, 2), min_df=1)),
                ("classifier", LogisticRegression(max_iter=1000, class_weight="balanced")),
            ]
        )
        pipeline.fit(texts, labels)
        return pipeline

    def score(self, text):
        document = self.preprocessor.to_document(text)
        if not document.strip():
            raise ValueError("No usable text was extracted from the CV.")

        with self.model_lock:
            probabilities = self.pipeline.predict_proba([document])[0]
            classes = self.pipeline.named_steps["classifier"].classes_

        label_scores = {
            label: probabilities[index] * self.SCORE_BY_LABEL[label]
            for index, label in enumerate(classes)
        }
        model_score = sum(label_scores.values())
        top_index = probabilities.argmax()
        predicted_level = str(classes[top_index])
        confidence = round(float(probabilities[top_index]), 4)
        semantic_score = self._semantic_quality_score(text)

        breakdown = self._quality_breakdown(text)
        structure_score = sum(item["score"] for item in breakdown) / len(breakdown)
        if semantic_score is not None:
            final_score = int(round((model_score * 0.45) + (semantic_score * 0.25) + (structure_score * 0.30)))
        else:
            final_score = int(round((model_score * 0.65) + (structure_score * 0.35)))
        final_score = max(0, min(100, final_score))

        return {
            "cv_quality_score": final_score,
            "cv_quality_level": self._quality_level(final_score, predicted_level),
            "cv_quality_confidence": confidence,
            "cv_quality_semantic_score": round(semantic_score, 2) if semantic_score is not None else None,
            "cv_quality_breakdown": breakdown,
            "cv_quality_suggestions": self._suggestions(breakdown, final_score),
            "cv_quality_feedback": self._feedback(final_score, predicted_level, confidence, breakdown, semantic_score),
        }

    def _semantic_quality_score(self, text):
        if not self.semantic.enabled:
            return None

        label_documents = {}
        for label in self.SCORE_BY_LABEL:
            label_documents[label] = " ".join(item["text"] for item in self.examples if item["label"] == label)

        scores = self.semantic.rank(text, [label_documents[label] for label in self.SCORE_BY_LABEL])
        if scores is None:
            return None

        normalized = np.clip(scores, 0, 1)
        total = normalized.sum()
        if total == 0:
            return None
        return float(
            sum(
                (normalized[index] / total) * self.SCORE_BY_LABEL[label]
                for index, label in enumerate(self.SCORE_BY_LABEL)
            )
        )

    def _quality_breakdown(self, text):
        words = word_tokens(text)
        word_count = len(words)
        lower_text = text.lower()
        bullet_count = len(re.findall(r"(^|\n)\s*([*-]|[0-9]+[.)])\s+", text))
        metric_count = len(re.findall(r"\b\d+%?|\$\d+|\b[0-9]+x\b", text, flags=re.IGNORECASE))
        action_verbs = {
            "built",
            "created",
            "led",
            "improved",
            "reduced",
            "increased",
            "managed",
            "designed",
            "implemented",
            "deployed",
            "optimized",
            "analyzed",
            "automated",
            "delivered",
            "trained",
            "mentored",
        }
        action_count = sum(1 for word in words if word.lower().strip(".") in action_verbs)
        section_terms = ["experience", "education", "skills", "projects", "certifications", "summary"]
        section_hits = sum(1 for term in section_terms if term in lower_text)
        role_terms = ["engineer", "developer", "designer", "analyst", "manager", "specialist", "scientist", "consultant"]
        role_hits = sum(1 for term in role_terms if term in lower_text)

        return [
            {
                "name": "Completeness",
                "score": self._bounded_score(word_count, 180, 650),
                "evidence": f"{word_count} extracted words",
            },
            {
                "name": "Structure",
                "score": max(self._bounded_score(section_hits, 2, 6), self._bounded_score(bullet_count, 4, 18)),
                "evidence": f"{section_hits} recognized sections, {bullet_count} bullet-style lines",
            },
            {
                "name": "Measurable impact",
                "score": self._bounded_score(metric_count, 2, 10),
                "evidence": f"{metric_count} measurable values or numbers",
            },
            {
                "name": "Action language",
                "score": self._bounded_score(action_count, 3, 16),
                "evidence": f"{action_count} strong action verbs",
            },
            {
                "name": "Role clarity",
                "score": self._bounded_score(role_hits, 1, 5),
                "evidence": f"{role_hits} explicit role or target-title signals",
            },
        ]

    def _bounded_score(self, value, minimum, target):
        if value <= 0:
            return 15
        if value < minimum:
            return int(round(25 + (value / minimum) * 25))
        return max(50, min(100, int(round(50 + ((value - minimum) / max(1, target - minimum)) * 50))))

    def _quality_level(self, score, model_level):
        if score >= 80:
            return "Strong CV writing"
        if score >= 60:
            return "Solid CV writing"
        if score >= 40:
            return "Needs clearer evidence"
        return f"Weak CV writing signal ({model_level} model class)"

    def _suggestions(self, breakdown, score):
        suggestions = []
        low_areas = sorted(breakdown, key=lambda item: item["score"])
        for area in low_areas[:3]:
            if area["name"] == "Completeness":
                suggestions.append("Add more relevant experience detail: responsibilities, projects, tools, and outcomes.")
            elif area["name"] == "Structure":
                suggestions.append("Use clear sections such as Summary, Experience, Skills, Projects, and Education with bullet points.")
            elif area["name"] == "Measurable impact":
                suggestions.append("Add numbers where possible: percentages, users, revenue, time saved, team size, or project scale.")
            elif area["name"] == "Action language":
                suggestions.append("Start bullets with strong action verbs like built, led, improved, automated, optimized, or delivered.")
            elif area["name"] == "Role clarity":
                suggestions.append("Make the target role explicit in the summary and mirror the key skills expected for that role.")

        if score < 70:
            suggestions.append("Rewrite generic claims into evidence-based bullets: action, tool, result, and measurable impact.")
        else:
            suggestions.append("Polish the strongest bullets by moving the best quantified achievements near the top.")

        return suggestions[:4]

    def _feedback(self, score, model_level, confidence, breakdown, semantic_score):
        weakest = min(breakdown, key=lambda item: item["score"])
        strongest = max(breakdown, key=lambda item: item["score"])
        semantic_text = (
            f" Transformer semantic writing score contributed {round(semantic_score, 1)}/100."
            if semantic_score is not None
            else " Transformer semantic scoring was unavailable, so the fallback model used TF-IDF and structural checks."
        )
        return (
            f"CV writing quality score: {score} out of 100. A separate TF-IDF + Logistic Regression model classified "
            f"the writing signal as '{model_level}' with {int(round(confidence * 100))}% confidence, then combined that "
            f"prediction with semantic embeddings and structural checks.{semantic_text} Strongest area: {strongest['name']} ({strongest['score']}/100). "
            f"Main improvement area: {weakest['name']} ({weakest['score']}/100, {weakest['evidence']})."
        )
