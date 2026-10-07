/** Formwise mark: a stacked "f" built from two rounded bars and an accent dot. */
export function LogoMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <rect width="32" height="32" rx="8" fill="#111318" />
      <rect x="9" y="8" width="14" height="4.5" rx="2.25" fill="#FFFFFF" />
      <rect x="9" y="14.5" width="10" height="4.5" rx="2.25" fill="#FFFFFF" fillOpacity="0.75" />
      <circle cx="11.25" cy="23.25" r="2.25" fill="#2F54EB" />
    </svg>
  );
}

export function Logo({ size = 28 }: { size?: number }) {
  return (
    <span className="inline-flex items-center gap-2">
      <LogoMark size={size} />
      <span className="text-[17px] font-semibold tracking-tight text-ink">formwise</span>
    </span>
  );
}
