// ฝั่งแอป: เรียก Backend /api/chat-delete (ลบทีละข้อความ / ลบทั้งหมด) + แปลงข้อผิดพลาดเป็นข้อความไทย
// รับฟังก์ชันจาก App.jsx (getToken, fetch) เพื่อทดสอบได้โดยไม่ต้องมี Firebase
import { ENDPOINT, CLIENT_FALLBACK, REQUEST_TIMEOUT_MS } from "./config.js";

export class ChatDeleteError extends Error {
  constructor(message, kind) { super(message); this.name = "ChatDeleteError"; this.kind = kind; }
}

const MSG = {
  auth: "ต้องล็อกอินด้วย Google ก่อนจึงจะลบข้อความได้ (บัญชี Guest ใช้ไม่ได้)",
  expired: "เซสชันหมดอายุ ลองออกจากระบบแล้วเข้าใหม่อีกครั้ง",
  notReady: "เซิร์ฟเวอร์ยังไม่พร้อมลบข้อความ (ผู้ดูแลต้องตั้งค่า Firebase Admin ก่อน) — ยังไม่มีอะไรถูกลบ",
  network: "เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ ตรวจอินเทอร์เน็ตแล้วลองใหม่ — ยังไม่มีอะไรถูกลบ",
};

export function makeChatDeleteApi({ getToken, fetchFn, endpoint = ENDPOINT, timeoutMs = REQUEST_TIMEOUT_MS, fallback = null, useFallback = CLIENT_FALLBACK } = {}) {
  async function viaServer(body) {
    let token;
    try { token = await getToken(); } catch (e) { throw new ChatDeleteError(MSG.auth, "auth"); }
    if (!token) throw new ChatDeleteError(MSG.auth, "auth");
    const f = fetchFn || ((...a) => fetch(...a));
    const ctl = typeof AbortController !== "undefined" ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
    let res;
    try {
      res = await f(endpoint, { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify(body), signal: ctl ? ctl.signal : undefined });
    } catch (e) {
      throw new ChatDeleteError(MSG.network, "network");
    } finally { if (timer) clearTimeout(timer); }
    let data = null;
    try { data = await res.json(); } catch (e) { data = null; }
    if (res.ok) return data && typeof data === "object" ? data : { ok: true };
    const st = res.status;
    if (st === 501 || st === 404 || st === 405) throw new ChatDeleteError(MSG.notReady, "server-not-ready");
    if (st === 401) throw new ChatDeleteError(MSG.expired, "auth");
    const text = data && data.error ? String(data.error) : "";
    if (st === 403 || st === 400) throw new ChatDeleteError(text || "ลบไม่ได้", st === 403 ? "forbidden" : "bad-request");
    throw new ChatDeleteError("เซิร์ฟเวอร์ผิดพลาด (" + st + ")" + (text ? ": " + text : "") + " — ลองใหม่อีกครั้ง", "server");
  }

  async function run(body, fb) {
    try { return await viaServer(body); }
    catch (e) {
      if (useFallback && fallback && e instanceof ChatDeleteError && (e.kind === "server-not-ready" || e.kind === "network")) return fb();
      throw e;
    }
  }

  return {
    deleteOne: (peer, messageId) => run({ action: "deleteOne", peer, messageId }, () => fallback.deleteOne(peer, messageId)),
    deleteAll: (peer) => run({ action: "deleteAll", peer }, () => fallback.deleteAll(peer)),
  };
}
