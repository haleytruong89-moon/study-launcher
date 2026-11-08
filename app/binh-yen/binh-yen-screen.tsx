"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import type { Avatar } from "@/lib/avatar";
import type { AvatarPics } from "@/lib/avatarPics";
import type { Quad, Voice } from "@/lib/binhYen/catalog";
import { HOTLINE_TEXT, VISIT_PING_MS } from "@/lib/binhYen/rules";
import { STUDY_CAP_TEXT } from "@/lib/binhYen/studyCap";
import { Breadcrumb, ChildNav } from "../child-nav";
import { Corner } from "./corner";
import { LookBack } from "./look-back";
import { Notebook } from "./notebook";
import { TalkPanel, type TalkInfoView } from "./talk-panel";

/** What the server answers (lib/binhYen/session.ts ByState). */
interface ByStateView {
  enabled: boolean;
  /** This browser has a visit going on. */
  open: boolean;
  studyMinutes: number;
  /** R5: when this visit ends (study time only), and the server time of this answer. */
  study: { minutes: number; endsAt: string } | null;
  /** R5: the visit reached the study-time limit; the server ended it. */
  capped: boolean;
  serverNow: string;
}

interface Child {
  id: string;
  name: string;
  color: string | null;
  icon: string | null;
  /** R3a: the child's character (or the default "Hình tạm" when avatarMine is false). */
  avatar: Avatar;
  /** R3b: Picrew pictures by face (shown instead of the drawn character). */
  pics: AvatarPics;
  avatarMine: boolean;
}

/** R7b: the "Nhìn lại" column sits beside the corner from this width (Tailwind `lg`). */
const WIDE = "(min-width: 1024px)";
function subscribeWide(onChange: () => void) {
  const m = window.matchMedia(WIDE);
  m.addEventListener("change", onChange);
  return () => m.removeEventListener("change", onChange);
}
/** Read in the browser only (the server and the first render say "narrow"). */
function useWide(): boolean {
  return useSyncExternalStore(subscribeWide, () => window.matchMedia(WIDE).matches, () => false);
}

/**
 * R7b "Nhìn lại 7 ngày": on a laptop a sticky column on the right; on a phone a closed
 * <details> after the talk card (loaded only once opened).
 */
function LookBackColumn(props: React.ComponentProps<typeof LookBack>) {
  const wide = useWide();
  const [open, setOpen] = useState(false);
  if (wide) {
    return (
      <aside aria-label="Nhìn lại 7 ngày" className="sticky top-5 flex max-h-[calc(100dvh-2.5rem)] flex-col gap-3 self-start overflow-y-auto rounded-2xl bg-white p-4">
        <h2 className="text-lg font-bold">Nhìn lại 7 ngày</h2>
        <LookBack {...props} />
      </aside>
    );
  }
  return (
    <aside aria-label="Nhìn lại 7 ngày" className="rounded-2xl bg-white">
      <details onToggle={(e) => setOpen(e.currentTarget.open)} className="group/look">
        <summary className="flex min-h-12 cursor-pointer items-center justify-between gap-2 px-4 text-lg font-bold marker:content-none">
          Nhìn lại 7 ngày
          <span aria-hidden className="text-ink/50 transition-transform group-open/look:rotate-90 motion-reduce:transition-none">
            ›
          </span>
        </summary>
        {open && (
          <div className="px-4 pb-4">
            <LookBack {...props} />
          </div>
        )}
      </details>
    </aside>
  );
}

/** After the study-time limit: the message stays this long, then back to Hôm nay. */
const CAP_REDIRECT_MS = 3_000;

async function call(method: "GET" | "POST", url: string): Promise<{ ok: boolean; data: (ByStateView & { error?: string }) | null }> {
  try {
    const res = await fetch(url, { method, cache: "no-store" });
    return { ok: res.ok, data: (await res.json().catch(() => null)) as never };
  } catch {
    return { ok: false, data: null };
  }
}

/**
 * Góc bình yên for the child. Parent decision 07/11/2026: NO separate PIN and NO idle lock —
 * being logged in as the child opens it. Every decision is still the server's: on/off and the
 * study-time limit (server clock, R5). The screen opens a visit (POST /api/by/open), tells the
 * server it is still there while visible, and asks again right when the limit is due — it
 * never decides itself. Nothing the child does here is logged; the only things sent are the
 * keys of a finished visit, to our own server.
 */
export function BinhYenScreen({ child, voice, initial, initialTalk, startQuad = null }: { child: Child; voice: Voice; initial: ByStateView | null; initialTalk: TalkInfoView | null; startQuad?: Quad | null }) {
  const router = useRouter();
  const [state, setState] = useState<ByStateView | null>(initial);
  /** Once the study-time limit is reached, this screen stays on its message (no new visit by itself). */
  const [capped, setCapped] = useState(!!initial?.capped);
  /** The corner stays on screen while a new visit starts (e.g. back after a while away). */
  const [shown, setShown] = useState(!!initial?.open);
  const [failed, setFailed] = useState(false);
  /** The "Nhắn bố mẹ" activity shows the talk card inside the visit (never two cards). */
  const [talkInline, setTalkInline] = useState(false);
  const opening = useRef(false);
  const color = child.color ?? "#2b5d4f";
  const firstName = child.name.trim().split(/\s+/).pop() ?? child.name;

  const accept = useCallback((s: unknown) => {
    const v = s as ByStateView | null | undefined;
    if (!v || typeof v.enabled !== "boolean") return;
    setState(v);
    setFailed(false);
    if (v.capped) setCapped(true);
    if (v.open) setShown(true);
  }, []);

  const refresh = useCallback(async () => {
    const { ok, data } = await call("GET", "/api/by/state");
    if (ok) accept(data);
    else setFailed(true);
  }, [accept]);

  const open = useCallback(async () => {
    if (opening.current) return;
    opening.current = true;
    const { ok, data } = await call("POST", "/api/by/open");
    opening.current = false;
    if (ok) accept(data);
    else setFailed(true);
  }, [accept]);

  // Corner on, no visit going on in this browser (first time, or back after a while): open one.
  const needsVisit = !capped && !failed && (state === null || (state.enabled && !state.open));
  useEffect(() => {
    if (!needsVisit) return;
    const id = window.setTimeout(() => void (state ? open() : refresh()), 0);
    return () => window.clearTimeout(id);
  }, [needsVisit, state, open, refresh]);

  // While the corner is on screen: "still here" every minute (server clock, last_seen_at), and
  // once more when the tab comes back. No idle lock: nothing here ever closes the corner.
  const visitOpen = !!state?.open && !capped;
  useEffect(() => {
    if (!visitOpen) return;
    const ping = () => void call("POST", "/api/by/ping").then(({ ok, data }) => ok && accept(data));
    const id = window.setInterval(() => {
      if (document.visibilityState === "visible") ping();
    }, VISIT_PING_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") ping();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [visitOpen, accept]);

  // R5: ask the server again right when this visit's study-time limit is due (server clock:
  // the delay is measured from the server's own "now", not the laptop's clock).
  const studyEndsAt = visitOpen ? (state?.study?.endsAt ?? null) : null;
  const serverNow = state?.serverNow ?? null;
  useEffect(() => {
    if (!studyEndsAt || !serverNow) return;
    const ms = Math.max(0, Date.parse(studyEndsAt) - Date.parse(serverNow)) + 1000;
    const id = window.setTimeout(() => void refresh(), Math.min(ms, 2_147_000_000));
    return () => window.clearTimeout(id);
  }, [studyEndsAt, serverNow, refresh]);

  // At the limit: the message, then back to Hôm nay — unless the child is in "Nhắn bố mẹ"
  // ("Con muốn nói chuyện" is never limited, R5 / §4).
  useEffect(() => {
    if (!capped || talkInline) return;
    const id = window.setTimeout(() => router.replace("/today"), CAP_REDIRECT_MS);
    return () => window.clearTimeout(id);
  }, [capped, talkInline, router]);

  const showTalk = !talkInline || capped || !shown;
  const talkAvailable = !!initialTalk && (initialTalk.available || !!initialTalk.status);
  // "Cần bố mẹ?": the "Con muốn nói chuyện" card when a parent phone can be reached (or a
  // signal is pending); otherwise an honest "find them in person" + 111 / 115.
  const talkCard = (
    <section aria-label="Cần bố mẹ?" className="flex flex-col">
      {talkAvailable ? (
        <TalkPanel initial={initialTalk ?? undefined} color={color} />
      ) : (
        <div className="flex flex-col gap-1 rounded-2xl border border-ink/10 bg-white p-4 text-sm">
          <h2 className="text-lg font-bold">Cần bố mẹ?</h2>
          <p>Con tìm bố mẹ trực tiếp để nói chuyện nhé. Cần nói chuyện ngay với ai đó? Con có thể {HOTLINE_TEXT}. Nguy hiểm ngay: gọi 115.</p>
        </div>
      )}
    </section>
  );
  const talk = showTalk ? talkCard : null;

  let content: React.ReactNode;
  if (capped) {
    content = (
      <div role="alert" className="flex flex-col gap-3 rounded-2xl bg-white p-5">
        <h2 className="text-xl font-bold">{STUDY_CAP_TEXT}</h2>
        <p className="text-sm text-ink/75">Trong giờ học, mỗi lần vào Góc bình yên tối đa {state?.studyMinutes ?? 10} phút. Vào lại lúc nào cũng được.</p>
        <Link href="/today" className="btn self-start text-white" style={{ background: color }}>
          Về Hôm nay
        </Link>
      </div>
    );
  } else if (failed && !shown) {
    content = (
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-5">
        <p role="alert">Chưa tải được Góc bình yên. Thử lại sau ít phút.</p>
        <button type="button" onClick={() => setFailed(false)} className="btn text-white" style={{ background: color }}>
          Thử lại
        </button>
      </div>
    );
  } else if (state && !state.enabled) {
    content = (
      <div className="flex flex-col gap-2 rounded-2xl bg-white p-5">
        <h2 className="text-xl font-bold">Góc bình yên chưa mở.</h2>
        <p className="text-ink/75">Bố mẹ sẽ bật cùng con.</p>
      </div>
    );
  } else if (state && shown) {
    content = (
      <Corner
        voice={voice}
        firstName={firstName}
        color={color}
        icon={child.icon}
        avatar={child.avatar}
        pics={child.pics}
        avatarMine={child.avatarMine}
        state={state}
        onState={accept}
        onTalkInline={setTalkInline}
        talk={talkCard}
        startQuad={startQuad}
      />
    );
  } else {
    content = (
      <p role="status" className="rounded-2xl bg-white p-5 text-ink/75">
        Đang mở Góc bình yên…
      </p>
    );
  }

  // R7b: the "Nhìn lại" column only beside an open corner (not on the limit or "chưa mở" messages).
  const side = !!state?.enabled && shown && !capped;
  // Laptop: corner (28rem) + gap + column (380px) + padding; the header lines up with it.
  const width = side ? "max-w-md lg:max-w-[55.25rem]" : "max-w-md";

  return (
    <div className="min-h-dvh bg-bg pb-24 lg:pb-0 lg:pl-52">
      <header className="text-white" style={{ background: color }}>
        <div className={`mx-auto flex ${width} items-center gap-3 px-4 pt-5 pb-4`}>
          <Link href="/today" className="-ml-1 inline-flex min-h-11 items-center px-1 text-sm font-bold">
            ‹ Hôm nay
          </Link>
          <h1 className="ml-auto text-xl font-bold">🌿 Góc bình yên</h1>
        </div>
      </header>
      <main className={`mx-auto flex ${width} flex-col gap-5 px-4 py-5 ${side ? "lg:grid lg:grid-cols-[minmax(0,28rem)_380px] lg:items-start lg:gap-6" : ""}`}>
        <div className="flex min-w-0 flex-col gap-5">
          <Breadcrumb trail={["Hôm nay", "Góc bình yên"]} onBack={() => (window.history.length > 1 ? router.back() : router.push("/today"))} />
          {content}
          {talk}
        </div>
        {side && <LookBackColumn voice={voice} firstName={firstName} color={color} look={child.avatar} pics={child.pics} notebook={voice === "detective" ? <Notebook /> : <Notebook deck="scientist" />} />}
      </main>
      {/* R2: the child's 5 tabs. This page exists only when the corner is on, so it is listed. */}
      <ChildNav active="binh-yen" byEnabled={state?.enabled !== false} color={color} voice={voice} />
    </div>
  );
}
