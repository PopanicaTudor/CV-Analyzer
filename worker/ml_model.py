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
        score_breakdown, career_score = self._career_score_breakdown(text, category, raw_confidence, combined_scores)

        return {
            "predicted_category": category,
            "confidence": round(career_score / 100, 4),
            "raw_confidence": round(raw_confidence, 4),
            "score": career_score,
            "score_breakdown": score_breakdown,
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
        profiles = [
            {
                "title": job["title"],
                "category": job["category"],
                "description": job["description"],
                "match_text": f"{job['title']}. {job['category']}. {job['description']}",
                "source": "market",
            }
            for job in self.jobs
        ]
        return self._match_profiles(text, profiles, limit=limit)

    def match_target_jobs(self, text, target_jobs, limit=5):
        profiles = self._target_job_profiles(target_jobs)
        if not profiles:
            return []
        return self._match_profiles(text, profiles, limit=limit, calibrate_targets=True)

    def score_quality(self, text):
        return self.quality_model.score(text)

    def _match_profiles(self, text, profiles, limit=5, calibrate_targets=False):
        cv_document = self.preprocessor.to_document(text)
        profile_documents = [self.preprocessor.to_document(profile["match_text"]) for profile in profiles]
        documents = [cv_document] + profile_documents

        if not cv_document.strip():
            return []

        vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2), min_df=1)
        matrix = vectorizer.fit_transform(documents)
        lexical_similarities = cosine_similarity(matrix[0:1], matrix[1:]).flatten()
        semantic_similarities = self.semantic.rank(text, [profile["match_text"] for profile in profiles])

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
            profile = profiles[index]
            semantic_value = round(float(semantic_percent[index]), 2) if semantic_percent is not None else None
            lexical_value = round(float(lexical_percent[index]), 2)
            raw_combined = float(combined_similarities[index])
            coverage = self._term_coverage(text, profile["match_text"])
            title_coverage = self._term_coverage(text, profile["title"], max_terms=5)
            combined_value = (
                self._calibrate_target_alignment(raw_combined, coverage["score"], title_coverage["score"])
                if calibrate_targets
                else round(raw_combined, 2)
            )
            matches.append(
                {
                    "title": profile["title"],
                    "category": profile["category"],
                    "similarity": combined_value,
                    "semantic_similarity": semantic_value,
                    "lexical_similarity": lexical_value,
                    "evidence_similarity": coverage["score"],
                    "covered_terms": coverage["covered"][:8],
                    "missing_terms": coverage["missing"][:8],
                    "alignment_verdict": self._alignment_verdict(combined_value),
                    "reference_title": profile.get("reference_title", ""),
                    "source": profile.get("source", "market"),
                    "match_reasons": self._match_reasons(
                        text,
                        profile["match_text"],
                        semantic_value,
                        lexical_value,
                        coverage["covered"],
                        coverage["missing"],
                    ),
                    "description": profile["description"],
                }
            )
        return matches

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

    def _career_score_breakdown(self, text, category, raw_confidence, combined_scores):
        cv_terms = set(self.preprocessor.preprocess_tokens(text))
        category_terms = self.preprocessor.preprocess_tokens(self.category_corpus.get(category, ""))
        important_terms = [term for term, _count in Counter(category_terms).most_common(30)]
        overlap = sum(1 for term in important_terms if term in cv_terms)
        overlap_ratio = overlap / max(1, len(important_terms))
        length_signal = min(len(cv_terms) / 260, 1.0)
        role_terms = {
            "engineer",
            "developer",
            "designer",
            "analyst",
            "scientist",
            "manager",
            "specialist",
            "consultant",
            "architect",
            "administrator",
        }
        skill_terms = {
            "python",
            "django",
            "react",
            "javascript",
            "typescript",
            "sql",
            "postgresql",
            "docker",
            "aws",
            "api",
            "testing",
            "machine",
            "learning",
            "figma",
            "analytics",
            "excel",
            "tableau",
            "power",
            "security",
            "marketing",
            "sales",
            "finance",
        }
        role_hits = sum(1 for term in role_terms if term in cv_terms)
        skill_hits = sum(1 for term in skill_terms if term in cv_terms)
        metric_count = len(
            re.findall(
                r"\b\d+(?:[.,]\d+)?\s?(?:%|users|clients|customers|projects|features|reports|dashboards|hours|weeks|months|years|x)\b|\$\s?\d+",
                text,
                flags=re.IGNORECASE,
            )
        )
        sorted_scores = sorted(combined_scores.values(), reverse=True)
        margin = sorted_scores[0] - sorted_scores[1] if len(sorted_scores) > 1 else sorted_scores[0]
        dominance = min(1.0, margin / max(sorted_scores[0], 0.001))
        confidence_signal = min(raw_confidence / 0.55, 1.0)
        skill_signal = min(skill_hits / 10, 1.0)
        role_signal = min(role_hits / 3, 1.0)
        metric_signal = min(metric_count / 6, 1.0)

        breakdown = [
            {
                "name": "Category confidence",
                "score": int(round(confidence_signal * 100)),
                "evidence": f"{int(round(raw_confidence * 100))}% top-category probability before calibration",
            },
            {
                "name": "Classifier separation",
                "score": int(round(dominance * 100)),
                "evidence": "How clearly the best category separates from the runner-up",
            },
            {
                "name": "Role vocabulary coverage",
                "score": int(round(overlap_ratio * 100)),
                "evidence": f"{overlap}/{len(important_terms)} important {category} terms detected",
            },
            {
                "name": "Explicit skill signals",
                "score": int(round(skill_signal * 100)),
                "evidence": f"{skill_hits} recognizable skill or domain terms",
            },
            {
                "name": "Target-title clarity",
                "score": int(round(role_signal * 100)),
                "evidence": f"{role_hits} explicit role-title terms",
            },
            {
                "name": "Measurable proof",
                "score": int(round(metric_signal * 100)),
                "evidence": f"{metric_count} measurable outcomes or scale signals",
            },
            {
                "name": "Document depth",
                "score": int(round(length_signal * 100)),
                "evidence": f"{len(cv_terms)} usable normalized terms",
            },
        ]

        score = (
            28
            + (confidence_signal * 22)
            + (dominance * 16)
            + (overlap_ratio * 18)
            + (skill_signal * 10)
            + (role_signal * 8)
            + (metric_signal * 8)
            + (length_signal * 8)
        )
        return breakdown, max(0, min(100, int(round(score))))

    def _target_job_profiles(self, target_jobs):
        profiles = []
        for item in target_jobs or []:
            if isinstance(item, str):
                title = self._clean_text(item)[:120]
                description = ""
            elif isinstance(item, dict):
                title = self._clean_text(item.get("title") or item.get("role") or item.get("name"))[:120]
                description = self._clean_text(item.get("description") or item.get("signals") or item.get("requirements"))[:1500]
            else:
                continue

            if not title and not description:
                continue
            if not title:
                title = description[:80].rstrip()

            reference = self._closest_reference_job(f"{title}. {description}")
            reference_description = reference["description"] if reference else ""
            match_text = self._clean_text(f"{title}. {description}. {reference_description}")
            profiles.append(
                {
                    "title": title,
                    "category": reference["category"] if reference else "User target",
                    "description": description or reference_description or title,
                    "match_text": match_text,
                    "reference_title": reference["title"] if reference else "",
                    "source": "user_target",
                }
            )
        return profiles

    def _closest_reference_job(self, query):
        query_document = self.preprocessor.to_document(query)
        if not query_document.strip():
            return None

        documents = [query_document] + [
            self.preprocessor.to_document(f"{job['title']} {job['category']} {job['description']}")
            for job in self.jobs
        ]
        vectorizer = TfidfVectorizer(max_features=3000, ngram_range=(1, 2), min_df=1)
        matrix = vectorizer.fit_transform(documents)
        scores = cosine_similarity(matrix[0:1], matrix[1:]).flatten()
        index = int(scores.argmax())
        if float(scores[index]) < 0.05:
            return None
        return self.jobs[index]

    def _term_coverage(self, cv_text, target_text, max_terms=18):
        cv_tokens = set(self.preprocessor.preprocess_tokens(cv_text))
        ranked_terms = [
            term
            for term, _count in Counter(self.preprocessor.preprocess_tokens(target_text)).most_common(max_terms)
            if len(term) >= 3
        ]
        if not ranked_terms:
            return {"score": 0, "covered": [], "missing": []}
        covered = [term for term in ranked_terms if term in cv_tokens]
        missing = [term for term in ranked_terms if term not in cv_tokens]
        score = int(round((len(covered) / len(ranked_terms)) * 100))
        return {"score": score, "covered": covered, "missing": missing}

    def _calibrate_target_alignment(self, raw_similarity, evidence_score, title_score):
        score = 18 + (raw_similarity * 0.45) + (evidence_score * 0.38) + (title_score * 0.17)
        if evidence_score >= 45:
            score += 8
        if raw_similarity >= 60:
            score += 7
        elif raw_similarity >= 40:
            score += 5
        return round(max(0, min(98, score)), 2)

    def _alignment_verdict(self, score):
        if score >= 80:
            return "Strong signal"
        if score >= 65:
            return "Good signal"
        if score >= 50:
            return "Partial signal"
        return "Weak signal"

    def _clean_text(self, value):
        return re.sub(r"\s+", " ", str(value or "")).strip()

    def _match_reasons(self, cv_text, job_description, semantic_value, lexical_value, covered_terms=None, missing_terms=None):
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
        if covered_terms:
            reasons.append(f"Evidence found for: {', '.join(covered_terms[:5])}.")
        if missing_terms:
            reasons.append(f"Missing or weak signals: {', '.join(missing_terms[:5])}.")
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
        structure_score = self._weighted_quality_score(breakdown)
        if semantic_score is not None:
            final_score = int(round((structure_score * 0.70) + (model_score * 0.20) + (semantic_score * 0.10)))
        else:
            final_score = int(round((structure_score * 0.78) + (model_score * 0.22)))
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
        metric_count = self._meaningful_metric_count(text)
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
        skill_count = self._skill_signal_count(lower_text)

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
                "score": self._bounded_score(metric_count, 2, 8),
                "evidence": f"{metric_count} meaningful metrics, scale, or outcome numbers",
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
            {
                "name": "Skill evidence",
                "score": self._bounded_score(skill_count, 4, 14),
                "evidence": f"{skill_count} concrete tool, method, or domain signals",
            },
        ]

    def _bounded_score(self, value, minimum, target):
        if value <= 0:
            return 20
        if value < minimum:
            return int(round(20 + (value / minimum) * 30))
        progress = min(1.0, (value - minimum) / max(1, target - minimum))
        return max(50, min(100, int(round(50 + (progress ** 0.7) * 50))))

    def _weighted_quality_score(self, breakdown):
        weights = {
            "Completeness": 0.16,
            "Structure": 0.17,
            "Measurable impact": 0.20,
            "Action language": 0.15,
            "Role clarity": 0.16,
            "Skill evidence": 0.16,
        }
        total_weight = sum(weights.get(item["name"], 0.1) for item in breakdown)
        if total_weight == 0:
            return sum(item["score"] for item in breakdown) / max(1, len(breakdown))
        return sum(item["score"] * weights.get(item["name"], 0.1) for item in breakdown) / total_weight

    def _meaningful_metric_count(self, text):
        patterns = [
            r"\b\d+(?:[.,]\d+)?\s?%",
            r"\b\d+(?:[.,]\d+)?\s?(?:users|clients|customers|projects|features|tickets|reports|dashboards|models|pages|hours|days|weeks|months|years)\b",
            r"\b(?:reduced|increased|improved|saved|grew|optimized|delivered|decreased|raised)\b[^.\n]{0,70}\b\d+(?:[.,]\d+)?\b",
            r"\$\s?\d+(?:[.,]\d+)?[kKmM]?",
            r"\b\d+(?:[.,]\d+)?x\b",
        ]
        matches = []
        for pattern in patterns:
            for match in re.finditer(pattern, text, flags=re.IGNORECASE):
                value = re.sub(r"\s+", " ", match.group()).strip().lower()
                if value not in matches:
                    matches.append(value)
        return len(matches)

    def _skill_signal_count(self, lower_text):
        skill_terms = [
            "python",
            "django",
            "flask",
            "fastapi",
            "react",
            "javascript",
            "typescript",
            "node",
            "sql",
            "postgresql",
            "mysql",
            "mongodb",
            "docker",
            "kubernetes",
            "aws",
            "azure",
            "git",
            "api",
            "testing",
            "machine learning",
            "nlp",
            "pandas",
            "numpy",
            "figma",
            "analytics",
            "excel",
            "tableau",
            "power bi",
            "seo",
            "crm",
            "accounting",
            "recruitment",
            "cybersecurity",
        ]
        count = 0
        for term in skill_terms:
            pattern = re.escape(term).replace(r"\ ", r"[\s/_-]+")
            if re.search(rf"(?<![a-z0-9+#.-]){pattern}(?![a-z0-9+#.-])", lower_text):
                count += 1
        return count

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
            elif area["name"] == "Skill evidence":
                suggestions.append("Name concrete tools, methods, domains, or platforms and connect them to real work.")

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
