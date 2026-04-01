export default function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-6 text-center">
      {/* Concentric rings with lightning bolt */}
      <svg
        width="120"
        height="120"
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Outermost ring */}
        <circle cx="60" cy="60" r="56" stroke="#e0e7ff" strokeWidth="2" fill="none" />
        {/* Middle ring */}
        <circle cx="60" cy="60" r="42" stroke="#c7d2fe" strokeWidth="2" fill="none" />
        {/* Inner ring */}
        <circle cx="60" cy="60" r="28" stroke="#a5b4fc" strokeWidth="2" fill="#eef2ff" />
        {/* Lightning bolt */}
        <path
          d="M63 44l-10 16h8l-4 16 12-18h-9l3-14z"
          fill="#4f46e5"
        />
      </svg>

      <div>
        <h2 className="text-xl font-display font-semibold text-gray-700">
          Select an accelerator
        </h2>
        <p className="mt-2 text-sm text-gray-500 max-w-xs">
          Choose a tool from the sidebar to get started.
        </p>
      </div>
    </div>
  );
}
