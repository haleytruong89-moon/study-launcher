import { describe, expect, it } from "vitest";
import {
  classifyUrl,
  hostMatchesDomain,
  isAllowed,
  normalizeDomainList,
  normalizeHost,
} from "@/extension/src/core/domains";
import { buildBlockedUrl, launcherOrigin, parseBlockedUrl } from "@/extension/src/core/blockedUrl";

const LAUNCHER = "study-launcher.vercel.app";

describe("normalizeHost", () => {
  it("lowercases, strips trailing dots, ports, schemes, paths and wildcards", () => {
    expect(normalizeHost("Example.COM")).toBe("example.com");
    expect(normalizeHost("example.com.")).toBe("example.com");
    expect(normalizeHost("example.com..")).toBe("example.com");
    expect(normalizeHost("example.com:8080")).toBe("example.com");
    expect(normalizeHost("https://Dictionary.Cambridge.org/dictionary/english")).toBe(
      "dictionary.cambridge.org",
    );
    expect(normalizeHost("*.khanacademy.org")).toBe("khanacademy.org");
    expect(normalizeHost(".khanacademy.org")).toBe("khanacademy.org");
    expect(normalizeHost("  tratu.soha.vn  ")).toBe("tratu.soha.vn");
    expect(normalizeHost("user:pass@example.com")).toBe("example.com");
  });

  it("converts IDN (any case) to punycode like the browser and DNR", () => {
    expect(normalizeHost("bücher.de")).toBe("xn--bcher-kva.de");
    expect(normalizeHost("BÜCHER.DE")).toBe("xn--bcher-kva.de");
    expect(normalizeHost("xn--bcher-kva.de")).toBe("xn--bcher-kva.de");
    expect(normalizeHost("tiếngviệt.vn")).toBe(new URL("http://tiếngviệt.vn").hostname);
  });

  it("rejects unusable input", () => {
    expect(normalizeHost("")).toBeNull();
    expect(normalizeHost("   ")).toBeNull();
    expect(normalizeHost("a b.com")).toBeNull();
    expect(normalizeHost("[::1]")).toBeNull();
    expect(normalizeHost("*.")).toBeNull();
    expect(normalizeHost("-bad-.com")).toBeNull();
  });
});

describe("normalizeDomainList", () => {
  it("drops invalid and single-label entries, dedupes and sorts", () => {
    expect(
      normalizeDomainList([
        "Khanacademy.org",
        "khanacademy.org.",
        "com",
        "localhost",
        "",
        "a b",
        "https://translate.google.com/",
        "*.duolingo.com",
      ]),
    ).toEqual(["duolingo.com", "khanacademy.org", "translate.google.com"]);
  });
});

describe("hostMatchesDomain", () => {
  it("matches the domain and its subdomains only", () => {
    expect(hostMatchesDomain("google.com", "google.com")).toBe(true);
    expect(hostMatchesDomain("www.google.com", "google.com")).toBe(true);
    expect(hostMatchesDomain("evilgoogle.com", "google.com")).toBe(false);
    expect(hostMatchesDomain("google.com.evil.com", "google.com")).toBe(false);
    expect(hostMatchesDomain("google.com", "translate.google.com")).toBe(false);
  });
});

describe("isAllowed", () => {
  const allow = ["translate.google.com", "example.com", "dictionary.cambridge.org", "bücher.de"];
  const ok = (url: string, blockAlways: string[] = []) => isAllowed(url, allow, blockAlways, LAUNCHER);

  it("an entry allows itself and its subdomains", () => {
    expect(ok("https://example.com/")).toBe(true);
    expect(ok("https://www.example.com/a?b=1")).toBe(true);
    expect(ok("https://translate.google.com/?sl=en&tl=vi")).toBe(true);
  });

  it("never allows a parent domain or a look-alike", () => {
    expect(ok("https://google.com/search?q=game")).toBe(false);
    expect(ok("https://www.google.com/")).toBe(false);
    expect(ok("https://evilexample.com/")).toBe(false);
    expect(ok("https://example.com.evil.com/")).toBe(false);
    expect(ok("https://www.youtube.com/watch?v=x")).toBe(false);
  });

  it("is case-insensitive and ignores trailing dots and ports", () => {
    expect(ok("HTTPS://WWW.EXAMPLE.COM/Path")).toBe(true);
    expect(ok("https://example.com./")).toBe(true);
    expect(ok("https://example.com:8443/")).toBe(true);
    expect(ok("http://example.com:80/")).toBe(true);
    expect(ok("https://evilexample.com:443/")).toBe(false);
  });

  it("matches IDN hosts in any form", () => {
    expect(ok("https://BÜCHER.de/x")).toBe(true);
    expect(ok("https://www.xn--bcher-kva.de/")).toBe(true);
  });

  it("uses the real host, not userinfo tricks", () => {
    expect(ok("https://example.com@evil.com/")).toBe(false);
    expect(ok("https://evil.com@example.com/")).toBe(true);
  });

  it("always allows the launcher, even with an empty allowlist", () => {
    expect(isAllowed(`https://${LAUNCHER}/today`, [], [], LAUNCHER)).toBe(true);
    expect(isAllowed(`https://${LAUNCHER}/blocked?u=https://x.com`, [], [], LAUNCHER)).toBe(true);
    expect(isAllowed("http://localhost:3000/today", [], [], "localhost")).toBe(true);
    expect(isAllowed("https://vercel.app/", [], [], LAUNCHER)).toBe(false);
  });

  it("blocks *.translate.goog even when allowlisted or not in blockAlways", () => {
    const sneaky = "https://www-youtube-com.translate.goog/?_x_tr_sl=auto&_x_tr_tl=vi";
    expect(isAllowed(sneaky, ["translate.goog"], [], LAUNCHER)).toBe(false);
    expect(isAllowed(sneaky, ["www-youtube-com.translate.goog"], ["translate.goog"], LAUNCHER)).toBe(
      false,
    );
    expect(isAllowed("https://translate.goog/", ["translate.goog"], [], LAUNCHER)).toBe(false);
  });

  it("blockAlways wins over allow", () => {
    expect(isAllowed("https://games.example.com/", ["example.com"], ["games.example.com"], LAUNCHER)).toBe(
      false,
    );
    expect(isAllowed("https://www.example.com/", ["example.com"], ["games.example.com"], LAUNCHER)).toBe(
      true,
    );
  });

  it("never hijacks browser-internal pages", () => {
    for (const url of [
      "chrome://settings/",
      "chrome://newtab/",
      "edge://settings/",
      "about:blank",
      "chrome-extension://abcdefghijklmnop/newtab.html",
      "devtools://devtools/bundled/inspector.html",
    ]) {
      expect(isAllowed(url, [], [], LAUNCHER)).toBe(true);
    }
  });

  it("blocks file:, data:, view-source:, javascript: and garbage while locked", () => {
    for (const url of [
      "file:///C:/Users/an/game.html",
      "data:text/html,<h1>hi</h1>",
      "view-source:https://example.com/",
      "javascript:alert(1)",
      "ftp://example.com/",
      "not a url",
      "",
    ]) {
      expect(isAllowed(url, allow, [], LAUNCHER)).toBe(false);
    }
  });

  it("blob: URLs follow their inner origin", () => {
    expect(isAllowed("blob:https://example.com/0b6c-1", allow, [], LAUNCHER)).toBe(true);
    expect(isAllowed("blob:https://youtube.com/0b6c-1", allow, [], LAUNCHER)).toBe(false);
    expect(isAllowed("blob:null/0b6c-1", allow, [], LAUNCHER)).toBe(false);
  });
});

describe("classifyUrl", () => {
  it("classifies web, internal and other URLs", () => {
    expect(classifyUrl("https://Example.com./x")).toEqual({ kind: "web", host: "example.com" });
    expect(classifyUrl("edge://newtab")).toEqual({ kind: "internal" });
    expect(classifyUrl("file:///tmp/a")).toEqual({ kind: "other" });
  });
});

describe("blocked URL", () => {
  const launcher = "https://study-launcher.vercel.app/today?x=1";

  it("uses only the launcher origin", () => {
    expect(launcherOrigin(launcher)).toBe("https://study-launcher.vercel.app");
    expect(launcherOrigin("http://localhost:3000/")).toBe("http://localhost:3000");
    expect(launcherOrigin("chrome://newtab")).toBeNull();
    expect(() => buildBlockedUrl("nope", "https://x.com")).toThrow();
  });

  it("appends the original URL raw (not encoded)", () => {
    expect(buildBlockedUrl(launcher, "https://youtube.com/watch?v=1&t=2#c")).toBe(
      "https://study-launcher.vercel.app/blocked?u=https://youtube.com/watch?v=1&t=2#c",
    );
  });

  it("round-trips &, #, ? and %-escapes, also after browser normalisation", () => {
    const originals = [
      "https://youtube.com/watch?v=abc&list=PL1&t=30s#comments",
      "https://example.com/a?b=1?c=2&d=%26e#frag?x&y",
      "https://example.com/",
      "http://example.com:8080/p%20q?r=s%23t",
      "https://xn--bcher-kva.de/#/route?x=1&y=2",
      "file:///C:/Users/an/game.html",
    ];
    for (const original of originals) {
      const built = buildBlockedUrl(launcher, original);
      expect(parseBlockedUrl(built)).toBe(original);
      expect(parseBlockedUrl(new URL(built).href)).toBe(original);
    }
  });

  it("returns null for other pages or an empty value", () => {
    expect(parseBlockedUrl("https://study-launcher.vercel.app/today")).toBeNull();
    expect(parseBlockedUrl("https://study-launcher.vercel.app/blocked?u=")).toBeNull();
    expect(parseBlockedUrl("https://study-launcher.vercel.app/blocked?x=1&u=a")).toBeNull();
    expect(parseBlockedUrl("https://study-launcher.vercel.app/blockedx?u=a")).toBeNull();
    expect(parseBlockedUrl("garbage")).toBeNull();
  });
});
