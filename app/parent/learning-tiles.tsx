import { tileCounts, type LearningTile } from "@/lib/parent/learning";

/**
 * L-3 "Học với app" on Ngày của con: one tile per learning app (SQL 0021). Display only; the
 * numbers come from each app. Links into the tutor app are plain <a> (another zone, D20).
 * Hidden when no app wrote anything that day.
 */
export function LearningSection({ tiles }: { tiles: readonly LearningTile[] }) {
  if (tiles.length === 0) return null;
  return (
    <section aria-labelledby="dv-apps" className="flex flex-col gap-2">
      <h2 id="dv-apps" className="text-xs font-extrabold tracking-wider text-ink/70 uppercase">
        Học với app
      </h2>
      <ul className="flex flex-col gap-2">
        {tiles.map((t) => (
          <li key={t.source}>
            <article aria-label={t.label} className="flex flex-col gap-1.5 rounded-2xl bg-white px-4 py-3">
              <div className="flex items-baseline justify-between gap-2">
                <h3 className="font-extrabold">{t.label}</h3>
                {t.stats && (
                  <span className="text-sm font-semibold text-ink/75">
                    {t.stats.minutes} phút · {t.stats.sessions} buổi
                  </span>
                )}
              </div>
              {t.stats && <p className="text-sm text-ink/80">{tileCounts(t.stats)}</p>}
              {t.attention.length > 0 && (
                <ul aria-label="Cần chú ý" className="flex flex-col gap-1">
                  {t.attention.map((line, i) => (
                    <li key={i} className="rounded-xl bg-[#FFF4E5] px-3 py-1.5 text-sm text-ink">
                      {line}
                    </li>
                  ))}
                </ul>
              )}
              {(t.reportHref || t.pendingRules > 0) && (
                <div className="flex flex-wrap gap-x-4">
                  {t.reportHref && (
                    <a href={t.reportHref} className="inline-flex min-h-11 items-center text-sm font-bold text-accent">
                      Xem báo cáo ›
                    </a>
                  )}
                  {t.pendingRules > 0 &&
                    (t.rulesHref ? (
                      <a href={t.rulesHref} className="inline-flex min-h-11 items-center text-sm font-bold text-accent">
                        {t.pendingRules} luật chờ duyệt ›
                      </a>
                    ) : (
                      <span className="inline-flex min-h-11 items-center text-sm font-semibold text-ink/75">{t.pendingRules} luật chờ duyệt</span>
                    ))}
                </div>
              )}
            </article>
          </li>
        ))}
      </ul>
      <p className="text-xs text-ink/65">Giờ học với gia sư AI chỉ để bố mẹ xem, chưa tính vào khóa/mở máy hay giờ nghỉ.</p>
    </section>
  );
}
