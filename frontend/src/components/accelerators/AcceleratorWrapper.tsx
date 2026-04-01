import { ExternalLink } from "lucide-react";

interface AcceleratorWrapperProps {
  title: string;
  description: string;
  docsUrl?: string;
  children: React.ReactNode;
}

export default function AcceleratorWrapper({
  title,
  description,
  docsUrl,
  children,
}: AcceleratorWrapperProps) {
  return (
    <div>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-display font-semibold text-gray-900">{title}</h1>
          {docsUrl && (
            <a
              href={docsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-gecx-600 hover:text-gecx-700 hover:underline shrink-0 transition"
            >
              View Docs
              <ExternalLink size={13} />
            </a>
          )}
        </div>
        <p className="mt-1 text-sm text-gray-500">{description}</p>
      </div>

      {children}
    </div>
  );
}
