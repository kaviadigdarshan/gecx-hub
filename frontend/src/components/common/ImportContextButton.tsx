import { useState } from 'react';
import type { ExtractedField } from '@/types/sourceContext';
import { useAcceleratorEnrichment } from '@/hooks/useAcceleratorEnrichment';

interface ImportContextButtonProps {
  targetAccelerator: string;
  onFieldsExtracted: (fields: ExtractedField[]) => void;
}

export function ImportContextButton({
  targetAccelerator,
  onFieldsExtracted,
}: ImportContextButtonProps) {
  const [expanded, setExpanded] = useState(false);
  const [text, setText] = useState('');
  const { isExtracting, error, extractFromText } = useAcceleratorEnrichment(targetAccelerator);

  const handleExtract = async () => {
    if (!text.trim()) return;
    const fields = await extractFromText(text);
    onFieldsExtracted(fields);
  };

  if (!expanded) {
    return (
      <button
        type="button"
        onClick={() => setExpanded(true)}
        className="text-sm text-blue-600 hover:text-blue-800 underline"
      >
        Import Context
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-gray-200 bg-gray-50 p-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Paste a requirements document, SoW, or brief..."
        rows={6}
        className="w-full resize-y rounded border border-gray-300 bg-white p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
      {error && <p className="text-xs text-red-600">{error}</p>}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={handleExtract}
          disabled={isExtracting || !text.trim()}
          className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isExtracting ? 'Extracting...' : 'Extract Fields'}
        </button>
        <button
          type="button"
          onClick={() => {
            setExpanded(false);
            setText('');
          }}
          className="rounded border border-gray-300 px-3 py-1.5 text-sm text-gray-600 hover:bg-gray-100"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
