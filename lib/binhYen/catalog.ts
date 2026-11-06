/**
 * Góc bình yên — fixed lists for S-BY1 (docs/BINH_YEN.md §2.2 by_catalog, R1; BINH_YEN_CATALOG.md).
 *
 * PURE DATA + tiny helpers, safe in browser and server code. Copied from the prototype the
 * children tried (words, quadrant names, activity texts, mentor lines, An's "bí mật của não",
 * the R1 weights) with the R1 corrections of BINH_YEN.md §5 and BINH_YEN_CATALOG.md §B.
 *
 * S-BY1 decision: these lists live in this typed module, not yet in a `by_catalog` table.
 * There is no parent editor yet, and the R1 gold tests must test exactly what production
 * runs. When a parent editor arrives (S-BY3, with causes and lessons), the same shape moves
 * to `by_catalog` and these values become its seed. Keys are stable forever: a removed word
 * or activity gets `retired: true` (old check-ins still show its label), never deleted.
 *
 * The server stores only the KEYS (`quad`, `word_key`, `activity_key`), never free text (D1).
 */

/** Who the corner talks like. Scientist = An (lớp 6), detective = Nguyên (lớp 9). */
export type Voice = "scientist" | "detective";

/**
 * The voice comes from the child's grade (lớp ≤ 7 → nhà khoa học, otherwise thám tử).
 * Not a family rule: it only changes wording and which activities are offered.
 */
export function voiceFor(grade: number | null | undefined): Voice {
  return typeof grade === "number" && grade <= 7 ? "scientist" : "detective";
}

// ---------------------------------------------------------------------------
// Quadrants
// ---------------------------------------------------------------------------

export const QUAD_KEYS = ["red", "yellow", "blue", "green"] as const;
export type Quad = (typeof QUAD_KEYS)[number];

export function isQuad(v: unknown): v is Quad {
  return typeof v === "string" && (QUAD_KEYS as readonly string[]).includes(v);
}

/** Yellow + green feel pleasant; red + blue unpleasant (intensity 1–5 asked only for these). */
export function isPleasant(q: Quad): boolean {
  return q === "yellow" || q === "green";
}

export interface QuadInfo {
  label: string;
  sub: string;
  icon: "volcano" | "sun" | "sea" | "forest" | "folder";
}

export const QUADS: Record<Voice, Record<Quad, QuadInfo>> = {
  scientist: {
    red: { icon: "volcano", label: "Núi lửa", sub: "tức, lo, căng thẳng" },
    yellow: { icon: "sun", label: "Mặt trời", sub: "vui, hào hứng, tò mò" },
    blue: { icon: "sea", label: "Biển sâu", sub: "buồn, chán, mệt" },
    green: { icon: "forest", label: "Khu rừng", sub: "bình yên, thư thái" },
  },
  detective: {
    red: { icon: "folder", label: "Hồ sơ đỏ", sub: "giận, lo, căng thẳng" },
    yellow: { icon: "folder", label: "Hồ sơ vàng", sub: "vui, hào hứng, tự hào" },
    blue: { icon: "folder", label: "Hồ sơ lam", sub: "buồn, chán, mệt" },
    green: { icon: "folder", label: "Hồ sơ lục", sub: "bình yên, thư thái" },
  },
};

/** Calm colours per quadrant (prototype palette): strong + soft. */
export const QUAD_COLORS: Record<Quad, { c: string; soft: string }> = {
  red: { c: "#C9553F", soft: "#F6DED8" },
  yellow: { c: "#A87A0E", soft: "#F7ECCB" },
  blue: { c: "#4C70A8", soft: "#DCE5F3" },
  green: { c: "#4E8C63", soft: "#DCEDE0" },
};

// ---------------------------------------------------------------------------
// Words (same list for both children, as in the prototype)
// ---------------------------------------------------------------------------

export interface Word {
  key: string;
  quad: Quad;
  label: string;
  def: string;
  retired?: boolean;
}

export const WORDS: readonly Word[] = [
  { quad: "red", key: "tuc_gian", label: "tức giận", def: "Có gì đó không công bằng hoặc vượt quá sức chịu đựng." },
  { quad: "red", key: "buc_boi", label: "bực bội", def: "Khó chịu vì mọi thứ không như ý, nhỏ hơn tức giận." },
  { quad: "red", key: "lo_lang", label: "lo lắng", def: "Đầu nghĩ mãi về điều có thể xảy ra." },
  { quad: "red", key: "cang_thang", label: "căng thẳng", def: "Quá nhiều việc cùng lúc, người như dây đàn căng." },
  { quad: "red", key: "hoang", label: "hoảng", def: "Mọi thứ đến quá nhanh, không kịp nghĩ." },
  { quad: "red", key: "ghen_ti", label: "ghen tị", def: "Muốn có điều người khác đang có." },
  { quad: "yellow", key: "vui", label: "vui", def: "Nhẹ, sáng, muốn cười." },
  { quad: "yellow", key: "hao_hung", label: "hào hứng", def: "Mong chờ điều gì đó sắp tới." },
  { quad: "yellow", key: "tu_hao", label: "tự hào", def: "Biết mình đã cố gắng và làm được." },
  { quad: "yellow", key: "to_mo", label: "tò mò", def: "Muốn biết thêm, muốn thử." },
  { quad: "yellow", key: "phan_khich", label: "phấn khích", def: "Vui đến mức không ngồi yên được." },
  { quad: "yellow", key: "tran_nang_luong", label: "tràn năng lượng", def: "Như có thể làm được mọi thứ." },
  { quad: "blue", key: "buon", label: "buồn", def: "Lòng trĩu xuống, có thể muốn khóc." },
  { quad: "blue", key: "chan", label: "chán", def: "Không có gì làm mình hứng thú." },
  { quad: "blue", key: "met", label: "mệt", def: "Cơ thể hoặc đầu óc đã dùng hết pin." },
  { quad: "blue", key: "co_don", label: "cô đơn", def: "Thấy như không ai hiểu mình." },
  { quad: "blue", key: "that_vong", label: "thất vọng", def: "Điều mình mong đã không xảy ra." },
  { quad: "blue", key: "tui_than", label: "tủi thân", def: "Buồn vì thấy mình bị đối xử chưa đúng." },
  { quad: "green", key: "binh_yen", label: "bình yên", def: "Trong lòng yên, không có gì phải vội." },
  { quad: "green", key: "thu_thai", label: "thư thái", def: "Thả lỏng, dễ chịu." },
  { quad: "green", key: "biet_on", label: "biết ơn", def: "Thấy may mắn vì có ai đó, điều gì đó." },
  { quad: "green", key: "nhe_nhom", label: "nhẹ nhõm", def: "Một gánh nặng vừa được đặt xuống." },
  { quad: "green", key: "an_toan", label: "an toàn", def: "Biết mình đang được che chở." },
  { quad: "green", key: "man_nguyen", label: "mãn nguyện", def: "Thấy đủ, không cần thêm gì." },
];

export function wordsFor(quad: Quad): Word[] {
  return WORDS.filter((w) => w.quad === quad && !w.retired);
}

export function findWord(key: string): Word | undefined {
  return WORDS.find((w) => w.key === key);
}

// ---------------------------------------------------------------------------
// Activities
// ---------------------------------------------------------------------------

/** What a kind of care gives: calm down, the body, moving, thinking, people, keeping a good moment… */
export type Need = "calm" | "body" | "move" | "think" | "express" | "connect" | "savor" | "create";

/**
 * How the activity screen works. Every screen has a "Xong" button at any time; timers only guide.
 * S-BY1 has NO text box: activities that used to need typing are done in the head or on paper.
 */
export type ActivityUi =
  | "breath"
  | "whale"
  | "timer"
  | "moves"
  | "steps"
  | "checks"
  | "heart"
  | "jar"
  | "bubbles"
  | "body"
  | "sky"
  | "people"
  | "talk";

export interface ActivityText {
  title: string;
  desc: string;
  minutes: string;
  /** Short line after "Xong". */
  done: string;
  /** Step lines (ui steps / checks / moves), or the guidance shown above a timer. */
  steps?: string[];
}

export interface Activity {
  key: string;
  ui: ActivityUi;
  /** Seconds for timer-like screens (timer, moves per step, observe). */
  seconds?: number;
  /** Kind of care it gives, with a weight (1 unless said). */
  tags: Partial<Record<Need, number>>;
  /** Offered only for these quadrants (null = all). */
  quads?: Quad[];
  /** Offered by the weights only when its score reaches this (talk: only for a strong need). */
  minScore?: number;
  /** false = never the FIRST suggestion when something doable right now is in the three. */
  lead?: boolean;
  /** Extra weight when the child picked this word (R1 corrections, BINH_YEN §5 #6 #7). */
  boost?: Record<string, number>;
  /** "Làm trong đầu / ra giấy" label (the S-BY1 replacement of a text box). */
  offline?: "head" | "paper";
  text: Partial<Record<Voice, ActivityText>>;
  retired?: boolean;
}

const both = (t: ActivityText): Record<Voice, ActivityText> => ({ scientist: t, detective: t });

export const ACTIVITIES: readonly Activity[] = [
  {
    key: "thought_case",
    ui: "steps",
    tags: { think: 1 },
    offline: "head",
    text: {
      detective: {
        title: "Hỏi lại cái đầu",
        desc: "Đầu đang nói câu nặng nề? Nói lại với mình tử tế như nói với bạn thân.",
        minutes: "2 phút",
        done: "Con vừa nói với mình tử tế như nói với bạn. Đó là một kỹ năng thật đấy.",
        steps: [
          "Bước 1. Nghĩ thầm câu nặng nề đang vang trong đầu, đúng như nó nói. Không cần viết ra.",
          "Bước 2. Tưởng tượng người bạn thân nhất cũng tự nói y câu đó về bản thân bạn ấy. Con sẽ nói lại với bạn thế nào? Nói thầm trong đầu.",
          "Bước 3. Giờ nói câu tử tế đó với chính mình. Mình thường dịu dàng với bạn hơn với bản thân — con cũng xứng đáng được nghe câu đó.",
        ],
      },
    },
  },
  {
    key: "breath",
    ui: "breath",
    tags: { calm: 1 },
    text: {
      detective: {
        title: "Thở cho dịu lại",
        desc: "Hít 4 · giữ 4 · thở ra 6. Vài hơi là người và đầu dịu bớt.",
        minutes: "1 phút",
        done: "Đầu đã nguội bớt. Giờ nhìn mọi thứ sẽ rõ hơn.",
        steps: ["Theo vòng tròn: to ra khi hít vào, nhỏ lại khi thở ra. 5 hơi là xong."],
      },
    },
  },
  {
    key: "rest",
    ui: "timer",
    seconds: 180,
    tags: { body: 1, calm: 1 },
    quads: ["blue"],
    lead: false,
    text: {
      detective: {
        title: "Nghỉ một chút / ngủ sớm",
        desc: "Ngồi tựa hoặc nằm, nhắm mắt 3 phút. Tối nay đi ngủ sớm hơn một chút.",
        minutes: "3 phút",
        done: "Pin vừa được sạc thêm một chút. Tối nay nhớ ngủ sớm nhé.",
        steps: ["Ngồi tựa lưng hoặc nằm xuống, nhắm mắt, thả lỏng vai. Không cần làm gì cả.", "Tối nay: đi ngủ sớm hơn khoảng 15 phút. Thiếu ngủ làm cảm xúc dễ bùng — không phải con tệ, là pin yếu."],
      },
    },
  },
  {
    key: "dance",
    ui: "timer",
    seconds: 120,
    tags: { move: 1 },
    boost: { chan: 3 },
    text: {
      detective: {
        title: "Nhảy theo một bài nhạc",
        desc: "Bật bài con thích, nhảy tự do 2 phút cho năng lượng chạy ra ngoài.",
        minutes: "2 phút",
        done: "Năng lượng đã được xả ra.",
        steps: ["Bật một bài con thích bằng thứ con có (app không mở nhạc), đứng dậy và nhảy tự do 2 phút. Không ai xem đâu."],
      },
    },
  },
  {
    key: "talk",
    ui: "talk",
    tags: { connect: 1 },
    minScore: 6,
    text: both({ title: "Nhắn bố mẹ", desc: "Con không cần giải thích, chỉ cần bấm.", minutes: "10 giây", done: "Con đã làm một việc can đảm: cho bố mẹ biết con cần họ." }),
  },
  {
    key: "share",
    ui: "people",
    tags: { connect: 1, savor: 1 },
    text: {
      detective: { title: "Kể cho một người", desc: "Niềm vui chia ra thì to thêm, chuyện nặng chia ra thì nhẹ bớt.", minutes: "2 phút", done: "Kể ra rồi. Chia sẻ là một cách chăm sóc mình." },
      scientist: { title: "Kể cho một người", desc: "Niềm vui chia ra thì to thêm, chuyện nặng chia ra thì nhẹ bớt.", minutes: "2 phút", done: "Kể ra rồi. Chia sẻ là một cách chăm sóc mình." },
    },
  },
  {
    key: "evidence",
    ui: "checks",
    tags: { savor: 1 },
    quads: ["red", "blue"],
    offline: "head",
    text: {
      detective: {
        title: "3 bằng chứng hôm nay không tệ",
        desc: "Thám tử tìm cả bằng chứng tốt: 3 điều nhỏ cho thấy hôm nay vẫn ổn.",
        minutes: "2 phút",
        done: "Ba bằng chứng đã vào hồ sơ. Hôm nay không tệ như cảm giác.",
        steps: ["Bằng chứng 1 (ví dụ: bữa trưa ngon)", "Bằng chứng 2 (ví dụ: làm xong một bài khó)", "Bằng chứng 3 (ví dụ: có người nhắn hỏi thăm)"],
      },
    },
  },
  {
    key: "gratitude",
    ui: "checks",
    tags: { savor: 1 },
    offline: "head",
    text: both({
      title: "3 điều biết ơn",
      desc: "Nhỏ thôi cũng được: cốc nước mát, một câu chào.",
      minutes: "2 phút",
      done: "Ba điều nhỏ, một lòng biết ơn.",
      steps: ["Điều 1 (ví dụ: bữa cơm ở nhà)", "Điều 2", "Điều 3"],
    }),
  },
  {
    key: "savor",
    ui: "steps",
    tags: { savor: 1 },
    boost: { chan: 1, tu_hao: 4 },
    offline: "paper",
    text: both({
      title: "Giữ lại khoảnh khắc",
      desc: "Nhớ thật rõ một điều vừa vui. Muốn giữ lâu hơn thì vẽ hoặc viết ra giấy.",
      minutes: "1 phút",
      done: "Khoảnh khắc này là của con. Lần sau mệt, nhớ lại nó nhé.",
      steps: [
        "Nhắm mắt khoảng 30 giây, nhớ lại thật rõ: chuyện gì, ở đâu, với ai, cảm giác trong người ra sao.",
        "Muốn giữ lâu hơn? Vẽ một khung hoặc viết một câu ra giấy, cất vào chỗ của con. App không lưu gì.",
      ],
    }),
  },
  // --- An (nhà khoa học) ---
  {
    key: "heart",
    ui: "heart",
    tags: { body: 1, calm: 1 },
    text: {
      scientist: {
        title: "Thí nghiệm: đo nhịp tim",
        desc: "Đo nhịp tim, thở như cá voi 1 phút, rồi đo lại. Hơi thở có làm tim chậm lại không?",
        minutes: "3 phút",
        done: "Thí nghiệm hoàn thành! Nhà khoa học vừa kiểm tra một giả thuyết.",
      },
    },
  },
  {
    key: "jar",
    ui: "jar",
    tags: { calm: 1 },
    text: {
      scientist: {
        title: "Lọ bình tĩnh",
        desc: "Lắc lọ kim tuyến, nhìn nó lắng xuống như đầu óc mình lắng xuống.",
        minutes: "1 phút",
        done: "Kim tuyến đã lắng. Đầu óc con cũng vậy chưa?",
      },
    },
  },
  {
    key: "volcano",
    ui: "steps",
    tags: { move: 1 },
    text: {
      scientist: {
        title: "Núi lửa trong lọ",
        desc: "Baking soda + giấm, làm cùng bố mẹ. Cơn giận cần lối thoát an toàn.",
        minutes: "5 phút",
        done: "Núi lửa đã phun. Nếu vẫn còn giận, thử thở như cá voi nhé.",
        steps: [
          "Chỉ làm khi có bố mẹ ở cạnh nhé.",
          "Đặt một cốc nhỏ trong khay hoặc bồn rửa. Cho 2 thìa baking soda vào cốc.",
          "Đổ từ từ nửa cốc giấm vào và quan sát!",
          "Khoa học: baking soda (một bazơ) gặp giấm (một axit) tạo ra khí CO₂. Khí cần thoát ra nên bọt trào lên.",
        ],
      },
    },
  },
  {
    key: "bubbles",
    ui: "bubbles",
    tags: { calm: 1 },
    text: {
      scientist: {
        title: "Thổi bong bóng chậm",
        desc: "Bong bóng to nhất khi thở ra chậm và đều. Thổi 3 quả.",
        minutes: "1 phút",
        done: "3 quả bong bóng, 3 hơi thở chậm. Lo lắng đã nhỏ lại chưa?",
      },
    },
  },
  {
    key: "whale",
    ui: "whale",
    tags: { calm: 1 },
    text: {
      scientist: {
        title: "Thở như cá voi",
        desc: "Cá voi thở rất chậm và sâu. Mình thở cùng nó 5 hơi.",
        minutes: "1 phút",
        done: "Thở cùng cá voi xong rồi. Chú chó canh cửa đã yên chưa?",
        steps: ["Cá voi xanh có thể nín thở nhiều phút dưới biển. Mình chỉ cần thở thật chậm cùng nó: to ra khi hít vào, nhỏ lại khi thở ra."],
      },
    },
  },
  {
    key: "body",
    ui: "body",
    tags: { body: 1 },
    text: {
      scientist: {
        title: "Thí nghiệm cơ thể",
        desc: "Cảm xúc đang nằm ở đâu trong người? Chạm vào chỗ đó.",
        minutes: "1 phút",
        done: "Thí nghiệm hoàn thành! Con vừa đọc được tín hiệu của cơ thể mình.",
      },
    },
  },
  {
    key: "sky",
    ui: "sky",
    tags: { calm: 1, savor: 1 },
    text: {
      scientist: {
        title: "Trạm quan sát bầu trời",
        desc: "1 phút nhìn trời, xem hình dạng Mặt Trăng hôm nay.",
        minutes: "1 phút",
        done: "Một ngôi sao vừa được thắp trên bầu trời của con.",
      },
    },
  },
  {
    key: "observe",
    ui: "timer",
    seconds: 60,
    tags: { calm: 1, savor: 1 },
    text: {
      scientist: {
        title: "Quan sát như nhà khoa học",
        desc: "Nhìn thật kỹ một chiếc lá, đám mây hay con kiến trong 1 phút.",
        minutes: "1 phút",
        done: "Nhà khoa học nào cũng bắt đầu bằng việc nhìn thật kỹ. Nhớ phát hiện của con để kể nhé.",
        steps: ["Chọn một thứ: chiếc lá, đám mây ngoài cửa sổ, con kiến, bàn tay mình. Nhìn thật kỹ trong 1 phút như lần đầu tiên thấy nó."],
      },
    },
  },
  {
    key: "curious",
    ui: "steps",
    tags: { create: 1, savor: 1 },
    offline: "head",
    text: {
      scientist: {
        title: "Câu hỏi tò mò của hôm nay",
        desc: "Nghĩ một câu hỏi về thế giới. Tối nay hỏi bố mẹ để cùng tìm câu trả lời.",
        minutes: "1 phút",
        done: "Câu hỏi hay là khởi đầu của mọi khám phá.",
        steps: ["Đang vui là lúc não thích học nhất! Con muốn biết điều gì về thế giới?", "Ví dụ: Vì sao bầu trời màu xanh? Cá có ngủ không? Ngôi sao gần nhất cách bao xa?", "Nhớ câu hỏi trong đầu (hoặc ghi ra giấy), tối nay hỏi bố mẹ để cùng tìm."],
      },
    },
  },
  {
    key: "release",
    ui: "steps",
    tags: { express: 1 },
    offline: "paper",
    text: {
      scientist: {
        title: "Viết ra giấy rồi buông",
        desc: "Viết hết ra một tờ giấy, rồi vò lại hoặc xé nhỏ. Không ai đọc.",
        minutes: "tùy con",
        done: "Buông rồi! Lòng con nhẹ hơn chưa?",
        steps: ["Lấy một tờ giấy nháp. Viết hết ra, không cần hay, không cần đúng chính tả.", "Xong thì vò lại, xé nhỏ, hoặc gấp lại thật nhỏ rồi bỏ đi. App không lưu gì cả."],
      },
    },
  },
  {
    key: "move",
    ui: "moves",
    seconds: 30,
    tags: { move: 1 },
    text: {
      scientist: {
        title: "Nhảy như con vật",
        desc: "Nhảy như kangaroo, vươn như hươu cao cổ, lắc như chó vừa tắm.",
        minutes: "2 phút",
        done: "Năng lượng đã được xả ra.",
        steps: ["Nhảy như kangaroo", "Vươn cổ cao như hươu cao cổ", "Lắc người như chú chó vừa tắm", "Bước chậm như gấu trúc"],
      },
    },
  },
];

/** Each child's own list, in the prototype's order (the order breaks ties). */
export const POOLS: Record<Voice, readonly string[]> = {
  detective: ["thought_case", "breath", "rest", "dance", "talk", "share", "evidence", "gratitude", "savor"],
  scientist: ["heart", "jar", "volcano", "bubbles", "whale", "body", "sky", "observe", "curious", "release", "move", "talk", "share", "gratitude", "savor"],
};

export function findActivity(key: string): Activity | undefined {
  return ACTIVITIES.find((a) => a.key === key);
}

export function activityText(a: Activity, voice: Voice): ActivityText {
  return a.text[voice] ?? a.text.detective ?? (a.text.scientist as ActivityText);
}

/** True when this child may pick this activity (it is in their own list and not retired). */
export function activityAllowed(voice: Voice, key: string): boolean {
  const a = findActivity(key);
  return !!a && !a.retired && POOLS[voice].includes(key);
}

// ---------------------------------------------------------------------------
// R1 weights (prototype NEED / WORD_NEED / causeNeed + BINH_YEN_CATALOG §B)
// ---------------------------------------------------------------------------

export type NeedMap = Partial<Record<Need, number>>;

/** The quadrant says which kind of care fits. */
export const QUAD_NEED: Record<Quad, NeedMap> = {
  red: { calm: 3, body: 3, move: 3, think: 2, express: 1 },
  blue: { connect: 3, savor: 2, calm: 2, create: 1, express: 1, think: 1 },
  yellow: { savor: 3, create: 3, connect: 2, move: 1 },
  green: { savor: 3, calm: 2, create: 1 },
};

/** The exact word adds weight. CATALOG §B: "tự hào" savor 2 → 3. */
export const WORD_NEED: Record<string, NeedMap> = {
  co_don: { connect: 3 },
  chan: { create: 2, move: 2 },
  met: { calm: 2, body: 1 },
  lo_lang: { calm: 2, think: 2 },
  hoang: { calm: 3 },
  ghen_ti: { think: 2, savor: 1 },
  tuc_gian: { move: 2 },
  buc_boi: { move: 2 },
  cang_thang: { calm: 2, body: 1 },
  tui_than: { connect: 2, express: 1 },
  that_vong: { think: 2, savor: 1 },
  buon: { connect: 2, savor: 1, express: 1 },
  to_mo: { create: 2 },
  tu_hao: { savor: 3, connect: 1 },
  phan_khich: { move: 1 },
  tran_nang_luong: { move: 1 },
  biet_on: { connect: 1, savor: 1 },
};

/**
 * Per-child word weights that replace the shared ones. CATALOG §B: "chán" move 2 → 3 is for
 * Nguyên (gold example #6); for An it would push "Núi lửa" above "Kể cho 1 người" (#11).
 */
export const WORD_NEED_BY_VOICE: Partial<Record<Voice, Record<string, NeedMap>>> = {
  detective: { chan: { create: 2, move: 3 } },
};

/** Cause keys (chosen in S-BY3; S-BY1 never sends one). */
export const CAUSE_NEED: Record<string, NeedMap> = {
  nguit: { body: 3, calm: 1 },
  doi: { body: 3, calm: 1 },
  baitap: { think: 3, calm: 1 },
  truong: { think: 3, calm: 1 },
  banbe: { connect: 3 },
  giadinh: { connect: 3 },
  chi: { connect: 3 },
  dienthoai: { move: 2, create: 1 },
  manhinh: { move: 2, create: 1 },
  ve: { savor: 2, create: 2 },
  nhac: { savor: 2, create: 2 },
  truyen: { savor: 2, create: 2 },
  khampha: { savor: 2, create: 2 },
  convat: { savor: 2, create: 2 },
  ngoaitroi: { savor: 2, create: 2 },
  vandong: { savor: 2, create: 2 },
  mamay: {},
};

// ---------------------------------------------------------------------------
// Voice lines (prototype MENTOR, An's BRAIN facts, acknowledgement step)
// ---------------------------------------------------------------------------

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One mentor line on the suggestion screen. `name` = the child's first name. */
export function mentorLine(voice: Voice, quad: Quad, word: string, name: string): string {
  if (voice === "detective") {
    return {
      red: `“${word}”. Lúc đang nóng thì chưa nên kết luận gì. Làm dịu người một chút trước — thở, hoặc cho năng lượng chạy ra ngoài — rồi tính.`,
      blue: `${cap(word)}. Những lúc thế này đầu hay nói “mình dở lắm”, “chẳng ai hiểu mình”. Thử hỏi lại cái đầu xem nó có đang nói quá không.`,
      yellow: `${cap(word)}! Một ngày như vậy đáng được giữ lại. Chọn một cách để sau này nhớ lại vẫn còn nguyên cảm giác.`,
      green: `${cap(word)}. Đầu óc yên là lúc nghĩ rõ nhất. Tận hưởng nó một chút.`,
    }[quad];
  }
  return {
    red: `Ồ, “${word}”! Núi lửa trong ${name} đang sôi rồi. Mình làm một thí nghiệm nhỏ để nó nguội bớt nhé.`,
    blue: `${name} đang ${word}. Biển sâu tối và lạnh, nhưng ở dưới đó vẫn có rất nhiều sinh vật phát sáng. Mình chọn một việc dễ thương để chăm sóc mình nào.`,
    yellow: `Yay, “${word}”! ${name} đang đầy năng lượng mặt trời. Lúc này não học điều mới nhanh nhất đấy!`,
    green: `“${cap(word)}” là cảm xúc của khu rừng yên tĩnh. Nhà thám hiểm giỏi biết dừng lại để quan sát. Mình thử nhé?`,
  }[quad];
}

/** An: how the brain / body works, in plain words (prototype BRAIN). */
export const BRAIN: Record<Quad, { head: string; body: string }> = {
  red: { head: "Bí mật của não", body: "Trong não có một “chú chó canh cửa” tên là hạch hạnh nhân. Khi con tức hay lo, chú sủa vang: tim đập nhanh, cơ căng lên, người nóng bừng. Thở chậm là cách nói với chú: “an toàn rồi”." },
  blue: { head: "Bí mật của cơ thể", body: "Khi buồn, cơ thể chậm lại để mình được nghỉ. Nhiều nhà khoa học cho rằng khóc cũng giúp cơ thể dịu xuống. Buồn không phải là hỏng, nó là tín hiệu “mình cần được chăm sóc”." },
  yellow: { head: "Bí mật của não", body: "Khi vui hay tò mò, não tiết ra dopamine, chất làm mình muốn khám phá và học thêm. Đây là lúc học điều mới vào đầu nhanh nhất!" },
  green: { head: "Bí mật của cơ thể", body: "Khi thấy yên, hệ thần kinh “nghỉ ngơi” đang làm việc: tim chậm lại, hơi thở sâu hơn, cơ thể tự sửa chữa. Giống khu rừng ban đêm, im lặng mà rất bận." },
};

export interface Ack {
  title: string;
  text: string;
}

/** The acknowledgement step after the word (prototype showAck). */
export function ackFor(voice: Voice, quad: Quad, word: string): Ack {
  if (isPleasant(quad)) {
    return voice === "scientist"
      ? { title: "Một phát hiện vui!", text: `“${cap(word)}” là một cảm xúc đẹp. Mình cùng tận hưởng một chút nhé.` }
      : { title: "Giữ lấy cảm giác này", text: `“${cap(word)}” là điều đáng giữ. Mình cùng tận hưởng nó một chút nhé.` };
  }
  return voice === "scientist"
    ? { title: "Dừng lại một chút nào", text: `Thấy “${word}” là một dữ kiện thú vị. Nhà khoa học giỏi làm dịu người trước, rồi mới quan sát.` }
    : { title: "Ổn thôi, mình ở đây", text: `Thấy “${word}” là chuyện bình thường, ai cũng có lúc vậy. Chưa cần phân tích gì — mình làm dịu một chút trước đã.` };
}

export const INTENSITY_LABELS = ["Nhẹ", "Hơi", "Vừa", "To", "Rất to"] as const;

export interface HomeCopy {
  greeting: string;
  sub: string;
  meterTitle: string;
  wordsTitle: string;
  wordsHint: string;
}

export function homeCopy(voice: Voice, name: string): HomeCopy {
  return voice === "scientist"
    ? {
        greeting: `Chào nhà thám hiểm ${name}!`,
        sub: `Hôm nay trong lòng ${name} đang là vùng đất nào? Mình cùng khám phá nhé.`,
        meterTitle: `Chọn vùng đất giống ${name} nhất lúc này`,
        wordsTitle: "Gọi tên nó nhé",
        wordsHint: `Chạm vào từng từ để xem nghĩa, rồi chọn từ giống ${name} nhất.`,
      }
    : {
        greeting: `Chào ${name}.`,
        sub: "Hồ sơ hôm nay đã mở. Trong lòng đang có manh mối gì?",
        meterTitle: "Chọn tập hồ sơ gần nhất với con lúc này",
        wordsTitle: "Nhận diện manh mối",
        wordsHint: "Chọn từ gần đúng nhất. Gọi đúng tên cảm xúc đã giúp nó dịu đi một chút.",
      };
}

/** "Vậy là đủ cho hôm nay": naming the feeling counts as done. */
export function enoughLine(word: string): string {
  return `Gọi được tên “${word}” là con đã làm được một việc rồi. Vậy là đủ cho hôm nay.`;
}
