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
  dong_vat: { label: "Động vật và cảm xúc", emoji: "🐾" },
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
  // 🐾 Động vật và cảm xúc
  // -------------------------------------------------------------------------
  {
    key: "voi_an_ui",
    topic: "dong_vat",
    quads: ["red", "blue"],
    title: "Voi an ủi nhau bằng vòi",
    body: "Ở một trại voi miền Bắc Thái Lan, hai nhà khoa học Joshua Plotnik và Frans de Waal quan sát 26 con voi châu Á gần một năm. Khi một con voi bồn chồn, những con ở gần thường đến chạm nhẹ vòi vào mặt con voi ấy và kêu những tiếng ríu rít nhỏ. Hai ông cho rằng đó có thể là cách voi trấn an nhau.",
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
    body: "Năm 2011, các nhà khoa học ở Đại học Chicago để một chú chuột trong một ống nhỏ có cửa, còn bạn cùng chuồng của nó được đi lại tự do. Sau khoảng một tuần, chú chuột tự do học được cách đẩy cửa cho bạn ra, dù không ai dạy và không được thưởng gì. Có cả hộp sô-cô-la bên cạnh, chúng vẫn hay mở cửa cho bạn, rồi còn chia sô-cô-la. Nhóm nghiên cứu xem đó là dấu hiệu của sự đồng cảm.",
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
    body: "Năm 2016, các nhà khoa học ở London dạy ong nghệ rằng cửa màu xanh dương có nước đường, cửa màu xanh lá thì không. Rồi một nửa số ong được uống một giọt nước đường bất ngờ, trước khi gặp một cửa màu xanh ngọc ở giữa. Những chú ong vừa được thưởng bay vào thử nhanh hơn. Các tác giả gọi đó là trạng thái “giống cảm xúc tích cực”, và cẩn thận không nói ong vui y như người.",
    source: "Perry, Baciadonna & Chittka, 2016 · Science",
  },
  {
    key: "khi_chai_long",
    topic: "dong_vat",
    quads: ["red", "blue"],
    title: "Khỉ chải lông cho bạn",
    body: "Khỉ hay ngồi chải và nhặt lông cho nhau. Năm 2007, các nhà khoa học theo dõi một đàn khỉ Barbary sống tự do và đo một loại hormone liên quan đến căng thẳng. Họ thấy những con chải lông cho bạn nhiều hơn có lượng hormone này thấp hơn. Đây mới là một mối liên hệ, nhưng có vẻ ở loài khỉ này, chăm sóc bạn cũng tốt cho chính nó.",
    tryIt: "Làm một việc nhỏ cho người trong nhà, rồi để ý xem mình thấy thế nào.",
    source: "Shutt và cộng sự, 2007 · Biology Letters",
  },
  {
    key: "qua_ngoi_sat",
    topic: "dong_vat",
    quads: ["red", "blue"],
    title: "Quạ ngồi sát bạn sau khi cãi nhau",
    body: "Năm 2010, hai nhà khoa học ở Áo quan sát một nhóm quạ raven (loài quạ to). Sau khi một con vừa cãi nhau với bạn trong đàn, những con khác thường đến ngồi sát, rỉa lông giúp hay chạm nhẹ vào nó. Chúng làm vậy nhiều nhất với những con vốn thân thiết với nó. Các nhà khoa học cho rằng đó có thể là cách quạ an ủi nhau.",
    source: "Fraser & Bugnyar, 2010 · PLoS ONE",
  },
  {
    key: "ca_heo_co_ten",
    topic: "dong_vat",
    quads: ["yellow", "green"],
    title: "Cá heo có “tên” riêng",
    body: "Thế giới Biển kể rằng mỗi chú cá heo mũi chai có một tiếng huýt riêng như cái tên. Năm 2013, các nhà khoa học ở Scotland kiểm chứng: họ làm bản sao tiếng huýt bằng máy tính rồi phát cho cá heo hoang dã, và mỗi chú chỉ phản ứng khi nghe đúng “tên” mình. Một nghiên cứu khác ở sáu nơi nuôi cá heo thấy chúng vẫn nhận ra tiếng huýt của bạn cũ sau hơn 20 năm.",
    source: "King & Janik, 2013 · PNAS; Bruck, 2013 · Proceedings of the Royal Society B",
  },
  {
    key: "chuot_cuoi",
    topic: "dong_vat",
    quads: ["yellow", "green"],
    title: "Chuột cũng “cười” khi được cù",
    body: "Năm 2016, hai nhà khoa học ở Berlin cù nhẹ những chú chuột. Chuột phát ra những tiếng chít siêu âm khoảng 50 kHz, cao hơn mức tai người nghe được, mà các nhà khoa học gọi vui là “tiếng cười”. Chúng còn nhảy cẫng lên và đuổi theo bàn tay để được cù tiếp. Khi đang lo lắng, chuột ít “cười” hơn, có lẽ hơi giống mình khó bật cười lúc căng thẳng.",
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
    body: "Năm 2018, các nhà khoa học cho 20 chú dê ở một trại cứu hộ dê tại Anh xem hai tấm ảnh của cùng một người lạ: một ảnh tươi cười, một ảnh cau có. Các chú dê thường lại gần và dùng mũi “khám phá” ảnh tươi cười nhiều hơn, nhất là khi ảnh tươi cười đặt bên phải. Nhóm nghiên cứu cho rằng dê có thể phân biệt được nét mặt vui và giận của người.",
    tryIt: "Mỉm cười với một con vật hay một người trong nhà, rồi quan sát xem họ đáp lại thế nào.",
    source: "Nawroth và cộng sự, 2018 · Royal Society Open Science",
  },
  {
    key: "tieng_cuoi_cua_vuon",
    topic: "dong_vat",
    quads: [],
    title: "Cây gia đình của tiếng cười",
    body: "Năm 2009, nhà khoa học Marina Davila Ross ghi âm tiếng “cười” khi cù nhẹ các bạn vượn nhỏ tuổi (đười ươi, khỉ đột, tinh tinh, bonobo) và cả em bé người. So các tiếng cười, cô vẽ được một “cây gia đình” khớp với quan hệ họ hàng giữa các loài. Trên cây ấy, tiếng cười của người đứng gần tinh tinh và bonobo nhất, gợi ý tiếng cười có thể đã có từ tổ tiên chung của người và vượn.",
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
    body: "Năm 2015, các nhà khoa học ở Đại học Melbourne (Úc) cho 150 sinh viên làm một bài bấm phím rất đơn điệu. Giữa chừng, mọi người được nghỉ 40 giây: một nửa nhìn ảnh mái nhà phủ đầy cỏ và hoa, nửa kia nhìn mái bê tông trơn. Nhóm nhìn mái xanh sau đó làm ít lỗi hơn và tập trung tốt hơn.",
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
    body: "Các nhà tâm lý gọi cảm giác đứng trước một điều thật lớn lao, như bầu trời sao hay hàng cây cao vút, là “kinh ngạc” (awe). Năm 2020, một nhóm ở Đại học California, San Francisco nhờ người lớn tuổi đi dạo 15 phút mỗi tuần và tìm điều kinh ngạc quanh mình. Dần dần, trong ảnh tự chụp, họ để mình nhỏ lại giữa cảnh vật, còn nụ cười thì tươi hơn.",
    tryIt: "Ngước nhìn bầu trời một phút (đừng nhìn thẳng vào Mặt Trời) và tìm một thứ thật lớn: đám mây, ngọn cây hay Mặt Trăng.",
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
    body: "Năm 2010, các nhà khoa học ở Anh cho người tham gia xem 120 bức ảnh thiên nhiên và phố phường, một nửa có nước như sông, hồ hay biển. Cảnh có nước được thích hơn, làm người xem thấy dễ chịu hơn và được chấm là giúp tinh thần hồi phục tốt hơn. Ngay cả cảnh phố có nước cũng được chấm gần bằng cảnh cây xanh.",
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
    body: "Năm 2015, các nhà khoa học theo dõi hơn 2.500 học sinh lớp 2 đến lớp 4 ở 36 trường tiểu học tại Barcelona (Tây Ban Nha) trong một năm. Ở những trường có nhiều cây xanh trong và quanh sân, trí nhớ và sự chú ý của học sinh tiến bộ nhanh hơn. Đây là một mối liên hệ. Các tác giả cho rằng một phần lý do có thể là không khí quanh đó ít khói xe hơn.",
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
    body: "Sâu trong não có hạch hạnh nhân, làm việc như một chú chó canh cửa. Khi thấy có vẻ nguy hiểm, chú sủa vang để cơ thể sẵn sàng: tim đập nhanh, thở nhanh hơn, cơ căng lên; đó là cơ thể đang cố bảo vệ mình. Theo Harvard Health, chú phản ứng nhanh đến mức có khi trước cả lúc mình kịp hiểu chuyện gì. Cơ thể cũng có sẵn một cái phanh giúp mình dịu lại khi mọi chuyện đã qua.",
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
    tryIt: "Hít vào, hít thêm một hơi ngắn, rồi thở ra thật chậm, như thổi nhẹ cho một chiếc lông vũ bay đi. Ba lần là đủ, thấy khác hay chưa đều ổn.",
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
    body: "Có lẽ con từng nghe câu “người ta chỉ dùng 10% bộ não”. Nhà khoa học nhí kiểm chứng rồi: đây là chuyện không có thật. Trên tạp chí Scientific American, nhà thần kinh học Barry Gordon ở Đại học Johns Hopkins nói chúng ta dùng gần như mọi phần của não. Não chỉ nặng khoảng 2–3% cơ thể nhưng dùng tới khoảng 20% năng lượng của cơ thể.",
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
    body: "Năm 2018, các nhà khoa học ở Đại học Pisa (Ý) đọc lại 15 nghiên cứu về thở chậm, chậm hơn khoảng 10 hơi mỗi phút. Thở chậm thường đi cùng cảm giác thư giãn, dễ chịu hơn, và nhịp tim thay đổi linh hoạt hơn. Các tác giả nói bằng chứng còn ít, nên đây là một thí nghiệm hay để nhà khoa học nhí tự quan sát.",
    tryIt: "Đếm hơi thở trong 1 phút, rồi thở thật chậm và nhẹ, không nín thở, 1 phút, rồi đếm lại. Ghi chép: số trước, số sau, mình thấy thế nào?",
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
    tryIt: "Chọn một đám mây (không nhìn về phía Mặt Trời) và nhìn nó trong 1 phút. Ghi chép: lúc đầu nó giống gì, lúc sau giống gì?",
    source: "USGS Water Science School · How Much Does a Cloud Weigh?",
  },
  {
    key: "ban_do_cam_xuc",
    topic: "thi_nghiem",
    quads: [],
    title: "Bản đồ cảm xúc trên cơ thể",
    body: "Năm 2014, nhóm của nhà khoa học Lauri Nummenmaa ở Phần Lan nhờ khoảng 700 người ở Phần Lan, Thụy Điển và Đài Loan tô lên hình một cơ thể những chỗ thấy cảm giác mạnh lên khi nghĩ về từng cảm xúc. Vui làm gần như cả cơ thể sáng lên, còn giận hiện rõ ở đầu, ngực và hai tay. Bản đồ của mọi người khá giống nhau, dù họ sống ở những nơi rất khác nhau.",
    tryIt: "Vẽ một hình người đơn giản, tô chỗ mình đang thấy cảm xúc lúc này. Ghi chép: màu gì, ở đâu?",
    source: "Nummenmaa và cộng sự, 2014 · PNAS",
  },
  {
    key: "mui_goi_ky_niem",
    topic: "thi_nghiem",
    quads: [],
    title: "Mùi hương gợi kỷ niệm",
    body: "Nhà tâm lý Rachel Herz và các đồng nghiệp thấy kỷ niệm được gợi lên bằng mùi thường mang nhiều cảm xúc hơn kỷ niệm gợi lên bằng hình ảnh hay âm thanh. Năm 2006, hai nhà khoa học ở Đại học Stockholm còn thấy mùi hay gợi lại những kỷ niệm rất xa, từ lúc còn nhỏ. Một lý do có thể là đường đi của mùi trong não nằm rất gần những vùng lo việc nhớ và cảm xúc.",
    tryIt: "Ngửi nhẹ một thứ quen thuộc trong bếp, như vỏ cam, lá chanh hay một nắm gạo. Ghi chép: mùi này gợi mình nhớ đến điều gì?",
    source: "Scientific American Mind, 2012 · Smells Like Old Times; Willander & Larsson, 2006 · Psychonomic Bulletin & Review",
  },
  {
    key: "dem_chim_15_phut",
    topic: "thi_nghiem",
    quads: [],
    title: "15 phút đếm chim cho khoa học",
    body: "Mỗi năm, trong 4 ngày giữa tháng Hai, rất nhiều người khắp thế giới tham gia Great Backyard Bird Count: dành ít nhất 15 phút đếm chim quanh nhà rồi gửi kết quả. Đã có lần hơn 300.000 người cùng gửi ghi chép, và các nhà khoa học dùng chúng để hiểu các loài chim đang sống ra sao. Một trang sổ của nhà khoa học nhí cũng có thể là một mảnh dữ liệu thật.",
    tryIt: "Ngồi cạnh cửa sổ 15 phút và đếm chim. Ghi chép: mấy con, màu gì, chúng đang làm gì?",
    source: "National Audubon Society · About the Great Backyard Bird Count",
  },

  // =========================================================================
  // Second half (08/11/2026): pure nature-science knowledge. None of these
  // repeats a fact from An's world packs (lib/world/{rung,bien,vu_tru,nui_lua}.ts).
  // =========================================================================

  // -------------------------------------------------------------------------
  // 🦎 Động vật kỳ thú
  // -------------------------------------------------------------------------
  {
    key: "sao_la",
    topic: "ky_thu",
    quads: ["yellow", "green"],
    title: "Sao la, “kỳ lân châu Á”",
    body: "Năm 1992, các nhà khoa học Việt Nam và WWF tìm thấy ở rừng Vũ Quang một hộp sọ có hai chiếc sừng song song rất lạ. Đó là sao la, loài thú lớn đầu tiên mới với khoa học sau hơn 50 năm. Sao la kín đáo đến mức phải tới năm 2013, một máy ảnh tự động trong rừng Trường Sơn mới chụp được một con đang đi bên suối.",
    tryIt: "Vẽ một chú sao la với hai chiếc sừng song song, đứng giữa một khu rừng thật xanh.",
    source: "WWF, 2013 · Saola rediscovered",
  },
  {
    key: "vooc_cha_va",
    topic: "ky_thu",
    quads: [],
    title: "Voọc chà vá chân nâu, “nữ hoàng linh trưởng”",
    body: "Voọc chà vá chân nâu được gọi là “nữ hoàng linh trưởng” nhờ bộ lông nhiều màu: thân xám, cẳng tay và đuôi trắng, còn bắp chân như đi đôi tất màu nâu đỏ. Ở Việt Nam, có thể gặp chúng trên bán đảo Sơn Trà, ngay cạnh thành phố Đà Nẵng. Chúng hay nhảy từ cành này sang cành khác bằng cú đẩy của hai chân sau, và thường đi theo những “con đường quen” trên tán rừng.",
    tryIt: "Tô màu một chú voọc chà vá: xám, trắng, đen và nâu đỏ. Màu nào mình thấy đẹp nhất?",
    source: "Animal Diversity Web (Đại học Michigan) · Pygathrix nemaeus; Việt Nam News · Save the Red-shanked Doucs of Sơn Trà",
  },
  {
    key: "gau_nuoc_vu_tru",
    topic: "ky_thu",
    quads: ["yellow", "green"],
    title: "Gấu nước đi du hành vũ trụ",
    body: "Gấu nước (tardigrade) là những con vật tí hon, dài chỉ 0,1 đến 1,5 mi-li-mét. Năm 2007, các nhà khoa học Thụy Điển gửi những chú gấu nước đã được làm khô lên quỹ đạo, cách mặt đất khoảng 270 ki-lô-mét, để chúng ở thẳng ngoài không gian. Về lại Trái Đất, phần lớn vẫn sống khỏe và còn sinh con bình thường.",
    tryIt: "Vẽ một chú gấu nước tám chân mặc bộ đồ phi hành gia.",
    source: "Jönsson và cộng sự, 2008 · Current Biology",
  },
  {
    key: "nhan_bien_bac_cuc",
    topic: "ky_thu",
    quads: ["yellow", "green"],
    title: "Nhạn biển Bắc Cực đi theo mùa hè",
    body: "Nhạn biển Bắc Cực nặng chưa tới 125 gam, nhưng mỗi năm bay từ vùng Bắc Cực xuống tận Nam Cực rồi quay về. Năm 2010, các nhà khoa học gắn thiết bị nặng 1,4 gam lên 11 chú chim ở Greenland và Iceland, và thấy mỗi năm chúng bay hơn 70.000 ki-lô-mét, có chú hơn 80.000. Đó là chuyến di cư dài nhất từng đo được ở động vật.",
    tryIt: "Tìm trên quả địa cầu hoặc bản đồ: từ Greenland xuống Nam Cực xa cỡ nào?",
    source: "Egevang và cộng sự, 2010 · PNAS",
  },
  {
    key: "chim_ruoi_bay_lui",
    topic: "ky_thu",
    quads: [],
    title: "Chim ruồi bay lùi được",
    body: "Theo National Geographic, chim ruồi là loài chim duy nhất thật sự bay lùi được, như có “số lùi”. Có loài vỗ cánh tới khoảng 100 lần mỗi giây, và tim chim ruồi có thể đập hơn 1.000 lần mỗi phút. Loài nhỏ nhất, chim ruồi ong ở Cuba, chỉ nặng hơn một hạt hạnh nhân một chút.",
    tryIt: "Đặt tay lên ngực, đếm nhịp tim mình trong 15 giây rồi nhân 4. Tim chim ruồi nhanh hơn mấy lần?",
    source: "National Geographic · Hummingbird secrets",
  },
  {
    key: "tac_ke_hoa_doi_mau",
    topic: "ky_thu",
    quads: ["yellow", "green"],
    title: "Tắc kè hoa đổi màu bằng tinh thể tí hon",
    body: "Năm 2015, nhóm của nhà khoa học Michel Milinkovitch ở Đại học Geneva (Thụy Sĩ) tìm ra cách tắc kè hoa báo đổi màu. Dưới da chúng có một lớp tế bào chứa vô số tinh thể nano xếp thành mạng lưới đều đặn. Khi tắc kè hoa hào hứng, mạng lưới giãn ra khoảng 30%, làm da phản chiếu ánh sáng khác đi: nền xanh lá chuyển sang vàng.",
    source: "Teyssier và cộng sự, 2015 · Nature Communications",
  },
  {
    key: "bo_hung_ngan_ha",
    topic: "ky_thu",
    quads: [],
    title: "Bọ hung nhìn dải Ngân Hà để đi thẳng",
    body: "Bọ hung vo phân thành viên tròn rồi lăn đi thật thẳng, để khỏi bị bọ khác lấy mất. Năm 2013, nhóm của nhà khoa học Marie Dacke (Đại học Lund, Thụy Điển) thử với bọ hung dưới một bầu trời sao nhân tạo. Khi “trời” có dải Ngân Hà, bọ đi thẳng tốt hơn; khi đội một tấm che nhỏ trên đầu, chúng đi lòng vòng. Có lẽ đây là lần đầu người ta thấy một loài vật dùng Ngân Hà để định hướng.",
    tryIt: "Tối nay cùng người lớn nhìn trời: mình thấy được mấy ngôi sao? Ghi lại một dòng.",
    source: "Dacke và cộng sự, 2013 · Current Biology",
  },
  {
    key: "kien_trong_nam",
    topic: "ky_thu",
    quads: ["yellow", "green"],
    title: "Kiến cắt lá là nhà nông",
    body: "Kiến cắt lá cắt những mẩu lá rồi khiêng về tổ dưới đất, nhưng chúng không ăn lá. Chúng dùng lá để nuôi một khu vườn nấm, rồi ăn nấm. Theo Viện Nghiên cứu Nhiệt đới Smithsonian, họ hàng của chúng đã trồng nấm từ gần 60 triệu năm trước, còn con người mới làm nông khoảng 10.000 năm. Một tổ lớn có thể có hàng triệu kiến thợ.",
    tryIt: "Ngồi yên quan sát một hàng kiến quanh nhà, không chạm vào: chúng đang khiêng gì?",
    source: "Smithsonian Tropical Research Institute · Leafcutter ants",
  },
  {
    key: "ca_thoi_loi_chop_mat",
    topic: "ky_thu",
    quads: [],
    title: "Cá thòi lòi biết chớp mắt",
    body: "Cá thòi lòi là loài cá sống được cả dưới nước lẫn trên cạn, và dành phần lớn thời gian trong ngày ở trên cạn. Năm 2023, các nhà khoa học Mỹ thấy chúng chớp mắt bằng cách kéo mắt tụt xuống hốc mắt trong chớp nhoáng. Chớp mắt giúp mắt cá luôn ướt, sạch và được bảo vệ, giống ở các loài sống trên cạn, mà không cần cơ mới, chỉ dùng cơ mắt sẵn có theo cách mới.",
    tryIt: "Nhờ người nhà đếm xem trong 1 phút mình chớp mắt mấy lần.",
    source: "Penn State & Georgia Tech, 2023 · PNAS",
  },
  {
    key: "doi_khong_mu",
    topic: "ky_thu",
    quads: [],
    title: "Kiểm chứng lời đồn: dơi bị mù?",
    body: "Có người nói “mù như dơi”, nhưng nhà khoa học nhí kiểm chứng rồi: đây là lời đồn sai. Theo Cục Khảo sát Địa chất Hoa Kỳ (USGS), dơi không mù: mắt dơi nhỏ nhưng rất nhạy, nhìn được cả khi mình thấy gần như tối đen. Dơi không thấy màu sắc rõ nét như người, nhưng với cuộc sống ban đêm thì thế là đủ.",
    source: "USGS · Are bats blind?",
  },
  {
    key: "ca_voi_hat",
    topic: "ky_thu",
    quads: ["yellow", "green"],
    title: "Bài hát “thịnh hành” của cá voi lưng gù",
    body: "Cá voi lưng gù đực hát những bài hát dài, và các con đực cùng vùng biển hát gần giống nhau. Năm 2011, nhà khoa học Ellen Garland và cộng sự nghe tiếng hát ở 6 vùng biển Nam Thái Bình Dương suốt 11 năm. Bài hát mới thường bắt đầu từ bờ đông nước Úc, rồi lan dần sang phía đông tới tận Polynesia thuộc Pháp, mất khoảng hai năm.",
    tryIt: "Nghĩ ra một giai điệu ngắn, hát cho người nhà nghe, xem họ có hát lại được không.",
    source: "Garland và cộng sự, 2011 · Current Biology",
  },
  {
    key: "than_lan_bay",
    topic: "ky_thu",
    quads: [],
    title: "Thằn lằn bay lượn giữa rừng",
    body: "Thằn lằn bay (chi Draco) sống ở rừng nhiệt đới châu Á. Hai bên sườn chúng có một tấm da mỏng căng trên 5 đến 7 chiếc xương sườn rất dài, xòe ra như đôi cánh. Năm 2017, nhà khoa học Max Dehling quay phim chúng ở Ấn Độ và thấy khi lượn, chúng áp hai chân trước vào mép “cánh”, ghép thành một đôi cánh lớn hơn. Cú lượn xa nhất ông ghi được dài khoảng 26 mét.",
    source: "Dehling, 2017 · PLoS ONE",
  },

  // -------------------------------------------------------------------------
  // 🌋 Trái Đất kỳ diệu
  // -------------------------------------------------------------------------
  {
    key: "son_doong",
    topic: "trai_dat",
    quads: ["yellow", "green"],
    title: "Sơn Đoòng, hang động có rừng và mây",
    body: "Khoảng năm 1990, anh Hồ Khanh đi rừng ở Phong Nha – Kẻ Bàng, trú mưa gần một vách đá và thấy sương mù tuôn ra từ một cửa hang. Năm 2009, anh dẫn các nhà thám hiểm hang động Anh tới hang Sơn Đoòng, nơi có đoạn rộng đến mức đặt vừa một dãy nhà 40 tầng. Chỗ trần hang sụt xuống, nắng lọt vào nuôi cả một khu rừng, và mây mỏng bay gần trần hang.",
    tryIt: "Vẽ một hang động có một khu rừng nhỏ bên trong và một đám mây gần trần.",
    source: "National Geographic, 2011 · Vietnam Cave; BBC Wildlife · Hang Sơn Đoòng",
  },
  {
    key: "giot_nuoc_9_ngay",
    topic: "trai_dat",
    quads: [],
    title: "Một giọt nước ở trên trời bao lâu?",
    body: "Theo Cơ quan Khí quyển và Đại dương Hoa Kỳ (NOAA), một phân tử nước bốc hơi từ biển chỉ ở trong không khí khoảng 9 ngày, rồi lại rơi xuống thành mưa hay tuyết. Khi đã về biển, nó có thể ở đó vài nghìn năm. Trong sông, nước thường ở khoảng 12 đến 20 ngày, còn trong băng ở hai cực có thể hơn 1.000 năm.",
    tryIt: "Lần tới trời mưa, nhìn một giọt nước trên cửa kính và đoán xem nó đã đi qua những đâu.",
    source: "NOAA JetStream · The Water Cycle",
  },
  {
    key: "set_hai_lan",
    topic: "trai_dat",
    quads: [],
    title: "Kiểm chứng lời đồn: sét không đánh hai lần?",
    body: "Nhiều người tin “sét không bao giờ đánh hai lần vào cùng một chỗ”. Nhà khoa học nhí kiểm chứng rồi: không đúng! Theo Cơ quan Thời tiết Quốc gia Hoa Kỳ, sét hay đánh nhiều lần vào những vật cao, nhọn, đứng riêng, như tòa nhà Empire State ở New York, trung bình 23 lần mỗi năm. Tia sét còn làm không khí quanh nó nóng gấp khoảng 5 lần bề mặt Mặt Trời.",
    tryIt: "Lần tới có giông, ngồi trong nhà đếm giây từ lúc thấy chớp đến lúc nghe sấm. Khoảng 3 giây là sét cách chừng 1 km.",
    source: "NOAA National Weather Service · Lightning Myths; Lightning Temperature",
  },
  {
    key: "cau_vong_tron",
    topic: "trai_dat",
    quads: ["yellow", "green"],
    title: "Cầu vồng thật ra là một vòng tròn",
    body: "Cầu vồng hiện ra khi ánh nắng đi vào những giọt nước trong không khí, bị bẻ cong, phản chiếu ở mặt sau giọt nước rồi tách thành nhiều màu. Vì vậy, muốn thấy cầu vồng thì Mặt Trời phải ở sau lưng mình. Theo NOAA, cầu vồng thật ra là một vòng tròn; đứng dưới đất mình chỉ thấy một phần, còn từ máy bay đôi khi thấy được cả vòng.",
    tryIt: "Sau cơn mưa, quay lưng về phía Mặt Trời và tìm cầu vồng. Đừng nhìn thẳng vào Mặt Trời nhé.",
    source: "NOAA SciJinks · What Causes a Rainbow?",
  },
  {
    key: "tam_trai_dat",
    topic: "trai_dat",
    quads: [],
    title: "Quả cầu sắt ở tâm Trái Đất",
    body: "Ở tâm Trái Đất có lõi trong, một quả cầu chủ yếu là sắt, bán kính khoảng 1.220 ki-lô-mét. Theo National Geographic, lõi trong nóng khoảng 5.200 °C mà vẫn rắn, vì sức ép ở đó lớn gần 3,6 triệu lần áp suất không khí quanh mình. Chỗ ranh giới giữa lõi trong và lõi ngoài có thể nóng tới 6.000 °C, nóng như bề mặt Mặt Trời.",
    source: "National Geographic Education · Core",
  },
  {
    key: "everest_day_bien",
    topic: "trai_dat",
    quads: ["yellow", "green"],
    title: "Đỉnh Everest từng là đáy biển",
    body: "Đá trên đỉnh Everest là một lớp đá vôi xám chứa mảnh vụn của sinh vật biển như bọ ba thùy và huệ biển. Theo Đại học Bang Montana (Hoa Kỳ), lớp đá này hình thành ở đáy biển khoảng 470 triệu năm trước. Khi mảng đất Ấn Độ trôi lên phía bắc và chạm vào châu Á, đáy biển xưa bị đẩy lên thành dãy Himalaya, và cú va chạm ấy vẫn đang tiếp diễn.",
    source: "Montana State University · Everest summit limestone",
  },
  {
    key: "vuc_mariana",
    topic: "trai_dat",
    quads: [],
    title: "Nơi sâu nhất đại dương",
    body: "Điểm sâu nhất đại dương mà ta biết là vực Challenger, ở rãnh Mariana giữa Thái Bình Dương, sâu khoảng 10.935 mét. Nếu đặt núi Everest (cao 8.849 mét) xuống đó, đỉnh núi vẫn còn nằm dưới mặt nước hơn 2 ki-lô-mét. Năm 1960, Jacques Piccard và Don Walsh là hai người đầu tiên xuống tới đáy vực.",
    source: "BBC Science Focus · How deep is the ocean?",
  },
  {
    key: "bui_sahara_amazon",
    topic: "trai_dat",
    quads: ["yellow", "green"],
    title: "Bụi sa mạc bón phân cho rừng Amazon",
    body: "Gió mang bụi từ sa mạc Sahara ở châu Phi bay qua cả Đại Tây Dương. Theo NASA, dựa vào vệ tinh CALIPSO từ năm 2007 đến 2013, trung bình mỗi năm có khoảng 27,7 triệu tấn bụi rơi xuống vùng rừng Amazon ở Nam Mỹ. Trong đó có khoảng 22.000 tấn phốt-pho, một chất cây cần để lớn, gần bằng lượng phốt-pho đất rừng mất đi mỗi năm vì nước mưa cuốn trôi.",
    source: "NASA Scientific Visualization Studio, 2015 · Saharan Dust to Amazon",
  },
  {
    key: "bang_chuyen_dai_duong",
    topic: "trai_dat",
    quads: ["blue", "green"],
    title: "Băng chuyền 1.000 năm dưới lòng biển",
    body: "Ở gần vùng cực, nước biển lạnh và mặn nặng hơn nên chìm xuống sâu, rồi chảy chầm chậm khắp các đại dương như một chiếc băng chuyền khổng lồ. Theo NOAA, dòng chảy này chỉ đi vài xăng-ti-mét mỗi giây. Một mét khối nước có thể mất khoảng 1.000 năm mới đi hết một vòng băng chuyền.",
    tryIt: "Nhắm mắt, tưởng tượng mình là một giọt nước đi một vòng quanh Trái Đất thật chậm, trong vài hơi thở.",
    source: "NOAA Ocean Service · The Global Conveyor Belt",
  },
  {
    key: "nhat_trieu_vinh_bac_bo",
    topic: "trai_dat",
    quads: [],
    title: "Vịnh Bắc Bộ: mỗi ngày một lần nước lớn",
    body: "Ở nhiều bờ biển trên thế giới, mỗi ngày nước biển lên xuống hai lần. Vịnh Bắc Bộ của nước ta lại khác: mỗi ngày thường chỉ có một lần nước lớn và một lần nước ròng, đều đặn lạ thường. Kiểu thủy triều này gọi là “nhật triều”, và nhật triều ở Vịnh Bắc Bộ được xem là một trong những kiểu điển hình nhất thế giới.",
    tryIt: "Lần tới đi biển cùng bố mẹ, nhớ mép nước lúc sáng và lúc chiều ở đâu, rồi so sánh.",
    source: "Trung tâm Phối hợp Tìm kiếm Cứu nạn Hàng hải Việt Nam · Đặc điểm vùng ven biển; NOAA · Tidal cycles",
  },

  // -------------------------------------------------------------------------
  // 🌌 Vũ trụ bao la
  // -------------------------------------------------------------------------
  {
    key: "nam_anh_sang",
    topic: "vu_tru",
    quads: [],
    title: "Một năm ánh sáng dài bao nhiêu?",
    body: "Ánh sáng đi khoảng 300.000 ki-lô-mét mỗi giây. “Một năm ánh sáng” là quãng đường ánh sáng đi trong một năm: khoảng 9 nghìn tỉ ki-lô-mét. Theo NASA, ngôi sao gần mình nhất sau Mặt Trời là Cận Tinh (Proxima Centauri), cách khoảng 4,3 năm ánh sáng, còn tâm dải Ngân Hà cách khoảng 26.000 năm ánh sáng.",
    source: "NASA Space Place · What Is a Light-Year?",
  },
  {
    key: "mat_trang_xa_dan",
    topic: "vu_tru",
    quads: ["blue", "green"],
    title: "Mặt Trăng mỗi năm lùi xa một chút",
    body: "Năm 1969, các nhà du hành Apollo 11 đặt lên Mặt Trăng một tấm gương phản xạ đặc biệt. Từ đó, các đài thiên văn ở Mỹ, Pháp, Ý và Đức bắn tia laser lên, đo thời gian ánh sáng dội về và tính được khoảng cách chính xác tới vài mi-li-mét. Nhờ vậy, ta biết Mặt Trăng đang xa dần Trái Đất khoảng 3,8 xăng-ti-mét mỗi năm.",
    tryIt: "Lấy thước đo xem 3,8 xăng-ti-mét dài cỡ nào: bằng một đốt ngón tay nào của mình?",
    source: "NASA JPL, 2019 · The Apollo Experiment That Keeps on Giving",
  },
  {
    key: "thien_vuong_nam_nghieng",
    topic: "vu_tru",
    quads: ["yellow", "green"],
    title: "Sao Thiên Vương lăn nghiêng",
    body: "Sao Thiên Vương nghiêng gần 98 độ, nên trông như vừa nằm nghiêng vừa đi quanh Mặt Trời. Một vòng quanh Mặt Trời của nó mất khoảng 84 năm Trái Đất, nên mỗi cực có mùa đông tối kéo dài khoảng 21 năm. Năm 1781, nhà thiên văn William Herschel tìm ra nó: hành tinh đầu tiên được phát hiện nhờ kính thiên văn.",
    source: "NASA Science · Uranus Facts",
  },
  {
    key: "hoang_hon_xanh_sao_hoa",
    topic: "vu_tru",
    quads: ["yellow", "green"],
    title: "Hoàng hôn màu xanh trên Sao Hỏa",
    body: "Ngày 15/4/2015, xe tự hành Curiosity chụp cảnh Mặt Trời lặn trên Sao Hỏa, và quanh Mặt Trời là một quầng màu xanh lam. Theo NASA, bụi trong không khí Sao Hỏa có những hạt rất mịn, để ánh sáng xanh đi qua dễ hơn và tụ lại gần phía Mặt Trời. Hành tinh đỏ lại có hoàng hôn xanh.",
    tryIt: "Tô hai bức hoàng hôn cạnh nhau: một trên Trái Đất, một trên Sao Hỏa.",
    source: "NASA JPL, 2015 · Sunset in Mars' Gale Crater",
  },
  {
    key: "trai_tim_diem_vuong",
    topic: "vu_tru",
    quads: [],
    title: "Trái tim trên Sao Diêm Vương",
    body: "Tháng 7/2015, tàu New Horizons của NASA bay ngang Sao Diêm Vương, một hành tinh lùn rất xa, và chụp được một vùng sáng hình trái tim. Vùng này mang tên Tombaugh, theo nhà thiên văn Clyde Tombaugh, người tìm ra Sao Diêm Vương năm 1930. Một phần trái tim là đồng bằng băng phẳng lì, có lẽ chưa tới 100 triệu năm tuổi, rất “trẻ” với một thế giới đá băng.",
    source: "Astronomy Now, 2015 · New Horizons discovers frozen plains in Pluto's heart",
  },
  {
    key: "enceladus_phun_bang",
    topic: "vu_tru",
    quads: ["yellow", "green"],
    title: "Enceladus phun băng vào vũ trụ",
    body: "Enceladus là một mặt trăng nhỏ của Sao Thổ, rộng chỉ khoảng 500 ki-lô-mét, và phản chiếu ánh sáng tốt nhất Hệ Mặt Trời. Tàu Cassini của NASA thấy hơi nước và hạt băng phun lên từ bốn vết nứt dài ở cực nam, gọi là “vằn hổ”. Dưới lớp băng có một đại dương nước mặn, và một phần băng phun ra góp thành vành đai E của Sao Thổ.",
    source: "NASA Science · Cassini at Enceladus",
  },
  {
    key: "sao_lap_lanh",
    topic: "vu_tru",
    quads: ["blue", "green"],
    title: "Vì sao sao lấp lánh?",
    body: "Ánh sáng từ một ngôi sao rất xa đến mắt mình như một tia sáng mảnh. Trên đường đi, nó xuyên qua những túi không khí nóng lạnh khác nhau luôn chuyển động, nên bị bẻ cong qua lại và trông như lấp lánh. Hành tinh ở gần hơn, trông như một cái đĩa nhỏ chứ không phải một chấm, nên ánh sáng “bù trừ” cho nhau và hành tinh ít lấp lánh hơn.",
    tryIt: "Tối nay nhìn trời: tìm một chấm sáng lấp lánh và một chấm sáng đứng yên. Chấm nào có thể là hành tinh?",
    source: "University of Wisconsin–Madison · Why do stars twinkle?",
  },
  {
    key: "bui_sao",
    topic: "vu_tru",
    quads: [],
    title: "Mình được làm từ bụi sao",
    body: "Theo Đài quan sát tia X Chandra (Harvard & Smithsonian), hydro trong nước của cơ thể mình có từ thuở Vũ trụ mới ra đời. Các-bon và ô-xy được tạo ra bên trong các ngôi sao, còn nhiều phần sắt trong cơ thể đến từ những vụ nổ sao rất lâu về trước. Nói cách khác, một phần cơ thể mình từng nằm trong các vì sao.",
    tryIt: "Viết một dòng: nếu mình là một ngôi sao, mình muốn tỏa sáng ở đâu?",
    source: "Chandra X-ray Observatory · Chandra Chemistry",
  },
  {
    key: "hanh_tinh_ngoai",
    topic: "vu_tru",
    quads: ["yellow", "green"],
    title: "Hơn 6.000 thế giới ngoài Hệ Mặt Trời",
    body: "Năm 1995, các nhà khoa học lần đầu tìm thấy một hành tinh quay quanh một ngôi sao giống Mặt Trời. Đến tháng 9/2025, danh sách của NASA đã có hơn 6.000 hành tinh ngoài Hệ Mặt Trời được xác nhận, và hơn 8.000 “ứng viên” đang chờ kiểm chứng. Có hành tinh quay quanh hai ngôi sao cùng lúc, có hành tinh to như Sao Mộc mà ở gần ngôi sao của nó hơn cả Sao Thủy gần Mặt Trời.",
    source: "NASA Exoplanet Archive (Caltech/IPAC), 2025 · 6,000 planets",
  },
  {
    key: "van_ly_truong_thanh",
    topic: "vu_tru",
    quads: [],
    title: "Kiểm chứng lời đồn: thấy Vạn Lý Trường Thành từ vũ trụ?",
    body: "Có lời đồn rằng từ Mặt Trăng nhìn thấy được Vạn Lý Trường Thành. Theo Britannica, các nhà du hành nói điều này không đúng: từ Mặt Trăng, mắt thường không thấy. Nhà du hành đầu tiên của Trung Quốc, Dương Lợi Vĩ, kể từ quỹ đạo ông cũng không thấy, vì theo NASA bức tường có màu rất giống đất quanh nó. Thứ do người làm ra dễ thấy nhất từ quỹ đạo là các thành phố sáng đèn ban đêm.",
    tryIt: "Buổi tối nhìn ra cửa sổ: chỗ nào sáng đèn nhất? Từ vũ trụ, các nhà du hành thấy những chỗ như thế.",
    source: "Britannica · Can you see the Great Wall of China from space?; NASA, 2005 · China's Wall Less Great in View from Space",
  },

  // -------------------------------------------------------------------------
  // 🌱 Cây cối thông minh
  // -------------------------------------------------------------------------
  {
    key: "huong_duong_dong_ho",
    topic: "cay_coi",
    quads: ["yellow", "green"],
    title: "Hướng dương có đồng hồ bên trong",
    body: "Năm 2016, các nhà khoa học ở Đại học California, Davis thấy cây hướng dương non quay về hướng đông lúc bình minh, theo Mặt Trời sang tây ban ngày, rồi ban đêm lại quay về hướng đông. Điều khiển việc này là một “đồng hồ sinh học” bên trong cây. Khi lớn, hoa đứng yên nhìn về hướng đông, ấm lên nhanh vào buổi sáng và được côn trùng ghé nhiều gấp 5 lần hoa quay về hướng tây.",
    tryIt: "Đặt một chậu cây cạnh cửa sổ. Vài ngày sau, ngọn cây có nghiêng về phía có nắng không?",
    source: "Atamian và cộng sự, 2016 · Science",
  },
  {
    key: "cay_keu_khi_khat",
    topic: "cay_coi",
    quads: [],
    title: "Cây kêu “tách tách” khi khát",
    body: "Năm 2023, các nhà khoa học ở Đại học Tel Aviv (Israel) đặt micro cạnh cây cà chua và cây thuốc lá. Cây đủ nước phát ra khoảng 1 tiếng mỗi giờ, còn cây thiếu nước phát ra tới khoảng 35 tiếng “tách” mỗi giờ, ở tần số cao đến mức tai người không nghe được. Chưa ai biết chắc tiếng kêu sinh ra thế nào, hay có con vật nào nghe thấy chúng không.",
    tryIt: "Tưới nước cho một chậu cây trong nhà và tưởng tượng nó vừa “nói” gì với mình.",
    source: "Khait và cộng sự, 2023 · Cell",
  },
  {
    key: "mang_luoi_nam",
    topic: "cay_coi",
    quads: [],
    title: "Kiểm chứng: cây “nói chuyện” qua mạng nấm?",
    body: "Dưới đất rừng, sợi nấm có thể nối rễ của nhiều cây với nhau thành mạng lưới, điều này đã được chứng minh. Nhiều sách báo còn kể cây “nói chuyện” và gửi thức ăn cho cây con qua mạng ấy. Năm 2023, ba nhà khoa học đọc lại các nghiên cứu ngoài rừng và thấy bằng chứng cho chuyện “gửi thức ăn” còn yếu. Ghi chép của nhà khoa học nhí: ý tưởng đẹp vẫn cần được kiểm chứng.",
    source: "Karst, Jones & Hoeksema, 2023 · Nature Ecology & Evolution",
  },
  {
    key: "la_sen_tu_sach",
    topic: "cay_coi",
    quads: ["yellow", "green"],
    title: "Lá sen tự làm sạch",
    body: "Nhỏ nước lên lá sen, nước vo tròn thành giọt và lăn đi, mang theo cả bụi bẩn. Bí mật nằm ở bề mặt lá: vô số u nhỏ li ti chỉ vài phần nghìn mi-li-mét, phủ thêm sáp, giữ lại không khí nên giọt nước gần như không chạm vào lá. Người ta gọi đó là “hiệu ứng lá sen” và học theo để làm sơn tường, ngói và vải chống bẩn.",
    tryIt: "Lần tới thấy lá sen ở chợ hay ở ao sen (có người lớn đi cùng), nhỏ một giọt nước lên và nhìn nó lăn.",
    source: "Scientific American · Self-Cleaning Materials; Barthlott & Neinhuis, 1997 · Planta",
  },
  {
    key: "tan_cay_ngai_ngung",
    topic: "cay_coi",
    quads: ["blue", "green"],
    title: "Những tán cây “ngại” chạm nhau",
    body: "Ở một số khu rừng, nhìn từ dưới lên sẽ thấy tán các cây cạnh nhau không chạm vào nhau, chừa lại những đường trời sáng như bản đồ. Hiện tượng này gọi là “tán cây ngại ngùng”, được ghi lại từ những năm 1920. Một giả thuyết là gió làm cành cọ vào nhau nên cây giữ khoảng cách, nhưng theo National Geographic, các nhà khoa học vẫn chưa hiểu hết vì sao.",
    tryIt: "Đứng dưới một hàng cây và ngước nhìn lên: tán cây có chạm nhau không? Vẽ lại khoảng trời giữa các tán.",
    source: "National Geographic, 2020 · Tree crown shyness",
  },
  {
    key: "hat_cha_la_2000_nam",
    topic: "cay_coi",
    quads: ["yellow", "green"],
    title: "Hạt chà là 2.000 tuổi nảy mầm",
    body: "Ở pháo đài cổ Masada (Israel), người ta tìm thấy những hạt chà là được tính ra khoảng 2.000 năm tuổi. Năm 2005, nhóm của nhà khoa học Sarah Sallon gieo thử một hạt, và khoảng tám tuần sau nó nảy mầm thành cây con, được đặt tên là “Methuselah”. Kỷ lục cũ thuộc về một hạt sen khoảng 1.300 năm tuổi.",
    source: "Sallon và cộng sự, 2008 · Science",
  },
  {
    key: "cay_lon_tu_khong_khi",
    topic: "cay_coi",
    quads: [],
    title: "Cây lớn lên từ… không khí",
    body: "Khoảng 400 năm trước, Jan Baptist van Helmont trồng một cây liễu trong chậu đất và chăm nó suốt 5 năm. Cây lớn hẳn lên, nhưng đất trong chậu gần như không nhẹ đi. Ngày nay ta biết phần lớn chất khô của cây đến từ khí các-bon-níc trong không khí, được lá biến đổi nhờ ánh nắng, còn đất chỉ góp một ít khoáng chất.",
    tryIt: "Nhìn một cái cây to và nghĩ: phần lớn thân cây ấy được làm từ không khí.",
    source: "Viện Davidson (Viện Khoa học Weizmann), 2025 · What are plants made of?",
  },
  {
    key: "pando_mot_cay",
    topic: "cay_coi",
    quads: [],
    title: "Pando: một cây mà như cả khu rừng",
    body: "Ở rừng quốc gia Fishlake (bang Utah, Hoa Kỳ) có một rừng dương lá rung trông như hơn 40.000 cây riêng lẻ. Thật ra tất cả là một cây duy nhất tên Pando, mọc lên từ một hạt và nối với nhau bằng chung một bộ rễ. Pando trải trên khoảng 43 héc-ta, nặng chừng 6.000 tấn, và được cho là sinh vật nặng nhất từng được tìm thấy.",
    source: "USDA Forest Service · Pando; EarthDate · Pando: A Forest of One",
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
