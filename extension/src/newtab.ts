import { LAUNCHER_URL } from "./config";

// A new tab always opens the child's "Hôm nay" (Chrome's home-page policy does not apply
// on Windows that is not joined to a domain, DESIGN section 7).
window.location.replace(`${LAUNCHER_URL}/today`);
