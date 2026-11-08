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
  // 🐾 Động vật và cảm xúc
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
    { ref: "Albuquerque, N. và cộng sự. Dogs recognize dog and human emotions (12(1): 20150883)", where: "Biology Letters", year: "2016", url: "https://doi.org/10.1098/rsbl.2015.0883" },
    { ref: "Tóm tắt trên PubMed", where: "PubMed", year: "2016", url: "https://pubmed.ncbi.nlm.nih.gov/26763220/" },
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
    { ref: "Ravens console each other (rỉa lông, ngồi sát, chạm; nhiều nhất với những con vốn thân thiết)", where: "Phys.org", year: "2010", url: "https://phys.org/news/2010-05-ravens-console.html" },
  ],
  ca_heo_co_ten: [
    { ref: "King, S. L. & Janik, V. M. Bottlenose dolphins can use learned vocal labels to address each other", where: "PNAS", year: "2013", url: "https://doi.org/10.1073/pnas.1304459110" },
    { ref: "Bruck, J. N. Decades-long social memory in bottlenose dolphins (sáu cơ sở nuôi cá heo)", where: "Proceedings of the Royal Society B", year: "2013", url: "https://doi.org/10.1098/rspb.2013.1726" },
    { ref: "Dolphins respond to individual names (King, S. L. & Janik, V. M., PNAS 2013; cá heo hoang dã ở bờ đông Scotland)", where: "University of St Andrews", year: "2013", url: "https://news.st-andrews.ac.uk/archive/dolphins-respond-to-individual-names/" },
    { ref: "Dolphins have longest social memories in non-human species (Bruck, J. N., Proc. R. Soc. B 2013; hơn 20 năm)", where: "The Royal Society", year: "2013", url: "https://royalsociety.org/news/2013/dophins-social-memory" },
  ],
  chuot_cuoi: [
    { ref: "Ishiyama, S. & Brecht, M. Neural correlates of ticklishness in the rat somatosensory cortex", where: "Science", year: "2016", url: "https://doi.org/10.1126/science.aah5114" },
    { ref: "Tin của Đại học Humboldt Berlin (tiếng kêu siêu âm 50 kHz, nhảy vui, đuổi tay; chuột lo lắng ít “cười” hơn)", where: "ScienceDaily", year: "2016", url: "https://www.sciencedaily.com/releases/2016/11/161110152342.htm" },
  ],
  duoi_cho_vay: [
    { ref: "Quaranta, A., Siniscalchi, M. & Vallortigara, G. Asymmetric tail-wagging responses by dogs to different emotive stimuli (17(6): R199–R201)", where: "Current Biology", year: "2007", url: "https://doi.org/10.1016/j.cub.2007.02.008" },
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
  tam_rung: [
    { ref: "Park, B. J. và cộng sự. The physiological effects of Shinrin-yoku (taking in the forest atmosphere or forest bathing): evidence from field experiments in 24 forests across Japan (15(1): 18–26)", where: "Environmental Health and Preventive Medicine", year: "2010 (đăng trực tuyến 2009)", url: "https://doi.org/10.1007/s12199-009-0086-9" },
    ...shared("tam_rung"),
  ],
  truong_nhieu_cay: [
    { ref: "Dadvand, P. và cộng sự. Green spaces and cognitive development in primary schoolchildren (2.593 học sinh, 36 trường ở Barcelona)", where: "PNAS", year: "2015", url: "https://doi.org/10.1073/pnas.1503402112" },
    { ref: "Tóm tắt trên PubMed", where: "PubMed", year: "2015", url: "https://pubmed.ncbi.nlm.nih.gov/26080420/" },
  ],
  // 🧠 Bộ não của con
  chu_cho_canh_cua: shared("chuong_bao_dong"),
  duong_mon_trong_nao: [
    { ref: "Draganski, B. và cộng sự. Neuroplasticity: Changes in grey matter induced by training (427: 311–312)", where: "Nature", year: "2004", url: "https://doi.org/10.1038/427311a" },
    { ref: "Juggling juggles the brain (về Draganski, B. và cộng sự. Neuroplasticity: Changes in grey matter induced by training, Nature 427: 311–312)", where: "Neuroscience for Kids (Eric Chudler, University of Washington)", year: "2004", url: "https://staff.washington.edu/chudler/jugg.html" },
  ],
  chim_on_bai_hat: [
    { ref: "Dave, A. S. & Margoliash, D. Song replay during sleep and computational rules for sensorimotor vocal learning (290(5492): 812–816)", where: "Science", year: "2000", url: "https://doi.org/10.1126/science.290.5492.812" },
    { ref: "Singing silently during sleep helps birds learn song (về Dave, A. S. & Margoliash, D., Science 2000)", where: "UChicago Medicine", year: "2000", url: "https://www.uchicagomedicine.org/forefront/news/singing-silently-during-sleep-helps-birds-learn-song" },
    ...shared("giac_ngu_cat_ho_so"),
  ],
  nao_dang_lon: shared("nao_dang_xay"),
  to_mo_giup_nho: shared("to_mo_la_chia_khoa"),
  bi_mat_hoi_tho_ra: shared("tho_ra_cham"),
  nghi_ngan_giup_hoc: [
    { ref: "Bönstrup, M. và cộng sự. A rapid form of offline consolidation in skill learning (29(8): 1346–1351)", where: "Current Biology", year: "2019", url: "https://doi.org/10.1016/j.cub.2019.02.049" },
    { ref: "Want to learn a new skill? Take some short breaks (về Bönstrup, M. và cộng sự, Current Biology 2019)", where: "NINDS, National Institutes of Health", year: "2019", url: "https://www.ninds.nih.gov/News-Events/News-and-Press-Releases/Press-Releases/Want-learn-new-skill-Take-some-short-breaks" },
  ],
  nao_an_nang_luong: shared("huyen_thoai_10_phan_tram"),
  // 💛 Cảm xúc là gì
  nguoi_dua_tin: shared("cam_xuc_la_tin_nhan"),
  ngap_va_cuoi_lay: [
    { ref: "Joly-Mascheroni, R. M., Senju, A. & Shepherd, A. J. Dogs catch human yawns (4(5): 446–448)", where: "Biology Letters", year: "2008", url: "https://doi.org/10.1098/rsbl.2008.0333" },
    { ref: "Warren, J. E. và cộng sự. Positive emotions preferentially engage an auditory–motor “mirror” system (26(50): 13067–13075)", where: "Journal of Neuroscience", year: "2006", url: "https://doi.org/10.1523/JNEUROSCI.3907-06.2006" },
    { ref: "Yong, E. Dogs catch yawns from humans (về Joly-Mascheroni, Senju & Shepherd, Biology Letters 2008; 21 trên 29 chú chó)", where: "National Geographic", year: "2008", url: "https://www.nationalgeographic.com/science/article/dogs-catch-yawns-from-humans" },
    { ref: "Study shows laughter is contagious (về Warren và cộng sự, Journal of Neuroscience 2006; nhóm Sophie Scott, UCL)", where: "ScienceDaily", year: "2006", url: "https://sciencedaily.com/releases/2006/12/061212213922.htm" },
  ],
  goi_ten_cam_xuc: shared("goi_ten_cam_xuc"),
  vui_buon_cung_luc: [
    { ref: "Larsen, J. T., To, Y. M. & Fireman, G. Children's understanding and experience of mixed emotions", where: "Psychological Science", year: "2007", url: "https://doi.org/10.1111/j.1467-9280.2007.01870.x" },
    { ref: "Trang bài báo (trẻ 5–12 tuổi)", where: "Association for Psychological Science", year: "2007", url: "https://www.psychologicalscience.org/journals/psychological-science/j.1467-9280.2007.01870.x/" },
  ],
  dem_dieu_biet_on: [
    { ref: "Froh, J. J., Sefick, W. J. & Emmons, R. A. Counting blessings in early adolescents: An experimental study of gratitude and subjective well-being", where: "Journal of School Psychology", year: "2008", url: "https://doi.org/10.1016/j.jsp.2007.03.005" },
    { ref: "A lesson in thanks (về Froh, Sefick & Emmons, Counting blessings in early adolescents, Journal of School Psychology 2008; 221 học sinh cấp hai)", where: "Greater Good Magazine (UC Berkeley)", year: "2007", url: "https://greatergood.berkeley.edu/article/item/a_lesson_in_thanks/" },
  ],
  goi_minh_bang_ten: [
    { ref: "Kross, E. và cộng sự. Self-talk as a regulatory mechanism: How you do it matters", where: "Journal of Personality and Social Psychology", year: "2014", url: "https://doi.org/10.1037/a0035173" },
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
    { ref: "Nummenmaa, L., Glerean, E., Hari, R. & Hietanen, J. K. Bodily maps of emotions", where: "PNAS", year: "2014", url: "https://doi.org/10.1073/pnas.1321664111" },
    { ref: "Tóm tắt trên PubMed", where: "PubMed", year: "2014", url: "https://pubmed.ncbi.nlm.nih.gov/24379370/" },
    { ref: "Mapping emotions on the body: love makes us warm all over (khoảng 700 người ở Phần Lan, Thụy Điển, Đài Loan)", where: "WGBH", year: "2014", url: "https://www.wgbh.org/news/2014-01-06/mapping-emotions-on-the-body-love-makes-us-warm-all-over" },
  ],
  mui_goi_ky_niem: [
    { ref: "Konnikova, M. Smells like old times (Herz; Willander & Larsson 2006, Đại học Stockholm)", where: "Scientific American Mind", year: "2012", url: "https://www.scientificamerican.com/article/smells-like-old-times" },
    { ref: "Willander, J. & Larsson, M. Smell your way back to childhood: Autobiographical odor memory (13: 240–244)", where: "Psychonomic Bulletin & Review", year: "2006", url: "https://doi.org/10.3758/BF03193837" },
  ],
  dem_chim_15_phut: [
    { ref: "About the Great Backyard Bird Count (4 ngày giữa tháng Hai hằng năm, ít nhất 15 phút; gần đây hơn 450.000 người gửi ghi chép)", where: "National Audubon Society", year: "2026", url: "https://www.audubon.org/community-science/great-backyard-bird-count" },
  ],

  // ===== Second half: pure nature-science knowledge =====
  // 🦎 Động vật kỳ thú
  sao_la: [
    { ref: "Saola rediscovered! ‘Asian Unicorn’ sighted in Vietnam for first time in 15 years (1992, rừng Vũ Quang, Bộ Lâm nghiệp + WWF; thú lớn đầu tiên mới với khoa học sau hơn 50 năm; hai sừng song song; ảnh bẫy ảnh 7/9/2013 ở Trường Sơn)", where: "WWF-Canada", year: "2013", url: "https://wwf.ca/media-releases/saola-rediscovered-asian-unicorn-sighted-in-vietnam-for-first-time-in-15-years/" },
  ],
  vooc_cha_va: [
    { ref: "Pygathrix nemaeus (thân xám, đuôi trắng, cẳng tay trắng, “tất” nâu đỏ ở chân; nhảy bằng cú đẩy chân sau; đi theo đường quen trên tán)", where: "Animal Diversity Web, University of Michigan", year: "không ghi năm", url: "https://animaldiversity.org/accounts/Pygathrix_nemaeus" },
    { ref: "Save the Red-shanked Doucs of Sơn Trà (“queen of primates”, sống trên bán đảo Sơn Trà)", where: "Việt Nam News", year: "không ghi năm", url: "https://vietnamnews.vn/environment/519788/save-the-red-shanked-doucs-of-son-tra.html" },
  ],
  gau_nuoc_vu_tru: [
    { ref: "Jönsson, K. I., Rabbow, E., Schill, R. O., Harms-Ringdahl, M. & Rettberg, P. Tardigrades survive exposure to space in low Earth orbit (18(17): R729–R731)", where: "Current Biology", year: "2008", url: "https://doi.org/10.1016/j.cub.2008.06.048" },
    { ref: "Jönsson, K. I. và cộng sự. Tardigrades survive exposure to space in low Earth orbit (FOTON-M3, 9/2007, khoảng 270 km; gấu nước khô; phần lớn sống, sinh sản bình thường; dài 0,1–1,5 mm)", where: "Current Biology (tin trên ScienceDaily)", year: "2008", url: "https://www.sciencedaily.com/releases/2008/09/080908135906.htm" },
  ],
  nhan_bien_bac_cuc: [
    { ref: "Egevang, C. và cộng sự. Tracking of Arctic terns Sterna paradisaea reveals longest animal migration (11 con, thiết bị 1,4 g, chim < 125 g, có con > 80.000 km/năm)", where: "PNAS", year: "2010", url: "https://doi.org/10.1073/pnas.0909493107" },
    { ref: "Tóm tắt bài báo (bản lưu của NERC)", where: "NERC Open Research Archive", year: "2010", url: "https://nora.nerc.ac.uk/id/eprint/14091/" },
    { ref: "Arctic terns confirmed to have the longest animal migration in the world (hơn 70.000 km mỗi năm, Greenland)", where: "Phys.org", year: "2010", url: "https://phys.org/news/2010-01-arctic-terns-longest-animal-migration.html" },
    { ref: "Tin của Đại học Newcastle (07/06/2016): một chú nhạn biển gắn thiết bị ở quần đảo Farne (Northumberland, Anh) bay khoảng 96.000 km, chuyến bay dài nhất từng ghi được ở chim di cư lúc ấy", where: "Newcastle University", year: "2016", url: "https://www.ncl.ac.uk/press/articles/archive/2016/06/arcticterns" },
  ],
  chim_ruoi_bay_lui: [
    { ref: "Hummingbird secrets (loài chim duy nhất có “số lùi”; có loài vỗ cánh ~100 lần/giây; tim > 1.000 nhịp/phút; chim ruồi ong ở Cuba nặng hơn một hạt hạnh nhân một chút)", where: "National Geographic", year: "không ghi năm", url: "https://www.nationalgeographic.com/magazine/article/hummingbird-secrets-speed-worlds-smallest-bird" },
  ],
  tac_ke_hoa_doi_mau: [
    { ref: "Teyssier, J., Saenko, S. V., van der Marel, D. & Milinkovitch, M. C. Photonic crystals cause active colour change in chameleons", where: "Nature Communications", year: "2015", url: "https://doi.org/10.1038/ncomms7368" },
    { ref: "Researchers reveal how the chameleon changes colour (Teyssier, J. và cộng sự, Nature Communications 2015; Đại học Geneva, Milinkovitch; tinh thể nano guanine trong tế bào da; giãn ~30%; xanh lá → vàng)", where: "CORDIS (Ủy ban châu Âu)", year: "2015", url: "https://cordis.europa.eu/article/id/116503-trending-science-researchers-reveal-how-the-chameleon-changes-colour" },
  ],
  bo_hung_ngan_ha: [
    { ref: "Dacke, M. và cộng sự. Dung beetles use the Milky Way for orientation", where: "Current Biology", year: "2013", url: "https://doi.org/10.1016/j.cub.2012.12.034" },
    { ref: "Dung beetles use the Milky Way to navigate at night (Dacke và cộng sự, Current Biology 2013; Đại học Lund; nhà mô phỏng bầu trời; tấm che trên đầu thì đi lòng vòng; có lẽ là lần đầu thấy ở động vật)", where: "EarthSky", year: "2013", url: "https://earthsky.org/earth/dung-beetles-use-the-milky-way-to-navigate-at-night/" },
  ],
  kien_trong_nam: [
    { ref: "Leafcutter ants (không ăn lá mà ăn nấm; trồng nấm gần 60 triệu năm; con người ~10.000 năm; tổ hàng triệu kiến thợ)", where: "Smithsonian Tropical Research Institute", year: "không ghi năm", url: "https://stri.si.edu/node/24899" },
  ],
  ca_thoi_loi_chop_mat: [
    { ref: "Aiello, B. R. và cộng sự. The origin of blinking in both mudskippers and tetrapods is linked to life on land", where: "PNAS", year: "2023", url: "https://doi.org/10.1073/pnas.2220404120" },
    { ref: "Mudskippers could be key to understanding evolution of blinking (PNAS 2023; kéo mắt xuống hốc mắt; giữ ướt, sạch, bảo vệ; không cần cơ mới; phần lớn thời gian ở trên cạn)", where: "ScienceDaily (tin của Penn State)", year: "2023", url: "https://sciencedaily.com/releases/2023/04/230424223105.htm" },
  ],
  doi_khong_mu: [
    { ref: "Are bats blind? (“No, bats are not blind”; mắt nhỏ nhưng rất nhạy, không thấy màu sắc rõ nét như người)", where: "U.S. Geological Survey (USGS)", year: "không ghi năm", url: "https://www.usgs.gov/faqs/are-bats-blind" },
  ],
  ca_voi_hat: [
    { ref: "Garland, E. C. và cộng sự. Dynamic horizontal cultural transmission of humpback whale song at the ocean basin scale", where: "Current Biology", year: "2011", url: "https://doi.org/10.1016/j.cub.2011.03.019" },
    { ref: "Humpback whales spread songs across Pacific (Garland, E. C. và cộng sự, Current Biology 2011; 11 năm, 6 quần thể; bài hát lan từ đông Úc tới Polynesia thuộc Pháp trong ~2 năm; chỉ con đực hát)", where: "University of Queensland", year: "2011", url: "https://news.uq.edu.au/2011-04-15-humpback-whales-spread-songs-across-pacific" },
  ],
  than_lan_bay: [
    { ref: "Dehling, J. M. How lizards fly: A novel type of wing in animals (5–7 xương sườn dài đỡ màng da; chân trước áp vào mép cánh; lượn xa nhất ~26 m; Draco dussumieri ở Ấn Độ)", where: "PLoS ONE (bản trên PMC)", year: "2017", url: "https://pmc.ncbi.nlm.nih.gov/articles/PMC5728497" },
  ],
  // 🌋 Trái Đất kỳ diệu
  son_doong: [
    { ref: "Vietnam Cave (đoàn Anh vào hang mùa xuân 2009; đặt vừa dãy nhà 40 tầng; trần sụt cho nắng vào, cây mọc; mây mỏng gần trần)", where: "National Geographic", year: "2011", url: "https://www.nationalgeographic.com/magazine/article/vietnam-cave" },
    { ref: "Hang Sơn Đoòng cave (Hồ Khanh, 1990, trú mưa và thấy sương tuôn ra từ cửa hang; 2009 khảo sát; rừng dưới hố sụt)", where: "BBC Wildlife (Discover Wildlife)", year: "không ghi năm", url: "https://www.discoverwildlife.com/environment/hang-son-doong-cave" },
  ],
  giot_nuoc_9_ngay: [
    { ref: "The Water Cycle (nước ở khí quyển ~9 ngày; đại dương vài nghìn năm; sông 12–20 ngày; băng > 1.000 năm)", where: "NOAA JetStream", year: "không ghi năm", url: "https://www.noaa.gov/jetstream/max-what-cycle" },
  ],
  set_hai_lan: [
    { ref: "Lightning Myths (sét hay đánh lại cùng chỗ; Empire State trung bình 23 lần/năm)", where: "NOAA National Weather Service", year: "không ghi năm", url: "https://www.weather.gov/safety/lightning-myths" },
    { ref: "Lightning Temperature (làm không khí nóng ~50.000 °F, gấp 5 lần bề mặt Mặt Trời)", where: "NOAA National Weather Service", year: "không ghi năm", url: "https://weather.gov/safety/lightning-temperature" },
    { ref: "Thunder (đếm giây từ chớp đến sấm, 5 giây ≈ 1 dặm; thẻ đổi thành ~3 giây ≈ 1 km)", where: "NOAA National Weather Service", year: "không ghi năm", url: "https://www.weather.gov/safety/lightning-science-thunder" },
  ],
  cau_vong_tron: [
    { ref: "What Causes a Rainbow? (ánh sáng khúc xạ, phản xạ trong giọt nước; Mặt Trời sau lưng; cầu vồng là vòng tròn, từ máy bay có thể thấy cả vòng)", where: "NOAA SciJinks", year: "không ghi năm", url: "https://scijinks.gov/rainbow" },
  ],
  tam_trai_dat: [
    { ref: "Core (lõi trong chủ yếu là sắt, bán kính ~1.220 km, ~5.200 °C, rắn vì áp suất ~3,6 triệu atm; ranh giới lõi trong–ngoài ~6.000 °C, “as hot as the surface of the sun”)", where: "National Geographic Education", year: "không ghi năm", url: "https://education.nationalgeographic.org/resource/core/" },
  ],
  everest_day_bien: [
    { ref: "Summit limestone (đá vôi Qomolangma; mảnh bọ ba thùy, tay cuộn, huệ biển; ~470 triệu năm; Ấn Độ va vào châu Á, vẫn đang tiếp diễn)", where: "Montana State University", year: "không ghi năm", url: "https://montana.edu/everest/facts/summit-limestone.html" },
  ],
  vuc_mariana: [
    { ref: "How deep is the ocean? (điểm sâu nhất đại dương, ở rãnh Mariana, sâu 10.935 m)", where: "NOAA Ocean Exploration", year: "không ghi năm", url: "https://oceanexplorer.noaa.gov/facts/ocean-depth.html" },
    { ref: "How deep is the ocean? (vực Challenger 10.935 m; Everest 8.849 m; Piccard và Walsh 1960)", where: "BBC Science Focus", year: "không ghi năm", url: "https://www.sciencefocus.com/planet-earth/how-deep-is-the-ocean" },
  ],
  bui_sahara_amazon: [
    { ref: "Yu, H. và cộng sự. The fertilizing role of African dust in the Amazon rainforest: A first multiyear assessment based on data from CALIPSO (42: 1984–1991)", where: "Geophysical Research Letters", year: "2015", url: "https://doi.org/10.1002/2015GL063040" },
    { ref: "Satellite Tracks Saharan Dust To Amazon In 3-D (CALIPSO 2007–2013; trung bình 27,7 triệu tấn/năm rơi xuống Amazon; ~22.000 tấn phosphorus, gần bằng lượng mất vì mưa và lũ)", where: "NASA Scientific Visualization Studio", year: "2015", url: "https://svs.gsfc.nasa.gov/11775" },
  ],
  bang_chuyen_dai_duong: [
    { ref: "The Global Conveyor Belt (nước lạnh, mặn chìm ở vùng cực; vài cm/giây; ~1.000 năm cho một mét khối nước đi hết vòng)", where: "NOAA Ocean Service", year: "không ghi năm", url: "https://oceanservice.noaa.gov/education/tutorial_currents/05conveyor2.html" },
  ],
  nhat_trieu_vinh_bac_bo: [
    { ref: "Geographical characteristics of Vietnam's coastal regions (nhật triều Vịnh Bắc Bộ “one of the most typical globally”, một lần nước lớn và một lần nước ròng mỗi ngày, rất đều đặn)", where: "Trung tâm Phối hợp Tìm kiếm Cứu nạn Hàng hải Việt Nam (VMRCC)", year: "không ghi năm", url: "https://www.vmrcc.gov.vn/en/hydrometeorological-information/geographical-characteristics-of-vietnam-s-coastal-regions-498.html" },
    { ref: "Tidal cycles (định nghĩa nhật triều, bán nhật triều; nhiều bờ biển có hai lần nước lớn mỗi ngày)", where: "NOAA Ocean Service", year: "không ghi năm", url: "https://oceanservice.noaa.gov/education/tutorial_tides/tides07_cycles.html" },
  ],
  // 🌌 Vũ trụ bao la
  nam_anh_sang: [
    { ref: "What Is a Light-Year? (~300.000 km/giây; ~9 nghìn tỉ km; sao gần nhất sau Mặt Trời ~4,3 năm ánh sáng; tâm Ngân Hà ~26.000 năm ánh sáng)", where: "NASA Space Place", year: "không ghi năm", url: "https://spaceplace.nasa.gov/light-year" },
  ],
  mat_trang_xa_dan: [
    { ref: "The Apollo Experiment That Keeps on Giving (gương phản xạ Apollo 11; laser từ Mỹ, Pháp, Ý, Đức; chính xác vài mm; Mặt Trăng xa thêm 3,8 cm/năm)", where: "NASA Jet Propulsion Laboratory", year: "2019", url: "https://www.jpl.nasa.gov/news/the-apollo-experiment-that-keeps-on-giving/" },
  ],
  thien_vuong_nam_nghieng: [
    { ref: "Uranus: Facts (nghiêng ~97,77°; năm ~84 năm Trái Đất; mùa đông tối 21 năm; Herschel 1781, hành tinh đầu tiên tìm bằng kính thiên văn)", where: "NASA Science", year: "không ghi năm", url: "https://science.nasa.gov/Uranus/facts" },
  ],
  hoang_hon_xanh_sao_hoa: [
    { ref: "PIA19400: Sunset in Mars' Gale Crater (Curiosity, 15/4/2015, sol 956; bụi mịn cho ánh sáng xanh đi qua dễ hơn, xanh tụ gần phía Mặt Trời)", where: "NASA Jet Propulsion Laboratory", year: "2015", url: "https://www.jpl.nasa.gov/images/pia19400-sunset-in-mars-gale-crater/" },
  ],
  trai_tim_diem_vuong: [
    { ref: "NASA's New Horizons Discovers Frozen Plains in the Heart of Pluto's ‘Heart’ (17/7/2015; Tombaugh Regio theo tên Clyde Tombaugh, người tìm ra Sao Diêm Vương năm 1930; đồng bằng “no more than 100 million years old”)", where: "NASA", year: "2015", url: "https://www.nasa.gov/news-release/nasas-new-horizons-discovers-frozen-plains-in-the-heart-of-plutos-heart" },
    { ref: "New Horizons discovers frozen plains in Pluto's heart (Tombaugh Regio theo tên Clyde Tombaugh, người tìm ra Pluto năm 1930; đồng bằng băng “no more than 100 million years old”)", where: "Astronomy Now", year: "2015", url: "https://astronomynow.com/2015/07/17/new-horizons-discovers-frozen-plains-in-plutos-heart/" },
  ],
  enceladus_phun_bang: [
    { ref: "Enceladus (Cassini) (~500 km; phản chiếu tốt nhất Hệ Mặt Trời; hơi nước và hạt băng phun từ bốn “vằn hổ” ở cực nam; đại dương nước mặn; vành đai E)", where: "NASA Science", year: "không ghi năm", url: "https://science.nasa.gov/mission/cassini/science/enceladus" },
  ],
  sao_lap_lanh: [
    { ref: "Curiosities: Why do stars appear to twinkle in the night sky? (James Lattis; túi khí nóng lạnh bẻ cong ánh sáng; hành tinh là đĩa nên ít lấp lánh)", where: "University of Wisconsin–Madison News", year: "không ghi năm", url: "https://news.wisc.edu/curiosities-why-do-stars-appear-to-twinkle-in-the-night-sky" },
  ],
  bui_sao: [
    { ref: "Chandra Chemistry (hydrogen từ Vụ Nổ Lớn; carbon, oxygen tạo trong sao; nhiều sắt trong cơ thể từ các vụ nổ siêu tân tinh)", where: "Chandra X-ray Center (Harvard & Smithsonian / NASA)", year: "không ghi năm", url: "https://chandra.cfa.harvard.edu/chemistry/" },
  ],
  hanh_tinh_ngoai: [
    { ref: "The NASA Exoplanet Archive hits 6,000 planets (17/9/2025; hành tinh đầu tiên quanh sao giống Mặt Trời năm 1995; > 8.000 ứng viên; hành tinh quay quanh hai sao; hành tinh cỡ Sao Mộc gần sao hơn Sao Thủy gần Mặt Trời)", where: "Caltech/IPAC (NASA Exoplanet Archive)", year: "2025", url: "https://www.ipac.caltech.edu/news/the-nasa-exoplanet-archive-hits-6-000-planets" },
  ],
  van_ly_truong_thanh: [
    { ref: "Can you see the Great Wall of China from space? (không thấy bằng mắt thường từ Mặt Trăng)", where: "Britannica", year: "không ghi năm", url: "https://www.britannica.com/question/Can-you-see-the-Great-Wall-of-China-from-space" },
    { ref: "China's Wall Less Great in View from Space (Dương Lợi Vĩ không thấy từ quỹ đạo; màu vật liệu giống đất xung quanh; dễ thấy nhất là thành phố sáng đèn ban đêm)", where: "NASA (bản lưu)", year: "2005", url: "https://webarchive.library.unt.edu/eot2008/20080917153200/http://www.nasa.gov/vision/space/workinginspace/great_wall.html" },
  ],
  // 🌱 Cây cối thông minh
  huong_duong_dong_ho: [
    { ref: "Atamian, H. S. và cộng sự. Circadian regulation of sunflower heliotropism, floral orientation, and pollinator visits (353: 587)", where: "Science", year: "2016", url: "https://doi.org/10.1126/science.aaf9793" },
    { ref: "Sunflowers Move by the Clock (Atamian và cộng sự, Science 2016; cây non theo Mặt Trời và quay về hướng đông ban đêm; đồng hồ sinh học; hoa lớn nhìn hướng đông, côn trùng ghé gấp 5 lần)", where: "UC Davis", year: "2016", url: "https://www.ucdavis.edu/news/sunflowers-move-clock" },
  ],
  cay_keu_khi_khat: [
    { ref: "Khait, I. và cộng sự. Sounds emitted by plants under stress are airborne and informative", where: "Cell", year: "2023", url: "https://doi.org/10.1016/j.cell.2023.03.009" },
    { ref: "Stressed Plants ‘Cry’—and Some Animals Can Probably Hear Them (Khait và cộng sự, Cell 2023; cà chua, thuốc lá; ~35 tiếng/giờ khi thiếu nước, ~1 tiếng/giờ khi đủ nước; 20–100 kHz; cơ chế và việc động vật có nghe không còn chưa rõ)", where: "Scientific American", year: "2023", url: "https://www.scientificamerican.com/article/stressed-plants-cry-and-some-animals-can-probably-hear-them/" },
  ],
  mang_luoi_nam: [
    { ref: "Karst, J., Jones, M. D. & Hoeksema, J. D. Positive citation bias and overinterpreted results lead to misinformation on common mycorrhizal networks in forests", where: "Nature Ecology & Evolution", year: "2023", url: "https://doi.org/10.1038/s41559-023-01986-1" },
    { ref: "The “wood-wide web” concept, which has taken root in popular media, challenged by researchers (Karst, Jones & Hoeksema, Nature Ecology & Evolution 2023; mạng nấm có thật, nhưng chuyện chia thức ăn cho cây con còn ít bằng chứng ngoài rừng)", where: "ScienceDaily (tin của Đại học Alberta)", year: "2023", url: "https://sciencedaily.com/releases/2023/02/230213113740.htm" },
  ],
  la_sen_tu_sach: [
    { ref: "Self-Cleaning Materials: Inspiration (u nhỏ vài micromet + sáp nano; giữ không khí; giọt nước lăn mang theo bụi; sơn, ngói, vải)", where: "Scientific American", year: "không ghi năm", url: "https://www.scientificamerican.com/article/self-cleaning-materials-inspiration/" },
    { ref: "Barthlott, W. & Neinhuis, C. Purity of the sacred lotus, or escape from contamination in biological surfaces", where: "Planta", year: "1997", url: "https://doi.org/10.1007/s004250050096" },
  ],
  tan_cay_ngai_ngung: [
    { ref: "Some trees may ‘social distance’ to avoid disease (crown shyness; mô tả từ những năm 1920; giả thuyết gió làm cành cọ nhau; nguyên nhân chưa ngã ngũ)", where: "National Geographic", year: "2020", url: "https://www.nationalgeographic.com/science/article/tree-crown-shyness-forest-canopy" },
  ],
  hat_cha_la_2000_nam: [
    { ref: "Sallon, S. và cộng sự. Germination, genetics, and growth of an ancient date seed (320(5882): 1464)", where: "Science", year: "2008", url: "https://doi.org/10.1126/science.1153600" },
    { ref: "2,000 year old “Phoenix” seed rises from the ashes (Sallon và cộng sự, Science 2008; hạt ở Masada ~2.000 năm; gieo năm 2005, nảy mầm sau ~8 tuần; “Methuselah”; kỷ lục cũ là hạt sen ~1.300 năm)", where: "National Geographic", year: "2008", url: "https://www.nationalgeographic.com/science/article/2000-year-old-phoenix-seed-rises-from-the-ashes" },
  ],
  cay_lon_tu_khong_khi: [
    { ref: "What are plants made of? (van Helmont, ~400 năm trước, cây liễu 5 năm, đất gần như không nhẹ đi; phần lớn chất khô từ không khí, đất chỉ góp ít khoáng)", where: "Davidson Institute of Science Education (Weizmann Institute)", year: "2025", url: "https://davidson.org.il/read-experience/en/reasonabledoubt-en/what-plants-made-of" },
  ],
  pando_mot_cay: [
    { ref: "Pando (hơn 40.000 cây, 106 mẫu Anh ≈ 43 ha, gần 13 triệu pound, một dòng vô tính từ một hạt, sinh vật lớn nhất từng tìm thấy)", where: "USDA Forest Service, Fishlake National Forest", year: "không ghi năm", url: "https://www.fs.usda.gov/r04/fishlake/recreation/explore-forest/pando" },
    { ref: "Pando: A Forest of One (~6.000 tấn, sinh vật nặng nhất được biết; chung một bộ rễ)", where: "EarthDate", year: "không ghi năm", url: "https://www.earthdate.org/pando-a-forest-of-one" },
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
  "`ca_heo_co_ten`: thế giới Biển của An đã có ý “cá heo có tên” (`lib/world/bien.ts`), nên thẻ nói rõ đó là điều thế giới Biển đã kể và thêm phần mới: cách kiểm chứng (bản sao tiếng huýt bằng máy tính) và trí nhớ hơn 20 năm. Nghiên cứu “20 năm” làm với cá heo nuôi ở sáu cơ sở; thẻ nói đúng vậy. DOI hai bài gốc đã kiểm (08/11/2026).",
  "`chuot_cuoi`: “cao hơn mức tai người nghe được” là suy ra (tai người nghe tới khoảng 20 kHz; tiếng kêu của chuột khoảng 50 kHz); nguồn chỉ ghi “siêu âm 50 kHz”. Thẻ không nhắc chi tiết đo não.",
  "`khi_chai_long`: chỉ là mối liên hệ (đo hormone trong mẫu phân), thẻ nói rõ điều này.",
  "`duoi_cho_vay`: chi tiết lấy từ bài Nature News; DOI bài gốc trên Current Biology đã kiểm, chưa đọc toàn văn.",
  "`ngap_va_cuoi_lay`: “các nhà khoa học ở Anh” (nhóm Birkbeck, Đại học London) — nguồn chính là bài National Geographic; DOI hai bài gốc đã kiểm. Lưu ý: các nghiên cứu lặp lại sau này về chó ngáp theo người cho kết quả không đồng nhất; thẻ chỉ kể kết quả của nghiên cứu năm 2008.",
  "`cam_giac_kinh_ngac`: người tham gia là **người lớn tuổi**; thẻ ghi đúng vậy.",
  "`mui_mua`: thẻ không ghi con số độ nhạy của mũi với geosmin (các nguồn ghi khác nhau: 100 phần nghìn tỉ hay 0,4 phần tỉ).",
  "`mot_phut_ngam_may`: 500 tấn là phép tính ước lượng của USGS cho một đám mây tích 1 km³.",
  "`nguoi_dua_tin`: hai ví dụ (“lo có thể báo…”, “vui có thể báo…”) là ví dụ minh họa của người soạn, không phải câu trong bài báo.",
  "`goi_minh_bang_ten`: kết quả bài nói (bớt lo, người chấm chấm cao hơn) lấy từ bài của World Economic Forum mô tả thí nghiệm; trang của Đại học Michigan xác nhận ý chính. Ví dụ “Nam ơi” là minh họa của người soạn (bài gốc dùng “John”).",
  "`dem_dieu_biet_on`: mô tả theo bài của Greater Good (221 học sinh cấp hai, hai tuần).",
  "`truong_nhieu_cay`: so sánh giữa các **trường**, không phải giữa các bạn; một phần mối liên hệ được giải thích bởi khói xe.",
  "`dem_chim_15_phut`: thẻ ghi “đã có lần hơn 300.000 người”; trang Audubon (kiểm 08/11/2026) nay ghi gần đây hơn 450.000 người, nên câu trong thẻ vẫn đúng (là mức thấp hơn).",
  // Second half (pure knowledge)
  "`vooc_cha_va`: màu lông theo Animal Diversity Web (thân xám, cẳng tay và đuôi trắng, “tất” nâu đỏ); thẻ cố ý **không** nói chuyện ăn lá / dạ dày nhiều ngăn (thế giới Rừng đã có ở voọc mông trắng) và **không** ghi số cá thể ở Sơn Trà (các nguồn báo chí ghi khác nhau theo năm). Nguồn thứ hai là báo Việt Nam News, không phải tổ chức khoa học.",
  "`sao_la`: “rừng Vũ Quang” theo WWF; thẻ không ghi tỉnh và không ghi số cá thể còn lại (tránh giọng “sắp mất”). Sau kiểm chứng: năm 1992 người ta tìm thấy cặp sừng (không phải hộp sọ); ảnh năm 2013 là lần đầu sau 15 năm thấy sao la ở Việt Nam (thẻ không nhắc lần bắt được ở Lào năm 2010).",
  "`nhan_bien_bac_cuc`: “hơn 70.000 km mỗi năm” theo Phys.org; “có chú hơn 80.000” theo tóm tắt PNAS. Kỷ lục năm 2010 đã bị vượt: năm 2016 Đại học Newcastle ghi được một chú bay khoảng 96.000 km, nên thẻ nói “dài nhất từng đo được lúc ấy”.",
  "`gau_nuoc_vu_tru`: “phần lớn vẫn khỏe” là kết quả với chân không + tia vũ trụ; khi thêm tia cực tím Mặt Trời thì chỉ một số con sống — thẻ không nói chi tiết này.",
  "`ca_thoi_loi_chop_mat`: chưa mở được bản gốc PNAS; dùng tin của Penn State trên ScienceDaily. Thẻ không nói cá thòi lòi sống ở Việt Nam (chưa kiểm được nguồn uy tín).",
  "`than_lan_bay`: nghiên cứu quay phim loài Draco dussumieri ở Ấn Độ; câu “sống ở rừng nhiệt đới châu Á” là tổng quát cho chi Draco (chưa kiểm nguồn riêng cho Việt Nam nên thẻ không nhắc Việt Nam).",
  "`chim_ruoi_bay_lui`: con số nhịp tim/vỗ cánh là “có thể tới”, theo National Geographic.",
  "`set_hai_lan`: NWS ghi “5 giây ≈ 1 dặm”; “khoảng 3 giây ≈ 1 km” là người soạn đổi đơn vị (âm thanh đi ~343 m/giây). Thẻ nói nhiệt độ của **không khí** quanh tia sét (NWS nói rõ: tia sét làm nóng không khí).",
  "`tam_trai_dat`: “nóng như bề mặt Mặt Trời” National Geographic nói cho **ranh giới** lõi trong–lõi ngoài (~6.000 °C), không phải cho cả lõi trong (~5.200 °C); thẻ viết đúng như vậy.",
  "`everest_day_bien`: gần với ý “đá vôi từ sinh vật biển / hóa thạch / mảng trôi” trong thế giới Núi lửa, nhưng điều mới là **đỉnh Everest** từng là đáy biển; nguồn là trang của Đại học Bang Montana.",
  "`bui_sahara_amazon`: NASA nói lượng phosphorus “gần bằng lượng mất vì mưa và lũ”; thẻ viết “vì nước mưa cuốn trôi” để tránh chữ lũ.",
  "`nhat_trieu_vinh_bac_bo`: nguồn chính là trang tiếng Anh của Trung tâm Phối hợp Tìm kiếm Cứu nạn Hàng hải Việt Nam; nên đối chiếu thêm một giáo trình hải dương học Việt Nam nếu bố mẹ muốn chắc hơn.",
  "`trai_tim_diem_vuong`: “chưa tới 100 triệu năm tuổi” là ước lượng lúc đầu (2015) của nhóm New Horizons; nguồn là Astronomy Now, không phải trang NASA.",
  "`bui_sao`: Chandra nói “nhiều sắt trong cơ thể” đến từ siêu tân tinh, không phải tất cả; thẻ giữ chữ “nhiều phần”.",
  "`van_ly_truong_thanh`: từ **quỹ đạo gần** đôi khi chụp được bức tường bằng ống kính (ảnh của Leroy Chiao, 2004–2005), nên thẻ chỉ bác bỏ chuyện “thấy bằng mắt thường từ Mặt Trăng” và kể lời Dương Lợi Vĩ.",
  "`mang_luoi_nam`: mạng nấm nối rễ nhiều cây có thật, nhưng mới được vẽ bản đồ ở rất ít khu rừng (thẻ nói đúng vậy, không nói “đã được chứng minh”); còn chuyện cây “nói chuyện”, “gửi thức ăn cho cây con” đang được tranh luận. Thẻ dựa vào bài tổng quan của Karst và cộng sự (2023); đây vẫn là chủ đề các nhà khoa học đang tranh luận.",
  "`cay_keu_khi_khat`: mới là một nghiên cứu (2023) trong phòng thí nghiệm; thẻ nói rõ chưa biết tiếng kêu sinh ra thế nào và có con vật nào nghe thấy không.",
  "`pando_mot_cay`: USDA ghi “hơn 40.000 cây” và “gần 13 triệu pound” (~5.900 tấn); EarthDate ghi ~47.000 thân và ~6.000 tấn. Thẻ dùng “hơn 40.000” và “chừng 6.000 tấn”; không ghi tuổi (các ước lượng rất khác nhau).",
  "`cay_lon_tu_khong_khi`: không ghi con số cân nặng của cây liễu (nguồn đã kiểm không có).",
  "Tên chất hóa học trong mọi thẻ viết theo sách Khoa học tự nhiên 6 (chương trình 2018): hydrogen, carbon, oxygen, khí carbon dioxide, phosphorus (không viết “ô-xy”, “các-bon”, “khí các-bon-níc”, “phốt-pho”).",
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
  out +=
    empty.length > 0
      ? `> Bộ hoàn chỉnh sẽ có **${total} thẻ** ở ${SCIENCE_TOPIC_KEYS.length} chủ đề. Đây là **nửa đầu** (thẻ gắn với cảm xúc). Nửa sau (kiến thức thiên nhiên thuần: ${empty.map((t) => `${SCIENCE_TOPICS[t].emoji} ${SCIENCE_TOPICS[t].label}`).join(" · ")}) sẽ được thêm sau; chủ đề chưa có thẻ thì app chưa hiện.\n\n`
      : `> Bộ đủ **${total} thẻ** ở ${SCIENCE_TOPIC_KEYS.length} chủ đề: **nửa đầu** gắn với cảm xúc (🐾 🌿 🧠 💛 🔬) và **nửa sau** là kiến thức thiên nhiên thuần (🦎 🌋 🌌 🌱). Thẻ nửa sau không lặp lại điều An đã gặp trong các thế giới Rừng, Biển, Vũ trụ, Núi lửa.\n\n`;

  out += `## Sổ tay nhà khoa học là gì\n\n`;
  out += `Mỗi ngày, sau khi ghé Góc bình yên, An có thể tự mở một thẻ trong “Sổ tay nhà khoa học”: một điều thú vị, có nguồn, về động vật, thiên nhiên, Trái Đất, vũ trụ, cây cối, bộ não hay cảm xúc. Nửa đầu nối những thứ con yêu (động vật, rừng, biển, bầu trời) với cảm xúc; nửa sau là kiến thức khoa học thuần để con thấy thế giới thật kỳ diệu. Giọng văn là giọng **nhà khoa học nhí** (quan sát, ghi chép, thí nghiệm) như phần còn lại của Góc bình yên của An.\n\n`;
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
  out += `- **Nửa sau — đã bỏ hoặc thay khi soạn:** cực quang theo màu khí (thế giới Vũ trụ đã có cực quang); thủy triều do Mặt Trăng (thế giới Vũ trụ đã có, thay bằng thẻ nhật triều Vịnh Bắc Bộ); cây xấu hổ cụp lá (thế giới Rừng đã có); cây bắt ruồi “đếm” số lần chạm (gần với chuyện bẫy côn trùng); sao nơtron “một thìa nặng một tỉ tấn” (chỉ tìm được nguồn tạp chí, và thế giới Vũ trụ đã có sao nơtron); mưa kim cương trên Sao Thiên Vương/Hải Vương và “năm thiên hà” 230 triệu năm (để dành, đủ 10 thẻ); bông tuyết sáu cánh; khối lượng đám mây (đã có ở thẻ \`mot_phut_ngam_may\`); số cá thể sao la và voọc (tránh giọng “sắp mất”, số liệu đổi theo năm).\n`;
  return out;
}

if (process.argv[1]?.endsWith("field-notes-doc.cjs")) {
  mkdirSync("docs/binh-yen", { recursive: true });
  writeFileSync(DOC_FILE, render());
}
