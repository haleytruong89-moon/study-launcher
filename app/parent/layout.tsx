/** Room at the bottom of every parent page for the fixed tab bar. */
export default function ParentLayout({ children }: { children: React.ReactNode }) {
  return <div className="pb-24">{children}</div>;
}
