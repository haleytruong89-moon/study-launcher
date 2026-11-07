import type { Icon, SvgIcon } from "@/lib/world/types";

/**
 * R4: how a thing or an animal of the world looks — an emoji when there is a good one, else a
 * small flat drawing (parent decision 07/11/2026: emoji + SVG). Everything is in the app; no
 * picture is fetched from anywhere. Decorative: the caller names it.
 */
function Shape({ s }: { s: SvgIcon }) {
  const c = s.color;
  const a = s.accent ?? "#6E4527";
  switch (s.shape) {
    case "bloom": {
      const n = s.n ?? 5;
      return (
        <>
          <rect x="23" y="30" width="2.5" height="16" fill="#4E9C57" />
          {Array.from({ length: n }, (_, i) => (
            <ellipse key={i} cx="24" cy="12" rx="6" ry="9" fill={c} transform={`rotate(${(360 / n) * i} 24 21)`} />
          ))}
          <circle cx="24" cy="21" r="5" fill={a} />
        </>
      );
    }
    case "tree": {
      const n = s.n ?? 3;
      return (
        <>
          <rect x="21" y="26" width="6" height="20" fill={a} />
          {n === 1 ? (
            <ellipse cx="24" cy="16" rx="9" ry="15" fill={c} />
          ) : (
            <>
              <circle cx="24" cy="15" r="12" fill={c} />
              <circle cx="14" cy="22" r="8" fill={c} />
              <circle cx="34" cy="22" r="8" fill={c} />
            </>
          )}
          {n >= 5 && (
            <>
              <rect x="12" y="26" width="1.6" height="20" fill={a} />
              <rect x="34" y="26" width="1.6" height="20" fill={a} />
            </>
          )}
          {n === 3 && <path d="M15 46 L21 38 M33 46 L27 38" stroke={a} strokeWidth="2.4" />}
        </>
      );
    }
    case "fruit":
      return (
        <>
          <rect x="23" y="2" width="2.5" height="9" fill="#6E4527" />
          <ellipse cx="24" cy="28" rx="13" ry="17" fill={c} />
          {[18, 24, 30].map((x) => [18, 26, 34].map((y) => <circle key={`${x}-${y}`} cx={x + ((y / 8) % 2) * 2} cy={y} r="1.4" fill={a} />))}
        </>
      );
    case "pod":
      return (
        <>
          <path d="M8 40 Q14 8 40 8 Q36 30 8 40 Z" fill={c} />
          <path d="M12 36 Q20 16 36 12" stroke={a} strokeWidth="2" fill="none" />
        </>
      );
    case "pitcher":
      return (
        <>
          <path d="M16 18 Q12 44 24 46 Q36 44 32 18 Z" fill={c} />
          <ellipse cx="24" cy="18" rx="8" ry="3" fill={a} />
          <path d="M26 15 Q34 6 38 12 Q32 14 26 15 Z" fill={c} />
        </>
      );
    case "patch":
      return (
        <>
          {[10, 18, 26, 34, 40].map((x, i) => (
            <circle key={x} cx={x} cy={38 - (i % 2) * 5} r={8 - (i % 3)} fill={i % 2 ? a : c} />
          ))}
        </>
      );
    case "bark":
      return (
        <>
          <rect x="8" y="14" width="32" height="7" rx="3.5" fill={c} transform="rotate(-18 24 24)" />
          <rect x="8" y="24" width="32" height="7" rx="3.5" fill={a} transform="rotate(-18 24 24)" />
        </>
      );
    case "glow":
      return (
        <>
          <circle cx="24" cy="26" r="16" fill={c} opacity=".25" />
          <circle cx="24" cy="26" r="8" fill={c} />
          <ellipse cx="24" cy="16" rx="4" ry="5" fill={a} />
          <ellipse cx="17" cy="14" rx="6" ry="3" fill="#E6F1FB" />
          <ellipse cx="31" cy="14" rx="6" ry="3" fill="#E6F1FB" />
        </>
      );
    case "figs":
      return (
        <>
          <rect x="22" y="2" width="4" height="44" fill="#7A5638" />
          {[
            [14, 14],
            [34, 18],
            [14, 30],
            [34, 34],
            [24, 24],
          ].map(([x, y]) => (
            <circle key={`${x}-${y}`} cx={x} cy={y} r="5.5" fill={y && y > 25 ? a : c} />
          ))}
        </>
      );
    case "fern":
      return (
        <>
          <rect x="22" y="18" width="4" height="28" fill={a} />
          {[-60, -30, 0, 30, 60].map((r) => (
            <ellipse key={r} cx="24" cy="10" rx="4" ry="12" fill={c} transform={`rotate(${r} 24 20)`} />
          ))}
        </>
      );
    case "star": {
      const n = s.n ?? 8;
      return (
        <>
          {Array.from({ length: n }, (_, i) => (
            <ellipse key={i} cx="24" cy="12" rx="4" ry="10" fill={i % 2 ? a : c} transform={`rotate(${(360 / n) * i} 24 24)`} />
          ))}
          <circle cx="24" cy="24" r="4" fill={a} />
        </>
      );
    }
  }
}

export function WorldIcon({ icon, size = 40 }: { icon: Icon; size?: number }) {
  if ("emoji" in icon) {
    return (
      <span aria-hidden="true" className="inline-block leading-none" style={{ fontSize: Math.round(size * 0.85) }}>
        {icon.emoji}
      </span>
    );
  }
  return (
    <svg viewBox="0 0 48 48" width={size} height={size} aria-hidden="true" focusable="false">
      <Shape s={icon.svg} />
    </svg>
  );
}
