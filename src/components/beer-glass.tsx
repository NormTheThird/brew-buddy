/* A little shaker pint tinted to the beer's color (real SRM when the recipe
   has one, style-family estimate otherwise) — the Untappd-style glance. */
export function BeerGlass({ color, size = 30, title }: { color: string; size?: number; title?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      role="img"
      aria-label={title ?? "beer color"}
      style={{ flexShrink: 0 }}
    >
      {title ? <title>{title}</title> : null}
      {/* glass body */}
      <path d="M6.2 2.5 h11.6 l-1.5 19 h-8.6 Z" fill={color} stroke="rgba(255,255,255,0.35)" strokeWidth="0.8" />
      {/* foam head */}
      <path d="M6.2 2.5 h11.6 l-.32 4 h-10.96 Z" fill="#f2ecdd" />
      {/* highlight */}
      <path d="M8.4 7.5 l-.5 12 h1.4 l.4 -12 Z" fill="rgba(255,255,255,0.22)" />
    </svg>
  );
}
