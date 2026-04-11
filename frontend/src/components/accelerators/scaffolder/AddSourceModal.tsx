import { useState, useRef } from 'react';
import type { SourceExtractionRequest, SourceExtractionSuccess } from '@/types/source_extraction';
import { extractContext } from '@/services/api';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onExtracted: (data: SourceExtractionSuccess) => void;
}

type Mode = 'choose' | 'upload' | 'paste';

export function AddSourceModal({ isOpen, onClose, onExtracted }: Props) {
  const [mode, setMode] = useState<Mode>('choose');
  const [pastedText, setPastedText] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const resetModal = () => {
    setMode('choose');
    setPastedText('');
    setSelectedFile(null);
    setLoading(false);
    setErrorMessage(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    setSelectedFile(file);
    setErrorMessage(null);
  };

  const readFileAsBase64 = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // result is "data:<mime>;base64,<data>" — strip the prefix
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
    });

  const handleExtract = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      let payload: SourceExtractionRequest;

      if (mode === 'upload' && selectedFile) {
        const base64 = await readFileAsBase64(selectedFile);
        payload = {
          input_type: 'file_upload',
          filename: selectedFile.name,
          file_content_base64: base64,
        };
      } else if (mode === 'paste') {
        payload = {
          input_type: 'clipboard_text',
          text_content: pastedText,
        };
      } else {
        return;
      }

      const response = await extractContext(payload);

      if (response.success && response.data) {
        onExtracted(response.data);
        handleClose();
      } else {
        setErrorMessage(response.error?.message ?? 'Extraction failed. Please try again.');
      }
    } catch {
      setErrorMessage('An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const canExtract =
    (mode === 'upload' && selectedFile !== null) ||
    (mode === 'paste' && pastedText.trim().length >= 50);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold text-gray-900">Add Source</h2>
          <button
            onClick={handleClose}
            className="text-gray-400 hover:text-gray-600 transition text-xl leading-none"
            aria-label="Close"
          >
            ×
          </button>
        </div>

        {/* Error alert */}
        {errorMessage && (
          <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {errorMessage}
          </div>
        )}

        {/* Loading overlay */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-3">
            <div className="h-8 w-8 animate-spin rounded-full border-4 border-gecx-600 border-t-transparent" />
            <span className="text-sm text-gray-500">Extracting context…</span>
          </div>
        )}

        {/* Screen 1: Choose mode */}
        {!loading && mode === 'choose' && (
          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => setMode('upload')}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-gray-200 p-5 text-center hover:border-gecx-400 hover:bg-gecx-50 transition"
            >
              <span className="text-3xl">📄</span>
              <span className="text-sm font-medium text-gray-800">Upload PDF or text file</span>
              <span className="text-xs text-gray-500">Supports .pdf, .txt, .md</span>
            </button>
            <button
              onClick={() => setMode('paste')}
              className="flex flex-col items-center gap-3 rounded-xl border-2 border-gray-200 p-5 text-center hover:border-gecx-400 hover:bg-gecx-50 transition"
            >
              <span className="text-3xl">📋</span>
              <span className="text-sm font-medium text-gray-800">Paste copied content</span>
              <span className="text-xs text-gray-500">BRD, spec, or any text</span>
            </button>
          </div>
        )}

        {/* Screen 2: Upload */}
        {!loading && mode === 'upload' && (
          <div className="flex flex-col gap-4">
            <div
              className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-gray-300 p-8 cursor-pointer hover:border-gecx-400 transition"
              onClick={() => fileInputRef.current?.click()}
            >
              <span className="text-3xl">📁</span>
              {selectedFile ? (
                <span className="text-sm font-medium text-gecx-700">{selectedFile.name}</span>
              ) : (
                <>
                  <span className="text-sm text-gray-600">Click to choose a file</span>
                  <span className="text-xs text-gray-400">.pdf, .txt, .md</span>
                </>
              )}
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.txt,.md,.text"
              className="hidden"
              onChange={handleFileChange}
            />
            <div className="flex items-center justify-between">
              <button
                onClick={() => { setMode('choose'); setSelectedFile(null); setErrorMessage(null); }}
                className="text-sm text-gray-500 hover:text-gray-700 transition"
              >
                ← Back
              </button>
              <button
                onClick={handleExtract}
                disabled={!canExtract}
                className="px-4 py-2 rounded-lg bg-gecx-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gecx-700 transition"
              >
                Extract Context
              </button>
            </div>
          </div>
        )}

        {/* Screen 3: Paste */}
        {!loading && mode === 'paste' && (
          <div className="flex flex-col gap-4">
            <textarea
              className="w-full rounded-lg border border-gray-300 p-3 text-sm text-gray-800 resize-none focus:outline-none focus:ring-2 focus:ring-gecx-400"
              rows={8}
              placeholder="Paste your BRD, requirements doc, or any text here…"
              value={pastedText}
              onChange={(e) => setPastedText(e.target.value)}
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => { setMode('choose'); setPastedText(''); setErrorMessage(null); }}
                  className="text-sm text-gray-500 hover:text-gray-700 transition"
                >
                  ← Back
                </button>
                <span className="text-xs text-gray-400">{pastedText.length} chars</span>
              </div>
              <button
                onClick={handleExtract}
                disabled={!canExtract}
                className="px-4 py-2 rounded-lg bg-gecx-600 text-white text-sm font-medium disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gecx-700 transition"
              >
                Extract Context
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
