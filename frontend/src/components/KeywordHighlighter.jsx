import { memo, useMemo, useState } from "react";

const PREVIEW_LIMIT = 8000;

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function KeywordHighlighter({ text = "", keywords = [] }) {
  const [expanded, setExpanded] = useState(false);
  const displayText = expanded ? text : text.slice(0, PREVIEW_LIMIT);
  const isTruncated = text.length > PREVIEW_LIMIT;

  const terms = useMemo(
    () =>
      keywords
        .map((item) => item.term)
        .filter(Boolean)
        .sort((a, b) => b.length - a.length)
        .slice(0, 20),
    [keywords],
  );
  const parts = useMemo(() => {
    if (!terms.length) {
      return [displayText];
    }
    const pattern = new RegExp(`\\b(${terms.map(escapeRegExp).join("|")})\\b`, "gi");
    return displayText.split(pattern);
  }, [displayText, terms]);
  const termSet = useMemo(() => new Set(terms.map((term) => term.toLowerCase())), [terms]);

  if (!text) {
    return <div className="text-sm text-slate-500">No extracted text available.</div>;
  }

  if (!terms.length) {
    return (
      <TextFrame isTruncated={isTruncated} expanded={expanded} onToggle={() => setExpanded((value) => !value)}>
        {displayText}
      </TextFrame>
    );
  }

  return (
    <TextFrame isTruncated={isTruncated} expanded={expanded} onToggle={() => setExpanded((value) => !value)}>
      {parts.map((part, index) =>
        termSet.has(part.toLowerCase()) ? (
          <mark key={`${part}-${index}`} className="rounded bg-pink-100 px-1 text-pink-950 ring-1 ring-pink-200">
            {part}
          </mark>
        ) : (
          part
        ),
      )}
    </TextFrame>
  );
}

function TextFrame({ children, isTruncated, expanded, onToggle }) {
  return (
    <div>
      <pre className="whitespace-pre-wrap break-words text-sm leading-6 text-slate-700">{children}</pre>
      {isTruncated && (
        <button type="button" onClick={onToggle} className="focus-ring mt-4 rounded-md bg-sky-50 px-3 py-2 text-sm font-semibold text-sky-800 ring-1 ring-sky-100">
          {expanded ? "Show optimized preview" : "Show full extracted text"}
        </button>
      )}
    </div>
  );
}

export default memo(KeywordHighlighter);
