"use client";

import { useEffect, useRef, useState } from "react";
import type { Activity, ActivityText } from "@/lib/binhYen/catalog";

/**
 * Góc bình yên activities (S-BY1). Pure screen helpers: NOTHING here is sent or stored — no
 * text box exists in this slice (activities that needed typing are done in the head or on
 * paper). Timers only guide; the "Xong" button works at any time. Motion is skipped for people
 * who ask for less (prefers-reduced-motion).
 */

function useReducedMotion(): boolean {
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const id = window.setTimeout(() => setReduce(mq.matches), 0);
    const on = () => setReduce(mq.matches);
    mq.addEventListener("change", on);
    return () => {
      window.clearTimeout(id);
      mq.removeEventListener("change", on);
    };
  }, []);
  return reduce;
}

/** Counts down once started; `left` = seconds still to go. */
function useCountdown(seconds: number) {
  const [left, setLeft] = useState(seconds);
  const [running, setRunning] = useState(false);
  const leftRef = useRef(seconds);
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      leftRef.current = Math.max(0, leftRef.current - 1);
      setLeft(leftRef.current);
      if (leftRef.current === 0) {
        window.clearInterval(id);
        setRunning(false);
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [running]);
  return {
    left,
    running,
    start: () => {
      leftRef.current = seconds;
      setLeft(seconds);
      setRunning(true);
    },
  };
}

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function Big({ children }: { children: React.ReactNode }) {
  return (
    <div aria-live="polite" className="text-center text-5xl font-bold tabular-nums">
      {children}
    </div>
  );
}

function StartButton({ onClick, disabled, color, children }: { onClick: () => void; disabled?: boolean; color: string; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} className="btn border-[1.5px] bg-white disabled:opacity-50" style={{ borderColor: color, color }}>
      {children}
    </button>
  );
}

// ---------------------------------------------------------------------------

type Phase = [label: string, seconds: number, scale: number];
const BREATH: Phase[] = [
  ["Hít vào", 4, 1],
  ["Giữ", 4, 1],
  ["Thở ra", 6, 0.72],
];
const WHALE: Phase[] = [
  ["Hít vào", 4, 1],
  ["Lặn xuống", 2, 1],
  ["Thở ra", 6, 0.72],
];

/** 5 breaths following a circle that grows and shrinks (4·4·6, or the whale's 4·2·6). */
function BreathCircle({ phases, color, onEnd }: { phases: Phase[]; color: string; onEnd?: () => void }) {
  const reduce = useReducedMotion();
  const [tick, setTick] = useState<{ p: number; left: number; round: number } | null>(null);
  const [finished, setFinished] = useState(false);
  const now = useRef({ p: 0, left: 0, round: 0 });
  const endRef = useRef(onEnd);
  useEffect(() => {
    endRef.current = onEnd;
  }, [onEnd]);
  const running = tick !== null && !finished;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const t = now.current;
      if (t.left > 1) {
        now.current = { ...t, left: t.left - 1 };
      } else {
        const p = (t.p + 1) % phases.length;
        const round = p === 0 ? t.round + 1 : t.round;
        if (round >= 5) {
          window.clearInterval(id);
          setFinished(true);
          endRef.current?.();
          return;
        }
        now.current = { p, left: phases[p]?.[1] ?? 4, round };
      }
      setTick(now.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, phases]);
  function start() {
    now.current = { p: 0, left: phases[0]?.[1] ?? 4, round: 0 };
    setFinished(false);
    setTick(now.current);
  }

  const phase = tick ? (phases[tick.p] ?? null) : null;
  const scale = finished ? 0.86 : phase ? phase[2] : 0.72;
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div
        aria-live="polite"
        className="grid size-48 place-items-center rounded-full border-2 text-center"
        style={{
          borderColor: color,
          background: "radial-gradient(circle at 40% 35%, #DCE5F3, #FFFFFF)",
          transform: reduce ? undefined : `scale(${scale})`,
          transition: reduce ? undefined : `transform ${phase ? phase[1] : 1}s ease-in-out`,
        }}
      >
        <div>
          <b className="block text-xl">{finished ? "Xong" : (phase?.[0] ?? "Sẵn sàng?")}</b>
          <span className="block text-sm tabular-nums text-ink/70">{finished ? "Cơ thể thấy thế nào?" : tick ? `${tick.left} · hơi ${tick.round + 1}/5` : ""}</span>
        </div>
      </div>
      <StartButton color={color} disabled={running} onClick={start}>
        {finished ? "Thở thêm 5 hơi" : "Bắt đầu"}
      </StartButton>
    </div>
  );
}

function Countdown({ seconds, color, label = "Bắt đầu" }: { seconds: number; color: string; label?: string }) {
  const t = useCountdown(seconds);
  return (
    <div className="flex flex-col items-center gap-3">
      <Big>{t.left === 0 ? "✓" : mmss(t.left)}</Big>
      <StartButton color={color} disabled={t.running} onClick={t.start}>
        {t.left === 0 ? "Làm lại" : label}
      </StartButton>
    </div>
  );
}

function Moves({ steps, seconds, color }: { steps: string[]; seconds: number; color: string }) {
  const [pos, setPos] = useState({ i: -1, left: seconds });
  const ref = useRef(pos);
  const running = pos.i >= 0 && pos.i < steps.length;
  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => {
      const c = ref.current;
      ref.current = c.left > 1 ? { i: c.i, left: c.left - 1 } : { i: c.i + 1, left: seconds };
      if (ref.current.i >= steps.length) window.clearInterval(id);
      setPos(ref.current);
    }, 1000);
    return () => window.clearInterval(id);
  }, [running, steps.length, seconds]);
  const done = pos.i >= steps.length;
  function start() {
    ref.current = { i: 0, left: seconds };
    setPos(ref.current);
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <p aria-live="polite" className="rounded-xl bg-[#F7ECCB] px-4 py-3 text-center text-lg font-semibold">
        {done ? "Xong! Thở chậm lại một chút." : pos.i < 0 ? `${steps.length} con vật, mỗi con ${seconds} giây.` : steps[pos.i]}
      </p>
      {running && <Big>{pos.left}</Big>}
      <StartButton color={color} disabled={running} onClick={start}>
        {done ? "Làm lại" : "Bắt đầu"}
      </StartButton>
    </div>
  );
}

function Stepper({ steps, color }: { steps: string[]; color: string }) {
  const [i, setI] = useState(0);
  return (
    <div className="flex flex-col gap-3">
      <ol className="flex flex-col gap-2">
        {steps.slice(0, i + 1).map((s) => (
          <li key={s} className="rounded-xl bg-bg p-3">
            {s}
          </li>
        ))}
      </ol>
      {i < steps.length - 1 && (
        <StartButton color={color} onClick={() => setI(i + 1)}>
          Tiếp →
        </StartButton>
      )}
    </div>
  );
}

function Checks({ steps, color }: { steps: string[]; color: string }) {
  const [on, setOn] = useState<boolean[]>(() => steps.map(() => false));
  return (
    <div role="group" aria-label="Đánh dấu khi con đã nghĩ ra" className="flex flex-col gap-2">
      {steps.map((s, k) => (
        <button
          key={s}
          type="button"
          aria-pressed={on[k]}
          onClick={() => setOn(on.map((v, j) => (j === k ? !v : v)))}
          className="flex min-h-12 items-center gap-3 rounded-xl border-[1.5px] bg-white px-3 text-left"
          style={{ borderColor: on[k] ? color : "rgb(28 31 29 / 0.15)" }}
        >
          <span aria-hidden className="text-xl">{on[k] ? "✓" : "○"}</span>
          <span>{s}</span>
        </button>
      ))}
    </div>
  );
}

function Chips({ options, label }: { options: string[]; label: string }) {
  const [pick, setPick] = useState<string | null>(null);
  return (
    <div role="group" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" aria-pressed={pick === o} onClick={() => setPick(pick === o ? null : o)} className="min-h-11 rounded-full border-[1.5px] bg-white px-4 aria-pressed:border-ink aria-pressed:bg-bg">
          {o}
        </button>
      ))}
    </div>
  );
}

/** Tap once per heartbeat for 15 seconds → beats per minute. Nothing is stored. */
function PulseCount({ label, color, onDone }: { label: string; color: string; onDone: (bpm: number) => void }) {
  const t = useCountdown(15);
  const [taps, setTaps] = useState(0);
  const started = t.running || t.left === 0;
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="font-semibold">{label}</p>
      <p className="text-sm text-ink/70">Đặt 2 ngón tay lên cổ tay (phía ngón cái) hoặc bên cổ. Bấm Bắt đầu, rồi chạm nút ♥ mỗi lần thấy tim đập, trong 15 giây.</p>
      <Big>{t.left === 0 ? "Dừng!" : t.left}</Big>
      {!started && (
        <StartButton color={color} onClick={() => { setTaps(0); t.start(); }}>
          Bắt đầu đếm
        </StartButton>
      )}
      {t.running && (
        <button type="button" onClick={() => setTaps((n) => n + 1)} className="btn min-h-16 min-w-32 text-2xl text-white" style={{ background: color }}>
          ♥ {taps}
        </button>
      )}
      {t.left === 0 && (
        <StartButton color={color} onClick={() => onDone(taps * 4)}>
          {taps * 4} nhịp/phút · Tiếp →
        </StartButton>
      )}
    </div>
  );
}

function Heart({ color }: { color: string }) {
  const [stage, setStage] = useState<"before" | "breathe" | "after" | "result">("before");
  const [before, setBefore] = useState(0);
  const [after, setAfter] = useState(0);
  if (stage === "before") return <PulseCount key="b" label="Bước 1 · Nhịp tim lúc này" color={color} onDone={(b) => { setBefore(b); setStage("breathe"); }} />;
  if (stage === "breathe")
    return (
      <div className="flex flex-col gap-2">
        <p className="font-semibold">Bước 2 · Thở như cá voi</p>
        <p className="text-sm text-ink/70">Nhịp tim lúc nãy: {before} nhịp/phút. Giờ thở chậm cùng cá voi.</p>
        <BreathCircle phases={WHALE} color={color} onEnd={() => setStage("after")} />
        <button type="button" onClick={() => setStage("after")} className="min-h-11 self-center text-sm font-semibold underline">
          Bỏ qua, đo lại luôn
        </button>
      </div>
    );
  if (stage === "after") return <PulseCount key="a" label="Bước 3 · Nhịp tim sau khi thở" color={color} onDone={(a) => { setAfter(a); setStage("result"); }} />;
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl bg-bg p-4 text-center">
      <span className="text-sm font-semibold text-ink/70">Kết quả thí nghiệm</span>
      <Big>
        {before} → {after}
      </Big>
      <p>{after < before ? `Tim chậm lại ${before - after} nhịp mỗi phút! Giả thuyết đúng: thở chậm giúp cơ thể bình tĩnh.` : "Lần này tim chưa chậm lại. Nhà khoa học thật cũng có thí nghiệm chưa ra kết quả. Thử lại lúc khác nhé!"}</p>
    </div>
  );
}

const GLITTER = ["#F2C94C", "#E8A2C8", "#8FB0E3", "#8CC79E", "#C9553F"];

function Jar({ color }: { color: string }) {
  const reduce = useReducedMotion();
  const [bits, setBits] = useState<{ left: number; top: number; d: number }[]>([]);
  useEffect(() => {
    const id = window.setTimeout(() => setBits(Array.from({ length: 50 }, () => ({ left: 8 + Math.random() * 84, top: 80 + Math.random() * 14, d: 0 }))), 0);
    return () => window.clearTimeout(id);
  }, []);
  function shake() {
    setBits((bs) => bs.map(() => ({ left: 8 + Math.random() * 84, top: 5 + Math.random() * 70, d: 0 })));
    window.setTimeout(() => setBits((bs) => bs.map((b) => ({ ...b, top: 80 + Math.random() * 14, d: reduce ? 0.4 : 8 + Math.random() * 20 }))), 60);
  }
  return (
    <div className="flex flex-col items-center gap-3">
      <div aria-label="Lọ kim tuyến" role="img" className="relative h-56 w-44 overflow-hidden rounded-t-[20px] rounded-b-[34px] border-[3px] border-ink bg-gradient-to-b from-[#DCE5F3] to-white">
        {bits.map((b, k) => (
          <i
            key={k}
            className="absolute size-1.5 rotate-45 rounded-[2px]"
            style={{ left: `${b.left}%`, top: `${b.top}%`, background: GLITTER[k % GLITTER.length], transition: b.d ? `top ${b.d}s ease-out` : "none" }}
          />
        ))}
      </div>
      <StartButton color={color} onClick={shake}>
        Lắc lọ
      </StartButton>
      <p className="text-sm text-ink/70">Lắc lọ, rồi chỉ ngồi nhìn kim tuyến lắng xuống. Đầu óc mình cũng lắng xuống y như vậy. Thở chậm trong lúc chờ.</p>
    </div>
  );
}

function Bubbles({ color }: { color: string }) {
  const reduce = useReducedMotion();
  const [size, setSize] = useState(40);
  const [made, setMade] = useState(0);
  const [note, setNote] = useState("Quả 1/3");
  const t0 = useRef(0);
  const raf = useRef(0);
  function grow() {
    const s = (performance.now() - t0.current) / 1000;
    setSize(Math.min(40 + s * 28, 200));
    raf.current = requestAnimationFrame(grow);
  }
  function start(e: React.PointerEvent) {
    e.preventDefault();
    if (made >= 3) return;
    t0.current = performance.now();
    raf.current = requestAnimationFrame(grow);
  }
  function stop() {
    if (!t0.current) return;
    cancelAnimationFrame(raf.current);
    const s = (performance.now() - t0.current) / 1000;
    t0.current = 0;
    setSize(40);
    if (s < 3) return setNote(`Nổ mất rồi (${s.toFixed(1)} giây). Thở ra chậm hơn nữa nhé!`);
    const n = made + 1;
    setMade(n);
    setNote(`Tuyệt! Bong bóng ${s.toFixed(1)} giây. ${n < 3 ? `Quả ${n + 1}/3` : "Đủ 3 quả rồi!"}`);
  }
  useEffect(() => () => cancelAnimationFrame(raf.current), []);
  return (
    <div className="flex flex-col items-center gap-3">
      <p className="text-sm text-ink/70">Giữ nút trong lúc thở ra thật chậm bằng miệng; thả tay khi hết hơi. Thổi 3 quả bong bóng nhé.</p>
      <div className="grid h-56 w-full place-items-center overflow-hidden rounded-2xl bg-[#DCE5F3]">
        <div
          aria-hidden
          className="rounded-full border-[1.5px] border-white/80"
          style={{
            width: reduce ? 120 : size,
            height: reduce ? 120 : size,
            opacity: reduce ? 0.4 + Math.min(1, (size - 40) / 120) * 0.6 : 1,
            background: "radial-gradient(circle at 35% 30%, rgb(255 255 255 / .95), rgb(255 255 255 / .2) 40%, rgb(143 176 227 / .5) 75%, rgb(232 162 200 / .6))",
          }}
        />
      </div>
      <p aria-live="polite" className="font-semibold">
        {note}
      </p>
      <button type="button" onPointerDown={start} onPointerUp={stop} onPointerLeave={stop} onPointerCancel={stop} className="btn min-h-14 touch-none select-none text-white" style={{ background: color }}>
        Giữ để thổi
      </button>
    </div>
  );
}

const PARTS = [
  ["head", "Đầu"],
  ["chest", "Ngực"],
  ["belly", "Bụng"],
  ["hands", "Tay"],
  ["legs", "Chân"],
] as const;

function BodyMap({ color }: { color: string }) {
  const [on, setOn] = useState<Set<string>>(new Set());
  const toggle = (k: string) => setOn((s) => { const n = new Set(s); if (n.has(k)) n.delete(k); else n.add(k); return n; });
  const fill = (k: string) => (on.has(k) ? "#F6DED8" : "#FFFFFF");
  const stroke = (k: string) => (on.has(k) ? "#C9553F" : "#1C1F1D");
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-[120px_1fr] items-start gap-4">
        <svg viewBox="0 0 120 230" aria-hidden className="w-28">
          <circle cx="60" cy="28" r="22" fill={fill("head")} stroke={stroke("head")} strokeWidth="2" />
          <rect x="34" y="54" width="52" height="46" rx="14" fill={fill("chest")} stroke={stroke("chest")} strokeWidth="2" />
          <rect x="36" y="102" width="48" height="36" rx="12" fill={fill("belly")} stroke={stroke("belly")} strokeWidth="2" />
          <rect x="8" y="58" width="22" height="78" rx="11" fill={fill("hands")} stroke={stroke("hands")} strokeWidth="2" />
          <rect x="90" y="58" width="22" height="78" rx="11" fill={fill("hands")} stroke={stroke("hands")} strokeWidth="2" />
          <rect x="36" y="140" width="22" height="84" rx="11" fill={fill("legs")} stroke={stroke("legs")} strokeWidth="2" />
          <rect x="62" y="140" width="22" height="84" rx="11" fill={fill("legs")} stroke={stroke("legs")} strokeWidth="2" />
        </svg>
        <div role="group" aria-label="Cảm xúc nằm ở đâu" className="flex flex-wrap gap-2">
          {PARTS.map(([k, label]) => (
            <button key={k} type="button" aria-pressed={on.has(k)} onClick={() => toggle(k)} className="min-h-11 rounded-full border-[1.5px] bg-white px-4" style={{ borderColor: on.has(k) ? color : "rgb(28 31 29 / 0.2)" }}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <p className="text-sm font-semibold">Ở đó con thấy:</p>
      <Chips label="Cảm giác ở đó" options={["Nóng", "Căng", "Nặng", "Run run", "Thắt lại"]} />
      <p className="text-sm text-ink/70">Phát hiện thú vị: tức giận hay làm nóng mặt và nắm chặt tay; lo lắng hay làm thắt bụng (“bụng cồn cào”). Cơ thể biết cảm xúc trước cả khi mình gọi tên nó.</p>
    </div>
  );
}

const MOONS = [
  ["🌑", "Trăng non"],
  ["🌒", "Lưỡi liềm đầu tháng"],
  ["🌓", "Bán nguyệt đầu tháng"],
  ["🌔", "Gần tròn"],
  ["🌕", "Trăng tròn"],
  ["🌖", "Khuyết dần"],
  ["🌗", "Bán nguyệt cuối tháng"],
  ["🌘", "Lưỡi liềm cuối tháng"],
  ["☁️", "Mây che mất"],
] as const;

function Sky() {
  const [pick, setPick] = useState<string | null>(null);
  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-ink/70">Ra cửa sổ hoặc ban công 1 phút (tối nay cũng được). Nhìn bầu trời và chọn hình dạng Mặt Trăng con thấy.</p>
      <div role="group" aria-label="Hình dạng Mặt Trăng" className="grid grid-cols-3 gap-2">
        {MOONS.map(([e, n]) => (
          <button key={n} type="button" aria-pressed={pick === n} onClick={() => setPick(n)} className="flex min-h-16 flex-col items-center justify-center rounded-xl border-[1.5px] bg-white text-2xl aria-pressed:border-ink aria-pressed:bg-bg">
            <span aria-hidden>{e}</span>
            <small className="text-xs">{n}</small>
          </button>
        ))}
      </div>
      <p className="text-sm text-ink/70">Khoa học: Mặt Trăng không tự phát sáng mà phản chiếu ánh sáng Mặt Trời. Một chu kỳ trăng dài khoảng 29,5 ngày.</p>
    </div>
  );
}

/** The body of one activity (without the title and the Xong button). `talk` is rendered by the caller. */
export function ActivityBody({ activity, text, color }: { activity: Activity; text: ActivityText; color: string }) {
  const steps = text.steps ?? [];
  const guide = steps.length > 0 && activity.ui !== "steps" && activity.ui !== "checks" && activity.ui !== "moves" ? (
    <div className="flex flex-col gap-2">
      {steps.map((s) => (
        <p key={s} className="text-ink/80">
          {s}
        </p>
      ))}
    </div>
  ) : null;
  let body: React.ReactNode = null;
  switch (activity.ui) {
    case "breath":
      body = <BreathCircle phases={BREATH} color={color} />;
      break;
    case "whale":
      body = <BreathCircle phases={WHALE} color={color} />;
      break;
    case "timer":
      body = <Countdown seconds={activity.seconds ?? 60} color={color} />;
      break;
    case "moves":
      body = <Moves steps={steps} seconds={activity.seconds ?? 30} color={color} />;
      break;
    case "steps":
      body = <Stepper steps={steps} color={color} />;
      break;
    case "checks":
      body = <Checks steps={steps} color={color} />;
      break;
    case "heart":
      body = <Heart color={color} />;
      break;
    case "jar":
      body = <Jar color={color} />;
      break;
    case "bubbles":
      body = <Bubbles color={color} />;
      break;
    case "body":
      body = <BodyMap color={color} />;
      break;
    case "sky":
      body = <Sky />;
      break;
    case "people":
      body = (
        <div className="flex flex-col gap-3">
          <p className="text-ink/80">Chọn một người, rồi kể trực tiếp hoặc nhắn tin bằng điện thoại của con. Câu mở đầu có thể là: “Hôm nay có chuyện này, nghe không?”</p>
          <Chips label="Kể cho ai" options={["Bố hoặc mẹ", "Anh chị em", "Bạn thân", "Ông bà"]} />
        </div>
      );
      break;
    case "talk":
      body = null;
      break;
  }
  return (
    <div className="flex flex-col gap-4">
      {activity.offline && (
        <span className="self-start rounded-full bg-bg px-3 py-1 text-xs font-semibold">{activity.offline === "head" ? "Làm trong đầu · không cần gõ gì" : "Làm ra giấy · app không lưu gì"}</span>
      )}
      {guide}
      {body}
    </div>
  );
}
