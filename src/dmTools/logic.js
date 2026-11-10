// DM Tools — ตรรกะล้วน (ไม่แตะ Firebase/DOM/React) เพื่อทดสอบง่าย
import { MAX_BLOCKS, MAX_CUSTOM_SOUND_BYTES, ALLOWED_SOUND_TYPES } from "./config.js";

export const pairIdOf = (a, b) => [a, b].sort().join("_");

const toMs = t => {
  if (t == null) return null;
  if (typeof t === "number") return Number.isFinite(t) ? t : null;
  if (typeof t.toMillis === "function") { try { return t.toMillis(); } catch (e) { return null; } }
  return null;
};

// ── บล็อก ──
export function normalizeBlocks(d) {
  const list = d && Array.isArray(d.list) ? d.list.filter(x => typeof x === "string" && x) : [];
  return Array.from(new Set(list)).slice(0, MAX_BLOCKS);
}
export function toggleBlock(list, uid, on) {
  const cur = normalizeBlocks({ list });
  if (!uid || typeof uid !== "string") return cur;
  if (on) return cur.includes(uid) ? cur : cur.length >= MAX_BLOCKS ? cur : [...cur, uid];
  return cur.filter(x => x !== uid);
}

// ── ลบประวัติ (เฉพาะฝั่งเรา): เก็บเวลาที่ลบไว้ที่ dms/{pair}.clearedAt.{uid} แล้วซ่อนข้อความที่เก่ากว่านั้น ──
// คืนเวลา (ms) หรือ 0 ถ้าไม่เคยลบ; ถ้ามีคีย์แต่ค่ายังเป็น null (กำลังรอเซิร์ฟเวอร์) = ใช้ now
export function clearedAtMs(conv, myUid, now = Date.now()) {
  const m = conv && conv.clearedAt;
  if (!m || typeof m !== "object" || !(myUid in m)) return 0;
  const v = toMs(m[myUid]);
  return v == null ? now : v;
}
// บทสนทนานี้ควรโผล่ในรายการของเราไหม (ลบแล้วและยังไม่มีข้อความใหม่ = ซ่อน)
export function visibleConversation(conv, myUid, now = Date.now()) {
  const c = clearedAtMs(conv, myUid, now);
  if (!c) return true;
  const last = toMs(conv.lastT);
  return last != null && last > c;
}

// ── เสียงแจ้งเตือน: ตัดสินว่าสแนปช็อตนี้มีข้อความใหม่ที่ควรส่งเสียงไหม ──
//   prev   = Map pairId→lastT(ms) ที่เห็นครั้งก่อน (null = ยังไม่เคยเห็นสแนปช็อตเลย → แค่จดค่า ไม่ส่งเสียง)
//   คืน { play:boolean, seen:Map }
export function detectIncoming(prev, convs, { myUid, blocked, prefs, activePair, pageVisible = true, now = Date.now() }) {
  const seen = new Map();
  let play = false;
  const first = !prev; // สแนปช็อตแรกหลังเปิดแอป = แค่จดค่า ไม่ส่งเสียง
  for (const c of convs || []) {
    const last = toMs(c.lastT) || 0;
    seen.set(c.id, last);
    if (first) continue;
    const before = prev.has(c.id) ? prev.get(c.id) : 0;
    if (last <= before) continue;
    if (!c.lastFrom || c.lastFrom === myUid) continue;
    const other = (c.uids || []).find(x => x !== myUid);
    if (!other) continue;
    if (blocked && blocked.has(other)) continue;
    if (prefs && prefs.mutedPeers && prefs.mutedPeers[other]) continue;
    if (last <= clearedAtMs(c, myUid, now)) continue;
    if (pageVisible && activePair && activePair === c.id) continue; // กำลังเปิดแชทนี้อยู่ ไม่ต้องส่งเสียงซ้ำ
    play = true;
  }
  return { play: play && !!(prefs && prefs.soundOn), seen };
}

// ── ไฟล์เสียงที่อัปโหลดเอง ──
export function validateSoundFile(file) {
  if (!file || typeof file !== "object") return { ok: false, reason: "ไม่พบไฟล์" };
  const name = file.name || "ไฟล์";
  if (!file.size) return { ok: false, reason: name + ": ไฟล์ว่างเปล่า" };
  const type = String(file.type || "").toLowerCase();
  if (!ALLOWED_SOUND_TYPES.includes(type) && !(!type && /\.(mp3|wav|ogg|m4a|aac|webm)$/i.test(name))) return { ok: false, reason: name + ": รองรับเฉพาะไฟล์เสียง MP3, WAV, OGG, M4A" };
  if (file.size > MAX_CUSTOM_SOUND_BYTES) return { ok: false, reason: name + ": ไฟล์ใหญ่เกิน " + Math.round(MAX_CUSTOM_SOUND_BYTES / 1024) + " KB" };
  return { ok: true };
}
