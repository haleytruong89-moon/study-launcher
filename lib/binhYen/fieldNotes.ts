/**
 * Sổ tay nhà khoa học — An's daily, optional science cards in Góc bình yên (R7d).
 *
 * PURE DATA + tiny pure helpers, safe in browser and server code. The scientist-voice sibling
 * of Nguyên's Hồ sơ mật (lib/binhYen/dossier.ts), and it reuses that deck's selection rule.
 * Animals and nature linked to feelings, plus a few brain / feelings / mini-experiment cards,
 * written for an 11–12-year-old. Not therapy and not advice about anyone's health. The parent
 * reads every card in docs/binh-yen/SO_TAY_KHOA_HOC.md (generated from this file by
 * scripts/field-notes-doc.ts, with every source link) before merging.
 *
 * Content rules (R7d spec "Safety for an 11-year-old"): nothing scary or sad about animals (no
 * predation, injury, death, extinction doom, no animal-testing distress), no clinical words,
 * no "con nên / con phải", no comparison with other children, no self-harm / eating / weight /
 * body-image topics, every claim hedged and sourced, never "an animal feels exactly like us"
 * (say what scientists observed and how they interpret it). tests/fieldNotes.test.ts enforces
 * the checkable parts.
 *
 * Keys are stable forever (the notebook stores them on the child's device). A card that is
 * withdrawn later keeps its key out of reuse.
 *
 * Nothing about which card was read goes to the server, logs or parents.
 */
import type { Quad } from "./catalog";
import { pickDossier, type Dossier } from "./dossier";

/**
 * Nine topics, 80 cards in all, written in two halves (parent's decision, 08/11/2026).
 * First half, feelings-linked (40): dong_vat, thien_nhien, bo_nao, cam_xuc, thi_nghiem.
 * Second half, pure nature-science knowledge (40, added later): ky_thu, trai_dat, vu_tru, cay_coi.
 * A topic with no cards yet is simply not offered (the UI shows chips for `activeScienceTopics()` only).
 */
export type ScienceTopic = "dong_vat" | "ky_thu" | "thien_nhien" | "trai_dat" | "vu_tru" | "cay_coi" | "bo_nao" | "cam_xuc" | "thi_nghiem";

/** Same fields as Nguyên's `Dossier`; only the topic set differs. */
export interface FieldNote extends Omit<Dossier, "topic"> {
  topic: ScienceTopic;
}

/** Chip order in the UI. */
export const SCIENCE_TOPIC_KEYS = ["dong_vat", "ky_thu", "thien_nhien", "trai_dat", "vu_tru", "cay_coi", "bo_nao", "cam_xuc", "thi_nghiem"] as const satisfies readonly ScienceTopic[];

export const SCIENCE_TOPICS: Record<ScienceTopic, { label: string; emoji: string }> = {
  dong_vat: { label: "Động vật cũng có cảm xúc", emoji: "🐾" },
  ky_thu: { label: "Động vật kỳ thú", emoji: "🦎" },
  thien_nhien: { label: "Thiên nhiên làm dịu", emoji: "🌿" },
  trai_dat: { label: "Trái Đất kỳ diệu", emoji: "🌋" },
  vu_tru: { label: "Vũ trụ bao la", emoji: "🌌" },
  cay_coi: { label: "Cây cối thông minh", emoji: "🌱" },
  bo_nao: { label: "Bộ não của con", emoji: "🧠" },
  cam_xuc: { label: "Cảm xúc là gì", emoji: "💛" },
  thi_nghiem: { label: "Thí nghiệm nhỏ", emoji: "🔬" },
};

/** How many cards each topic will have when the deck is complete (80 in all). Tests check topics that have cards. */
export const SCIENCE_TOPIC_TARGET: Record<ScienceTopic, number> = {
  dong_vat: 12,
  ky_thu: 12,
  thien_nhien: 8,
  trai_dat: 10,
  vu_tru: 10,
  cay_coi: 8,
  bo_nao: 8,
  cam_xuc: 6,
  thi_nghiem: 6,
};

export function isScienceTopic(v: unknown): v is ScienceTopic {
  return typeof v === "string" && (SCIENCE_TOPIC_KEYS as readonly string[]).includes(v);
}

export const FIELD_NOTES: readonly FieldNote[] = [
  // -------------------------------------------------------------------------
  // 🐾 Động vật cũng có cảm xúc
  // -------------------------------------------------------------------------
  {
    key: "voi_an_ui",
    topic: "dong_vat",
    quads: ["red", "blue"],
    title: "Voi an ủi nhau bằng vòi",
    body: "Ở một trại voi miền Bắc Thái Lan, hai nhà khoa học Joshua Plotnik và Frans de Waal quan sát 26 con voi châu Á gần một năm. Khi một con voi bồn chồn, những con ở gần thường đến chạm nhẹ vòi vào mặt bạn và kêu những tiếng ríu rít nhỏ. Hai ông cho rằng đó có thể là cách voi trấn an nhau.",
    tryIt: "Nghĩ về một cách mình hay làm ai đó yên lòng: một cái ôm, một câu nói, hay chỉ ngồi cạnh.",
    source: "Plotnik & de Waal, 2014 · PeerJ",
  },
  {
    key: "be_rai_ca",
    topic: "dong_vat",
    quads: ["blue", "green"],
    title: "Bè rái cá ngủ trên sóng",
    body: "Rái cá biển nghỉ trên mặt nước thành từng nhóm gọi là “bè”, có khi hơn 1.000 con nằm ngửa gần nhau. Mỗi ngày chúng dành nhiều thời gian chải bộ lông thật dày, vì lớp lông giữ không khí giúp cơ thể ấm, thay cho lớp mỡ mà nhiều loài thú biển khác có. Ghi chép của nhà khoa học nhí: nghỉ gần bạn bè và chăm sóc bản thân là việc quan trọng của rái cá.",
    tryIt: "Hôm nay mình chăm sóc bản thân bằng một việc nhỏ nào: uống nước, vươn vai hay nghỉ một chút?",
    source: "Bộ Nội vụ Hoa Kỳ · 12 Facts About Otters; Aquarium of the Pacific · Southern Sea Otter",
  },
  {
    key: "chuot_mo_cua",
    topic: "dong_vat",
    quads: ["blue", "green"],
    title: "Chuột mở cửa cho bạn",
    body: "Năm 2011, các nhà khoa học ở Đại học Chicago để một chú chuột trong một ống nhỏ có cửa, còn bạn cùng chuồng của nó được đi lại tự do. Sau vài ngày, chú chuột tự do học được cách đẩy cửa cho bạn ra, dù không ai dạy và không được thưởng gì. Có cả hộp sô-cô-la bên cạnh, chúng vẫn hay mở cửa cho bạn, rồi còn chia phần sô-cô-la. Nhóm nghiên cứu xem đó là dấu hiệu của sự đồng cảm.",
    source: "Ben-Ami Bartal, Decety & Mason, 2011 · Science",
  },
  {
    key: "cho_doc_cam_xuc",
    topic: "dong_vat",
    quads: [],
    title: "Chó đọc được nét mặt và giọng nói",
    body: "Năm 2016, các nhà khoa học cho 17 chú chó nhà xem hai bức ảnh của cùng một người hoặc một chú chó: một ảnh vui, một ảnh giận. Cùng lúc, loa phát một giọng nói hoặc tiếng sủa, vui hoặc giận. Các chú chó nhìn lâu hơn vào khuôn mặt khớp với âm thanh. Nhóm nghiên cứu cho rằng chó có thể ghép điều nghe và điều thấy để phân biệt vui với giận, cả ở người lẫn ở chó.",
    source: "Albuquerque và cộng sự, 2016 · Biology Letters",
  },
  {
    key: "ong_duoc_thuong",
    topic: "dong_vat",
    quads: ["yellow", "green"],
    title: "Ong nghệ được thưởng bất ngờ",
    body: "Năm 2016, các nhà khoa học ở London dạy ong nghệ rằng cửa màu xanh dương có nước đường, cửa màu xanh lá thì không. Rồi một nửa số ong được uống một giọt nước đường bất ngờ, trước khi gặp một cửa màu lưng chừng. Những chú ong vừa được thưởng bay vào thử nhanh hơn. Các tác giả gọi đó là trạng thái “giống cảm xúc tích cực”, và cẩn thận không nói ong vui y như người.",
    source: "Perry, Baciadonna & Chittka, 2016 · Science",
  },
  {
    key: "khi_chai_long",
    topic: "dong_vat",
    quads: ["red", "blue"],
    title: "Khỉ chải lông cho bạn",
    body: "Khỉ hay ngồi chải và nhặt lông cho nhau. Năm 2007, các nhà khoa học theo dõi một đàn khỉ Barbary sống tự do và đo một loại hormone liên quan đến căng thẳng. Họ thấy những con chải lông cho bạn nhiều hơn có lượng hormone này thấp hơn. Đây mới là một mối liên hệ, nhưng có vẻ chăm sóc bạn cũng tốt cho chính mình.",
    tryIt: "Làm một việc nhỏ cho người trong nhà, rồi để ý xem mình thấy thế nào.",
    source: "Shutt và cộng sự, 2007 · Biology Letters",
  },
  {
    key: "qua_ngoi_sat",
    topic: "dong_vat",
    quads: ["red", "blue"],
    title: "Quạ ngồi sát bạn sau khi cãi nhau",
    body: "Năm 2010, hai nhà khoa học ở Áo quan sát một đàn quạ lớn (raven). Sau khi một con vừa cãi nhau với bạn trong đàn, những con khác thường đến ngồi sát, rỉa lông giúp hay chạm nhẹ vào nó. Chúng làm vậy nhiều nhất với bạn thân hoặc người nhà. Các nhà khoa học cho rằng đó có thể là cách quạ an ủi nhau.",
    source: "Fraser & Bugnyar, 2010 · PLoS ONE",
  },
  {
    key: "ca_heo_co_ten",
    topic: "dong_vat",
    quads: ["yellow", "green"],
    title: "Cá heo có “tên” riêng",
    body: "Mỗi chú cá heo mũi chai có một tiếng huýt sáo riêng, giống như một cái tên. Năm 2013, các nhà khoa học ở Scotland phát lại những tiếng huýt này cho cá heo hoang dã, và mỗi chú chỉ phản ứng khi nghe đúng “tên” mình. Một nghiên cứu khác cùng năm thấy cá heo vẫn nhận ra tiếng huýt của bạn cũ sau hơn 20 năm xa nhau.",
    source: "King & Janik, 2013 · PNAS; Bruck, 2013 · Proceedings of the Royal Society B",
  },
  {
    key: "chuot_cuoi",
    topic: "dong_vat",
    quads: ["yellow", "green"],
    title: "Chuột cũng “cười” khi được cù",
    body: "Năm 2016, hai nhà khoa học ở Berlin cù nhẹ những chú chuột. Chuột phát ra những tiếng chít rất cao, cao hơn mức tai người nghe được, mà các nhà khoa học gọi vui là “tiếng cười”. Chúng còn nhảy cẫng lên và đuổi theo bàn tay để được cù tiếp. Khi đang lo lắng, chuột ít “cười” hơn, có lẽ hơi giống mình khó bật cười lúc căng thẳng.",
    source: "Ishiyama & Brecht, 2016 · Science",
  },
  {
    key: "duoi_cho_vay",
    topic: "dong_vat",
    quads: [],
    title: "Đuôi chó vẫy lệch bên nào?",
    body: "Năm 2007, các nhà khoa học ở Ý quay phim 30 chú chó khi gặp chủ, một người lạ, một con mèo hay một chú chó lạ to lớn. Gặp chủ, đuôi vẫy nhiều và hơi lệch về bên phải của chó; gặp chú chó lạ, đuôi lại lệch về bên trái. Họ cho rằng hướng vẫy có thể cho biết chó muốn lại gần hay muốn tránh ra. Độ lệch rất khó thấy bằng mắt thường, các nhà khoa học xem lại phim mới rõ.",
    source: "Quaranta, Siniscalchi & Vallortigara, 2007 · Current Biology",
  },
  {
    key: "de_thich_mat_vui",
    topic: "dong_vat",
    quads: ["yellow", "green"],
    title: "Dê thích khuôn mặt tươi cười",
    body: "Năm 2018, các nhà khoa học cho 20 chú dê ở một trại cứu hộ dê tại Anh xem hai tấm ảnh của cùng một người lạ: một ảnh tươi cười, một ảnh cau có. Các chú dê thường lại gần và dùng mũi “khám phá” ảnh tươi cười nhiều hơn. Nhóm nghiên cứu cho rằng dê có thể phân biệt được nét mặt vui và giận của người.",
    tryIt: "Mỉm cười với một con vật hay một người trong nhà, rồi quan sát xem họ đáp lại thế nào.",
    source: "Nawroth và cộng sự, 2018 · Royal Society Open Science",
  },
  {
    key: "tieng_cuoi_cua_vuon",
    topic: "dong_vat",
    quads: [],
    title: "Cây gia đình của tiếng cười",
    body: "Năm 2009, nhà khoa học Marina Davila Ross ghi âm tiếng “cười” khi cù nhẹ các bạn đười ươi, khỉ đột, tinh tinh, bonobo con và cả em bé người. So các tiếng cười với nhau, cô vẽ được một “cây gia đình” khớp với quan hệ họ hàng giữa các loài. Tiếng cười của người giống nhất với tinh tinh và bonobo, gợi ý tiếng cười có thể đã có từ tổ tiên chung của người và vượn.",
    source: "Davila Ross, Owren & Zimmermann, 2009 · Current Biology",
  },

  // -------------------------------------------------------------------------
  // 🌿 Thiên nhiên làm dịu
  // -------------------------------------------------------------------------
  {
    key: "mai_nha_xanh",
    topic: "thien_nhien",
    quads: ["blue", "green"],
    title: "40 giây nhìn mái nhà xanh",
    body: "Năm 2015, các nhà khoa học ở Đại học Melbourne (Úc) cho 150 sinh viên làm một bài bấm phím rất đơn điệu. Giữa chừng, mọi người được nghỉ 40 giây: một nửa nhìn ảnh mái nhà phủ đầy cỏ hoa, nửa kia nhìn mái bê tông trơn. Nhóm nhìn mái xanh sau đó làm ít lỗi hơn và tập trung tốt hơn.",
    tryIt: "Giữa hai bài, nhìn ra cửa sổ tìm một chút màu xanh trong 40 giây.",
    source: "Lee và cộng sự, 2015 · Journal of Environmental Psychology",
  },
  {
    key: "tieng_chim",
    topic: "thien_nhien",
    quads: ["red", "blue"],
    title: "Nghe chim hót",
    body: "Năm 2022, các nhà nghiên cứu ở King's College London dùng một ứng dụng hỏi gần 1.300 người, ba lần mỗi ngày, xem lúc đó họ có thấy hay nghe tiếng chim không. Những lúc có chim, mọi người thường thấy tinh thần dễ chịu hơn, và cảm giác ấy có thể kéo dài nhiều giờ. Đây mới là một mối liên hệ, chưa chứng minh chim là nguyên nhân, nhưng là một manh mối dễ thử.",
    tryIt: "Mở cửa sổ, nhắm mắt một phút và đếm xem nghe được mấy kiểu tiếng chim.",
    source: "Hammoud và cộng sự, 2022 · Scientific Reports",
  },
  {
    key: "cam_giac_kinh_ngac",
    topic: "thien_nhien",
    quads: ["yellow", "green"],
    title: "Mình nhỏ bé, thế giới thật lớn",
    body: "Các nhà tâm lý gọi cảm giác đứng trước một điều thật lớn lao, như bầu trời sao hay hàng cây cao vút, là “kinh ngạc” (awe). Năm 2020, một nhóm ở Đại học California nhờ người lớn tuổi đi dạo 15 phút mỗi tuần và tìm điều kinh ngạc quanh mình. Dần dần, trong ảnh tự chụp, họ để mình nhỏ lại giữa cảnh vật, còn nụ cười thì tươi hơn.",
    tryIt: "Ngước nhìn bầu trời một phút và tìm một thứ thật lớn: đám mây, ngọn cây hay Mặt Trăng.",
    source: "Sturm và cộng sự, 2020 · Emotion",
  },
  {
    key: "mui_mua",
    topic: "thien_nhien",
    quads: [],
    title: "Mùi của cơn mưa",
    body: "Năm 1964, hai nhà khoa học Úc Isabel Bear và Richard Thomas đặt tên cho mùi đất sau mưa là “petrichor”. Một phần mùi đó đến từ geosmin, một chất do vi khuẩn sống trong đất tạo ra, và mũi người ngửi được nó dù chỉ có một lượng cực nhỏ. Khi giọt mưa rơi xuống đất khô, nó giữ lại những bọt khí li ti; bọt vỡ ra và tung mùi vào không khí.",
    tryIt: "Lần tới trời mưa, đứng gần cửa sổ, hít nhẹ và nghĩ xem mùi đó giống gì.",
    source: "Bear & Thomas, 1964 · Nature; Joung & Buie, 2015 · Nature Communications",
  },
  {
    key: "canh_co_nuoc",
    topic: "thien_nhien",
    quads: ["red", "blue"],
    title: "Cảnh có nước",
    body: "Năm 2010, các nhà khoa học ở Anh cho người tham gia xem 120 bức ảnh thiên nhiên và phố phường, một nửa có nước như sông, hồ hay biển. Cảnh có nước được thích hơn, làm người xem thấy dễ chịu hơn và được chấm là giúp “hồi sức” tốt hơn. Ngay cả cảnh phố có nước cũng được chấm gần bằng cảnh cây xanh.",
    tryIt: "Nhắm mắt nghĩ về một nơi có nước mình từng đến: biển, hồ hay một dòng suối.",
    source: "White và cộng sự, 2010 · Journal of Environmental Psychology",
  },
  {
    key: "thay_chau_cay",
    topic: "thien_nhien",
    quads: ["red", "green"],
    title: "Thay chậu cho cây",
    body: "Năm 2015, các nhà khoa học Hàn Quốc và Nhật Bản nhờ 24 thanh niên làm hai việc, mỗi việc 15 phút: thay chậu cho một cây cảnh nhỏ, và gõ chữ trên máy tính. Sau khi chăm cây, mọi người thấy dễ chịu, thư thái hơn, và huyết áp thấp hơn một chút so với sau khi gõ máy. Nghiên cứu còn nhỏ, nhưng là một manh mối dễ thương.",
    tryIt: "Tưới cho một cái cây trong nhà, rồi nhìn kỹ màu và đường gân của một chiếc lá.",
    source: "Lee và cộng sự, 2015 · Journal of Physiological Anthropology",
  },
  {
    key: "tam_rung",
    topic: "thien_nhien",
    quads: ["red", "blue"],
    title: "Người Nhật gọi đó là “tắm rừng”",
    body: "Năm 1982, Bộ Nông Lâm Ngư nghiệp Nhật Bản đặt ra từ “shinrin-yoku”, nghĩa là “tắm rừng”: đắm mình trong không khí của rừng. Một nghiên cứu ở 24 khu rừng khắp Nhật Bản cho các nam sinh viên đi dạo và ngắm cảnh ở rừng hoặc ở phố. Ở rừng, nhịp tim, huyết áp và một hormone liên quan đến căng thẳng đều thấp hơn.",
    tryIt: "Lần tới ra công viên, đi chậm lại, ngửi mùi lá và nghe tiếng gió trong vài hơi thở.",
    source: "Park và cộng sự, 2010 · Environmental Health and Preventive Medicine",
  },
  {
    key: "truong_nhieu_cay",
    topic: "thien_nhien",
    quads: ["yellow", "green"],
    title: "Sân trường có nhiều cây",
    body: "Năm 2015, các nhà khoa học theo dõi hơn 2.500 học sinh lớp 2 đến lớp 4 ở 36 trường tiểu học tại Barcelona (Tây Ban Nha) trong một năm. Ở những trường có nhiều cây xanh trong và quanh sân, trí nhớ và sự chú ý của học sinh tiến bộ nhanh hơn. Các tác giả cho rằng một phần lý do có thể là không khí quanh đó ít khói xe hơn.",
    tryIt: "Tìm một cái cây gần nhà hoặc gần trường, và nhìn kỹ hình dạng tán lá của nó.",
    source: "Dadvand và cộng sự, 2015 · PNAS",
  },

  // -------------------------------------------------------------------------
  // 🧠 Bộ não của con
  // -------------------------------------------------------------------------
  {
    key: "chu_cho_canh_cua",
    topic: "bo_nao",
    quads: ["red"],
    title: "Chú chó canh cửa trong não",
    body: "Sâu trong não có hạch hạnh nhân, làm việc như một chú chó canh cửa. Khi thấy có vẻ nguy hiểm, chú sủa vang để cơ thể sẵn sàng: tim đập nhanh, thở nhanh hơn, cơ căng lên. Theo Harvard Health, chú phản ứng nhanh đến mức có khi trước cả lúc mình kịp hiểu chuyện gì đang xảy ra. Cơ thể cũng có sẵn một cái phanh giúp mình dịu lại khi mọi chuyện đã qua.",
    tryIt: "Thở ra chậm hơn hít vào, ba lần, như nói với chú chó: “An toàn rồi.”",
    source: "Harvard Health Publishing · Understanding the stress response (2011, duyệt lại 2024)",
  },
  {
    key: "duong_mon_trong_nao",
    topic: "bo_nao",
    quads: ["yellow", "green"],
    title: "Đường mòn trong rừng não",
    body: "Năm 2004, các nhà khoa học ở Đức dạy 12 người lớn tung hứng ba quả bóng. Ba tháng sau, ảnh chụp não cho thấy hai vùng giúp theo dõi vật đang chuyển động đã lớn thêm một chút. Khi họ thôi tập, phần lớn thêm ấy nhỏ dần lại. Giống đường mòn trong rừng: càng đi nhiều càng rõ, lâu không đi thì cỏ mọc lại.",
    tryIt: "Chọn một việc nhỏ đang tập, như viết chữ đẹp hay tung bóng, và thử thêm một lần hôm nay.",
    source: "Draganski và cộng sự, 2004 · Nature",
  },
  {
    key: "chim_on_bai_hat",
    topic: "bo_nao",
    quads: ["blue", "green"],
    title: "Chim ôn bài hát trong giấc ngủ",
    body: "Năm 2000, các nhà khoa học ở Đại học Chicago theo dõi não của chim sẻ vằn, một loài chim phải học mới hót được. Khi chim ngủ, những tế bào thần kinh dùng để hót lại hoạt động theo nhịp giống lúc đang hót, dù không phát ra tiếng nào. Các nhà khoa học đoán chim có thể đang “ôn bài hát” trong lúc ngủ. Ở người, theo NIH, ngủ sau khi học giúp lưu và gắn chặt điều mới học.",
    tryIt: "Trước khi ngủ, nhớ lại một điều mới mình biết hôm nay.",
    source: "Dave & Margoliash, 2000 · Science; NIH News in Health, 2013 · Sleep On It",
  },
  {
    key: "nao_dang_lon",
    topic: "bo_nao",
    quads: [],
    title: "Bộ não đang lớn",
    body: "Theo NIMH, một viện nghiên cứu lớn của Hoa Kỳ, não người còn phát triển đến khoảng giữa hoặc cuối tuổi hai mươi. Vùng ngay sau trán, lo việc lập kế hoạch và cân nhắc, nằm trong số những vùng hoàn thiện sau cùng. Não tuổi thiếu niên lại có một điểm mạnh: rất linh hoạt, dễ học và dễ thích nghi với điều mới.",
    tryIt: "Viết một dòng: năm nay mình muốn học thêm điều gì mới?",
    source: "NIMH, 2023 · The Teen Brain: 7 Things to Know",
  },
  {
    key: "to_mo_giup_nho",
    topic: "bo_nao",
    quads: ["yellow", "green"],
    title: "Tò mò giúp nhớ lâu",
    body: "Năm 2014, các nhà khoa học ở Đại học California, Davis cho người tham gia đọc câu đố rồi chờ đáp án. Khi rất tò mò, họ nhớ đáp án tốt hơn, và vẫn nhớ sau một ngày. Bất ngờ hơn, họ còn nhớ tốt hơn cả những khuôn mặt lạ hiện ra trong lúc chờ. Có vẻ tò mò giúp não sẵn sàng ghi nhớ.",
    tryIt: "Viết một câu hỏi “Vì sao…?” về thế giới, tối nay cùng bố mẹ tìm đáp án.",
    source: "Gruber, Gelman & Ranganath, 2014 · Neuron",
  },
  {
    key: "bi_mat_hoi_tho_ra",
    topic: "bo_nao",
    quads: ["red", "blue"],
    title: "Bí mật của hơi thở ra",
    body: "Năm 2023, các nhà khoa học ở Đại học Stanford cho 108 người lớn tập vài kiểu thở, 5 phút mỗi ngày trong một tháng. Kiểu “thở dài có nhịp” (hít vào, hít thêm một hơi ngắn, rồi thở ra thật chậm) giúp tâm trạng tốt lên nhiều hơn so với nhóm ngồi thiền. Nhóm nghiên cứu cho rằng phần thở ra dài có thể là điểm quan trọng.",
    tryIt: "Hít vào, hít thêm một hơi ngắn, rồi thở ra thật chậm như cá voi. Ba lần là đủ, thấy khác hay chưa đều ổn.",
    source: "Balban và cộng sự, 2023 · Cell Reports Medicine",
  },
  {
    key: "nghi_ngan_giup_hoc",
    topic: "bo_nao",
    quads: ["blue", "green"],
    title: "Nghỉ ngắn, não cất bài",
    body: "Năm 2019, các nhà khoa học ở Viện Y tế Quốc gia Hoa Kỳ (NIH) nhờ người lớn tập gõ một dãy số: gõ 10 giây, nghỉ 10 giây, lặp lại nhiều lần. Bất ngờ là phần lớn sự tiến bộ xuất hiện trong những lúc nghỉ ngắn, chứ không phải lúc đang gõ. Các nhà khoa học cho rằng trong lúc nghỉ, não có thể đang cất lại điều vừa tập.",
    tryIt: "Khi tập một việc khó, thử nghỉ vài hơi thở giữa các lần tập.",
    source: "Bönstrup và cộng sự, 2019 · Current Biology",
  },
  {
    key: "nao_an_nang_luong",
    topic: "bo_nao",
    quads: [],
    title: "Kiểm chứng lời đồn “10% bộ não”",
    body: "Có lẽ con từng nghe câu “người ta chỉ dùng 10% bộ não”. Nhà khoa học nhí kiểm chứng rồi: đây là chuyện không có thật. Trên tạp chí Scientific American, nhà thần kinh học Barry Gordon ở Đại học Johns Hopkins nói chúng ta dùng gần như mọi phần của não. Não chỉ nặng khoảng 3% cơ thể nhưng dùng tới khoảng 20% năng lượng của cơ thể.",
    source: "Scientific American, 2008 · Do People Only Use 10 Percent of Their Brains?",
  },

  // -------------------------------------------------------------------------
  // 💛 Cảm xúc là gì
  // -------------------------------------------------------------------------
  {
    key: "nguoi_dua_tin",
    topic: "cam_xuc",
    quads: [],
    title: "Cảm xúc là người đưa tin",
    body: "Hai nhà tâm lý Dacher Keltner và James Gross viết rằng cảm xúc có chức năng: chúng giúp mình phản ứng với những gì đang thay đổi quanh mình. Lo có thể đang báo “cần cẩn thận”, vui có thể đang báo “điều này tốt cho mình”. Nghe tin xong, mình vẫn là người chọn làm gì tiếp theo.",
    tryIt: "Hỏi cảm xúc đang có: “Bạn muốn báo cho mình điều gì?” Ghi lại một dòng.",
    source: "Keltner & Gross, 1999 · Cognition and Emotion",
  },
  {
    key: "ngap_va_cuoi_lay",
    topic: "cam_xuc",
    quads: ["yellow", "green"],
    title: "Ngáp và cười đều “lây”",
    body: "Năm 2008, các nhà khoa học ở Anh thấy 21 trên 29 chú chó ngáp theo khi một người lạ ngáp trước mặt, nhưng không chú nào ngáp khi người đó chỉ há miệng. Tiếng cười cũng lây: năm 2006, nhóm của nhà khoa học Sophie Scott thấy nghe tiếng cười làm vùng não chuẩn bị cử động cơ mặt hoạt động mạnh lên. Có lẽ vì vậy mà nghe bạn cười, mình cũng dễ mỉm cười theo.",
    tryIt: "Ngáp thật to trước một người trong nhà. Ghi chép: người đó có ngáp theo không?",
    source: "Joly-Mascheroni, Senju & Shepherd, 2008 · Biology Letters; Warren và cộng sự, 2006 · Journal of Neuroscience",
  },
  {
    key: "goi_ten_cam_xuc",
    topic: "cam_xuc",
    quads: ["red", "blue"],
    title: "Gọi tên cảm xúc",
    body: "Năm 2007, nhóm của nhà tâm lý Matthew Lieberman ở Đại học California, Los Angeles cho người tham gia xem ảnh khuôn mặt đang giận hay sợ, rồi chọn một từ gọi tên cảm xúc ấy. Khi gọi tên, “chú chó canh cửa” trong não (hạch hạnh nhân) hoạt động ít hơn. Chính tác giả nói hiệu ứng có lẽ không lớn, nhưng đây là một phát hiện đáng ghi chép.",
    tryIt: "Chọn một từ gần đúng nhất với lúc này, như “bực”, “mệt” hay “hồi hộp”, và nói thầm nó ra.",
    source: "Lieberman và cộng sự, 2007 · Psychological Science",
  },
  {
    key: "vui_buon_cung_luc",
    topic: "cam_xuc",
    quads: [],
    title: "Vừa vui vừa buồn cùng lúc",
    body: "Năm 2007, các nhà tâm lý cho các bạn nhỏ từ 5 đến 12 tuổi xem đoạn cuối một bộ phim hoạt hình, khi hai cha con nói lời tạm biệt vừa vui vừa buồn. Nhiều bạn lớn hơn kể là thấy cả vui lẫn buồn cùng một lúc. Cảm thấy hai điều một lúc là chuyện bình thường, nhất là khi một điều quý giá sắp khép lại.",
    source: "Larsen, To & Fireman, 2007 · Psychological Science",
  },
  {
    key: "dem_dieu_biet_on",
    topic: "cam_xuc",
    quads: ["yellow", "green"],
    title: "Đếm những điều biết ơn",
    body: "Năm 2008, nhà tâm lý Jeffrey Froh và cộng sự nhờ 221 học sinh cấp hai ghi lại tối đa năm điều mình biết ơn mỗi ngày, trong hai tuần. So với các lớp làm việc khác, các bạn này thấy lạc quan hơn, hài lòng hơn với cuộc sống và với trường học. Điều được ghi không cần lớn: một bữa cơm ngon hay một câu đùa của bạn cũng tính.",
    tryIt: "Ghi một dòng: hôm nay có một điều nhỏ mình thấy biết ơn.",
    source: "Froh, Sefick & Emmons, 2008 · Journal of School Psychology",
  },
  {
    key: "goi_minh_bang_ten",
    topic: "cam_xuc",
    quads: ["red", "blue"],
    title: "Tự động viên bằng tên mình",
    body: "Nhà tâm lý Ethan Kross ở Đại học Michigan nhờ sinh viên chuẩn bị một bài nói chỉ trong năm phút. Ai tự động viên bằng tên mình, kiểu “Nam ơi, cậu làm được”, thấy bớt lo hơn, và người nghe chấm bài nói của họ tốt hơn so với nhóm tự nói “tôi”. Kross cho rằng gọi tên mình giúp mình nhìn chuyện của mình như đang khuyên một người bạn.",
    tryIt: "Lúc thấy lo, nói thầm với mình bằng tên: “An ơi, từ từ thôi, cậu làm được.”",
    source: "Kross và cộng sự, 2014 · Journal of Personality and Social Psychology",
  },

  // -------------------------------------------------------------------------
  // 🔬 Thí nghiệm nhỏ
  // -------------------------------------------------------------------------
  {
    key: "dem_hoi_tho",
    topic: "thi_nghiem",
    quads: ["red", "blue"],
    title: "Đếm hơi thở trước và sau",
    body: "Năm 2018, các nhà khoa học ở Đại học Pisa (Ý) đọc lại 15 nghiên cứu về thở chậm, khoảng dưới 10 hơi mỗi phút. Thở chậm thường đi cùng cảm giác thư giãn, dễ chịu hơn, và nhịp tim thay đổi linh hoạt hơn. Các tác giả nói bằng chứng còn ít, nên đây là một thí nghiệm hay để nhà khoa học nhí tự quan sát.",
    tryIt: "Đếm số hơi thở trong 1 phút, rồi thở thật chậm 1 phút, rồi đếm lại. Ghi chép: số trước, số sau, mình thấy thế nào?",
    source: "Zaccaro và cộng sự, 2018 · Frontiers in Human Neuroscience",
  },
  {
    key: "nam_dieu_quanh_minh",
    topic: "thi_nghiem",
    quads: [],
    title: "Sổ tay thực địa: quanh mình có gì?",
    body: "Các nhà khoa học tự nhiên ghi vào sổ tay thực địa những gì họ quan sát: nơi sinh vật sống, thời tiết, và cả cảm xúc của chính họ. Viện Smithsonian (Hoa Kỳ) đã lập danh mục cho hơn 9.500 cuốn sổ như vậy. Nhiều khám phá bắt đầu từ việc nhìn thật kỹ và ghi lại.",
    tryIt: "Tìm 5 thứ nhìn thấy, 4 thứ chạm được, 3 âm thanh nghe được. Ghi chép: điều nào mình chưa từng để ý?",
    source: "Smithsonian Institution Archives · Field Book Project",
  },
  {
    key: "mot_phut_ngam_may",
    topic: "thi_nghiem",
    quads: ["yellow", "green"],
    title: "Một phút ngắm mây",
    body: "Theo Cục Khảo sát Địa chất Hoa Kỳ (USGS), một đám mây trắng bông cỡ một ki-lô-mét mỗi chiều chứa những giọt nước nặng tổng cộng khoảng 500 tấn. Mây vẫn nổi được vì không khí ẩm trong mây nhẹ hơn lớp không khí khô bên dưới, giống như dầu nổi trên nước.",
    tryIt: "Chọn một đám mây và nhìn nó trong 1 phút. Ghi chép: lúc đầu nó giống gì, lúc sau giống gì?",
    source: "USGS Water Science School · How Much Does a Cloud Weigh?",
  },
  {
    key: "ban_do_cam_xuc",
    topic: "thi_nghiem",
    quads: [],
    title: "Bản đồ cảm xúc trên cơ thể",
    body: "Năm 2014, nhóm của nhà khoa học Lauri Nummenmaa ở Phần Lan nhờ khoảng 700 người ở Phần Lan, Thụy Điển và Đài Loan tô lên hình một cơ thể những chỗ thấy cảm giác mạnh lên khi nghĩ về từng cảm xúc. Vui làm gần như cả cơ thể sáng lên, còn giận hay hiện ở tay. Bản đồ của mọi người khá giống nhau, dù họ sống ở những nơi rất khác nhau.",
    tryIt: "Vẽ một hình người đơn giản, tô chỗ mình đang thấy cảm xúc lúc này. Ghi chép: màu gì, ở đâu?",
    source: "Nummenmaa và cộng sự, 2014 · PNAS",
  },
  {
    key: "mui_goi_ky_niem",
    topic: "thi_nghiem",
    quads: [],
    title: "Mùi hương gợi kỷ niệm",
    body: "Nhà tâm lý Rachel Herz và các đồng nghiệp thấy kỷ niệm được gợi lên bằng mùi thường mang nhiều cảm xúc hơn kỷ niệm gợi lên bằng hình ảnh hay âm thanh. Năm 2006, hai nhà khoa học ở Đại học Stockholm còn thấy mùi hay gợi lại những kỷ niệm rất xa, từ lúc còn nhỏ. Một lý do có thể là đường đi của mùi trong não nằm rất gần những vùng lo việc nhớ và cảm xúc.",
    tryIt: "Ngửi một thứ trong nhà, như vỏ cam, lá chanh hay gạo. Ghi chép: mùi này gợi mình nhớ đến điều gì?",
    source: "Scientific American Mind, 2012 · Smells Like Old Times",
  },
  {
    key: "dem_chim_15_phut",
    topic: "thi_nghiem",
    quads: [],
    title: "15 phút đếm chim cho khoa học",
    body: "Mỗi tháng Hai, rất nhiều người khắp thế giới tham gia Great Backyard Bird Count: dành ít nhất 15 phút đếm chim quanh nhà rồi gửi kết quả. Đã có lần hơn 300.000 người cùng gửi ghi chép, và các nhà khoa học dùng chúng để hiểu các loài chim đang sống ra sao. Một trang sổ của nhà khoa học nhí cũng có thể là một mảnh dữ liệu thật.",
    tryIt: "Ngồi cạnh cửa sổ 15 phút và đếm chim. Ghi chép: mấy con, màu gì, chúng đang làm gì?",
    source: "National Audubon Society · About the Great Backyard Bird Count",
  },
];

/** Today's card for (local date, the visit's quad, the chosen topic). Same inputs → same card; rotates daily. */
/** Topics that have at least one card the child may see, in chip order (the UI offers only these). */
export function activeScienceTopics(): ScienceTopic[] {
  return SCIENCE_TOPIC_KEYS.filter((t) => FIELD_NOTES.some((d) => d.topic === t && !d.held));
}

/** Today's card for (local date, the visit's quad, the chosen topic). Same inputs → same card; rotates daily. Null only for a topic with no cards yet. */
export function fieldNoteFor(date: string, quad: Quad | null | undefined, topic: ScienceTopic): FieldNote | null {
  return pickDossier(FIELD_NOTES, date, quad, topic);
}

/** A card by key (held cards included; the notebook filters them out). */
export function findFieldNote(key: string): FieldNote | undefined {
  return FIELD_NOTES.find((d) => d.key === key);
}

/** A card the child may see, by key (not held). */
export function findShownFieldNote(key: string): FieldNote | undefined {
  const d = findFieldNote(key);
  return d && !d.held ? d : undefined;
}
