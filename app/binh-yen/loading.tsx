/**
 * R6a (parent 08/11: "Góc bình yên mở chậm"): shown at once while the server checks the visit,
 * so a tap on Hôm nay answers right away. Nothing about the child here (it is the same for everyone).
 */
export default function BinhYenLoading() {
  return (
    <div className="min-h-dvh bg-bg pb-24 lg:pb-0 lg:pl-52">
      <header className="text-white" style={{ background: "#4E8C63" }}>
        <div className="mx-auto flex max-w-md items-center gap-3 px-4 pt-5 pb-4">
          <span className="inline-flex min-h-11 items-center px-1 text-sm font-bold opacity-80">‹ Hôm nay</span>
          <h1 className="ml-auto text-xl font-bold">🌿 Góc bình yên</h1>
        </div>
      </header>
      <main className="mx-auto flex max-w-md flex-col gap-5 px-4 py-5" aria-busy="true">
        <p role="status" className="text-sm font-semibold text-ink/70">
          Đang mở Góc bình yên…
        </p>
        <div className="flex flex-col gap-4 rounded-[20px] bg-white p-4">
          <div className="h-6 w-2/3 animate-pulse rounded-full bg-ink/10 motion-reduce:animate-none" />
          <div className="grid grid-cols-2 gap-3">
            {["#FBE3DC", "#FBF0D6", "#DEE8F5", "#E3F0E3"].map((c) => (
              <div key={c} className="min-h-28 animate-pulse rounded-2xl motion-reduce:animate-none" style={{ background: c }} />
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
