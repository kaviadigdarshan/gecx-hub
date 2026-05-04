interface AIFieldBadgeProps {
  confidence: 'high' | 'medium' | 'low';
  onDismiss: () => void;
}

const CONFIDENCE_CONFIG: Record<
  AIFieldBadgeProps['confidence'],
  { pct: number; classes: string }
> = {
  high:   { pct: 92, classes: 'bg-green-100 text-green-800 border-green-200' },
  medium: { pct: 70, classes: 'bg-amber-100 text-amber-800 border-amber-200' },
  low:    { pct: 45, classes: 'bg-red-100 text-red-800 border-red-200' },
};

export function AIFieldBadge({ confidence, onDismiss }: AIFieldBadgeProps) {
  const { pct, classes } = CONFIDENCE_CONFIG[confidence];

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}
    >
      ⚡ AI {pct}%
      <button
        type="button"
        aria-label="Dismiss AI suggestion"
        onClick={onDismiss}
        className="ml-0.5 leading-none opacity-60 hover:opacity-100"
      >
        ×
      </button>
    </span>
  );
}
