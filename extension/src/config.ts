/** Fixed when the extension is built (scripts/build-extension.mjs). Never taken from a page. */
declare const __LAUNCHER_URL__: string;
export const LAUNCHER_URL: string = __LAUNCHER_URL__;

/** Messages between the Launcher page, the content script and the background worker. */
export const PAGE_SOURCE = "study-launcher-page";
export const EXT_SOURCE = "study-launcher-ext";
export const TOKEN_RE = /^[A-Za-z0-9_-]{20,200}$/;
