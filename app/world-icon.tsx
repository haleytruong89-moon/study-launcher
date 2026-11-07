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
    case "orb": {
      // Planets, moons, pearls. n = 1: a ring (Sao Thổ); accent = band / spot.
      return (
        <>
          <circle cx="24" cy="24" r="14" fill={c} />
          {s.accent && <ellipse cx="24" cy="27" rx="13" ry="3" fill={a} opacity=".55" />}
          {s.n === 1 && <ellipse cx="24" cy="24" rx="22" ry="6" fill="none" stroke={a} strokeWidth="3" transform="rotate(-18 24 24)" />}
        </>
      );
    }
    case "spark":
      return (
        <>
          <circle cx="24" cy="24" r="16" fill={c} opacity=".22" />
          <path d="M24 4 L27 21 L44 24 L27 27 L24 44 L21 27 L4 24 L21 21 Z" fill={c} />
          <circle cx="24" cy="24" r="5" fill={a} />
        </>
      );
    case "swirl":
      return (
        <>
          <ellipse cx="24" cy="24" rx="20" ry="9" fill={c} opacity=".45" transform="rotate(-25 24 24)" />
          <ellipse cx="22" cy="22" rx="12" ry="6" fill={a} opacity=".7" transform="rotate(20 24 24)" />
          <circle cx="24" cy="24" r="4" fill="#FFF6D8" />
        </>
      );
    case "hole":
      return (
        <>
          <ellipse cx="24" cy="24" rx="21" ry="8" fill={a} />
          <circle cx="24" cy="24" r="10" fill={c} />
          <ellipse cx="24" cy="24" rx="21" ry="8" fill="none" stroke={a} strokeWidth="2" opacity=".6" />
        </>
      );
    case "branch":
      return (
        <>
          <path d="M24 46 L24 26 M24 32 L14 20 M24 30 L34 16 M14 20 L10 10 M14 20 L18 9 M34 16 L30 6 M34 16 L40 8" stroke={c} strokeWidth={s.n === 1 ? 2.2 : 4.5} strokeLinecap="round" fill="none" />
          {s.n === 1 && <path d="M8 8 L40 8 L40 40 L8 40 Z" fill={c} opacity=".18" />}
          <circle cx="10" cy="10" r="2.5" fill={a} />
          <circle cx="30" cy="6" r="2.5" fill={a} />
          <circle cx="40" cy="8" r="2.5" fill={a} />
        </>
      );
    case "brain":
      return (
        <>
          <path d="M6 40 Q6 12 24 12 Q42 12 42 40 Z" fill={c} />
          <path d="M10 36 Q14 20 18 34 Q22 18 26 34 Q30 18 34 34 Q38 22 40 36" stroke={a} strokeWidth="2" fill="none" />
        </>
      );
    case "blades": {
      const n = s.n ?? 5;
      return (
        <>
          {Array.from({ length: n }, (_, i) => {
            const x = 8 + (32 / Math.max(1, n - 1)) * i;
            return <path key={i} d={`M${x} 46 Q${x + (i % 2 ? 6 : -6)} 26 ${x + (i % 2 ? -2 : 2)} 4`} stroke={i % 2 ? a : c} strokeWidth="4" strokeLinecap="round" fill="none" />;
          })}
        </>
      );
    }
    case "shell":
      // n = 0 spiral (ốc), 1 oval (ốc tiền), 2 fan / clam (with a pearl when accent is light).
      return s.n === 1 ? (
        <>
          <ellipse cx="24" cy="26" rx="16" ry="11" fill={c} />
          <path d="M14 26 L34 26" stroke={a} strokeWidth="2" />
          <circle cx="18" cy="20" r="1.6" fill={a} />
          <circle cx="28" cy="19" r="1.6" fill={a} />
        </>
      ) : s.n === 2 ? (
        <>
          <path d="M6 32 Q24 2 42 32 Z" fill={c} />
          {[12, 18, 24, 30, 36].map((x) => (
            <path key={x} d={`M24 30 L${x} 14`} stroke={a} strokeWidth="1.5" />
          ))}
          <path d="M6 32 Q24 44 42 32 Z" fill={c} opacity=".8" />
        </>
      ) : (
        <>
          <circle cx="24" cy="26" r="16" fill={c} />
          <path d="M24 26 m0 -12 a12 12 0 1 1 -10 6 a8 8 0 1 1 8 -2 a4 4 0 1 1 2 4" stroke={a} strokeWidth="2" fill="none" />
        </>
      );
    case "seahorse":
      return (
        <>
          <path d="M28 6 Q38 8 34 16 L26 16 Q20 22 26 30 Q30 38 22 44 Q16 42 20 38 Q24 34 18 28 Q14 18 22 12 Z" fill={c} />
          <circle cx="30" cy="10" r="1.6" fill={a} />
          <path d="M34 12 L42 13" stroke={c} strokeWidth="3" strokeLinecap="round" />
        </>
      );
    case "urchin":
      return (
        <>
          {Array.from({ length: 16 }, (_, i) => (
            <path key={i} d="M24 24 L24 3" stroke={c} strokeWidth="2" strokeLinecap="round" transform={`rotate(${22.5 * i} 24 24)`} />
          ))}
          <circle cx="24" cy="24" r="10" fill={a} />
        </>
      );
    case "slug":
      return (
        <>
          <path d="M6 34 Q8 22 24 22 Q40 22 42 34 Z" fill={c} />
          {[12, 18, 24, 30, 36].map((x) => (
            <circle key={x} cx={x} cy="22" r="3" fill={a} />
          ))}
          <path d="M34 22 L36 14 M38 23 L42 16" stroke={a} strokeWidth="2.5" strokeLinecap="round" />
        </>
      );
    case "jelly":
      return (
        <>
          <path d="M8 24 Q8 6 24 6 Q40 6 40 24 Z" fill={c} opacity=".85" />
          {[12, 18, 24, 30, 36].map((x, i) => (
            <path key={x} d={`M${x} 24 Q${x + (i % 2 ? 4 : -4)} 34 ${x} 44`} stroke={a} strokeWidth="2" fill="none" />
          ))}
        </>
      );
    case "dugong":
      return (
        <>
          <ellipse cx="22" cy="26" rx="17" ry="9" fill={c} />
          <path d="M37 26 L46 18 L46 34 Z" fill={c} />
          <circle cx="9" cy="24" r="1.6" fill={a} />
          <path d="M18 33 L14 40" stroke={c} strokeWidth="4" strokeLinecap="round" />
        </>
      );
    case "probe":
      return (
        <>
          <circle cx="24" cy="18" r="11" fill="#E8E4D8" />
          <circle cx="24" cy="18" r="6" fill={c} />
          <rect x="21" y="28" width="6" height="8" fill={a} />
          <path d="M24 36 L24 46 M10 32 L38 32" stroke={a} strokeWidth="2" />
        </>
      );
    case "rover":
      return (
        <>
          <rect x="8" y="18" width="30" height="12" rx="2" fill={c} />
          <rect x="30" y="8" width="3" height="10" fill={a} />
          <rect x="27" y="5" width="9" height="5" rx="1" fill={a} />
          {[12, 23, 34].map((x) => (
            <circle key={x} cx={x} cy="36" r="5" fill="#3A3A3A" />
          ))}
        </>
      );
    case "aurora":
      return (
        <>
          <path d="M2 30 Q12 6 24 22 Q36 38 46 12" stroke={c} strokeWidth="7" fill="none" strokeLinecap="round" opacity=".8" />
          <path d="M2 40 Q14 18 26 32 Q38 44 46 24" stroke={a} strokeWidth="5" fill="none" strokeLinecap="round" opacity=".7" />
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
