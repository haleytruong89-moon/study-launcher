import Link from "next/link";

/** Friendly 404 (review 12/11/2026). "/" sends each person to their own start page. */
export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 bg-bg px-6 py-10 text-ink">
      <h1 className="text-xl font-bold">Không tìm thấy trang này</h1>
      <p className="text-base text-ink/75">Có thể đường dẫn bị gõ nhầm hoặc trang đã được chuyển chỗ.</p>
      <div className="pt-2">
        <Link href="/" className="btn w-full bg-accent text-white">
          Về trang đầu
        </Link>
      </div>
    </main>
  );
}
