// Builds the browser extension into extension/dist and zips it to
// public/downloads/study-launcher-extension.zip (served by the app for the parent to download).
// The Launcher address is baked in from NEXT_PUBLIC_APP_URL (fallback: production URL), so the
// extension never trusts an address coming from a web page.
import { build } from "esbuild";
import { zipSync } from "fflate";
import { copyFileSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "extension");
const dist = join(src, "dist");
const zipPath = join(root, "public", "downloads", "study-launcher-extension.zip");

let launcher = "https://study-launcher-nine.vercel.app";
try {
  if (process.env.NEXT_PUBLIC_APP_URL) launcher = new URL(process.env.NEXT_PUBLIC_APP_URL).origin;
} catch {
  /* keep the fallback */
}

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });

await build({
  entryPoints: ["background", "content", "newtab", "popup"].map((n) => join(src, "src", `${n}.ts`)),
  outdir: dist,
  bundle: true,
  format: "iife",
  target: "chrome120",
  minify: false,
  legalComments: "none",
  define: { __LAUNCHER_URL__: JSON.stringify(launcher) },
  logLevel: "warning",
});

for (const f of readdirSync(join(src, "static"))) copyFileSync(join(src, "static", f), join(dist, f));

const manifest = JSON.parse(readFileSync(join(src, "manifest.json"), "utf8"));
manifest.content_scripts[0].matches = [`${launcher}/*`];
writeFileSync(join(dist, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");

const files = {};
for (const f of readdirSync(dist)) {
  const p = join(dist, f);
  if (statSync(p).isFile()) files[`study-launcher-extension/${relative(dist, p)}`] = readFileSync(p);
}
mkdirSync(dirname(zipPath), { recursive: true });
writeFileSync(zipPath, zipSync(files, { level: 9 }));
console.log(`extension built for ${launcher} -> ${relative(root, zipPath)}`);
