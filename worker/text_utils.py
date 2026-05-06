import re
import unicodedata


WORD_PATTERN = re.compile(r"(?u)[^\W\d_][\w+#'`.-]*")
PROTECTED_MIXED_CASE_TERMS = (
    "JavaScript",
    "TypeScript",
    "GitHub",
    "LinkedIn",
    "PostgreSQL",
    "MySQL",
    "MongoDB",
    "Node.js",
    "Next.js",
    "ReactJS",
    "PowerBI",
    "GraphQL",
    "TensorFlow",
    "PyTorch",
    "FastAPI",
    "OpenAI",
)


def normalize_extracted_text(text):
    if not text:
        return ""

    normalized = unicodedata.normalize("NFKC", text)
    normalized = normalized.replace("\r\n", "\n").replace("\r", "\n")
    normalized = re.sub(r"[\u00a0\u2007\u202f]", " ", normalized)
    normalized = re.sub(r"[\u200b-\u200d\ufeff]", "", normalized)
    normalized, protected_terms = protect_mixed_case_terms(normalized)
    normalized = re.sub(r"([a-z])([A-Z][a-z])", r"\1 \2", normalized)
    normalized = restore_mixed_case_terms(normalized, protected_terms)
    normalized = re.sub(r"([A-Za-z])(\d)", r"\1 \2", normalized)
    normalized = re.sub(r"(\d)([A-Za-z])", r"\1 \2", normalized)
    normalized = re.sub(r"[ \t]+", " ", normalized)
    normalized = re.sub(r"\n[ \t]+", "\n", normalized)
    normalized = re.sub(r"\n{3,}", "\n\n", normalized)
    return normalized.strip()


def protect_mixed_case_terms(text):
    protected_terms = {}
    protected = text
    for index, term in enumerate(PROTECTED_MIXED_CASE_TERMS):
        placeholder = f"cvprotectedtoken{index}"
        pattern = re.compile(re.escape(term), flags=re.IGNORECASE)
        if pattern.search(protected):
            protected = pattern.sub(placeholder, protected)
            protected_terms[placeholder] = term
    return protected, protected_terms


def restore_mixed_case_terms(text, protected_terms):
    restored = text
    for placeholder, term in protected_terms.items():
        restored = restored.replace(placeholder, term)
    return restored


def word_tokens(text):
    tokens = []
    for match in WORD_PATTERN.finditer(normalize_extracted_text(text)):
        token = match.group().strip("._-'`+#")
        if token and any(character.isalpha() for character in token):
            tokens.append(token)
    return tokens


def count_words(text):
    return len(word_tokens(text))


def build_text_stats(text, extraction_method="unknown"):
    normalized = normalize_extracted_text(text)
    non_empty_lines = [line for line in normalized.splitlines() if line.strip()]
    return {
        "word_count": count_words(normalized),
        "character_count": len(normalized),
        "line_count": len(non_empty_lines),
        "extraction_method": extraction_method,
    }
