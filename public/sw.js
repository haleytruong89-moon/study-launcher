/* Study Launcher service worker. Intentionally empty in slice S0:
 * it only makes the app installable. Web Push handlers arrive in slice S5. */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));
