import { useState, useRef, useCallback, useEffect } from "react";
import { Braces, X } from "lucide-react";
import type { VariableDeclaration } from "@/types/scaffoldContext";

interface Props {
  value: string;
  onChange: (value: string) => void;
  variableDeclarations: VariableDeclaration[];
  rows?: number;
  placeholder?: string;
  className?: string;
}

export function VariablePickerTextarea({
  value,
  onChange,
  variableDeclarations,
  rows = 3,
  placeholder,
  className = "",
}: Props) {
  const [open, setOpen] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handleOutsideClick = (e: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [open]);

  const insertVariable = useCallback(
    (varName: string) => {
      const el = textareaRef.current;
      if (!el) return;
      const start = el.selectionStart ?? value.length;
      const end = el.selectionEnd ?? value.length;
      const insertion = `{${varName}}`;
      const newValue = value.slice(0, start) + insertion + value.slice(end);
      onChange(newValue);
      // Restore cursor after the inserted variable
      requestAnimationFrame(() => {
        el.focus();
        el.selectionStart = start + insertion.length;
        el.selectionEnd = start + insertion.length;
      });
      setOpen(false);
    },
    [value, onChange]
  );

  return (
    <div className="relative">
      {/* Toolbar row */}
      <div className="flex justify-end mb-1">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 border border-blue-200 transition"
          title="Insert a session variable"
        >
          <Braces size={11} />
          Variables
        </button>
      </div>

      {/* Textarea */}
      <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={rows}
        placeholder={placeholder}
        className={`w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 resize-none transition ${className}`}
      />

      {/* Variable picker popover */}
      {open && (
        <div
          ref={pickerRef}
          className="absolute right-0 top-7 z-20 w-72 bg-white border border-gray-200 rounded-xl shadow-lg overflow-hidden"
        >
          <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
            <span className="text-xs font-semibold text-gray-600">Session Variables</span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="text-gray-400 hover:text-gray-600 transition"
            >
              <X size={13} />
            </button>
          </div>

          {variableDeclarations.length === 0 ? (
            <p className="px-3 py-4 text-xs text-gray-400 italic">
              No session variables declared — add them in the Scaffolder (Step 1)
            </p>
          ) : (
            <ul className="max-h-52 overflow-y-auto py-1">
              {variableDeclarations.map((v) => (
                <li key={v.name}>
                  <button
                    type="button"
                    onClick={() => insertVariable(v.name)}
                    title={v.description ?? v.name}
                    className="w-full flex items-start gap-2 px-3 py-2 text-left hover:bg-blue-50 transition"
                  >
                    <code className="shrink-0 font-mono text-[11px] bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded border border-blue-100 leading-snug">
                      {`{${v.name}}`}
                    </code>
                    <div className="min-w-0 flex-1">
                      <span className="block text-[10px] text-gray-400 uppercase tracking-wide leading-tight">
                        {v.type}
                      </span>
                      {v.description && (
                        <p className="text-xs text-gray-500 truncate">{v.description}</p>
                      )}
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
