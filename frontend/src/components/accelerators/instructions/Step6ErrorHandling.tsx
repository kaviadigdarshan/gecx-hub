import type { ErrorHandlingForm } from "@/types/instructions";

interface Props {
  data: ErrorHandlingForm | null;
  onChange: (data: ErrorHandlingForm | null) => void;
}

const DEFAULT_ERROR_HANDLING: ErrorHandlingForm = {
  fallback_response:
    "I'm sorry, I wasn't able to complete that request. Let me connect you with our support team.",
  max_retries: 2,
  retry_message:
    "I apologise for the difficulty. Let me try that one more time.",
};

export default function Step6ErrorHandling({ data, onChange }: Props) {
  const enabled = data !== null;

  const set = <K extends keyof ErrorHandlingForm>(key: K, val: ErrorHandlingForm[K]) => {
    if (!data) return;
    onChange({ ...data, [key]: val });
  };

  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5 shadow-sm space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h3 className="text-sm font-semibold text-gray-700">Error Handling</h3>
          <p className="text-xs text-gray-400 mt-0.5">
            Configure how the agent responds when it cannot fulfil a request.
          </p>
        </div>
        <label className="flex items-center gap-2 cursor-pointer shrink-0">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(e) =>
              onChange(e.target.checked ? DEFAULT_ERROR_HANDLING : null)
            }
            className="h-4 w-4 rounded border-gray-300 text-gecx-600 focus:ring-gecx-500 transition"
          />
          <span className="text-sm text-gray-600">Enable</span>
        </label>
      </div>

      {!enabled && (
        <div className="rounded-lg bg-gray-50 border border-dashed border-gray-200 p-4 text-center">
          <p className="text-sm text-gray-400">
            Error handling is disabled. The model&apos;s default behaviour will apply.
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            Enable to customise fallback responses and retry behaviour.
          </p>
        </div>
      )}

      {enabled && data && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Fallback response
            </label>
            <textarea
              value={data.fallback_response}
              onChange={(e) => set("fallback_response", e.target.value)}
              rows={3}
              placeholder="What the agent says when it cannot complete a request."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 resize-none transition"
            />
            <p className="mt-1 text-xs text-gray-400">
              Used after all retries are exhausted or when an unrecoverable error occurs.
            </p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">
              Max retries
            </label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                min={0}
                max={5}
                value={data.max_retries}
                onChange={(e) => set("max_retries", Math.max(0, Math.min(5, Number(e.target.value))))}
                className="w-24 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 transition"
              />
              <span className="text-xs text-gray-400">attempts before fallback (0–5)</span>
            </div>
          </div>

          {data.max_retries > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">
                Retry message
              </label>
              <textarea
                value={data.retry_message}
                onChange={(e) => set("retry_message", e.target.value)}
                rows={2}
                placeholder="What the agent says before attempting a retry."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 placeholder-gray-400 focus:outline-none focus:border-gecx-400 focus:ring-1 focus:ring-gecx-200 resize-none transition"
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}
