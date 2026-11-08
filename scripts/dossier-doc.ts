/**
 * Writes docs/binh-yen/HO_SO_MAT.md, the reading copy of the Hồ sơ mật pack for parents.
 * Run: node_modules/.bin/esbuild scripts/dossier-doc.ts --bundle --platform=node --alias:@=. --outfile=/tmp/dossier-doc.cjs && node /tmp/dossier-doc.cjs
 * tests/dossier.test.ts checks every card string appears in the doc and every card has a link here.
 *
 * The links live here, not in lib/binhYen/dossier.ts: the app shows only the short `source`
 * line, and the parent reads the links in the doc.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { DOSSIERS, TOPICS, TOPIC_KEYS, type Dossier } from "@/lib/binhYen/dossier";
import type { Quad } from "@/lib/binhYen/catalog";

export const DOC_FILE = "docs/binh-yen/HO_SO_MAT.md";
const CHECKED = "08/11/2026";

export interface SourceRef {
  /** Full reference as a parent would look it up. */
  ref: string;
  /** Journal / publisher. */
  where: string;
  year: string;
  url: string;
}

/** Every card's sources (the first one is the main source). URLs checked on 08/11/2026. */
export const CARD_SOURCES: Record<string, SourceRef[]> = {
  // 🧠 Não bộ
  chuong_bao_dong: [
    { ref: "Understanding the stress response", where: "Harvard Health Publishing (Harvard Medical School)", year: "2011, duyệt lại 2024", url: "https://www.health.harvard.edu/staying-healthy/understanding-the-stress-response" },
  ],
  bao_dong_nham: [
    { ref: "Nesse, R. M. The smoke detector principle: Natural selection and the regulation of defenses (Annals NYAS 935: 75–85) — tóm tắt trên trang của tác giả", where: "Annals of the New York Academy of Sciences", year: "2001", url: "https://www.randolphnesse.com/articles/smoke-detector" },
  ],
  goi_ten_cam_xuc: [
    { ref: "Lieberman, Eisenberger, Crockett, Tom, Pfeifer & Way. Putting feelings into words: Affect labeling disrupts amygdala activity in response to affective stimuli", where: "Psychological Science", year: "2007", url: "https://pubmed.ncbi.nlm.nih.gov/17576282/" },
    { ref: "Tin của UCLA về nghiên cứu (mô tả thí nghiệm, lời tác giả: hiệu ứng có lẽ không lớn)", where: "ScienceDaily", year: "2007", url: "https://www.sciencedaily.com/releases/2007/06/070622090727.htm" },
  ],
  tho_ra_cham: [
    { ref: "Balban và cộng sự. Brief structured respiration practices enhance mood and reduce physiological arousal (108 người lớn tham gia)", where: "Cell Reports Medicine", year: "2023", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC9873947" },
  ],
  nao_dang_xay: [
    { ref: "The Teen Brain: 7 Things to Know", where: "National Institute of Mental Health (NIMH)", year: "2023 (bản sửa, NIH Publication No. 23-MH-8078)", url: "https://www.nimh.nih.gov/health/publications/the-teen-brain-7-things-to-know" },
  ],
  giac_ngu_cat_ho_so: [
    { ref: "Sleep On It: How Snoozing Strengthens Memories", where: "NIH News in Health (Viện Y tế Quốc gia Hoa Kỳ)", year: "2013 (số tháng 4)", url: "https://newsinhealth.nih.gov/node/1481" },
  ],
  huyen_thoai_10_phan_tram: [
    { ref: "Boyd, R. Do People Only Use 10 Percent of Their Brains? (phỏng vấn nhà thần kinh học Barry Gordon, Johns Hopkins)", where: "Scientific American", year: "2008 (07/02/2008)", url: "https://www.scientificamerican.com/article/do-people-only-use-10-percent-of-their-brains/" },
  ],
  tai_xe_taxi_london: [
    { ref: "Maguire và cộng sự. Navigation-related structural change in the hippocampi of taxi drivers (PNAS 97(8))", where: "Proceedings of the National Academy of Sciences (PNAS)", year: "2000", url: "https://www.fil.ion.ucl.ac.uk/Maguire/Maguire_CORE_2000.pdf" },
  ],
  // 💬 Cảm xúc
  cam_xuc_la_tin_nhan: [
    { ref: "Keltner, D. & Gross, J. J. Functional accounts of emotions (13(5): 467–480)", where: "Cognition and Emotion", year: "1999", url: "https://www.personal.kent.edu/%7Edfresco/CBT_Readings/keltner_%26_gross.pdf" },
  ],
  lo_la_tap_duot: [
    { ref: "Students Experiencing Anxiety (Mental Health Primer)", where: "American Psychological Association (APA)", year: "2021", url: "https://www.apa.org/ed/schools/primer/anxiety" },
  ],
  song_len_song_xuong: [
    { ref: "Verduyn, P. & Lavrijsen, S. Which emotions last longest and why: The role of event importance and rumination", where: "Motivation and Emotion", year: "2015 (đăng trực tuyến 2014)", url: "https://ppw.kuleuven.be/okp/_pdf/Verduyn2015WELLA.pdf" },
    { ref: "Tóm tắt của ScienceDaily (233 học sinh cấp ba; nghĩ đi nghĩ lại là yếu tố chính)", where: "ScienceDaily", year: "2014", url: "https://www.sciencedaily.com/releases/2014/10/141030133119.htm" },
  ],
  vua_vui_vua_buon: [
    { ref: "Larsen, J. T., McGraw, A. P. & Cacioppo, J. T. Can people feel happy and sad at the same time?", where: "Journal of Personality and Social Psychology", year: "2001", url: "https://leeds-faculty.colorado.edu/mcgrawp/pdf/larsen.mcgraw.cacioppo.2001.pdf" },
  ],
  tu_chinh_xac: [
    { ref: "Kashdan, T. B., Barrett, L. F. & McKnight, P. E. Unpacking emotion differentiation", where: "Current Directions in Psychological Science", year: "2015", url: "https://www.affective-science.org/pubs/2015/kashdan-et-all-unpacking-emotion-differentiation-2015.pdf" },
  ],
  anh_chup_trong_dau: [
    { ref: "Kennelly, S. 10 Steps to Savoring the Good Things in Life (dẫn lời nhà tâm lý Fred Bryant)", where: "Greater Good Magazine, Greater Good Science Center (UC Berkeley)", year: "2012", url: "https://greatergood.berkeley.edu/article/item/10_steps_to_savoring_the_good_things_in_life" },
  ],
  to_mo_la_chia_khoa: [
    { ref: "Gruber, M. J., Gelman, B. D. & Ranganath, C. States of curiosity modulate hippocampus-dependent learning via the dopaminergic circuit (84(2): 486–496)", where: "Neuron", year: "2014", url: "https://doi.org/10.1016/j.neuron.2014.08.060" },
    { ref: "Tin của UC Davis về nghiên cứu", where: "ScienceDaily", year: "2014", url: "https://www.sciencedaily.com/releases/2014/10/141002123631.htm" },
  ],
  so_dieu_tot: [
    { ref: "Emmons, R. A. & McCullough, M. E. Counting blessings versus burdens (84(2): 377–389)", where: "Journal of Personality and Social Psychology", year: "2003", url: "https://greatergood.berkeley.edu/pdfs/GratitudePDFs/6Emmons-BlessingsBurdens.pdf" },
  ],
  // 📜 Lịch sử
  so_tay_hoang_de: [
    { ref: "Meditations (Marcus Aurelius)", where: "Encyclopaedia Britannica", year: "—", url: "https://www.britannica.com/topic/Meditations-by-Marcus-Aurelius" },
  ],
  hai_chiec_hop: [
    { ref: "Epictetus (sinh năm 55; thuở nhỏ là nô lệ, sau được trả tự do)", where: "Encyclopaedia Britannica", year: "—", url: "https://www.britannica.com/print/article/189728" },
    { ref: "Epictetus (vùng “thuộc về mình” và “bên ngoài”)", where: "Stanford Encyclopedia of Philosophy", year: "—", url: "https://plato.stanford.edu/entries/epictetus/" },
  ],
  thu_vien_tren_thap: [
    { ref: "Michel de Montaigne", where: "Encyclopaedia Britannica", year: "—", url: "https://www.britannica.com/biography/Michel-de-Montaigne" },
  ],
  phong_tra_nho: [
    { ref: "Willmann, A. The Japanese Tea Ceremony", where: "The Metropolitan Museum of Art (Heilbrunn Timeline of Art History)", year: "2011", url: "https://www.metmuseum.org/toah/hd/jtea/hd_jtea.htm" },
    { ref: "Abstract Concepts in Chanoyu (bốn chữ wa–kei–sei–jaku: “không có bằng chứng nối Rikyū với câu này”)", where: "Japan Past & Present (dự án có logo UCLA, Waseda)", year: "—", url: "https://japanpastandpresent.org/en/projects/teaching-tea-culture-history-practice-art/pedagogy/abstract-concepts-in-chanoyu" },
  ],
  mot_lan_mot_hoi: [
    { ref: "Abstract Concepts in Chanoyu (ichigo ichie, gắn với Ii Naosuke)", where: "Japan Past & Present (dự án có logo UCLA, Waseda)", year: "—", url: "https://japanpastandpresent.org/en/projects/teaching-tea-culture-history-practice-art/pedagogy/abstract-concepts-in-chanoyu" },
  ],
  duc_toc_bat_dat: [
    { ref: "Confucius, The Analects, Book 13 (bản dịch James Legge): “Do not be desirous to have things done quickly; do not look at small advantages.”", where: "UCLA Center for Chinese Studies", year: "—", url: "https://www.international.ucla.edu/ccs/article/18488" },
  ],
  mai_sat_nen_kim: [
    { ref: "Lê Thị Hồng Minh. Vài nét về tục ngữ mới (bảng tục ngữ cải biên: “Có công mài sắt có ngày nên kim” được ghi là tục ngữ dân gian xưa), Kỷ yếu Hội thảo Quốc tế Việt Nam học lần thứ tư", where: "Trường ĐH Khoa học Xã hội và Nhân văn, ĐHQG TP.HCM", year: "không ghi năm (số liệu trong bài tính đến 2017)", url: "https://hcmussh.edu.vn/static/document/13086.pdf" },
    { ref: "Giải thích ý nghĩa tục ngữ “Có công mài sắt có ngày nên kim”", where: "VOH — Đài Tiếng nói Nhân dân TP.HCM", year: "2022", url: "https://voh.com.vn/song-dep/co-cong-mai-sat-co-ngay-nen-kim-453392.html" },
  ],
  truong_cua_nguoi_di_bo: [
    { ref: "Lyceum", where: "Encyclopaedia Britannica", year: "—", url: "https://www.britannica.com/print/article/352514" },
  ],
  // 👥 Con người
  chiec_ao_phong: [
    { ref: "Gilovich, T., Medvec, V. H. & Savitsky, K. The spotlight effect in social judgment: An egocentric bias in estimates of the salience of one's own actions and appearance (78(2): 211–222)", where: "Journal of Personality and Social Psychology", year: "2000", url: "https://doi.org/10.1037/0022-3514.78.2.211" },
    { ref: "McConnell, A. R. Did everyone see me do that? (con số “gần một nửa” và “chưa đến một phần tư”)", where: "Psychology Today", year: "2009", url: "https://psychologytoday.com/ca/blog/the-social-self/200906/did-everyone-see-me-do-that" },
  ],
  khong_trong_suot: [
    { ref: "Gilovich, T., Savitsky, K. & Medvec, V. H. The illusion of transparency (75(2): 332–346)", where: "Journal of Personality and Social Psychology", year: "1998", url: "https://pubmed.ncbi.nlm.nih.gov/9731312/" },
    { ref: "Savitsky, K. & Gilovich, T. The illusion of transparency and the alleviation of speech anxiety (39(6): 618–625)", where: "Journal of Experimental Social Psychology", year: "2003", url: "https://doi.org/10.1016/S0022-1031%2803%2900056-8" },
  ],
  khoang_cach_yeu_thich: [
    { ref: "Boothby, E. J., Cooney, G., Sandstrom, G. M. & Clark, M. S. The liking gap in conversations: Do people like us more than we think?", where: "Psychological Science", year: "2018", url: "https://doi.org/10.1177/0956797618783714" },
    { ref: "Tin của Đại học Yale về nghiên cứu", where: "Yale News", year: "2018", url: "https://news.yale.edu/2018/09/04/first-meeting-people-you-more-you-think" },
  ],
  cu_hoi_thang: [
    { ref: "Flynn, F. J. & Lake, V. K. B. If you need help, just ask (95(1): 128–143)", where: "Journal of Personality and Social Psychology", year: "2008", url: "https://www.gsb.stanford.edu/faculty-research/publications/if-you-need-help-just-ask-underestimating-compliance-direct-requests" },
  ],
  lam_dieu_tot: [
    { ref: "Curry, O. S. và cộng sự. Happy to help? A systematic review and meta-analysis of the effects of performing acts of kindness on the well-being of the actor", where: "Journal of Experimental Social Psychology", year: "2018", url: "https://ora.ox.ac.uk/objects/uuid:4701365b-5760-4ece-a390-857a5f7b3c0c/files/m636b48d703aae252c79789d85933935e" },
  ],
  cau_chao_nho: [
    { ref: "Sandstrom, G. M. & Dunn, E. W. Is efficiency overrated? Minimal social interactions lead to belonging and positive affect (5(4): 437–442)", where: "Social Psychological and Personality Science", year: "2014", url: "https://repository.essex.ac.uk/15301/" },
  ],
  la_thu_cam_on: [
    { ref: "Kumar, A. & Epley, N. Undervaluing gratitude: Expressers misunderstand the consequences of showing appreciation", where: "Psychological Science", year: "2018", url: "https://doi.org/10.1177/0956797618772506" },
    { ref: "Tin về nghiên cứu", where: "ScienceDaily", year: "2018", url: "https://www.sciencedaily.com/releases/2018/08/180828172046.htm" },
  ],
  trong_giong_can_dam: [
    { ref: "Bruk, A., Scholl, S. G. & Bless, H. Beautiful mess effect: Self–other differences in evaluation of showing vulnerability (115(2): 192–205; tóm tắt nêu ví dụ thổ lộ cảm xúc, nhờ giúp đỡ)", where: "Journal of Personality and Social Psychology", year: "2018", url: "https://doi.org/10.1037/pspa0000120" },
    { ref: "Trang bài báo của Đại học Mannheim", where: "MZES, Đại học Mannheim", year: "2018", url: "https://www.mzes.uni-mannheim.de/en/publications/details/beautiful-mess-effect-self-other-differences-in-evaluation-of-showing-vulnerability" },
    { ref: "Tóm tắt của BPS Research Digest (thừa nhận sai, nhờ giúp đỡ, hát ngẫu hứng trước ban giám khảo; “từ bên ngoài trông giống can đảm”)", where: "British Psychological Society", year: "2018", url: "https://bps.org.uk/research-digest/beautiful-mess-effect" },
  ],
  // 🌏 Xã hội
  con_so_120_phut: [
    { ref: "White, M. P. và cộng sự. Spending at least 120 minutes a week in nature is associated with good health and wellbeing (9: 7730; 19.806 người)", where: "Scientific Reports", year: "2019", url: "https://doi.org/10.1038/s41598-019-44097-3" },
    { ref: "Tin về nghiên cứu", where: "Neuroscience News", year: "2019", url: "https://neurosciencenews.com/nature-health-wellbeing-14233/" },
  ],
  tam_rung: [
    { ref: "Park, B. J. và cộng sự. The physiological effects of Shinrin-yoku: evidence from field experiments in 24 forests across Japan (280 nam sinh viên, 12 người mỗi khu rừng)", where: "Environmental Health and Preventive Medicine", year: "2010", url: "https://pubmed.ncbi.nlm.nih.gov/19568835/" },
  ],
  sac_lai_tap_trung: [
    { ref: "Berman, M. G., Jonides, J. & Kaplan, S. The cognitive benefits of interacting with nature (19(12): 1207–1212)", where: "Psychological Science", year: "2008", url: "https://doi.org/10.1111/j.1467-9280.2008.02225.x" },
  ],
  noi_thuoc_ve: [
    { ref: "Baumeister, R. F. & Leary, M. R. The need to belong (117(3): 497–529)", where: "Psychological Bulletin", year: "1995", url: "https://scholars.duke.edu/publication/677016" },
  ],
  tin_don_chay_nhanh: [
    { ref: "Vosoughi, S., Roy, D. & Aral, S. The spread of true and false news online (359(6380): 1146–1151)", where: "Science", year: "2018", url: "https://doi.org/10.1126/science.aap9559" },
    { ref: "Tin của MIT về nghiên cứu", where: "MIT News", year: "2018", url: "https://news.mit.edu/2018/study-twitter-false-news-travels-faster-true-stories-0308" },
  ],
  nghi_ngan: [
    { ref: "Ariga, A. & Lleras, A. Brief and rare mental “breaks” keep you focused", where: "Cognition (tin của Đại học Illinois)", year: "2011", url: "https://news.illinois.edu/brief-diversions-vastly-improve-focus-researchers-find/" },
  ],
  y_tuong_thich_di_bo: [
    { ref: "Oppezzo, M. & Schwartz, D. L. Give your ideas some legs: The positive effect of walking on creative thinking", where: "Journal of Experimental Psychology: Learning, Memory, and Cognition (tin của APA)", year: "2014", url: "https://www.apa.org/news/press/releases/2014/04/creativity-walk" },
  ],
  hat_cung_nhau: [
    { ref: "Pearce, E., Launay, J. & Dunbar, R. I. M. The ice-breaker effect: singing mediates fast social bonding", where: "Royal Society Open Science (tin của ScienceDaily)", year: "2015", url: "https://sciencedaily.com/releases/2015/10/151027213419.htm" },
  ],
};

const QUAD_LABEL: Record<Quad, string> = {
  red: "Hồ sơ đỏ (giận, lo, căng thẳng)",
  yellow: "Hồ sơ vàng (vui, hào hứng, tự hào)",
  blue: "Hồ sơ lam (buồn, chán, mệt)",
  green: "Hồ sơ lục (bình yên, thư thái)",
};

const quadsText = (d: Dossier) => (d.quads.length === 0 ? "mọi lúc" : d.quads.map((q) => QUAD_LABEL[q]).join(" · "));

function cardBlock(d: Dossier, n: number): string {
  let out = `### ${n}. ${d.title} (\`${d.key}\`)\n\n`;
  out += `${d.body}\n\n`;
  if (d.tryIt) out += `- **Thử nhỏ:** ${d.tryIt}\n`;
  out += `- **Hợp với:** ${quadsText(d)}\n`;
  out += `- **Nguồn (hiện trong app):** ${d.source}\n`;
  for (const s of CARD_SOURCES[d.key] ?? []) out += `- **Link:** [${s.ref}](${s.url}) — ${s.where}, ${s.year} (kiểm ${CHECKED})\n`;
  return out + `\n`;
}

function render(): string {
  const shown = DOSSIERS.filter((d) => !d.held);
  const held = DOSSIERS.filter((d) => d.held);
  let out = `# Hồ sơ mật — ${DOSSIERS.length} hồ sơ cho Nguyên (bản để bố mẹ đọc và duyệt)\n\n`;
  out += `> Sinh từ \`lib/binhYen/dossier.ts\` (chữ hiện trong app) và \`scripts/dossier-doc.ts\` (link nguồn) bằng lệnh ở đầu file script. Test \`tests/dossier.test.ts\` kiểm hai file khớp nhau. Sửa chữ ở file \`.ts\` rồi sinh lại; mã (\`key\`) không bao giờ đổi.\n`;
  out += `> Nội dung soạn ngày ${CHECKED}. Một người kiểm tra độc lập đã đọc lại từng thẻ và từng nguồn ngày ${CHECKED}; mọi chỗ sửa của người kiểm tra đã được áp dụng. Link bài báo gốc (DOI) được đối chiếu lại ngày ${CHECKED}.\n`;
  out += `> **${shown.length} thẻ** con có thể thấy. **${held.length} thẻ** đang **chờ bố mẹ / chuyên gia đồng ý** (chưa hiện cho con), ở mục riêng gần cuối.\n\n`;

  out += `## Hồ sơ mật là gì\n\n`;
  out += `Mỗi ngày, sau khi ghé Góc bình yên, Nguyên có thể tự mở một “hồ sơ mật”: một điều thú vị, có nguồn, về não bộ, cảm xúc, lịch sử, con người hoặc xã hội. Giọng văn là giọng thám tử (hồ sơ, manh mối) như phần còn lại của Góc bình yên.\n\n`;
  out += `Đây là **kiến thức nhẹ nhàng, khơi tò mò**, giúp con hiểu cơ thể và cảm xúc của mình vận hành thế nào. Đây **không phải** trị liệu, không phải lời khuyên về sức khỏe, và không nói gì về riêng con. Nếu bố mẹ thấy con cần hỗ trợ nhiều hơn, người phù hợp là chuyên gia tâm lý của con.\n\n`;

  out += `## Luật an toàn nội dung (đã áp dụng cho cả ${DOSSIERS.length} thẻ)\n\n`;
  out += `1. **Không dùng từ chẩn đoán hay bệnh lý** về con hay người đọc (ví dụ “rối loạn”, “triệu chứng”, “chẩn đoán” và các từ tương tự), không dùng “ảo giác” (dễ hiểu nhầm là thấy thứ không có thật) và không nói cơ thể “hỏng”. Test tự động chặn các từ này.\n`;
  out += `2. **Không có con số đáng sợ**, không giọng thảm họa (kiểu “căng thẳng phá hủy não”).\n`;
  out += `3. **Không ra lệnh** (không “con nên…”, “con phải…”) và **không so sánh** con với người khác.\n`;
  out += `4. **Không có** chủ đề tự làm đau mình, ăn uống, cân nặng, ngoại hình. Không kể chuyện sức khỏe tinh thần của người thật đang sống.\n`;
  out += `5. **Nói có chừng mực**: “nghiên cứu cho thấy… có thể…”. Có chỗ nói rõ giới hạn (hiệu ứng nhỏ, mới là mối liên hệ, cần thêm bằng chứng).\n`;
  out += `6. **Mỗi thẻ có nguồn**: bài báo khoa học có bình duyệt (ưu tiên link DOI của bài gốc), hoặc tổ chức uy tín (NIMH, NIH, APA, Harvard Health, Greater Good – UC Berkeley), hoặc Britannica cho lịch sử. Không bịa lời trích dẫn; lời người xưa được kể lại bằng lời mình, trừ một câu Luận ngữ trích đúng bản dịch Legge (chỉ trong phần nguồn).\n`;
  out += `7. **Gỡ huyền thoại nhẹ nhàng**: thẻ “10% bộ não” nói rõ đó là chuyện không có thật; thẻ trà đạo nói rõ bốn chữ “hòa, kính, thanh, tịch” chưa có bằng chứng là của Sen no Rikyū. Không dùng “luật 90 giây” vì không tìm được nguồn vững.\n`;
  out += `8. **“Thử nhỏ”** (không bắt buộc) chỉ gồm việc nhẹ: thở ra chậm hơn hít vào, gọi tên cảm xúc, để ý vài thứ quanh mình, viết một dòng, đi bộ hoặc vươn vai ngắn. Không có gì liên quan đến lạnh, đau hay gây sốc cho giác quan. Thở không phải “nghi lễ” bắt buộc: thẻ thở chính nói rõ “thấy khác hay chưa thấy gì cũng đều ổn”.\n`;
  out += `9. **Thẻ về “chuông báo động”** (cảm giác lo trong cơ thể) kết thúc ở chỗ an toàn: cơ thể đang làm đúng việc của nó, báo nhầm là bình thường, và luôn có thể kể với một người lớn mình tin.\n\n`;

  out += `## Cách hồ sơ hiện ra\n\n`;
  out += `- Chỉ có ở Góc bình yên của **Nguyên** (giọng thám tử). An không thấy.\n`;
  out += `- Ở bước “Xong rồi”, dưới khung truyện, có một dòng **thu gọn** “📁 Mở hồ sơ mật hôm nay?”. Con không chạm thì không có gì hiện ra. Nếu lượt ghé là hồ sơ đỏ hoặc lam, dòng này chỉ đến sau khi con đã được ghi nhận cảm xúc và làm xong hoạt động.\n`;
  out += `- Con **tự chọn chủ đề** (5 nút: 🧠 Não bộ · 💬 Cảm xúc · 📜 Lịch sử · 👥 Con người · 🌏 Xã hội). Máy nhớ chủ đề con chọn lần trước.\n`;
  out += `- **Cách chọn thẻ** (cố định, không ngẫu nhiên): bỏ qua các thẻ đang chờ đồng ý, lấy các thẻ của chủ đề, giữ những thẻ hợp với hồ sơ cảm xúc lúc ghé (dòng “Hợp với” bên dưới; nếu còn ít hơn 2 thẻ thì dùng cả chủ đề), rồi lấy thẻ thứ (số ngày kể từ 01/01/2026) chia lấy dư cho số thẻ. Cùng ngày, cùng cảm xúc, cùng chủ đề thì ra cùng một thẻ; mỗi ngày đổi thẻ.\n`;
  out += `- Thẻ đỏ/lam thiên về **trấn an, làm dịu cơ thể**; thẻ vàng/lục thiên về **tò mò, tận hưởng**.\n`;
  out += `- Nút **“Cất vào sổ tay”** lưu thẻ vào “Sổ tay thám tử”, **chỉ trên máy của con** (bộ nhớ trình duyệt). Không có số đếm, không huy hiệu.\n`;
  out += `- **Bố mẹ không thấy** con đọc thẻ nào: không gửi lên máy chủ, không ghi nhật ký, không có trong trang phụ huynh.\n\n`;

  out += `## Gợi ý cho bố mẹ\n\n`;
  out += `Nếu Nguyên đang có hoặc từng có chuyên gia tư vấn / nhà trị liệu tâm lý, bố mẹ nên cho họ xem bộ thẻ này trước khi bật. Họ biết con rõ nhất và có thể bảo bỏ hoặc sửa thẻ nào không hợp với con lúc này (ví dụ các thẻ về “chuông báo động”). Bỏ một thẻ rất dễ: báo lại, thẻ đó sẽ được rút khỏi danh sách. Thẻ đang chờ (mục bên dưới) chỉ được bật khi bố mẹ hoặc chuyên gia đồng ý.\n\n`;

  let n = 0;
  for (const t of TOPIC_KEYS) {
    out += `## ${TOPICS[t].emoji} ${TOPICS[t].label}\n\n`;
    for (const d of shown.filter((x) => x.topic === t)) out += cardBlock(d, ++n);
  }

  out += `## Chờ bố mẹ / chuyên gia đồng ý (chưa hiện cho con)\n\n`;
  out += `Những thẻ này nằm trong bộ nhưng app **không bao giờ chọn** cho đến khi bố mẹ báo đồng ý (sau khi hỏi chuyên gia của con nếu có).\n\n`;
  for (const d of held) {
    out += cardBlock(d, ++n).replace(/\n\n$/, "\n");
    out += `- **Vì sao đang chờ:** ${d.heldReason ?? "Chờ bố mẹ / chuyên gia đọc lại."}\n\n`;
  }

  out += `## Bảng nguồn\n\n`;
  out += `| # | Thẻ | Tài liệu | Nơi đăng | Năm | Link | Ngày kiểm |\n|---|---|---|---|---|---|---|\n`;
  let i = 0;
  for (const d of [...shown, ...held].sort((a, b) => TOPIC_KEYS.indexOf(a.topic) - TOPIC_KEYS.indexOf(b.topic))) {
    for (const s of CARD_SOURCES[d.key] ?? []) {
      i += 1;
      out += `| ${i} | \`${d.key}\`${d.held ? " (chờ)" : ""} | ${s.ref.replace(/\|/g, "/")} | ${s.where} | ${s.year} | [link](${s.url}) | ${CHECKED} |\n`;
    }
  }
  out += `\n## Ghi chú của người kiểm tra (đã xử lý)\n\n`;
  out += `- **Đã sửa theo bản kiểm tra độc lập 08/11/2026:** thẻ báo động kết thúc an toàn hơn (\`chuong_bao_dong\`, \`bao_dong_nham\` — bỏ chữ “hỏng”); bỏ mọi chữ “ảo giác”, thay bằng “ảo tưởng trong suốt” / “cú lừa nhỏ của trí óc”; “đang run” → “đang hồi hộp”; “đám đông” → “vài người nghe”; Epictetus “thuở nhỏ là nô lệ, sau được trả tự do”; \`mai_sat_nen_kim\` viết lại (không khẳng định chuyện “ngày xưa mài sắt thành kim”); \`trong_giong_can_dam\` chỉ dùng ví dụ có trong nghiên cứu (thừa nhận sai, nhờ giúp đỡ, hát ngẫu hứng); \`chiec_ao_phong\` ghi đúng là phòng có vài sinh viên; thay link tin tức bằng link DOI của bài gốc ở nhiều thẻ.\n`;
  out += `- **\`lo_la_tap_duot\`** viết lại và **để chờ**: nói lo lắng là “tập dượt” có ích có thể làm mạnh thêm ý nghĩ “lo giúp mình chuẩn bị”. Bản mới nói phần có ích là *việc chuẩn bị*, không phải số vòng nghĩ đi nghĩ lại.\n`;
  out += `- **\`chiec_ao_phong\`**: con số “gần một nửa / chưa đến một phần tư” khớp với bài của nhà tâm lý Allen McConnell trên Psychology Today; link DOI của bài gốc đã kiểm (bản đầy đủ cần tài khoản).\n`;
  out += `- **\`khong_trong_suot\`**: kết quả năm 2003 (người được kể trước bớt căng hơn, người nghe chấm bài nói tốt hơn) đối chiếu qua tóm tắt bách khoa; link DOI của bài gốc đã kiểm.\n`;
  out += `- **\`cam_xuc_la_tin_nhan\`**: hai ví dụ (“bực có thể báo…”, “buồn có thể báo…”) là ví dụ minh họa của người soạn, không phải câu trong bài báo; bài báo chỉ nói cảm xúc có chức năng giúp phản ứng với môi trường.\n`;
  out += `- **\`song_len_song_xuong\`**: câu cuối (chuyển sang việc khác có thể giúp sóng lắng nhanh hơn) là suy ra từ kết quả “nghĩ đi nghĩ lại làm cảm xúc kéo dài”, đã viết có chừng mực.\n`;
  out += `- **\`mai_sat_nen_kim\`**: câu tục ngữ được một bài nghiên cứu của ĐH KHXH&NV (ĐHQG TP.HCM) ghi là tục ngữ dân gian xưa; bài của VOH để tham khảo thêm.\n`;
  out += `- **\`duc_toc_bat_dat\`**: câu “dục tốc bất đạt” trong tiếng Việt là cách nói quen thuộc; nguồn đối chiếu là đoạn Luận ngữ 13.17 bản dịch Legge (Tử Hạ làm quan ở Cử Phụ — “Chu-fu” trong bản Legge).\n`;
  return out;
}


if (process.argv[1]?.endsWith("dossier-doc.cjs")) {
  mkdirSync("docs/binh-yen", { recursive: true });
  writeFileSync(DOC_FILE, render());
}
