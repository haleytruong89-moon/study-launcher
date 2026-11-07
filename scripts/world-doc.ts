/**
 * Writes docs/world/<KEY>.md, the reading copy of a world pack for parents and An.
 * Run: node_modules/.bin/esbuild scripts/world-doc.ts --bundle --platform=node --alias:@=. --outfile=/tmp/world-doc.cjs && node /tmp/world-doc.cjs
 * tests/world.test.ts checks every string of each pack appears in its doc.
 */
import { writeFileSync } from "node:fs";
import { WORLDS } from "@/lib/world/catalog";
import type { Icon, World } from "@/lib/world/types";

export const docFile = (key: string) => `docs/world/${key.toUpperCase()}.md`;

const AREA = { feel: "Cảm xúc", study: "Học tập", skill: "Kỹ năng", play: "Vui chơi" } as const;
const ic = (i: Icon) => ("emoji" in i ? i.emoji : "(hình vẽ)");

function render(w: World): string {
  let out = `# Thế giới "${w.name}" — nội dung để bố mẹ và An đọc lại\n\n`;
  out += `> Sinh từ \`lib/world/${w.key}.ts\` bằng \`scripts/world-doc.ts\`; test \`tests/world.test.ts\` kiểm hai file khớp nhau. Sửa chữ ở file \`.ts\` rồi sinh lại. Mã (\`key\`) không bao giờ đổi.\n`;
  out += `> Mỗi thứ có 3 điều thú vị: điều 1 mở khi có lần đầu, điều 2 và 3 mở khi có lại.\n\n**Lời mở đầu:** ${w.intro}\n\n`;
  for (const p of ["feel", "study", "skill", "play"] as const) {
    out += `## Xong mảng ${AREA[p]} → ${w.pillarNames[p]}\n\n`;
    for (const t of w.things[p]) {
      out += `### ${ic(t.icon)} ${t.name} (\`${t.key}\`)\n\n`;
      t.facts.forEach((f, i) => (out += `${i + 1}. ${f}\n`));
      out += `\n- **Nhiệm vụ ngoài đời:** ${t.mission}\n- **Tối nay dạy cả nhà:** ${t.teach}\n\n`;
    }
  }
  out += `## ${w.visitorWord[0]?.toUpperCase()}${w.visitorWord.slice(1)} ghé thăm\n\n`;
  for (const a of w.animals) {
    out += `### ${ic(a.icon)} ${a.name} (\`${a.key}\`) — đến vì ${a.because}\n\nĐiều kiện: ${a.needs.map((n) => `${n.n} thứ có nhãn \`${n.tag}\``).join(" + ")}\n\n`;
    a.facts.forEach((f, i) => (out += `${i + 1}. ${f}\n`));
    out += `\n- **Nhiệm vụ ngoài đời:** ${a.mission}\n- **Tối nay dạy cả nhà:** ${a.teach}\n\n`;
  }
  return out;
}

if (process.argv[1]?.endsWith("world-doc.cjs")) {
  for (const w of Object.values(WORLDS)) writeFileSync(docFile(w.key), render(w));
}
