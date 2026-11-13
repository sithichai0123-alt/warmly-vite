// DM Unread — ตรรกะล้วน (ไม่แตะ Firebase/DOM/React)
const toMs = t => {
  if (t == null) return null;
  if (typeof t === "number") return Number.isFinite(t) ? t : null;
  if (typeof t.toMillis === "function") { try { return t.toMillis(); } catch (e) { return null; } }
  return null;
};

// เวลาที่เราลบประวัติ (ฝั่งเรา) — ข้อความเก่ากว่านี้ไม่นับเป็นข้อความใหม่
function clearedMs(c, myUid) {
  const m = c && c.clearedAt;
  if (!m || typeof m !== "object" || !(myUid in m)) return 0;
  const v = toMs(m[myUid]);
  return v == null ? Number.MAX_SAFE_INTEGER : v; // กำลังลบอยู่ (ยังรอเซิร์ฟเวอร์) = ถือว่าลบหมด
}

// คืน { byPair: {pairId:true}, count } — count = จำนวน "คนที่ส่งข้อความใหม่มา" (ไม่ใช่จำนวนข้อความ)
//   อ่านแล้ว = เวลาข้อความล่าสุด <= max(เวลาที่เปิดอ่านล่าสุด, เวลาเริ่มใช้ฟีเจอร์)
export function computeUnread(convs, { myUid, readMap = {}, since = 0, blocked } = {}) {
  const byPair = {};
  let count = 0;
  for (const c of convs || []) {
    if (!c || !c.id) continue;
    const last = toMs(c.lastT);
    if (last == null) continue;
    if (!c.lastFrom || c.lastFrom === myUid) continue;           // ข้อความล่าสุดเราส่งเอง
    const other = (c.uids || []).find(x => x !== myUid);
    if (!other) continue;
    if (blocked && blocked.has(other)) continue;                  // บล็อกอยู่ = ไม่แจ้ง
    if (last <= clearedMs(c, myUid)) continue;                    // ลบประวัติแล้ว
    const seenAt = Math.max(Number(readMap[c.id]) || 0, since || 0);
    if (last <= seenAt) continue;
    byPair[c.id] = true; count++;
  }
  return { byPair, count };
}

export function parseReadState(raw) {
  try {
    const o = JSON.parse(raw);
    if (!o || typeof o !== "object") return { since: 0, read: {} };
    const read = {};
    if (o.read && typeof o.read === "object") for (const k of Object.keys(o.read)) { const v = Number(o.read[k]); if (Number.isFinite(v)) read[k] = v; }
    return { since: Number.isFinite(Number(o.since)) ? Number(o.since) : 0, read };
  } catch (e) { return { since: 0, read: {} }; }
}

export function markReadState(state, pairId, ms) {
  if (!pairId) return state;
  const cur = Number(state.read[pairId]) || 0;
  if (ms <= cur) return state;
  return { since: state.since, read: { ...state.read, [pairId]: ms } };
}

export const badgeText = n => (n > 99 ? "99+" : String(n));
