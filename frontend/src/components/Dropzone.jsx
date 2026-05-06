import { FileText, UploadCloud, X } from "lucide-react";
import { useCallback, useState } from "react";

const acceptedExtensions = [".pdf", ".docx"];

function isSupported(file) {
  return acceptedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension));
}

export default function Dropzone({ file, onFile, disabled }) {
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState("");

  const chooseFile = useCallback(
    (selectedFile) => {
      if (!selectedFile) {
        return;
      }
      if (!isSupported(selectedFile)) {
        setError("Only PDF and DOCX files are supported.");
        return;
      }
      if (selectedFile.size > 10 * 1024 * 1024) {
        setError("File must be 10 MB or smaller.");
        return;
      }
      setError("");
      onFile(selectedFile);
    },
    [onFile],
  );

  return (
    <div>
      <label
        onDragEnter={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={(event) => {
          event.preventDefault();
          setDragging(false);
        }}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          chooseFile(event.dataTransfer.files?.[0]);
        }}
        className={[
          "flex min-h-[260px] cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed p-8 text-center shadow-inner transition",
          dragging
            ? "border-pink-400 bg-pink-50"
            : "border-sky-200 bg-gradient-to-br from-sky-50 via-white to-pink-50 hover:border-pink-300",
          disabled ? "pointer-events-none opacity-60" : "",
        ].join(" ")}
      >
        <input
          type="file"
          accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="sr-only"
          disabled={disabled}
          onChange={(event) => chooseFile(event.target.files?.[0])}
        />
        <div className="mb-4 rounded-full bg-gradient-to-br from-sky-400 to-pink-400 p-4 text-white shadow-soft">
          <UploadCloud size={34} />
        </div>
        <div className="text-lg font-semibold text-slate-950">Drop a CV here or click to select</div>
        <div className="mt-2 max-w-md text-sm leading-6 text-slate-600">
          PDF or DOCX, up to 10 MB. The upload starts a RabbitMQ job and the worker analyzes it in parallel threads.
        </div>
      </label>

      {file && (
        <div className="mt-4 flex items-center justify-between rounded-lg border border-sky-100 bg-white/80 p-3 shadow-sm">
          <div className="flex min-w-0 items-center gap-3">
            <FileText size={20} className="shrink-0 text-sky-700" />
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-slate-950">{file.name}</div>
              <div className="text-xs text-slate-500">{(file.size / 1024 / 1024).toFixed(2)} MB</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onFile(null)}
            aria-label="Remove selected file"
            className="focus-ring rounded-md p-2 text-slate-500 hover:bg-pink-50"
            disabled={disabled}
          >
            <X size={18} />
          </button>
        </div>
      )}

      {error && <div className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>}
    </div>
  );
}
