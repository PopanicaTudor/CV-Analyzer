import logging
import re
from functools import lru_cache

import nltk
from nltk.corpus import stopwords
from nltk.stem import WordNetLemmatizer
from nltk.tokenize import word_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer

logger = logging.getLogger(__name__)

NLP_RESOURCES = {
    "tokenizers/punkt": "punkt",
    "tokenizers/punkt_tab": "punkt_tab",
    "corpora/stopwords": "stopwords",
    "corpora/wordnet": "wordnet",
    "corpora/omw-1.4": "omw-1.4",
}

FALLBACK_STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "has",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "to",
    "was",
    "were",
    "with",
}

NOISE_TOKENS = {
    "com",
    "www",
    "http",
    "https",
    "html",
    "pdf",
    "doc",
    "docx",
    "file",
    "view",
    "mailto",
    "email",
    "gmail",
    "yahoo",
    "outlook",
}


def ensure_nltk_data():
    for path, package in NLP_RESOURCES.items():
        try:
            nltk.data.find(path)
        except LookupError:
            logger.info("Downloading NLTK resource: %s", package)
            nltk.download(package, quiet=True)


@lru_cache(maxsize=1)
def get_stopwords():
    try:
        ensure_nltk_data()
        return set(stopwords.words("english"))
    except LookupError:
        logger.warning("Using fallback stopword list; NLTK stopwords are unavailable.")
        return FALLBACK_STOPWORDS


class TextPreprocessor:
    def __init__(self):
        ensure_nltk_data()
        self.stop_words = get_stopwords()
        self.lemmatizer = WordNetLemmatizer()

    def tokenize(self, text):
        normalized = re.sub(r"[^A-Za-z0-9+#\s-]", " ", text.lower())
        try:
            tokens = word_tokenize(normalized)
        except LookupError:
            tokens = re.findall(r"[a-z0-9+#.]+", normalized)
        return tokens

    def preprocess_tokens(self, text):
        tokens = []
        for token in self.tokenize(text):
            token = token.strip(".-")
            if len(token) < 3 or token in self.stop_words or token in NOISE_TOKENS:
                continue
            if not re.search(r"[a-z]", token):
                continue
            try:
                token = self.lemmatizer.lemmatize(token)
            except LookupError:
                pass
            tokens.append(token)
        return tokens

    def to_document(self, text):
        return " ".join(self.preprocess_tokens(text))


def extract_keywords(text, corpus, preprocessor, limit=20):
    cv_document = preprocessor.to_document(text)
    corpus_documents = [preprocessor.to_document(item) for item in corpus if item.strip()]
    documents = [cv_document] + corpus_documents

    if not cv_document.strip():
        return []

    vectorizer = TfidfVectorizer(max_features=5000, ngram_range=(1, 2), min_df=1)
    matrix = vectorizer.fit_transform(documents)
    feature_names = vectorizer.get_feature_names_out()
    scores = matrix[0].toarray()[0]
    ranked_indexes = scores.argsort()[::-1]

    keywords = []
    seen = set()
    for index in ranked_indexes:
        score = scores[index]
        if score <= 0:
            continue
        keyword = feature_names[index]
        if keyword in seen:
            continue
        seen.add(keyword)
        keywords.append({"term": keyword, "weight": round(float(score), 4)})
        if len(keywords) >= limit:
            break

    return keywords
