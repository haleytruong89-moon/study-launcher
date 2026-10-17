/** Returned when the request never got an answer (the server may still have saved it). */
export const NETWORK_ERROR = "Mất kết nối mạng, thử lại sau.";

/** Browser helper for the parent forms: sends JSON, returns a Vietnamese error message or null. */
export async function sendJson(method: "POST" | "PUT" | "PATCH", url: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (res.ok) return null;
    const data = (await res.json().catch(() => null)) as { error?: string } | null;
    return data?.error ?? "Có lỗi, thử lại sau.";
  } catch {
    return NETWORK_ERROR;
  }
}
