/**
 * Hồ sơ mật — Nguyên's daily, optional "fact" cards in Góc bình yên (R7c).
 *
 * PURE DATA + tiny pure helpers, safe in browser and server code. Gentle psychoeducation
 * framed as curiosity, in the detective voice. Not therapy and not advice about anyone's
 * health. The parent reads every card in docs/binh-yen/HO_SO_MAT.md (generated from this
 * file by scripts/dossier-doc.ts, with every source link) before merging.
 *
 * Content rules (spec "Content safety"): no clinical words about the reader, no frightening
 * statistics, no "con nên / con phải", no comparison with others, no self-harm / eating /
 * weight / body-image topics, no living people's mental-health stories, every claim hedged
 * and sourced. tests/dossier.test.ts enforces the checkable parts.
 *
 * Keys are stable forever (the notebook stores them on the child's device). A card that is
 * withdrawn later keeps its key out of reuse.
 *
 * Nothing about which card was read goes to the server, logs or parents.
 */
import type { Quad } from "./catalog";

export type DossierTopic = "nao" | "cam_xuc" | "lich_su" | "con_nguoi" | "xa_hoi";

export interface Dossier {
  key: string;
  topic: DossierTopic;
  /** Check-in quads this card suits; empty = any. Red/blue: reassuring, body-calming. Yellow/green: curiosity, savouring. */
  quads: Quad[];
  title: string;
  body: string;
  /** One gentle, optional micro-action ("Thử nhỏ"). */
  tryIt?: string;
  /** Short citation shown small under the card ("Nguồn: …"). */
  source: string;
  /**
   * Held back: kept in the pack (and in the parents' reading copy) but never shown to the
   * child until the parent / her counsellor agrees. Selection skips held cards.
   */
  held?: true;
  /** Why the card is held (shown to parents in docs/binh-yen/HO_SO_MAT.md only). */
  heldReason?: string;
}

/** Chip order in the UI. */
export const TOPIC_KEYS = ["nao", "cam_xuc", "lich_su", "con_nguoi", "xa_hoi"] as const satisfies readonly DossierTopic[];

export const TOPICS: Record<DossierTopic, { label: string; emoji: string }> = {
  nao: { label: "Não bộ", emoji: "🧠" },
  cam_xuc: { label: "Cảm xúc", emoji: "💬" },
  lich_su: { label: "Lịch sử", emoji: "📜" },
  con_nguoi: { label: "Con người", emoji: "👥" },
  xa_hoi: { label: "Xã hội", emoji: "🌏" },
};

export function isDossierTopic(v: unknown): v is DossierTopic {
  return typeof v === "string" && (TOPIC_KEYS as readonly string[]).includes(v);
}

export const DOSSIERS: readonly Dossier[] = [
  // -------------------------------------------------------------------------
  // 🧠 Não bộ
  // -------------------------------------------------------------------------
  {
    key: "chuong_bao_dong",
    topic: "nao",
    quads: ["red"],
    title: "Chiếc chuông trong đầu",
    body: "Sâu trong não có hạch hạnh nhân, hoạt động như một chiếc chuông báo động. Khi thấy có vẻ nguy hiểm, nó báo ngay để cơ thể chuẩn bị: tim đập nhanh, thở gấp, cơ căng lên; đó là cơ thể đang làm đúng việc của nó. Theo Harvard Health, chuông này nhanh đến mức có khi reo trước cả lúc mắt kịp nhìn rõ chuyện gì. Cơ thể cũng có sẵn một hệ thống giống như cái phanh, giúp mình dịu lại khi mọi thứ đã qua.",
    tryIt: "Thở ra chậm hơn hít vào, ba lần. Đó là một cách nhẹ nhàng có thể giúp nhấn phanh.",
    source: "Harvard Health Publishing · Understanding the stress response (2011, duyệt lại 2024)",
  },
  {
    key: "bao_dong_nham",
    topic: "nao",
    quads: ["red", "blue"],
    title: "Chiếc máy báo khói cẩn thận",
    body: "Nhà khoa học Randolph Nesse nói về “nguyên tắc máy báo khói”. Máy kêu nhầm vì bánh mì hơi khét vẫn tốt hơn máy im lặng lúc cháy thật. Theo ông, phản ứng phòng vệ của cơ thể, kể cả cảm giác lo, cũng được chỉnh để thà báo nhầm còn hơn bỏ sót, nên báo nhầm là chuyện thường gặp và bình thường. Vậy chuông kêu to chưa chắc là có chuyện thật; còn nếu có chuyện thật, kể với một người lớn mình tin luôn là một lựa chọn.",
    tryIt: "Gọi tên cái chuông đang kêu, ví dụ: “À, đây là lo lắng.” Rồi thở ra chậm một lần.",
    source: "Nesse, 2001 · Annals of the New York Academy of Sciences",
  },
  {
    key: "goi_ten_cam_xuc",
    topic: "nao",
    quads: ["red", "blue"],
    title: "Gọi đúng tên, chuông nhỏ lại",
    body: "Năm 2007, nhóm của nhà tâm lý Matthew Lieberman ở Đại học California, Los Angeles cho người tham gia xem ảnh những khuôn mặt đang giận hay sợ, rồi chọn một từ gọi tên cảm xúc ấy. Khi gọi tên, hạch hạnh nhân hoạt động ít hơn, còn một vùng não ngay sau trán, liên quan đến việc nghĩ về cảm xúc bằng lời, thì hoạt động nhiều hơn. Chính tác giả nói hiệu ứng có lẽ không lớn, nhưng đây là một manh mối đáng giữ.",
    tryIt: "Chọn một từ gần đúng nhất với lúc này, ví dụ “bực”, “mệt” hay “hồi hộp”, và nói thầm nó ra.",
    source: "Lieberman và cộng sự, 2007 · Psychological Science",
  },
  {
    key: "tho_ra_cham",
    topic: "nao",
    quads: ["red"],
    title: "Manh mối nằm ở hơi thở ra",
    body: "Trong một thí nghiệm năm 2023 ở Đại học Stanford, các nhà khoa học cho 108 người lớn tập vài kiểu thở khác nhau, 5 phút mỗi ngày trong một tháng. Kiểu “thở dài có nhịp” (hít vào, hít thêm một hơi ngắn, rồi thở ra thật chậm) giúp tâm trạng tích cực tăng nhiều hơn so với nhóm ngồi thiền. Nhóm nghiên cứu cho rằng phần thở ra dài có thể là điểm quan trọng.",
    tryIt: "Hít vào bằng mũi, hít thêm một hơi ngắn, rồi thở ra thật chậm bằng miệng. Ba lần là đủ. Thấy khác hay chưa thấy gì cũng đều ổn.",
    source: "Balban và cộng sự, 2023 · Cell Reports Medicine",
  },
  {
    key: "nao_dang_xay",
    topic: "nao",
    quads: [],
    title: "Công trình đang xây",
    body: "Theo NIMH, một viện nghiên cứu lớn của Hoa Kỳ, não người tiếp tục phát triển đến khoảng giữa hoặc cuối tuổi hai mươi. Vùng vỏ não trước trán, nơi lo việc lập kế hoạch và cân nhắc, nằm trong số những vùng hoàn thiện sau cùng. Não tuổi teen lại có một điểm mạnh: rất linh hoạt, dễ thích nghi với điều mới. Có hôm thấy khó sắp xếp mọi thứ cũng dễ hiểu thôi, vì công trình vẫn đang xây.",
    source: "NIMH, 2023 · The Teen Brain: 7 Things to Know",
  },
  {
    key: "giac_ngu_cat_ho_so",
    topic: "nao",
    quads: ["blue", "green"],
    title: "Ai sắp xếp hồ sơ lúc nửa đêm?",
    body: "Các nhà nghiên cứu giấc ngủ cho rằng trong lúc mình ngủ, não xem lại những gì vừa trải qua trong ngày. Trong đêm, một số ký ức được củng cố, nhất là trong giai đoạn ngủ sâu. Theo bài viết của Viện Y tế Quốc gia Hoa Kỳ (NIH), ngủ sau khi học giúp lưu và gắn chặt thông tin mới vào não. Vậy là trong lúc mình ngủ, não vẫn âm thầm làm phần việc của nó.",
    tryIt: "Trước khi ngủ, viết một dòng: hôm nay mình biết thêm điều gì?",
    source: "NIH News in Health, 2013 · Sleep On It",
  },
  {
    key: "huyen_thoai_10_phan_tram",
    topic: "nao",
    quads: ["yellow", "green"],
    title: "Vụ án “10% bộ não”",
    body: "Có lẽ con đã từng nghe câu “người ta chỉ dùng 10% bộ não”. Thám tử kiểm tra rồi: đây là chuyện không có thật. Trên tạp chí Scientific American, nhà thần kinh học Barry Gordon ở Đại học Johns Hopkins nói chúng ta dùng gần như mọi phần của não. Không có vùng nào đang ngủ quên chờ được đánh thức cả.",
    source: "Scientific American, 2008 · Do People Only Use 10 Percent of Their Brains?",
  },
  {
    key: "tai_xe_taxi_london",
    topic: "nao",
    quads: ["yellow", "green"],
    title: "Bản đồ trong đầu tài xế taxi",
    body: "Tài xế taxi ở London phải học rất kỹ đường đi khắp thành phố. Năm 2000, nhóm của nhà khoa học Eleanor Maguire chụp não các tài xế và thấy phần sau của hồi hải mã, vùng liên quan đến tìm đường, lớn hơn so với người không lái taxi. Người lái càng lâu năm, phần này càng lớn. Đây là một manh mối cho thấy não có thể thay đổi theo những gì mình luyện tập.",
    source: "Maguire và cộng sự, 2000 · PNAS",
  },

  // -------------------------------------------------------------------------
  // 💬 Cảm xúc
  // -------------------------------------------------------------------------
  {
    key: "cam_xuc_la_tin_nhan",
    topic: "cam_xuc",
    quads: ["red", "blue"],
    title: "Cảm xúc là tin nhắn, không phải mệnh lệnh",
    body: "Hai nhà tâm lý Dacher Keltner và James Gross viết rằng cảm xúc có chức năng: chúng giúp mình phản ứng với những gì đang thay đổi quanh mình. Bực có thể đang báo “có gì đó chưa công bằng”, buồn có thể đang báo “mình vừa mất một điều quan trọng”. Có tin nhắn đúng, cũng có tin nhắn gửi nhầm. Đọc xong, mình vẫn là người quyết định làm gì tiếp theo.",
    tryIt: "Hỏi cảm xúc đang có: “Bạn muốn báo cho mình điều gì?” Viết câu trả lời thành một dòng.",
    source: "Keltner & Gross, 1999 · Cognition and Emotion",
  },
  {
    key: "lo_la_tap_duot",
    topic: "cam_xuc",
    quads: ["red"],
    held: true,
    heldReason: "Nói lo lắng là “tập dượt” có ích có thể làm mạnh thêm ý nghĩ “lo giúp mình chuẩn bị”. Chỉ bật khi bố mẹ hoặc chuyên gia của con đồng ý.",
    title: "Khi cái đầu muốn “tập dượt” mãi",
    body: "Hiệp hội Tâm lý học Hoa Kỳ (APA) viết rằng một chút lo lắng là bình thường, ví dụ trước khi nói trước đám đông, và có khi còn có ích vì nó thúc mình bắt tay vào chuẩn bị. Phần có ích là việc chuẩn bị, không phải số vòng nghĩ đi nghĩ lại (hồ sơ “Sóng lên rồi sóng lại xuống” thấy việc này làm cảm xúc ở lâu hơn). Khi đã chuẩn bị xong mà cái đầu vẫn muốn chạy thử thêm vòng nữa, mình có thể cảm ơn nó và cho nó nghỉ.",
    tryIt: "Viết ra một việc nhỏ có thể chuẩn bị ngay. Những điều còn lại, ghi một dòng để mai xem.",
    source: "APA (Hiệp hội Tâm lý học Hoa Kỳ), 2021",
  },
  {
    key: "song_len_song_xuong",
    topic: "cam_xuc",
    quads: ["red", "blue"],
    title: "Sóng lên rồi sóng lại xuống",
    body: "Hai nhà tâm lý ở Đại học Leuven (Bỉ) hỏi 233 học sinh cấp ba xem những cảm xúc gần đây của các bạn kéo dài bao lâu. Nhiều cảm xúc, như ngạc nhiên hay sợ, có khi qua rất nhanh; cảm xúc gắn với chuyện mình quan tâm thì thường ở lâu hơn. Theo các tác giả, nghĩ đi nghĩ lại một chuyện là lý do chính khiến cảm xúc kéo dài. Vì thế, chuyển sang việc khác một lúc có thể giúp sóng lắng nhanh hơn.",
    tryIt: "Đi bộ vài phút hoặc vươn vai, rồi xem con sóng đã đổi chưa.",
    source: "Verduyn & Lavrijsen, 2015 · Motivation and Emotion",
  },
  {
    key: "vua_vui_vua_buon",
    topic: "cam_xuc",
    quads: ["blue", "yellow"],
    title: "Vừa vui vừa buồn, có được không?",
    body: "Có. Năm 2001, các nhà tâm lý hỏi mọi người ngay sau khi xem một bộ phim vừa hài vừa cảm động, lúc sinh viên dọn khỏi ký túc xá và lúc tốt nghiệp. Ngày thường, phần lớn người ta thấy hoặc vui hoặc buồn; nhưng vào những dịp như vậy, nhiều người thấy cả hai cùng lúc. Có vẻ cảm xúc lẫn lộn hay đến khi một điều quý giá sắp khép lại.",
    source: "Larsen, McGraw & Cacioppo, 2001 · Journal of Personality and Social Psychology",
  },
  {
    key: "tu_chinh_xac",
    topic: "cam_xuc",
    quads: [],
    title: "Thám tử dùng từ thật chính xác",
    body: "Nói “mình thấy tệ” là một cách. Nói “mình đang thất vọng” hay “mình đang tủi thân” là một cách khác, chi tiết hơn. Các nhà tâm lý gọi khả năng này là độ “mịn” của cảm xúc, và nghiên cứu cho thấy gọi tên chi tiết hơn thường đi cùng với việc xoay xở tốt hơn lúc khó chịu. Bằng chứng ban đầu còn cho thấy đây là kỹ năng có thể luyện dần.",
    tryIt: "Thay chữ “tệ” bằng một từ chính xác hơn trong danh sách cảm xúc của Góc bình yên.",
    source: "Kashdan, Barrett & McKnight, 2015 · Current Directions in Psychological Science",
  },
  {
    key: "anh_chup_trong_dau",
    topic: "cam_xuc",
    quads: ["yellow", "green"],
    title: "Chụp một tấm ảnh bằng trí nhớ",
    body: "Nhà tâm lý Fred Bryant nghiên cứu về “nếm trải” (savoring) từ lâu. Ông mô tả đó là để ý và tận hưởng cảm xúc của mình ngay trong lúc điều tốt đẹp đang diễn ra. Một cách ông gợi ý là dừng lại chụp một “tấm ảnh trong đầu” về khoảnh khắc muốn nhớ. Một cách khác là kể điều vui ấy cho một người mình quý.",
    tryIt: "Nhìn quanh và giữ lại một chi tiết của lúc này: một âm thanh, một màu, một mùi.",
    source: "Greater Good Magazine (UC Berkeley), 2012 · 10 Steps to Savoring the Good Things in Life",
  },
  {
    key: "to_mo_la_chia_khoa",
    topic: "cam_xuc",
    quads: ["yellow", "green"],
    title: "Tò mò là chiếc chìa khóa",
    body: "Các nhà khoa học ở Đại học California, Davis từng cho người tham gia đọc câu đố rồi chờ xem đáp án (2014). Khi rất tò mò, họ nhớ đáp án tốt hơn. Bất ngờ hơn, họ còn nhớ tốt hơn cả những khuôn mặt không liên quan được cho xem trong lúc đang tò mò, và vẫn nhớ sau một ngày.",
    source: "Gruber, Gelman & Ranganath, 2014 · Neuron",
  },
  {
    key: "so_dieu_tot",
    topic: "cam_xuc",
    quads: ["yellow", "green"],
    title: "Cuốn sổ những điều tốt",
    body: "Trong một nghiên cứu năm 2003, hai nhà tâm lý Robert Emmons và Michael McCullough nhờ một nhóm người ghi lại tối đa năm điều mình biết ơn, mỗi tuần hoặc mỗi ngày. So với các nhóm khác, nhóm này thấy dễ chịu hơn ở nhiều phép đo, dù không phải tất cả, và rõ nhất là ở cảm xúc tích cực. Điều được ghi không cần lớn: một câu đùa của bạn cũng tính.",
    tryIt: "Viết một dòng: hôm nay có một điều nhỏ mình thấy biết ơn.",
    source: "Emmons & McCullough, 2003 · Journal of Personality and Social Psychology",
  },

  // -------------------------------------------------------------------------
  // 📜 Lịch sử
  // -------------------------------------------------------------------------
  {
    key: "so_tay_hoang_de",
    topic: "lich_su",
    quads: [],
    title: "Cuốn sổ riêng của một hoàng đế",
    body: "Marcus Aurelius là hoàng đế La Mã sống gần 2.000 năm trước. Theo Britannica, ông viết những ghi chép rời rạc bằng tiếng Hy Lạp cổ, có lẽ vào đầu những năm 170, giữa các chiến dịch dọc sông Danube. Ngày nay ta gọi chúng là “Suy tưởng”. Không ai biết chắc ông có định cho người khác đọc hay không, nên nhiều người xem đó như cuốn sổ ông viết cho chính mình.",
    tryIt: "Viết một dòng cho chính mình, như Marcus: hôm nay có điều gì mình muốn nhớ?",
    source: "Encyclopaedia Britannica · Meditations (Marcus Aurelius)",
  },
  {
    key: "hai_chiec_hop",
    topic: "lich_su",
    quads: ["red", "blue"],
    title: "Hai chiếc hộp của Epictetus",
    body: "Epictetus là một triết gia Khắc kỷ sinh khoảng năm 55. Thuở nhỏ ông là nô lệ, sau này được trả tự do. Ông không tự viết sách; học trò Arrian ghi lại lời ông giảng. Ông chia mọi thứ làm hai loại: điều thật sự thuộc về mình, như suy nghĩ, ý định và việc mình làm; và điều không hoàn toàn do mình, như người khác nghĩ gì hay kết quả ra sao.",
    tryIt: "Viết một dòng chia hai phía: “thuộc về mình” và “không do mình”.",
    source: "Britannica · Epictetus; Stanford Encyclopedia of Philosophy · Epictetus",
  },
  {
    key: "thu_vien_tren_thap",
    topic: "lich_su",
    quads: ["yellow", "green"],
    title: "Một thư viện trên tòa tháp",
    body: "Năm 1571, Michel de Montaigne lui về lâu đài của gia đình ở Pháp để đọc, suy ngẫm và viết. Thư viện trên tòa tháp của lâu đài trở thành nơi trú ẩn của ông. Ở đó ông bắt đầu viết các “essais”, mà Britannica mô tả là những lần thăm dò và thử nghiệm tâm trí của chính ông. Ông còn viết rằng bản thân ông là chất liệu cho cuốn sách của mình.",
    tryIt: "Viết một dòng về một điều nhỏ mình mới nhận ra về bản thân hôm nay.",
    source: "Britannica · Michel de Montaigne",
  },
  {
    key: "phong_tra_nho",
    topic: "lich_su",
    quads: ["red", "green"],
    title: "Căn phòng trà chỉ đủ năm người",
    body: "Giữa thế kỷ 16, các bậc thầy trà Nhật Bản như Sen no Rikyū đưa trà đạo theo vẻ đẹp giản dị gọi là “wabi”. Phòng trà thường chỉ đủ cho bốn, năm người, mô phỏng túp lều của người ẩn cư. Manh mối thêm: bốn chữ “hòa, kính, thanh, tịch” hay được gán cho Rikyū, nhưng các nhà nghiên cứu chưa tìm thấy bằng chứng ông nói vậy.",
    source: "The Met, 2011 · The Japanese Tea Ceremony; Japan Past & Present · Abstract Concepts in Chanoyu",
  },
  {
    key: "mot_lan_mot_hoi",
    topic: "lich_su",
    quads: ["yellow", "green"],
    title: "Một lần, một cuộc gặp",
    body: "Trong trà đạo Nhật Bản có câu “ichigo ichie”, nghĩa là “một lần, một cuộc gặp”. Câu này gắn với Ii Naosuke, một lãnh chúa đồng thời là bậc thầy trà. Ý của nó là buổi trà hôm nay sẽ không bao giờ lặp lại đúng y như vậy, nên chủ và khách đối với nhau bằng sự tử tế và chân thành.",
    tryIt: "Nhìn quanh và ghi nhớ ba điều của khoảnh khắc này, vì nó sẽ không lặp lại y hệt.",
    source: "Japan Past & Present · Abstract Concepts in Chanoyu",
  },
  {
    key: "duc_toc_bat_dat",
    topic: "lich_su",
    quads: ["red"],
    title: "“Dục tốc bất đạt” đến từ đâu?",
    body: "Người Việt hay nói “dục tốc bất đạt”: muốn nhanh thì lại không tới. Câu này bắt nguồn từ sách Luận ngữ, ghi lời Khổng Tử khoảng 2.500 năm trước. Khi học trò Tử Hạ làm quan ở đất Cử Phụ và hỏi cách cai quản, ông khuyên đừng mong việc xong thật nhanh và đừng chăm chăm vào cái lợi nhỏ. Thám tử cũng vậy: từng manh mối một.",
    source: "Luận ngữ 13.17 · bản dịch James Legge (UCLA Center for Chinese Studies)",
  },
  {
    key: "mai_sat_nen_kim",
    topic: "lich_su",
    quads: ["blue", "yellow"],
    title: "Từng chút một, sắt cũng thành kim",
    body: "Tục ngữ Việt Nam có câu “Có công mài sắt, có ngày nên kim”. Hình ảnh trong câu rất lạ: một thanh sắt thô được mài mòn dần, cho đến khi chỉ còn bằng cây kim. Câu tục ngữ không đòi xong ngay; nó nói về những lần mài nhỏ, đều đặn, cộng dồn lại theo thời gian.",
    source: "Tục ngữ dân gian · Lê Thị Hồng Minh, Vài nét về tục ngữ mới (ĐH KHXH&NV, ĐHQG TP.HCM)",
  },
  {
    key: "truong_cua_nguoi_di_bo",
    topic: "lich_su",
    quads: ["blue", "yellow"],
    title: "Trường học của những người đi dạo",
    body: "Năm 335 trước Công nguyên, Aristotle lập trường Lyceum ở Athens. Theo Britannica, trường được gọi là “Peripatetic” (người đi dạo) vì ông có thói quen vừa đi quanh lùm cây vừa giảng bài. Trường còn có một hành lang có mái che tên là “peripatos”. Đi bộ và suy nghĩ đã đi cùng nhau từ rất lâu.",
    tryIt: "Nghĩ về một bài khó trong lúc đi bộ vài phút quanh nhà.",
    source: "Britannica · Lyceum",
  },

  // -------------------------------------------------------------------------
  // 👥 Con người
  // -------------------------------------------------------------------------
  {
    key: "chiec_ao_phong",
    topic: "con_nguoi",
    quads: ["red", "blue"],
    title: "Vụ án chiếc áo phông",
    body: "Năm 2000, ở Đại học Cornell, sinh viên được nhờ mặc một chiếc áo in hình ca sĩ mà họ thấy ngượng, rồi bước vào một phòng có vài bạn sinh viên khác đang ngồi. Họ đoán gần một nửa số người trong phòng sẽ nhận ra chiếc áo, nhưng thực tế chưa đến một phần tư nhận ra. Các nhà tâm lý gọi đây là “hiệu ứng ánh đèn sân khấu”: mình thường nghĩ người khác để ý mình nhiều hơn thực tế.",
    tryIt: "Lần tới thấy ngượng, thử nhớ lại: ánh đèn trong đầu thường sáng hơn ngoài đời.",
    source: "Gilovich, Medvec & Savitsky, 2000 · Journal of Personality and Social Psychology",
  },
  {
    key: "khong_trong_suot",
    topic: "con_nguoi",
    quads: ["red"],
    title: "Người khác không nhìn xuyên qua mình",
    body: "Nhiều người tin rằng cảm xúc bên trong “lộ ra ngoài” nhiều hơn thực tế, ví dụ nghĩ ai cũng nhận ra mình đang hồi hộp. Các nhà tâm lý gọi đây là “ảo tưởng trong suốt”. Trong một nghiên cứu năm 2003, người nói trước vài người nghe tự thấy mình lộ vẻ lo nhiều hơn những gì người nghe nhận ra. Những người được kể trước về điều này thấy bớt căng hơn, và người nghe cũng chấm bài nói của họ tốt hơn.",
    tryIt: "Trước khi nói, gọi tên cảm giác đang có và nhớ: người nghe thường thấy mình bình tĩnh hơn mình tưởng.",
    source: "Gilovich, Savitsky & Medvec, 1998 · JPSP; Savitsky & Gilovich, 2003 · Journal of Experimental Social Psychology",
  },
  {
    key: "khoang_cach_yeu_thich",
    topic: "con_nguoi",
    quads: ["red", "blue"],
    title: "Người mới quen thường quý mình hơn mình nghĩ",
    body: "Sau khi trò chuyện với một người mới gặp, mình thường đoán người kia quý mình ít hơn mức họ thật sự quý. Năm 2018, các nhà tâm lý ở Đại học Yale và vài trường khác gọi đây là “khoảng cách yêu thích” (liking gap). Họ thấy cả hai người trong cuộc trò chuyện đều đoán như vậy, dù nói chuyện lâu hay nhanh. Lần tới nghĩ “chắc bạn ấy thấy mình chán”, có thể đó chỉ là một cú lừa nhỏ của trí óc.",
    source: "Boothby, Cooney, Sandstrom & Clark, 2018 · Psychological Science",
  },
  {
    key: "cu_hoi_thang",
    topic: "con_nguoi",
    quads: ["red", "blue"],
    title: "Lời nhờ giúp hiệu nghiệm hơn mình tưởng",
    body: "Trong các thí nghiệm năm 2008, người tham gia phải nhờ người lạ giúp một việc nhỏ, và trước đó đoán xem bao nhiêu người sẽ đồng ý. Họ đoán thấp hơn thực tế khá nhiều, có khi thấp tới một nửa. Có vẻ nhiều người sẵn lòng giúp hơn mình tưởng, nhất là khi mình hỏi thẳng.",
    tryIt: "Viết một dòng: có việc gì mình muốn nhờ ai đó giúp không?",
    source: "Flynn & Lake, 2008 · Journal of Personality and Social Psychology",
  },
  {
    key: "lam_dieu_tot",
    topic: "con_nguoi",
    quads: ["blue", "green"],
    title: "Làm điều tốt, mình cũng được phần",
    body: "Một nhóm nhà khoa học ở Đại học Oxford gom 27 nghiên cứu về việc làm điều tốt cho người khác. Kết quả cho thấy người làm điều tốt thường thấy dễ chịu hơn, ở mức nhỏ đến vừa. Các tác giả cũng nói nhiều nghiên cứu còn nhỏ nên cần thêm bằng chứng. Một việc tốt nhỏ cũng tính, như giữ cửa cho ai đó hay nhắn một lời hỏi thăm.",
    source: "Curry và cộng sự, 2018 · Journal of Experimental Social Psychology",
  },
  {
    key: "cau_chao_nho",
    topic: "con_nguoi",
    quads: ["blue", "yellow"],
    title: "Một câu chào cũng có sức nặng",
    body: "Năm 2014, hai nhà tâm lý ở Canada làm một thí nghiệm nhỏ với những người đi mua cà phê. Một nhóm được nhờ mỉm cười, nhìn vào mắt và nói vài câu với người bán; nhóm kia mua thật nhanh gọn. Nhóm có trò chuyện thấy vui hơn, và có dấu hiệu ban đầu là nhờ cảm giác mình thuộc về nơi đó.",
    source: "Sandstrom & Dunn, 2014 · Social Psychological and Personality Science",
  },
  {
    key: "la_thu_cam_on",
    topic: "con_nguoi",
    quads: ["yellow", "green"],
    title: "Lá thư cảm ơn nặng ký hơn mình nghĩ",
    body: "Hai nhà khoa học Amit Kumar và Nicholas Epley từng nhờ người tham gia viết một lá thư cảm ơn ngắn cho ai đó. Người viết đoán người nhận sẽ thấy hơi ngượng, nhưng trong nghiên cứu năm 2018 ấy, người nhận ngạc nhiên và vui hơn nhiều so với dự đoán. Viết một lá thư như vậy chỉ mất vài phút.",
    tryIt: "Viết một dòng cảm ơn ai đó. Gửi hay giữ lại đều được.",
    source: "Kumar & Epley, 2018 · Psychological Science",
  },
  {
    key: "trong_giong_can_dam",
    topic: "con_nguoi",
    quads: ["red", "blue"],
    title: "Từ bên ngoài, nó trông giống can đảm",
    body: "Thừa nhận mình sai, nhờ giúp đỡ hay hát ngẫu hứng trước người khác có thể khiến mình thấy yếu đuối. Năm 2018, các nhà tâm lý ở Đại học Mannheim (Đức) thấy người ta tự đánh giá những lúc mình làm vậy tệ hơn so với cách người khác nhìn vào. Họ gọi đây là “hiệu ứng mớ hỗn độn đẹp”, và cho rằng từ bên ngoài, những việc ấy trông giống can đảm hơn.",
    source: "Bruk, Scholl & Bless, 2018 · Journal of Personality and Social Psychology",
  },

  // -------------------------------------------------------------------------
  // 🌏 Xã hội
  // -------------------------------------------------------------------------
  {
    key: "con_so_120_phut",
    topic: "xa_hoi",
    quads: [],
    title: "Manh mối 120 phút",
    body: "Năm 2019, một nhóm nghiên cứu ở Anh hỏi gần 20.000 người về thời gian họ ở với thiên nhiên mỗi tuần. Những người có ít nhất 120 phút mỗi tuần thường cho biết sức khỏe và tinh thần tốt hơn, và chia nhỏ thành nhiều lần cũng được. Đây mới là một mối liên hệ, chưa chứng minh nguyên nhân, nhưng là một manh mối dễ thử.",
    tryIt: "Đi bộ vài phút ở chỗ có cây xanh, rồi để ý một màu lá.",
    source: "White và cộng sự, 2019 · Scientific Reports",
  },
  {
    key: "tam_rung",
    topic: "xa_hoi",
    quads: ["red", "blue"],
    title: "Người Nhật gọi đó là “tắm rừng”",
    body: "Năm 1982, Bộ Nông Lâm Ngư nghiệp Nhật Bản đặt ra từ “shinrin-yoku”, nghĩa là “tắm rừng”: đắm mình trong bầu không khí của rừng. Một nghiên cứu ở 24 khu rừng khắp Nhật Bản cho 280 nam sinh viên đi dạo và ngắm cảnh ở rừng hoặc ở phố. Ở rừng, nhịp tim, huyết áp và cortisol (một hormone liên quan đến căng thẳng) thấp hơn, còn hệ thần kinh “nghỉ ngơi” hoạt động nhiều hơn.",
    tryIt: "Nhìn ra cửa sổ tìm một chút màu xanh, rồi để ý nó trong vài hơi thở.",
    source: "Park và cộng sự, 2010 · Environmental Health and Preventive Medicine",
  },
  {
    key: "sac_lai_tap_trung",
    topic: "xa_hoi",
    quads: ["blue", "green"],
    title: "Sạc lại sự tập trung",
    body: "Các nhà tâm lý ở Đại học Michigan (2008) cho người tham gia đi dạo trong một vườn cây hoặc trên phố, rồi làm bài kiểm tra sự chú ý. Sau khi đi trong thiên nhiên, hay thậm chí chỉ xem ảnh thiên nhiên, kết quả tốt hơn. Các tác giả cho rằng thiên nhiên thu hút sự chú ý một cách nhẹ nhàng, để phần tập trung có chủ đích được nghỉ và hồi lại.",
    tryIt: "Giữa hai bài, đứng dậy vươn vai và nhìn về phía có cây xanh một lúc.",
    source: "Berman, Jonides & Kaplan, 2008 · Psychological Science",
  },
  {
    key: "noi_thuoc_ve",
    topic: "xa_hoi",
    quads: ["blue"],
    title: "Ai cũng cần một nơi thuộc về",
    body: "Năm 1995, hai nhà tâm lý Roy Baumeister và Mark Leary tổng hợp rất nhiều nghiên cứu và cho rằng nhu cầu thuộc về là một động lực cơ bản của con người. Theo họ, chỉ cần vài người thôi: điều mình cần là những lần gặp gỡ thường xuyên, phần lớn dễ chịu, trong một mối quan hệ có sự quan tâm lâu dài. Một tin nhắn hỏi thăm hay một buổi đi dạo cùng nhau đều là những sợi dây nhỏ như thế.",
    source: "Baumeister & Leary, 1995 · Psychological Bulletin",
  },
  {
    key: "tin_don_chay_nhanh",
    topic: "xa_hoi",
    quads: ["yellow", "green"],
    title: "Tin đồn chạy nhanh hơn sự thật",
    body: "Năm 2018, ba nhà khoa học ở MIT nghiên cứu cách tin thật và tin sai lan truyền trên Twitter. Tin sai được chia sẻ lại nhiều hơn tin đúng khoảng 70%, và đến được với nhiều người nhanh hơn. Người lan truyền chủ yếu là con người chứ không phải máy tự động, có lẽ vì tin sai thường mới lạ. Vì vậy, một thám tử luôn kiểm tra nguồn trước khi chuyển tiếp.",
    source: "Vosoughi, Roy & Aral, 2018 · Science",
  },
  {
    key: "nghi_ngan",
    topic: "xa_hoi",
    quads: [],
    title: "Hai lần nghỉ ngắn",
    body: "Ở Đại học Illinois, các nhà tâm lý cho người tham gia làm một bài lặp đi lặp lại trên máy tính suốt 50 phút. Trong thí nghiệm năm 2011 ấy, phần lớn người làm liền một mạch thì càng về sau làm càng kém. Nhóm được chen vào hai lần chuyển việc rất ngắn thì giữ được phong độ đến cuối. Nghỉ ngắn không phải là lười; có thể nó giúp não giữ mục tiêu luôn mới.",
    tryIt: "Xong một bài, đứng dậy vươn vai một chút rồi mới làm bài tiếp.",
    source: "Ariga & Lleras, 2011 · Cognition",
  },
  {
    key: "y_tuong_thich_di_bo",
    topic: "xa_hoi",
    quads: ["blue", "yellow"],
    title: "Ý tưởng thích đi bộ",
    body: "Năm 2014, hai nhà nghiên cứu ở Đại học Stanford cho người tham gia nghĩ cách dùng mới cho đồ vật quen thuộc, lúc ngồi và lúc đi bộ. Khi đi bộ, kể cả trên máy chạy trong phòng, phần lớn người nghĩ ra nhiều ý sáng tạo hơn, và hiệu quả còn kéo dài một chút khi ngồi xuống lại. Với bài chỉ có một đáp án đúng thì đi bộ không giúp, thậm chí kém hơn một chút.",
    tryIt: "Lần tới bí ý tưởng, đi bộ vài phút quanh phòng rồi nghĩ tiếp.",
    source: "Oppezzo & Schwartz, 2014 · Journal of Experimental Psychology: Learning, Memory, and Cognition",
  },
  {
    key: "hat_cung_nhau",
    topic: "xa_hoi",
    quads: ["yellow", "green"],
    title: "Hát cùng nhau, thân nhau nhanh hơn",
    body: "Năm 2015, các nhà nghiên cứu ở Đại học Oxford theo dõi một số lớp học trong bảy tháng: lớp hát, lớp thủ công và lớp viết sáng tạo. Lớp hát thân nhau nhanh hơn hẳn ngay từ những buổi đầu, nên họ gọi đó là “hiệu ứng phá băng”. Đến cuối bảy tháng, các lớp khác cũng thân như vậy, chỉ là chậm hơn.",
    source: "Pearce, Launay & Dunbar, 2015 · Royal Society Open Science",
  },
];

/** Whole days from 2026-01-01 to a "YYYY-MM-DD" date (UTC date math; no time zone involved). Invalid input → 0. */
export function dayIndex(date: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  if (!m) return 0;
  const t = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  if (!Number.isFinite(t)) return 0;
  return Math.round((t - Date.UTC(2026, 0, 1)) / 86_400_000);
}

/** Whether a card suits a check-in quad (an empty `quads` suits every quad; no quad = any card). */
export function fitsQuad(d: Dossier, quad: Quad | null | undefined): boolean {
  return !quad || d.quads.length === 0 || d.quads.includes(quad);
}

/**
 * The selection rule on any list (exported for tests): skip held cards, filter by topic, then
 * by quad fit; if the quad filter leaves fewer than 2 cards, use the whole topic. Pick `dayIndex % n`.
 */
export function pickDossier(list: readonly Dossier[], date: string, quad: Quad | null | undefined, topic: DossierTopic): Dossier | null {
  const inTopic = list.filter((d) => d.topic === topic && !d.held);
  const fit = inTopic.filter((d) => fitsQuad(d, quad));
  const pool = fit.length >= 2 ? fit : inTopic;
  const n = pool.length;
  if (n === 0) return null;
  return pool[((dayIndex(date) % n) + n) % n] ?? null;
}

/** Today's card for (local date, the visit's quad, the chosen topic). Same inputs → same card; rotates daily. */
export function dossierFor(date: string, quad: Quad | null | undefined, topic: DossierTopic): Dossier {
  return pickDossier(DOSSIERS, date, quad, topic) as Dossier;
}

/** A card by key (held cards included; the notebook filters them out). */
export function findDossier(key: string): Dossier | undefined {
  return DOSSIERS.find((d) => d.key === key);
}

/** A card the child may see, by key (not held). */
export function findShownDossier(key: string): Dossier | undefined {
  const d = findDossier(key);
  return d && !d.held ? d : undefined;
}
