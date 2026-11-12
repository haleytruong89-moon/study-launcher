import type { Metadata } from "next";
import Link from "next/link";

/**
 * Privacy policy of the Study Launcher browser extension (S6, store listing). Public, no login,
 * indexable (the stores' reviewers open it). Every statement here was checked against
 * extension/src/* and app/api/ext/* on 12/11/2026 — update this page whenever they change what
 * is sent or stored (docs/store/LISTING.md lists the same facts for the stores' forms).
 */
export const metadata: Metadata = {
  title: "Chính sách riêng tư — Study Launcher",
  description: "Extension Study Launcher gửi gì, lưu gì, ai xem được và cách xóa. Privacy policy of the Study Launcher browser extension.",
  robots: { index: true, follow: true },
};

const UPDATED = "12/11/2026";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-2">
      <h2 id={id} className="text-lg font-bold">
        {title}
      </h2>
      {children}
    </section>
  );
}

export default function PrivacyPolicyPage() {
  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-7 px-5 py-10 text-base leading-relaxed">
      <header className="flex flex-col gap-2">
        <span className="text-xs font-bold tracking-wider text-ink/70 uppercase">Study Launcher</span>
        <h1 className="text-2xl font-bold">Chính sách riêng tư</h1>
        <p className="text-sm text-ink/70">
          Cập nhật: {UPDATED} · Áp dụng cho extension “Study Launcher” (Chrome, Edge) và ứng dụng web đi kèm. <a href="#english" className="font-semibold text-accent underline">English version below</a>
        </p>
      </header>

      <Section id="ai" title="1. Ai làm extension này, dùng để làm gì">
        <p>
          Study Launcher là ứng dụng <strong>riêng của một gia đình</strong>: bố mẹ cài lên laptop của con mình để khi đang giờ học, trình duyệt chỉ mở các trang học bố mẹ đã cho phép; xong bài tập thì web mở lại theo luật của gia đình. Extension không dành
          cho người ngoài gia đình, không bán, không có quảng cáo.
        </p>
        <p>
          Người quản lý dữ liệu là <strong>bố mẹ trong gia đình</strong> (cũng là người đăng extension lên cửa hàng). Liên hệ: địa chỉ email nhà phát triển ghi trên trang của extension ở Chrome Web Store / Microsoft Edge Add-ons.
        </p>
      </Section>

      <Section id="gui" title="2. Extension gửi gì đi, gửi cho ai">
        <p>
          Extension chỉ nói chuyện với <strong>một máy chủ duy nhất</strong>: ứng dụng Study Launcher của gia đình (địa chỉ cố định lúc đóng gói, hiện là <code>study-launcher-nine.vercel.app</code>). Không gửi cho bên thứ ba nào khác.
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Hỏi trạng thái, khoảng 30 giây một lần:</strong> gửi <em>mã thiết bị</em> (một chuỗi ngẫu nhiên nhận được lúc ghép máy) và một thông tin có/không: extension có được phép chạy trong cửa sổ ẩn danh/InPrivate không. Máy chủ trả lời: đang khóa hay mở, danh
            sách trang được mở, mở đến mấy giờ. Máy chủ ghi lại <em>lần cuối laptop hỏi</em>. Lần hỏi này <strong>không</strong> kèm địa chỉ trang nào con đang xem.
          </li>
          <li>
            <strong>Khi đang khóa và con mở một trang ngoài danh sách:</strong> trình duyệt được chuyển sang trang “Đang giờ học” của ứng dụng, địa chỉ trang bị chặn nằm trong đường link của trang đó (<code>/blocked?u=…</code>) để con biết trang nào bị chặn. Ứng dụng{" "}
            <strong>không lưu</strong> địa chỉ này, trừ khi con bấm “Xin bố mẹ mở trang này” — khi đó lưu địa chỉ trang và lý do con gõ (nếu có) để bố mẹ trả lời. Như mọi trang web, nhà cung cấp máy chủ (Vercel) có thể ghi nhật ký truy cập kỹ thuật ngắn hạn, gồm
            đường link được mở.
          </li>
          <li>
            <strong>Khi một khung nhỏ bên trong trang học bị chặn</strong> (ví dụ một phần của Google Meet đến từ một địa chỉ khác cùng trang chủ): gửi địa chỉ gốc của trang học và địa chỉ của khung bị chặn, mỗi địa chỉ tối đa 1 lần/giờ. Máy chủ chỉ giữ lại khi khung
            đó cùng trang chủ với trang học, chưa được phép, và chưa hỏi trong 7 ngày (tối đa 20 lần/ngày) — khi đó lưu thành một yêu cầu “Tự phát hiện” để bố mẹ quyết định mở hay không. Các trường hợp khác bị bỏ qua, không lưu.
          </li>
          <li>
            <strong>Khi extension bị gỡ:</strong> trình duyệt mở một địa chỉ của ứng dụng kèm <em>mã băm SHA-256</em> của mã thiết bị (không phải mã thiết bị). Máy chủ ghi lại “extension bị gỡ” và báo cho bố mẹ.
          </li>
          <li>
            <strong>Lúc ghép máy:</strong> trang “Ghép máy” của ứng dụng (con đã đăng nhập) chuyển mã thiết bị cho extension. Máy chủ chỉ giữ mã băm của mã thiết bị và tên laptop gõ ở trang đó (mặc định “Laptop”).
          </li>
        </ul>
      </Section>

      <Section id="khong" title="3. Extension KHÔNG làm gì">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Không đọc nội dung trang web</strong>: không đọc chữ, ảnh, ô nhập, mật khẩu, cookie, tin nhắn. Phần chạy trong trang (content script) chỉ chạy trên trang của chính ứng dụng Study Launcher, để nhận mã ghép máy.
          </li>
          <li>
            <strong>Không gửi lịch sử duyệt web.</strong> Extension xem địa chỉ của tab (quyền “tabs”) ngay trên máy để quyết định chặn hay cho qua và để mở trang “Việc hôm nay” khi mở tab mới; danh sách tab không được gửi đi.
          </li>
          <li>Không có quảng cáo, không có công cụ thống kê/theo dõi (analytics), không bán hay chia sẻ dữ liệu, không dùng dữ liệu để chấm điểm tín dụng hay mục đích nào ngoài việc khóa/mở web cho con.</li>
          <li>Không tải và chạy mã từ xa: toàn bộ mã nằm trong gói extension đã được cửa hàng duyệt.</li>
        </ul>
      </Section>

      <Section id="luu-may" title="4. Lưu gì trên máy">
        <p>
          Trong bộ nhớ riêng của extension trên trình duyệt: mã thiết bị, trạng thái đang khóa/mở, danh sách trang được mở và trang luôn chặn, giờ hết mở, số lần hỏi máy chủ thất bại liên tiếp. Không lưu lịch sử duyệt web. Gỡ extension thì trình duyệt xóa hết
          phần này.
        </p>
      </Section>

      <Section id="luu-may-chu" title="5. Lưu ở đâu, ai xem được">
        <p>
          Dữ liệu nằm trong cơ sở dữ liệu <strong>riêng của gia đình</strong> (Supabase, máy chủ ở Singapore) và ứng dụng chạy trên Vercel — hai dịch vụ hạ tầng do gia đình tự thuê, không dùng chung với ai. Mỗi bảng đều bật phân quyền theo hàng (RLS).
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Bố mẹ trong gia đình</strong> xem được: danh sách laptop đã ghép (tên laptop, lần cuối hỏi máy chủ, có được chạy ẩn danh không), các yêu cầu mở trang (địa chỉ, lý do, trả lời), các lần “extension bị gỡ” / “mở ứng dụng mà không có extension”.
          </li>
          <li>
            <strong>Con</strong> chỉ xem được yêu cầu mở trang của chính mình, không xem được của anh/chị/em.
          </li>
          <li>Không ai ngoài gia đình được cấp quyền xem. Thông báo cho bố mẹ đi qua dịch vụ thông báo đẩy của điện thoại bố mẹ (ví dụ của Apple) theo cách mọi thông báo web đi qua.</li>
        </ul>
      </Section>

      <Section id="xoa" title="6. Giữ bao lâu, xóa thế nào">
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            <strong>Gỡ một laptop:</strong> bố mẹ vào Thiết bị → “Gỡ máy”. Mã thiết bị hết hiệu lực ngay; extension trên máy đó không lấy được gì nữa.
          </li>
          <li>
            <strong>Gỡ extension</strong> khỏi trình duyệt: mọi thứ extension lưu trên máy bị xóa.
          </li>
          <li>
            Dữ liệu trên máy chủ (laptop, yêu cầu mở trang, nhật ký) được giữ đến khi bố mẹ xóa. Muốn xóa, liên hệ bố mẹ — người quản lý cơ sở dữ liệu của gia đình — để xóa từng mục hoặc xóa toàn bộ dự án.
          </li>
        </ul>
      </Section>

      <Section id="doi" title="7. Khi chính sách thay đổi">
        <p>Nếu extension gửi hoặc lưu thêm điều gì, trang này được cập nhật trước khi bản mới lên cửa hàng, kèm ngày cập nhật ở đầu trang.</p>
      </Section>

      <hr className="border-ink/15" />

      <section id="english" lang="en" aria-labelledby="en-title" className="flex flex-col gap-3">
        <h2 id="en-title" className="text-xl font-bold">
          Privacy policy (English)
        </h2>
        <p className="text-sm text-ink/70">Last updated: 12 November 2026. Applies to the “Study Launcher” browser extension (Chrome, Edge) and its companion web app.</p>
        <p>
          <strong>Who and why.</strong> Study Launcher is a <strong>private family tool</strong>. Parents install it on their own children’s laptops so that during study time the browser only opens study sites the parents allowed. It is not offered to the
          public, has no ads and is not sold. The parents (who also publish the extension) control the data; contact them through the developer e-mail on the extension’s store page.
        </p>
        <p>
          <strong>What is sent, and to whom.</strong> The extension talks to <strong>one server only</strong>: the family’s own Study Launcher web app (address fixed at build time, currently <code>study-launcher-nine.vercel.app</code>).
        </p>
        <ul className="flex list-disc flex-col gap-2 pl-5">
          <li>
            About every 30 seconds it sends a random <em>device token</em> (received when the laptop is paired) and whether it may run in incognito/InPrivate windows. It receives whether the web is locked, the list of allowed sites and until when it is
            open. The server records when the laptop last checked in. No page addresses are sent with this check.
          </li>
          <li>
            While locked, a navigation to a site that is not allowed is redirected to the app’s “study time” page with the blocked address in that page’s link (<code>/blocked?u=…</code>). The app does not store it unless the child taps “ask my parents to
            open this page”; then the address and the child’s optional reason are stored for the parents to answer. Like any website, the hosting provider (Vercel) may keep short-lived technical access logs that include the requested link.
          </li>
          <li>
            If a frame inside an allowed study page is blocked, the extension reports the page’s origin and the frame’s address (each host at most once an hour). The server keeps it only if the frame is from the same site as the page, still blocked and not
            asked about in the last 7 days (max 20 a day), as a request the parents answer; otherwise it is discarded.
          </li>
          <li>When the extension is removed, the browser opens an app address carrying the SHA-256 hash of the device token (never the token). The server records the removal and notifies the parents.</li>
          <li>At pairing, the app’s pairing page (child signed in) hands the device token to the extension. The server keeps only the token’s hash and the laptop name typed on that page (default “Laptop”).</li>
        </ul>
        <p>
          <strong>What it does not do.</strong> It does not read page content (text, images, form fields, passwords, cookies, messages); its content script runs only on the Study Launcher app’s own pages, to receive the pairing token. It does not send
          browsing history: tab addresses are checked locally to decide what to block and to open “today’s tasks” in new tabs. No ads, no analytics or tracking, no selling or sharing of data, no use for any purpose other than locking/unlocking the web for
          the family’s children, no remote code.
        </p>
        <p>
          <strong>Stored on the laptop.</strong> In the extension’s own storage: the device token, locked/open state, allowed and always-blocked sites, open-until time and the count of consecutive failed checks. No browsing history. Removing the extension
          deletes it.
        </p>
        <p>
          <strong>Stored on the server, and who can see it.</strong> In the family’s own database (Supabase, Singapore region) behind the family’s own app (Vercel), with row-level security on every table. Parents of the family see paired laptops (name,
          last check-in, incognito allowed), page requests (address, reason, answer) and “extension removed / app opened without the extension” events. A child sees only their own page requests. Nobody outside the family has access. Notifications to the
          parents pass through their phone’s web-push service (e.g. Apple’s), like any web notification.
        </p>
        <p>
          <strong>Retention and deletion.</strong> Parents can remove a laptop (“Gỡ máy”), which revokes its token at once. Removing the extension deletes its local data. Server data is kept until the parents delete it; contact them to delete single
          records or the whole project.
        </p>
        <p>
          <strong>Changes.</strong> If the extension starts sending or storing anything else, this page is updated before the new version is published, with the date at the top.
        </p>
      </section>

      <footer className="text-sm text-ink/70">
        <Link href="/today" className="font-semibold text-accent underline">
          Về Study Launcher
        </Link>
      </footer>
    </main>
  );
}
