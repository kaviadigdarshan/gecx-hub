export const INDUSTRY_VERTICALS = [
  { value: 'retail',      label: 'Retail',                       emoji: '🏪' },
  { value: 'bfsi',        label: 'Banking & Financial Services',  emoji: '🏛️' },
  { value: 'healthcare',  label: 'Healthcare',                    emoji: '🏥' },
  { value: 'telecom',     label: 'Telecom',                       emoji: '📡' },
  { value: 'hospitality', label: 'Hospitality',                   emoji: '🏨' },
  { value: 'ecommerce',   label: 'E-Commerce',                    emoji: '🛒' },
  { value: 'utilities',   label: 'Utilities',                     emoji: '⚡' },
  { value: 'generic',     label: 'Generic',                       emoji: '🔧' },
] as const;

export type IndustryVertical = typeof INDUSTRY_VERTICALS[number]['value'];
