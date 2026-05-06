import logging
from collections import Counter
import threading
from pathlib import Path

import pdfplumber
from docx import Document

from .ml_model import CareerModel
from .nlp_pipeline import extract_keywords
from .text_utils import build_text_stats, count_words, normalize_extracted_text

logger = logging.getLogger(__name__)


class WorkerProcessingError(RuntimeError):
    pass


class CVProcessor:
    def __init__(self):
        self.career_model = CareerModel()

    def process(self, cv_id, file_path, user_id):
        aggregate = {
            "cv_id": cv_id,
            "user_id": user_id,
            "extracted_text": "",
            "keywords": [],
            "ml": {},
            "quality": {},
            "job_matches": [],
            "text_stats": {},
        }
        errors = []
        lock = threading.Lock()
        text_ready = threading.Event()
        barrier = threading.Barrier(4)

        def add_error(stage, exc):
            logger.exception("%s failed for CV %s", stage, cv_id)
            with lock:
                errors.append(f"{stage}: {exc}")

        def has_errors():
            with lock:
                return bool(errors)

        def wait_for_siblings():
            try:
                barrier.wait(timeout=120)
            except threading.BrokenBarrierError:
                logger.error("Processing barrier broke for CV %s", cv_id)

        def get_text():
            with lock:
                return aggregate["extracted_text"]

        def extract_thread():
            try:
                text, extraction_method = self.extract_text(file_path)
                if not text.strip():
                    raise WorkerProcessingError("No readable text was found in the uploaded file.")
                text_stats = build_text_stats(text, extraction_method)
                with lock:
                    aggregate["extracted_text"] = text
                    aggregate["text_stats"] = text_stats
            except Exception as exc:
                add_error("text extraction", exc)
            finally:
                text_ready.set()
                wait_for_siblings()

        def keyword_thread():
            text_ready.wait()
            try:
                if not has_errors():
                    keywords = extract_keywords(
                        get_text(),
                        self.career_model.job_corpus,
                        self.career_model.preprocessor,
                    )
                    with lock:
                        aggregate["keywords"] = keywords
            except Exception as exc:
                add_error("keyword extraction", exc)
            finally:
                wait_for_siblings()

        def scoring_thread():
            text_ready.wait()
            try:
                if not has_errors():
                    ml_result = self.career_model.score_text(get_text())
                    quality_result = self.career_model.score_quality(get_text())
                    with lock:
                        aggregate["ml"] = ml_result
                        aggregate["quality"] = quality_result
            except Exception as exc:
                add_error("ML scoring", exc)
            finally:
                wait_for_siblings()

        def matching_thread():
            text_ready.wait()
            try:
                if not has_errors():
                    matches = self.career_model.match_jobs(get_text())
                    with lock:
                        aggregate["job_matches"] = matches
            except Exception as exc:
                add_error("job matching", exc)
            finally:
                wait_for_siblings()

        threads = [
            threading.Thread(target=extract_thread, name=f"cv-{cv_id}-extract"),
            threading.Thread(target=keyword_thread, name=f"cv-{cv_id}-keywords"),
            threading.Thread(target=scoring_thread, name=f"cv-{cv_id}-ml-score"),
            threading.Thread(target=matching_thread, name=f"cv-{cv_id}-job-match"),
        ]

        for thread in threads:
            thread.start()
        for thread in threads:
            thread.join()

        with lock:
            if errors:
                raise WorkerProcessingError("; ".join(errors))
            ml = aggregate["ml"]
            quality = aggregate["quality"]
            matches = aggregate["job_matches"]
            keywords = aggregate["keywords"]
            extracted_text = aggregate["extracted_text"]
            text_stats = aggregate["text_stats"]
        insights = self.build_extended_insights(extracted_text, ml, quality, keywords, matches)

        return {
            "score": ml["score"],
            "predicted_category": ml["predicted_category"],
            "feedback": self.build_feedback(ml, keywords, matches),
            "cv_quality_score": quality["cv_quality_score"],
            "cv_quality_level": quality["cv_quality_level"],
            "cv_quality_feedback": quality["cv_quality_feedback"],
            "cv_quality_suggestions": quality["cv_quality_suggestions"],
            "cv_quality_breakdown": quality["cv_quality_breakdown"],
            "analysis_summary": insights["analysis_summary"],
            "strengths": insights["strengths"],
            "missing_keywords": insights["missing_keywords"],
            "career_path": insights["career_path"],
            "improvement_plan": insights["improvement_plan"],
            "rewrite_examples": insights["rewrite_examples"],
            "keywords": keywords,
            "job_matches": matches,
            "extracted_text": extracted_text,
            "text_stats": text_stats,
        }

    def extract_text(self, file_path):
        path = Path(file_path)
        suffix = path.suffix.lower()
        if suffix == ".pdf":
            return self._extract_pdf(path)
        if suffix == ".docx":
            return self._extract_docx(path)
        raise WorkerProcessingError("Unsupported CV file type.")

    def _extract_pdf(self, path):
        pages = []
        methods = []
        with pdfplumber.open(path) as pdf:
            for page in pdf.pages:
                text, method = self._extract_pdf_page(page)
                if text:
                    pages.append(text)
                    methods.append(method)
        method = self._most_common_method(methods, "pdf-empty")
        return normalize_extracted_text("\n\n".join(pages)), method

    def _extract_pdf_page(self, page):
        candidates = []

        plain_text = page.extract_text() or ""
        candidates.append(("pdf-text", plain_text))

        try:
            layout_text = page.extract_text(layout=True, x_tolerance=1, y_tolerance=3) or ""
            candidates.append(("pdf-layout", layout_text))
        except TypeError:
            logger.debug("pdfplumber layout extraction is unavailable for this page.")

        words_by_position = page.extract_words(x_tolerance=1, y_tolerance=3, keep_blank_chars=False)
        candidates.append(("pdf-words-position", self._pdf_words_to_lines(words_by_position)))

        words_by_flow = page.extract_words(use_text_flow=True, keep_blank_chars=False)
        candidates.append(("pdf-words-flow", " ".join(word.get("text", "") for word in words_by_flow)))

        return self._best_text_candidate(candidates)

    def _extract_docx(self, path):
        document = Document(path)
        blocks = []
        self._append_docx_paragraphs(blocks, document.paragraphs)
        self._append_docx_tables(blocks, document.tables)

        for section in document.sections:
            self._append_docx_paragraphs(blocks, section.header.paragraphs)
            self._append_docx_tables(blocks, section.header.tables)
            self._append_docx_paragraphs(blocks, section.footer.paragraphs)
            self._append_docx_tables(blocks, section.footer.tables)

        structured_text = "\n".join(blocks)
        xml_text = self._extract_docx_xml_text(document)
        text, method = self._best_text_candidate(
            [
                ("docx-structured", structured_text),
                ("docx-xml", xml_text),
            ]
        )
        return normalize_extracted_text(text), method

    def _append_docx_paragraphs(self, blocks, paragraphs):
        for paragraph in paragraphs:
            text = normalize_extracted_text(paragraph.text)
            if text:
                blocks.append(text)

    def _append_docx_tables(self, blocks, tables):
        for table in tables:
            for row in table.rows:
                cells = [normalize_extracted_text(cell.text) for cell in row.cells if cell.text.strip()]
                if cells:
                    blocks.append(" | ".join(cells))

    def _extract_docx_xml_text(self, document):
        elements = [document.element]
        for section in document.sections:
            elements.append(section.header._element)
            elements.append(section.footer._element)

        blocks = []
        for element in elements:
            for paragraph in element.iter():
                if paragraph.tag.rsplit("}", 1)[-1] != "p":
                    continue

                pieces = []
                for node in paragraph.iter():
                    tag = node.tag.rsplit("}", 1)[-1]
                    if tag in {"t", "instrText"} and node.text:
                        pieces.append(node.text)
                    elif tag == "tab":
                        pieces.append(" ")
                    elif tag == "br":
                        pieces.append("\n")

                text = normalize_extracted_text("".join(pieces))
                if text:
                    blocks.append(text)
        return "\n".join(blocks)

    def _pdf_words_to_lines(self, words, y_tolerance=3):
        if not words:
            return ""

        sorted_words = sorted(words, key=lambda word: (float(word.get("top", 0)), float(word.get("x0", 0))))
        lines = []
        current_line = []
        current_top = None

        for word in sorted_words:
            top = float(word.get("top", 0))
            if current_top is None or abs(top - current_top) <= y_tolerance:
                current_line.append(word)
                current_top = top if current_top is None else current_top
                continue

            lines.append(self._join_pdf_line(current_line))
            current_line = [word]
            current_top = top

        if current_line:
            lines.append(self._join_pdf_line(current_line))

        return "\n".join(line for line in lines if line)

    def _join_pdf_line(self, words):
        return " ".join(word.get("text", "") for word in sorted(words, key=lambda item: float(item.get("x0", 0))))

    def _best_text_candidate(self, candidates):
        normalized_candidates = [
            (method, normalize_extracted_text(text), count_words(text))
            for method, text in candidates
            if text and normalize_extracted_text(text)
        ]
        if not normalized_candidates:
            return "", "empty"

        method, text, _word_count = max(normalized_candidates, key=lambda item: (item[2], len(item[1])))
        return text, method

    def _most_common_method(self, methods, fallback):
        if not methods:
            return fallback
        return Counter(methods).most_common(1)[0][0]

    def build_feedback(self, ml, keywords, matches):
        top_keywords = ", ".join(item["term"] for item in keywords[:8]) or "no dominant keywords"
        best_match = matches[0] if matches else None
        match_text = (
            f"The closest role match is {best_match['title']} with {best_match['similarity']}% similarity."
            if best_match
            else "No close role match was found."
        )
        return (
            f"Score: {ml['score']} out of 100. This score is the model's confidence that the CV clearly fits "
            f"one of the trained career categories. Predicted category: {ml['predicted_category']} "
            f"with {int(round(ml['confidence'] * 100))}% category confidence. "
            f"The strongest TF-IDF keywords found in the CV are: {top_keywords}. {match_text} "
            "For a stronger score, make the target role explicit, repeat important role-specific tools naturally, "
            "and add measurable achievements that connect experience to the predicted category."
        )

    def build_extended_insights(self, text, ml, quality, keywords, matches):
        top_keywords = [item["term"] for item in keywords[:10]]
        best_match = matches[0] if matches else None
        missing_keywords = self.find_missing_keywords(text, best_match, top_keywords)
        strengths = self.detect_strengths(quality, keywords, matches)
        career_path = self.build_career_path(ml, quality, matches, missing_keywords)
        improvement_plan = self.build_improvement_plan(quality, missing_keywords, best_match)
        rewrite_examples = self.build_rewrite_examples(ml, missing_keywords, best_match)

        best_match_text = (
            f" The closest specific job profile is {best_match['title']} at {best_match['similarity']}% similarity."
            if best_match
            else ""
        )
        analysis_summary = (
            f"The analysis separates career direction from CV-writing quality. Career fit is {ml['score']}/100 for "
            f"{ml['predicted_category']}, while CV writing quality is {quality['cv_quality_score']}/100. "
            f"The strongest visible signals are {', '.join(top_keywords[:5]) or 'not yet clear'}.{best_match_text} "
            "The best next move is to strengthen the weakest writing-quality areas and add missing role vocabulary naturally."
        )

        return {
            "analysis_summary": analysis_summary,
            "strengths": strengths,
            "missing_keywords": missing_keywords,
            "career_path": career_path,
            "improvement_plan": improvement_plan,
            "rewrite_examples": rewrite_examples,
        }

    def find_missing_keywords(self, text, best_match, existing_keywords):
        if not best_match:
            return []

        cv_terms = set(self.career_model.preprocessor.preprocess_tokens(text))
        existing_terms = set()
        for keyword in existing_keywords:
            existing_terms.update(keyword.split())

        job_terms = self.career_model.preprocessor.preprocess_tokens(best_match["description"])
        ranked_terms = Counter(job_terms).most_common()
        missing = []
        for term, frequency in ranked_terms:
            if term in cv_terms or term in existing_terms:
                continue
            if len(term) < 4:
                continue
            missing.append(
                {
                    "term": term,
                    "reason": f"Appears in the closest job profile ({best_match['title']}) but is not prominent in the CV.",
                    "priority": "high" if frequency > 1 else "medium",
                }
            )
            if len(missing) >= 8:
                break
        return missing

    def detect_strengths(self, quality, keywords, matches):
        strengths = []
        top_quality_areas = sorted(quality["cv_quality_breakdown"], key=lambda item: item["score"], reverse=True)[:2]
        for area in top_quality_areas:
            strengths.append(
                {
                    "title": area["name"],
                    "detail": f"{area['score']}/100 based on {area['evidence']}.",
                }
            )

        if keywords:
            strengths.append(
                {
                    "title": "Recognizable keyword signal",
                    "detail": f"Top extracted terms include {', '.join(item['term'] for item in keywords[:5])}.",
                }
            )

        if matches:
            strengths.append(
                {
                    "title": "Closest market direction",
                    "detail": f"{matches[0]['title']} is the closest role profile at {matches[0]['similarity']}% similarity.",
                }
            )
        return strengths[:5]

    def build_career_path(self, ml, quality, matches, missing_keywords):
        target_role = matches[0]["title"] if matches else f"{ml['predicted_category']} role"
        second_role = matches[1]["title"] if len(matches) > 1 else "adjacent role"
        missing_terms = ", ".join(item["term"] for item in missing_keywords[:4]) or "the most important target-role tools"
        quality_focus = min(quality["cv_quality_breakdown"], key=lambda item: item["score"])

        return [
            {
                "stage": "Now",
                "title": f"Position the CV toward {target_role}",
                "detail": f"Make the profile headline and first experience bullets clearly support {ml['predicted_category']}.",
            },
            {
                "stage": "Next 2 weeks",
                "title": "Close vocabulary gaps",
                "detail": f"Add honest, experience-backed references to {missing_terms}. Do not keyword-stuff; connect each term to a project or responsibility.",
            },
            {
                "stage": "Next project",
                "title": "Create proof for the target role",
                "detail": f"Add one portfolio or work project that demonstrates the responsibilities expected from a {target_role}.",
            },
            {
                "stage": "Interview positioning",
                "title": f"Prepare a bridge story for {second_role}",
                "detail": f"Use the CV to explain why your strongest experience transfers into {target_role} and nearby roles such as {second_role}.",
            },
            {
                "stage": "CV polish",
                "title": f"Improve {quality_focus['name'].lower()}",
                "detail": f"This is currently the weakest writing area: {quality_focus['evidence']}. Improving it should lift the writing-quality mark.",
            },
        ]

    def build_improvement_plan(self, quality, missing_keywords, best_match):
        plan = []
        low_areas = sorted(quality["cv_quality_breakdown"], key=lambda item: item["score"])[:3]
        for area in low_areas:
            plan.append(
                {
                    "priority": "High" if area["score"] < 55 else "Medium",
                    "title": f"Improve {area['name'].lower()}",
                    "detail": self.improvement_detail(area),
                }
            )

        if missing_keywords:
            terms = ", ".join(item["term"] for item in missing_keywords[:5])
            role = best_match["title"] if best_match else "the target role"
            plan.append(
                {
                    "priority": "High",
                    "title": "Add missing role signals",
                    "detail": f"For {role}, the CV should naturally prove experience with: {terms}.",
                }
            )

        plan.append(
            {
                "priority": "Medium",
                "title": "Move strongest evidence upward",
                "detail": "Put the strongest quantified achievements in the summary or first two experience bullets so they are visible immediately.",
            }
        )
        return plan[:5]

    def improvement_detail(self, area):
        if area["name"] == "Completeness":
            return "Expand short roles with scope, tools, project context, and outcome. Aim for enough detail that a recruiter can understand what you owned."
        if area["name"] == "Structure":
            return "Use consistent headings and bullet points. Keep each bullet to one idea: action, tool, result."
        if area["name"] == "Measurable impact":
            return "Add numbers such as percentages, time saved, users served, budget, team size, or frequency."
        if area["name"] == "Action language":
            return "Start bullets with verbs such as built, led, improved, automated, optimized, analyzed, or delivered."
        if area["name"] == "Role clarity":
            return "Add a headline or summary that names the target role and mirrors the most relevant skills."
        return "Add clearer evidence and reduce generic wording."

    def build_rewrite_examples(self, ml, missing_keywords, best_match):
        role = best_match["title"] if best_match else f"{ml['predicted_category']} role"
        terms = [item["term"] for item in missing_keywords[:3]]
        term_text = ", ".join(terms) if terms else "the relevant tools"
        return [
            {
                "before": "Responsible for different tasks and helping the team.",
                "after": f"Delivered {role.lower()} responsibilities by owning a defined project, using {term_text}, and reporting the measurable outcome.",
            },
            {
                "before": "Worked on applications and fixed issues.",
                "after": "Improved application reliability by identifying recurring issues, implementing fixes, and documenting the result with before/after metrics.",
            },
            {
                "before": "Good communication and teamwork skills.",
                "after": "Coordinated with product, design, and technical stakeholders to clarify requirements, remove blockers, and deliver a documented project milestone.",
            },
        ]
