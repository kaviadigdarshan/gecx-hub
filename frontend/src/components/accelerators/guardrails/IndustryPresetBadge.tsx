import type { IndustryVertical } from "@/types/accelerators";

const INDUSTRY_META: Record<
  IndustryVertical,
  { label: string; bg: string; text: string; emoji: string }
> = {
  retail:      { label: "Retail",      bg: "bg-blue-100",   text: "text-blue-700",   emoji: "🛍️" },
  bfsi:        { label: "BFSI",        bg: "bg-green-100",  text: "text-green-700",  emoji: "🏦" },
  healthcare:  { label: "Healthcare",  bg: "bg-red-100",    text: "text-red-700",    emoji: "🏥" },
  telecom:     { label: "Telecom",     bg: "bg-purple-100", text: "text-purple-700", emoji: "📡" },
  hospitality: { label: "Hospitality", bg: "bg-orange-100", text: "text-orange-700", emoji: "🏨" },
  ecommerce:   { label: "E-Commerce",  bg: "bg-teal-100",   text: "text-teal-700",   emoji: "🛒" },
  utilities:   { label: "Utilities",   bg: "bg-yellow-100", text: "text-yellow-700", emoji: "⚡" },
  generic:     { label: "Generic",     bg: "bg-gray-100",   text: "text-gray-600",   emoji: "🔧" },
};

interface IndustryPresetBadgeProps {
  industry: IndustryVertical;
  size?: "sm" | "md";
}

export default function IndustryPresetBadge({
  industry,
  size = "md",
}: IndustryPresetBadgeProps) {
  const meta = INDUSTRY_META[industry] ?? INDUSTRY_META.generic;
  return (
    <span
      className={[
        "inline-flex items-center gap-1 font-medium rounded-full",
        meta.bg,
        meta.text,
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1",
      ].join(" ")}
    >
      <span>{meta.emoji}</span>
      {meta.label}
    </span>
  );
}
