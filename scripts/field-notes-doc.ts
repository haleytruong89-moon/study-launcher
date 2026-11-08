/**
 * Writes docs/binh-yen/SO_TAY_KHOA_HOC.md, the reading copy of An's Sổ tay nhà khoa học for parents.
 * Run: node_modules/.bin/esbuild scripts/field-notes-doc.ts --bundle --platform=node --alias:@=. --outfile=/tmp/field-notes-doc.cjs && node /tmp/field-notes-doc.cjs
 * tests/fieldNotes.test.ts checks every card string appears in the doc and every card has a link here.
 *
 * The links live here, not in lib/binhYen/fieldNotes.ts: the app shows only the short `source`
 * line, and the parent reads the links in the doc. Cards that reuse a source already checked for
 * Nguyên's Hồ sơ mật point at the same entry in scripts/dossier-doc.ts.
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { FIELD_NOTES, SCIENCE_TOPICS, SCIENCE_TOPIC_KEYS, SCIENCE_TOPIC_TARGET, type FieldNote } from "@/lib/binhYen/fieldNotes";
import type { Quad } from "@/lib/binhYen/catalog";
import { CARD_SOURCES as DOSSIER_SOURCES, type SourceRef } from "./dossier-doc";

export const DOC_FILE = "docs/binh-yen/SO_TAY_KHOA_HOC.md";
const CHECKED = "08/11/2026";

const shared = (key: string): SourceRef[] => DOSSIER_SOURCES[key] ?? [];

/** Every card's sources (the first one is the main source). URLs checked on 08/11/2026. */
export const NOTE_SOURCES: Record<string, SourceRef[]> = {
  // 🐾 Động vật cũng có cảm xúc
  voi_an_ui: [
    { ref: "Plotnik, J. M. & de Waal, F. B. M. Asian elephants (Elephas maximus) reassure others in distress", where: "PeerJ", year: "2014", url: "https://doi.org/10.7717/peerj.278" },
    { ref: "Tin về nghiên cứu (26 con voi ở một trại voi miền Bắc Thái Lan, gần một năm; chạm vòi, tiếng kêu ríu rít)", where: "ScienceDaily", year: "2014", url: "https://www.sciencedaily.com/releases/2014/02/140218101020.htm" },
  ],
  be_rai_ca: [
    { ref: "12 Facts About Otters for Sea Otter Awareness Week (bè rái cá, có nhóm hơn 1.000 con; chải lông dày thay cho lớp mỡ)", where: "U.S. Department of the Interior (Bộ Nội vụ Hoa Kỳ)", year: "không ghi năm", url: "https://doi.gov/node/25976" },
    { ref: "Southern Sea Otter (sống và nghỉ theo bè; dành một phần ngày để chải lông)", where: "Aquarium of the Pacific", year: "không ghi năm", url: "https://aquariumofpacific.org/onlinelearningcenter/species/southern_sea_otter" },
  ],
  chuot_mo_cua: [
    { ref: "Ben-Ami Bartal, I., Decety, J. & Mason, P. Empathy and pro-social behavior in rats (334(6061): 1427–1430)", where: "Science", year: "2011", url: "https://doi.org/10.1126/science.1210789" },
    { ref: "Tin của Đại học Chicago về nghiên cứu (ống có cửa, không huấn luyện, thử với sô-cô-la)", where: "ScienceDaily", year: "2011", url: "https://www.sciencedaily.com/releases/2011/12/111208141933.htm" },
    { ref: "Yong, E. Empathic rats spring each other from jail (chi tiết chia sô-cô-la)", where: "National Geographic", year: "2011", url: "https://www.nationalgeographic.com/science/article/empathic-rats-spring-each-other-from-jail" },
  ],
  cho_doc_cam_xuc: [
    { ref: "Albuquerque, N. và cộng sự. Dogs recognize dog and human emotions", where: "Biology Letters", year: "2016", url: "https://pubmed.ncbi.nlm.nih.gov/26763220/" },
    { ref: "Bản thảo bài báo (17 chú chó nhà, ảnh vui/giận + âm thanh vui/giận, đo thời gian nhìn)", where: "CORE (bản thảo của tác giả)", year: "2015", url: "https://core.ac.uk/download/42584594.pdf" },
  ],
  ong_duoc_thuong: [
    { ref: "Perry, C. J., Baciadonna, L. & Chittka, L. Unexpected rewards induce dopamine-dependent positive emotion–like state changes in bumblebees", where: "Science", year: "2016", url: "https://doi.org/10.1126/science.aaf4454" },
    { ref: "Bài báo đầy đủ trên trang phòng thí nghiệm Chittka (Queen Mary University of London)", where: "Science (bản PDF)", year: "2016", url: "https://chittkalab.sbcs.qmul.ac.uk/2016/science.aaf4454.pdf" },
    { ref: "Bees Show Optimism After A Dopamine-Boosting Sweet Treat (cửa xanh dương có đường, xanh lá không; cửa màu lưng chừng)", where: "Popular Science", year: "2016", url: "https://www.popsci.com/bees-show-optimism-after-dopamine-boosting-sweet-treat/" },
  ],
  khi_chai_long: [
    { ref: "Shutt, K. và cộng sự. Grooming in Barbary macaques: better to give than to receive? (3(3): 231–233)", where: "Biology Letters", year: "2007", url: "https://www.pubmed.gov/17327200/" },
    { ref: "Tóm tắt (khỉ Barbary sống tự do; chải lông cho bạn đi cùng hormone căng thẳng thấp hơn)", where: "Refinement Database", year: "2007", url: "https://refinementdatabase.org/publications/grooming-in-barbary-macaques-better-to-give-than-receive" },
  ],
  qua_ngoi_sat: [
    { ref: "Fraser, O. N. & Bugnyar, T. Do ravens show consolation? Responses to distressed others", where: "PLoS ONE", year: "2010", url: "https://doi.org/10.1371/journal.pone.0010605" },
    { ref: "Ravens console each other (rỉa lông, ngồi sát, chạm; nhiều nhất với con thân hoặc họ hàng)", where: "Phys.org", year: "2010", url: "https://phys.org/news/2010-05-ravens-console.html" },
  ],
  ca_heo_co_ten: [
    { ref: "Dolphins respond to individual names (King, S. L. & Janik, V. M., PNAS 2013; cá heo hoang dã ở bờ đông Scotland)", where: "University of St Andrews", year: "2013", url: "https://news.st-andrews.ac.uk/archive/dolphins-respond-to-individual-names/" },
    { ref: "Dolphins have longest social memories in non-human species (Bruck, J. N., Proc. R. Soc. B 2013; hơn 20 năm)", where: "The Royal Society", year: "2013", url: "https://royalsociety.org/news/2013/dophins-social-memory" },
  ],
  chuot_cuoi: [
    { ref: "Ishiyama, S. & Brecht, M. Neural correlates of ticklishness in the rat somatosensory cortex", where: "Science", year: "2016", url: "https://doi.org/10.1126/science.aah5114" },
    { ref: "Tin của Đại học Humboldt Berlin (tiếng kêu siêu âm 50 kHz, nhảy vui, đuổi tay; chuột lo lắng ít “cười” hơn)", where: "ScienceDaily", year: "2016", url: "https://www.sciencedaily.com/releases/2016/11/161110152342.htm" },
  ],
  duoi_cho_vay: [
    { ref: "Whitfield, J. Dogs' tails reveal their emotions (về Quaranta, Siniscalchi & Vallortigara, Current Biology 17: 199–201; 30 chú chó)", where: "Nature News", year: "2007", url: "https://www.nature.com/news/2007/070319/full/news070319-6.html" },
  ],
  de_thich_mat_vui: [
    { ref: "Nawroth, C., Albuquerque, N., Savalli, C., Single, M.-S. & McElligott, A. G. Goats prefer positive human emotional facial expressions", where: "Royal Society Open Science", year: "2018", url: "https://doi.org/10.1098/rsos.180491" },
    { ref: "Goats prefer happy people (20 chú dê ở Buttercups Sanctuary for Goats, Kent)", where: "Queen Mary University of London", year: "2018", url: "https://www.qmul.ac.uk/news/latest-news/2018/se/goats-prefer-happy-people-.html" },
  ],
  tieng_cuoi_cua_vuon: [
    { ref: "Davila Ross, M., Owren, M. J. & Zimmermann, E. Reconstructing the evolution of laughter in great apes and humans", where: "Current Biology", year: "2009", url: "https://doi.org/10.1016/j.cub.2009.05.028" },
    { ref: "Scientists tickle apes to reveal evolutionary origins of human laughter", where: "National Geographic", year: "2009", url: "https://www.nationalgeographic.com/science/article/scientists-tickle-apes-to-reveal-evolutionary-origins-of-human-laughter" },
  ],
  // 🌿 Thiên nhiên làm dịu
  mai_nha_xanh: [
    { ref: "Lee, K. E., Williams, K. J. H., Sargent, L. D., Williams, N. S. G. & Johnson, K. A. 40-second green roof views sustain attention: The role of micro-breaks in attention restoration", where: "Journal of Environmental Psychology", year: "2015", url: "https://doi.org/10.1016/j.jenvp.2015.04.003" },
    { ref: "Tin của Đại học Melbourne (150 sinh viên, nghỉ 40 giây)", where: "ScienceDaily", year: "2015", url: "https://sciencedaily.com/releases/2015/05/150526093611.htm" },
  ],
  tieng_chim: [
    { ref: "Hammoud, R. và cộng sự. Smartphone-based ecological momentary assessment reveals mental health benefits of birdlife", where: "Scientific Reports", year: "2022", url: "https://doi.org/10.1038/s41598-022-20207-6" },
    { ref: "Feeling chirpy: being around birds is linked to lasting mental health benefits (1.292 người, ứng dụng Urban Mind; mối liên hệ, có thể kéo dài đến 8 giờ)", where: "King's College London", year: "2022", url: "https://www.kcl.ac.uk/news/feeling-chirpy-being-around-birds-is-linked-to-lasting-mental-health-benefits" },
  ],
  cam_giac_kinh_ngac: [
    { ref: "Sturm, V. E. và cộng sự. Big smile, small self: Awe walks promote prosocial positive emotions in older adults", where: "Emotion", year: "2022 (đăng trực tuyến 2020)", url: "https://pubmed.ncbi.nlm.nih.gov/32955293/" },
    { ref: "'Awe walks' boost emotional well-being (52 người lớn tuổi, đi dạo ít nhất 15 phút mỗi tuần trong 8 tuần; ảnh tự chụp)", where: "UCSF Psychiatry and Behavioral Sciences", year: "2020", url: "https://psychiatry.ucsf.edu/news/awe-walks-boost-emotional-well-being" },
  ],
  mui_mua: [
    { ref: "Bear, I. J. & Thomas, R. G. Nature of argillaceous odour (bài đặt tên “petrichor”)", where: "Nature", year: "1964", url: "https://doi.org/10.1038/201993a0" },
    { ref: "Joung, Y. S. & Buie, C. R. Aerosol generation by raindrop impact on soil", where: "Nature Communications", year: "2015", url: "https://doi.org/10.1038/ncomms7083" },
    { ref: "How rain evolved its distinct scent (geosmin do vi khuẩn Streptomyces trong đất tạo ra; mũi người rất nhạy với geosmin)", where: "Smithsonian Magazine", year: "2020", url: "https://www.smithsonianmag.com/smart-news/smell-rain-explained-180974692/" },
  ],
  canh_co_nuoc: [
    { ref: "White, M. và cộng sự. Blue space: The importance of water for preference, affect, and restorativeness ratings of natural and built scenes", where: "Journal of Environmental Psychology", year: "2010", url: "https://doi.org/10.1016/j.jenvp.2010.04.004" },
    { ref: "Trang công bố (120 bức ảnh; hai nghiên cứu)", where: "University of Plymouth Research Portal", year: "2010", url: "https://researchportal.plymouth.ac.uk/en/publications/blue-space-the-importance-of-water-for-preference-affect-and-rest/" },
  ],
  thay_chau_cay: [
    { ref: "Lee, M., Lee, J., Park, B.-J. & Miyazaki, Y. Interaction with indoor plants may reduce psychological and physiological stress by suppressing autonomic nervous system activity in young adults: a randomized crossover study", where: "Journal of Physiological Anthropology", year: "2015", url: "https://doi.org/10.1186/s40101-015-0060-8" },
    { ref: "Bản đầy đủ (24 nam thanh niên; thay chậu cây và gõ máy, mỗi việc 15 phút)", where: "PubMed Central", year: "2015", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC4419447" },
  ],
  tam_rung: shared("tam_rung"),
  truong_nhieu_cay: [
    { ref: "Dadvand, P. và cộng sự. Green spaces and cognitive development in primary schoolchildren (2.593 học sinh, 36 trường ở Barcelona)", where: "PNAS", year: "2015", url: "https://doi.org/10.1073/pnas.1503402112" },
    { ref: "Tóm tắt trên PubMed", where: "PubMed", year: "2015", url: "https://pubmed.ncbi.nlm.nih.gov/26080420/" },
  ],
  // 🧠 Bộ não của con
  chu_cho_canh_cua: shared("chuong_bao_dong"),
  duong_mon_trong_nao: [
    { ref: "Juggling juggles the brain (về Draganski, B. và cộng sự. Neuroplasticity: Changes in grey matter induced by training, Nature 427: 311–312)", where: "Neuroscience for Kids (Eric Chudler, University of Washington)", year: "2004", url: "https://staff.washington.edu/chudler/jugg.html" },
  ],
  chim_on_bai_hat: [
    { ref: "Singing silently during sleep helps birds learn song (về Dave, A. S. & Margoliash, D., Science 2000)", where: "UChicago Medicine", year: "2000", url: "https://www.uchicagomedicine.org/forefront/news/singing-silently-during-sleep-helps-birds-learn-song" },
    ...shared("giac_ngu_cat_ho_so"),
  ],
  nao_dang_lon: shared("nao_dang_xay"),
  to_mo_giup_nho: shared("to_mo_la_chia_khoa"),
  bi_mat_hoi_tho_ra: shared("tho_ra_cham"),
  nghi_ngan_giup_hoc: [
    { ref: "Want to learn a new skill? Take some short breaks (về Bönstrup, M. và cộng sự, Current Biology 2019)", where: "NINDS, National Institutes of Health", year: "2019", url: "https://www.ninds.nih.gov/News-Events/News-and-Press-Releases/Press-Releases/Want-learn-new-skill-Take-some-short-breaks" },
  ],
  nao_an_nang_luong: shared("huyen_thoai_10_phan_tram"),
  // 💛 Cảm xúc là gì
  nguoi_dua_tin: shared("cam_xuc_la_tin_nhan"),
  ngap_va_cuoi_lay: [
    { ref: "Yong, E. Dogs catch yawns from humans (về Joly-Mascheroni, Senju & Shepherd, Biology Letters 2008; 21 trên 29 chú chó)", where: "National Geographic", year: "2008", url: "https://www.nationalgeographic.com/science/article/dogs-catch-yawns-from-humans" },
    { ref: "Study shows laughter is contagious (về Warren và cộng sự, Journal of Neuroscience 2006; nhóm Sophie Scott, UCL)", where: "ScienceDaily", year: "2006", url: "https://sciencedaily.com/releases/2006/12/061212213922.htm" },
  ],
  goi_ten_cam_xuc: shared("goi_ten_cam_xuc"),
  vui_buon_cung_luc: [
    { ref: "Larsen, J. T., To, Y. M. & Fireman, G. Children's understanding and experience of mixed emotions (trẻ 5–12 tuổi)", where: "Psychological Science", year: "2007", url: "https://www.psychologicalscience.org/journals/psychological-science/j.1467-9280.2007.01870.x/" },
  ],
  dem_dieu_biet_on: [
    { ref: "A lesson in thanks (về Froh, Sefick & Emmons, Counting blessings in early adolescents, Journal of School Psychology 2008; 221 học sinh cấp hai)", where: "Greater Good Magazine (UC Berkeley)", year: "2007", url: "https://greatergood.berkeley.edu/article/item/a_lesson_in_thanks/" },
  ],
  goi_minh_bang_ten: [
    { ref: "Talking in the 3rd person lowers anxiety: Study (về Kross, E. và cộng sự, Journal of Personality and Social Psychology 2014)", where: "University of Michigan, Department of Psychology", year: "2014", url: "https://prod.lsa.umich.edu/psych/news-events/all-news/archived-news/2014/02/talking-in-the-3rd-person-lowers-anxiety--study.html" },
    { ref: "Could this trick help you perform better in stressful situations? (mô tả thí nghiệm bài nói 5 phút, người chấm, ví dụ “You can do it, John”)", where: "World Economic Forum", year: "2015", url: "https://weforum.org/stories/2015/06/could-this-trick-help-you-perform-better-in-stressful-situations" },
  ],
  // 🔬 Thí nghiệm nhỏ
  dem_hoi_tho: [
    { ref: "Zaccaro, A. và cộng sự. How breath-control can change your life: A systematic review on psycho-physiological correlates of slow breathing (15 nghiên cứu)", where: "Frontiers in Human Neuroscience", year: "2018", url: "https://www.frontiersin.org/articles/10.3389/fnhum.2018.00353/full" },
  ],
  nam_dieu_quanh_minh: [
    { ref: "Field Book Project (sổ tay thực địa ghi nơi sống, thời tiết, quan sát và cả cảm xúc; hơn 9.500 cuốn đã lập danh mục)", where: "Smithsonian Institution Archives", year: "không ghi năm", url: "https://siarchives.si.edu/about/field-book-project" },
  ],
  mot_phut_ngam_may: [
    { ref: "How much does a cloud weigh? (mây tích 1 km³ × 0,5 g/m³ ≈ 500.000 kg)", where: "USGS Water Science School", year: "không ghi năm", url: "https://www.usgs.gov/water-science-school/science/how-much-does-a-cloud-weigh" },
  ],
  ban_do_cam_xuc: [
    { ref: "Nummenmaa, L., Glerean, E., Hari, R. & Hietanen, J. K. Bodily maps of emotions", where: "PNAS", year: "2014", url: "https://pubmed.ncbi.nlm.nih.gov/24379370/" },
    { ref: "Mapping emotions on the body: love makes us warm all over (khoảng 700 người ở Phần Lan, Thụy Điển, Đài Loan)", where: "WGBH", year: "2014", url: "https://www.wgbh.org/news/2014-01-06/mapping-emotions-on-the-body-love-makes-us-warm-all-over" },
  ],
  mui_goi_ky_niem: [
    { ref: "Konnikova, M. Smells like old times (Herz; Willander & Larsson 2006, Đại học Stockholm)", where: "Scientific American Mind", year: "2012", url: "https://www.scientificamerican.com/article/smells-like-old-times" },
  ],
  dem_chim_15_phut: [
    { ref: "About the Great Backyard Bird Count (tháng Hai hằng năm, ít nhất 15 phút, hơn 300.000 người gửi ghi chép)", where: "National Audubon Society", year: "2024", url: "https://www.audubon.org/es/conservation/about-great-backyard-bird-count" },
  ],
};

const QUAD_LABEL: Record<Quad, string> = {
  red: "Núi lửa (tức, lo, căng thẳng)",
  yellow: "Mặt trời (vui, hào hứng, tò mò)",
  blue: "Biển sâu (buồn, chán, mệt)",
  green: "Khu rừng (bình yên, thư thái)",
};

const quadsText = (d: FieldNote) => (d.quads.length === 0 ? "mọi lúc" : d.quads.map((q) => QUAD_LABEL[q]).join(" · "));

function cardBlock(d: FieldNote, n: number): string {
  let out = `### ${n}. ${d.title} (\`${d.key}\`)\n\n`;
  out += `${d.body}\n\n`;
  if (d.tryIt) out += `- **Thử nhỏ:** ${d.tryIt}\n`;
  out += `- **Hợp với:** ${quadsText(d)}\n`;
  out += `- **Nguồn (hiện trong app):** ${d.source}\n`;
  for (const s of NOTE_SOURCES[d.key] ?? []) out += `- **Link:** [${s.ref}](${s.url}) — ${s.where}, ${s.year} (kiểm ${CHECKED})\n`;
  return out + `\n`;
}

/** Points the independent fact-checker should look at hardest (the least certain claims). */
const CHECK_POINTS: string[] = [
  "`be_rai_ca`: thẻ **không** nói rái cá “nắm tay khi ngủ” (chuyện hay kể trên mạng, nhưng không thấy trong nguồn uy tín đã kiểm), và không lặp lại chuyện rái cá quấn tảo bẹ vì thế giới Biển của An đã có. Con số “có khi hơn 1.000 con” lấy từ trang của Bộ Nội vụ Hoa Kỳ.",
  "`chuot_mo_cua`: chi tiết “chia phần sô-cô-la” có trong bài National Geographic; tin của ScienceDaily chỉ nói chuột hay mở cửa cho bạn trước khi mở hộp sô-cô-la. Thẻ không tả cảnh chuột bạn bồn chồn.",
  "`ca_heo_co_ten`: chưa mở được bản DOI của hai bài gốc; dùng tin của Đại học St Andrews và Hội Hoàng gia Anh. Nghiên cứu “20 năm” làm với cá heo nuôi ở sáu cơ sở.",
  "`chuot_cuoi`: “cao hơn mức tai người nghe được” là suy ra từ tiếng kêu siêu âm 50 kHz; nguồn chỉ ghi “siêu âm”. Thẻ không nhắc chi tiết đo não.",
  "`khi_chai_long`: chỉ là mối liên hệ (đo hormone trong mẫu phân), thẻ nói rõ điều này.",
  "`duoi_cho_vay`: chi tiết lấy từ bài Nature News; chưa mở bản gốc trên Current Biology.",
  "`ngap_va_cuoi_lay`: “các nhà khoa học ở Anh” (nhóm Birkbeck, Đại học London) — nguồn đã kiểm là bài National Geographic, chưa mở bản gốc.",
  "`cam_giac_kinh_ngac`: người tham gia là **người lớn tuổi**; thẻ ghi đúng vậy.",
  "`mui_mua`: thẻ không ghi con số độ nhạy của mũi với geosmin (các nguồn ghi khác nhau: 100 phần nghìn tỉ hay 0,4 phần tỉ).",
  "`mot_phut_ngam_may`: 500 tấn là phép tính ước lượng của USGS cho một đám mây tích 1 km³.",
  "`nguoi_dua_tin`: hai ví dụ (“lo có thể báo…”, “vui có thể báo…”) là ví dụ minh họa của người soạn, không phải câu trong bài báo.",
  "`goi_minh_bang_ten`: kết quả bài nói (bớt lo, người chấm chấm cao hơn) lấy từ bài của World Economic Forum mô tả thí nghiệm; trang của Đại học Michigan xác nhận ý chính. Ví dụ “Nam ơi” là minh họa của người soạn (bài gốc dùng “John”).",
  "`dem_dieu_biet_on`: mô tả theo bài của Greater Good (221 học sinh cấp hai, hai tuần).",
  "`truong_nhieu_cay`: so sánh giữa các **trường**, không phải giữa các bạn; một phần mối liên hệ được giải thích bởi khói xe.",
  "`dem_chim_15_phut`: con số 300.000 là theo trang của Audubon cho một mùa đếm gần đây.",
];

function render(): string {
  const shown = FIELD_NOTES.filter((d) => !d.held);
  const held = FIELD_NOTES.filter((d) => d.held);
  const total = Object.values(SCIENCE_TOPIC_TARGET).reduce((a, b) => a + b, 0);
  const empty = SCIENCE_TOPIC_KEYS.filter((t) => !FIELD_NOTES.some((d) => d.topic === t));
  let out = `# Sổ tay nhà khoa học — ${FIELD_NOTES.length} thẻ cho An (bản để bố mẹ đọc và duyệt)\n\n`;
  out += `> Sinh từ \`lib/binhYen/fieldNotes.ts\` (chữ hiện trong app) và \`scripts/field-notes-doc.ts\` (link nguồn) bằng lệnh ở đầu file script. Test \`tests/fieldNotes.test.ts\` kiểm hai file khớp nhau. Sửa chữ ở file \`.ts\` rồi sinh lại; mã (\`key\`) không bao giờ đổi.\n`;
  out += `> Nội dung soạn và mọi link được kiểm ngày ${CHECKED}. Bộ thẻ còn chờ một người kiểm tra độc lập đọc lại.\n`;
  out += `> **${shown.length} thẻ** con có thể thấy. **${held.length} thẻ** đang chờ bố mẹ đồng ý.\n`;
  out += `> Bộ hoàn chỉnh sẽ có **${total} thẻ** ở ${SCIENCE_TOPIC_KEYS.length} chủ đề. Đây là **nửa đầu** (thẻ gắn với cảm xúc). ${empty.length > 0 ? `Nửa sau (kiến thức thiên nhiên thuần: ${empty.map((t) => `${SCIENCE_TOPICS[t].emoji} ${SCIENCE_TOPICS[t].label}`).join(" · ")}) sẽ được thêm sau; chủ đề chưa có thẻ thì app chưa hiện.` : ""}\n\n`;

  out += `## Sổ tay nhà khoa học là gì\n\n`;
  out += `Mỗi ngày, sau khi ghé Góc bình yên, An có thể tự mở một thẻ trong “Sổ tay nhà khoa học”: một điều thú vị, có nguồn, về động vật, thiên nhiên, bộ não hay cảm xúc, nối những thứ con yêu (động vật, rừng, biển, bầu trời) với cảm xúc. Giọng văn là giọng **nhà khoa học nhí** (quan sát, ghi chép, thí nghiệm) như phần còn lại của Góc bình yên của An.\n\n`;
  out += `Đây là **kiến thức nhẹ nhàng, khơi tò mò**. Đây **không phải** trị liệu, không phải lời khuyên về sức khỏe, và không nói gì về riêng con. Nếu bố mẹ thấy con cần hỗ trợ nhiều hơn, người phù hợp là chuyên gia tâm lý.\n\n`;

  out += `## Luật an toàn nội dung (cho tuổi 11–12, đã áp dụng cho cả ${FIELD_NOTES.length} thẻ)\n\n`;
  out += `1. **Không có gì đáng sợ hay buồn về động vật**: không cảnh săn mồi, bị thương, chết, không giọng “tuyệt chủng đến nơi”. Nghiên cứu làm với động vật nuôi thì thẻ không tả cảnh con vật khó chịu. Test tự động chặn các chữ “chết”, “giết”, “săn mồi”, “tuyệt chủng”, “đáng sợ”.\n`;
  out += `2. **Không nói con vật cảm thấy “y hệt như người”**: thẻ kể các nhà khoa học **quan sát** được gì và họ **hiểu** điều đó thế nào (“cho rằng”, “có thể”, “trạng thái giống cảm xúc”).\n`;
  out += `3. **Không dùng từ bệnh lý** (“rối loạn”, “bệnh”, “triệu chứng”, “điều trị”, “chẩn đoán”, “ảo giác”, “hỏng”…). Test tự động chặn các từ này.\n`;
  out += `4. **Không ra lệnh** (không “con nên…”, “con phải…”) và **không so sánh** con với bạn khác. Không có chủ đề tự làm đau mình, ăn uống, cân nặng, ngoại hình.\n`;
  out += `5. **Nói có chừng mực** và nói rõ giới hạn khi cần (“mới là mối liên hệ”, “nghiên cứu còn nhỏ”, “bằng chứng còn ít”).\n`;
  out += `6. **Mỗi thẻ có nguồn**: bài báo khoa học có bình duyệt (link DOI khi mở được), hoặc tổ chức uy tín (NIH, NIMH, Harvard Health, Smithsonian, USGS, National Geographic, Greater Good – UC Berkeley, Hội Hoàng gia Anh, các trường đại học). Không dùng chuyện truyền miệng chưa kiểm được (ví dụ cá vàng “nhớ 3 giây”, rái cá “nắm tay khi ngủ”, “luật 90 giây”). Thẻ “10% bộ não” nói rõ đó là chuyện không có thật.\n`;
  out += `7. **“Thử nhỏ”** (không bắt buộc) chỉ gồm việc nhẹ, an toàn, không cần dụng cụ ngoài giấy bút: thở chậm, đếm hơi thở, để ý quanh mình, nhìn trời hay mây, ngửi một mùi trong nhà, vẽ, viết một dòng, đi bộ ngắn. Thẻ 🔬 Thí nghiệm nhỏ có dòng **“Ghi chép:”** để con ghi kết quả. Thở không phải nghi lễ bắt buộc: “thấy khác hay chưa đều ổn”.\n`;
  out += `8. **Bộ não**: thẻ “chú chó canh cửa” dùng đúng hình ảnh đã có ở Góc bình yên của An và kết thúc ở chỗ an toàn (cơ thể có sẵn “cái phanh”). Các thẻ não không nói khác với thẻ của Nguyên; vài thẻ dùng chung nguồn đã kiểm cho Hồ sơ mật.\n\n`;

  out += `## Cách thẻ hiện ra\n\n`;
  out += `- Chỉ có ở Góc bình yên của **An** (giọng nhà khoa học). Nguyên không thấy bộ này (Nguyên có Hồ sơ mật).\n`;
  out += `- Ở bước “Xong rồi”, dưới phần quà của thế giới, có một dòng **thu gọn** “📓 Mở sổ tay nhà khoa học hôm nay?”. Con không chạm thì không có gì hiện ra.\n`;
  out += `- Con **tự chọn chủ đề** (chỉ hiện các chủ đề đã có thẻ). Máy nhớ chủ đề con chọn lần trước; lần đầu là 🐾.\n`;
  out += `- **Cách chọn thẻ** (giống Hồ sơ mật, cố định, không ngẫu nhiên): bỏ qua thẻ đang chờ, lấy thẻ của chủ đề, giữ những thẻ hợp với cảm xúc lúc ghé (dòng “Hợp với”; nếu còn ít hơn 2 thẻ thì dùng cả chủ đề), rồi lấy thẻ thứ (số ngày kể từ 01/01/2026) chia lấy dư cho số thẻ. Cùng ngày, cùng cảm xúc, cùng chủ đề thì ra cùng một thẻ; mỗi ngày đổi thẻ.\n`;
  out += `- Thẻ Núi lửa/Biển sâu thiên về **trấn an, làm dịu**; thẻ Mặt trời/Khu rừng thiên về **tò mò, ngạc nhiên**.\n`;
  out += `- Nút **“Cất vào sổ tay”** lưu thẻ vào sổ tay, **chỉ trên máy của con** (bộ nhớ trình duyệt). Không có số đếm, không huy hiệu.\n`;
  out += `- **Bố mẹ không thấy** con đọc thẻ nào: không gửi lên máy chủ, không ghi nhật ký, không có trong trang phụ huynh.\n\n`;

  let n = 0;
  for (const t of SCIENCE_TOPIC_KEYS) {
    const cards = shown.filter((x) => x.topic === t);
    if (cards.length === 0) continue;
    out += `## ${SCIENCE_TOPICS[t].emoji} ${SCIENCE_TOPICS[t].label}\n\n`;
    for (const d of cards) out += cardBlock(d, ++n);
  }

  if (held.length > 0) {
    out += `## Chờ bố mẹ đồng ý (chưa hiện cho con)\n\n`;
    out += `Những thẻ này nằm trong bộ nhưng app **không bao giờ chọn** cho đến khi bố mẹ báo đồng ý.\n\n`;
    for (const d of held) {
      out += cardBlock(d, ++n).replace(/\n\n$/, "\n");
      out += `- **Vì sao đang chờ:** ${d.heldReason ?? "Chờ bố mẹ đọc lại."}\n\n`;
    }
  }

  out += `## Bảng nguồn\n\n`;
  out += `| # | Thẻ | Tài liệu | Nơi đăng | Năm | Link | Ngày kiểm |\n|---|---|---|---|---|---|---|\n`;
  let i = 0;
  for (const d of [...shown, ...held].sort((a, b) => SCIENCE_TOPIC_KEYS.indexOf(a.topic) - SCIENCE_TOPIC_KEYS.indexOf(b.topic))) {
    for (const s of NOTE_SOURCES[d.key] ?? []) {
      i += 1;
      out += `| ${i} | \`${d.key}\`${d.held ? " (chờ)" : ""} | ${s.ref.replace(/\|/g, "/")} | ${s.where} | ${s.year} | [link](${s.url}) | ${CHECKED} |\n`;
    }
  }

  out += `\n## Điểm cần soát kỹ (cho người kiểm tra)\n\n`;
  for (const p of CHECK_POINTS) out += `- ${p}\n`;
  out += `- **Thẻ đã bỏ khi soạn:** “bò có bạn thân” (chỉ tìm thấy luận án và tin báo, chưa thấy bài có bình duyệt); rái cá “nắm tay khi ngủ” (không có trong nguồn uy tín; thẻ rái cá nói chuyện bè và chải lông, vì chuyện quấn tảo bẹ đã có trong thế giới Biển); bài nhịp tim khỉ được chải lông năm 1999 (chỉ có 2 con khỉ, nên dùng nghiên cứu 2007 thay thế).\n`;
  return out;
}

if (process.argv[1]?.endsWith("field-notes-doc.cjs")) {
  mkdirSync("docs/binh-yen", { recursive: true });
  writeFileSync(DOC_FILE, render());
}
