export const CATEGORIES = [
  "Identity",
  "Education",
  "Property",
  "Banking",
  "Insurance",
  "Medical",
  "Government",
  "Pension",
  "Electricity",
  "Tax",
  "Other",
] as const;

export type Category = (typeof CATEGORIES)[number];

// Distinct, accessible badge palette per category
export const CATEGORY_STYLES: Record<string, string> = {
  Identity:    "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-500/20 dark:text-blue-200 dark:border-blue-400/30",
  Education:   "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-400/30",
  Property:    "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-400/30",
  Banking:     "bg-violet-100 text-violet-800 border-violet-200 dark:bg-violet-500/20 dark:text-violet-200 dark:border-violet-400/30",
  Insurance:   "bg-cyan-100 text-cyan-800 border-cyan-200 dark:bg-cyan-500/20 dark:text-cyan-200 dark:border-cyan-400/30",
  Medical:     "bg-rose-100 text-rose-800 border-rose-200 dark:bg-rose-500/20 dark:text-rose-200 dark:border-rose-400/30",
  Government:  "bg-indigo-100 text-indigo-800 border-indigo-200 dark:bg-indigo-500/20 dark:text-indigo-200 dark:border-indigo-400/30",
  Pension:     "bg-teal-100 text-teal-800 border-teal-200 dark:bg-teal-500/20 dark:text-teal-200 dark:border-teal-400/30",
  Electricity: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-500/20 dark:text-yellow-200 dark:border-yellow-400/30",
  Tax:         "bg-orange-100 text-orange-800 border-orange-200 dark:bg-orange-500/20 dark:text-orange-200 dark:border-orange-400/30",
  Other:       "bg-slate-100 text-slate-800 border-slate-200 dark:bg-slate-500/20 dark:text-slate-200 dark:border-slate-400/30",
};

export function categoryBadgeClass(cat: string) {
  return CATEGORY_STYLES[cat] ?? CATEGORY_STYLES.Other;
}
