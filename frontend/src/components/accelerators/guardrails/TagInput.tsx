import { useState, useRef, KeyboardEvent, ClipboardEvent } from "react";
import { X } from "lucide-react";

interface TagInputProps {
  value: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
  maxItems?: number;
  disabled?: boolean;
}

export default function TagInput({
  value,
  onChange,
  placeholder = "Type and press Enter…",
  maxItems = 50,
  disabled = false,
}: TagInputProps) {
  const [input, setInput] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const addTags = (raw: string) => {
    const newTags = raw
      .split(/[,\n]+/)
      .map((t) => t.trim())
      .filter((t) => t.length > 0 && !value.includes(t));
    if (newTags.length > 0) {
      onChange([...value, ...newTags].slice(0, maxItems));
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === "Enter" || e.key === ",") && input.trim()) {
      e.preventDefault();
      addTags(input);
      setInput("");
    } else if (e.key === "Backspace" && !input && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault();
    addTags(e.clipboardData.getData("text"));
    setInput("");
  };

  const removeTag = (idx: number) => {
    onChange(value.filter((_, i) => i !== idx));
  };

  const atLimit = value.length >= maxItems;

  return (
    <div
      className="flex flex-wrap gap-1.5 min-h-[42px] p-2 rounded-lg border border-gray-200 bg-white focus-within:border-gecx-400 focus-within:ring-1 focus-within:ring-gecx-200 transition cursor-text"
      onClick={() => inputRef.current?.focus()}
    >
      {value.map((tag, i) => (
        <span
          key={i}
          className="flex items-center gap-1 bg-gecx-100 text-gecx-700 text-xs font-medium px-2 py-0.5 rounded-full"
        >
          {tag}
          {!disabled && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); removeTag(i); }}
              className="text-gecx-400 hover:text-gecx-700 transition"
            >
              <X size={11} />
            </button>
          )}
        </span>
      ))}

      {!disabled && !atLimit && (
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={value.length === 0 ? placeholder : ""}
          className="flex-1 min-w-[120px] outline-none text-sm text-gray-700 bg-transparent placeholder-gray-400"
        />
      )}

      {atLimit && (
        <span className="text-xs text-gray-400 self-center ml-1">
          Max {maxItems} items
        </span>
      )}
    </div>
  );
}
