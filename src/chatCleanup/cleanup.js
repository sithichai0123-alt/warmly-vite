// Chat Cleanup — ตรรกะลบข้อความเก่า (รับเครื่องมือ Firestore จากแอป จึงไม่ import firebase ในไฟล์นี้)
//
// ความปลอดภัย: ลบได้เฉพาะ "แชทรวม" (groupChat) และ "แชทห้องเสียง" (voiceRooms/{id}/chat) เท่านั้น
//   → แชทส่วนตัว (dms/...), ประวัติเหรียญ (ledger), ผู้ใช้, ห้อง ฯลฯ ถูกปฏิเสธที่นี่ ไม่มีทางถูกลบ
import { CHAT_CLEANUP_ENABLED, CHAT_KEEP_LATEST, CHAT_TRIM_MIN_INTERVAL_MS, CHAT_PURGE_ON_ROOM_CLOSE, CHAT_RETENTION_DAYS } from "./config.js";

const BATCH = 400; // ต่ำกว่าขีดจำกัด 500 ของ Firestore ต่อ batch

// path ที่อนุญาตให้ลบ
export function isCleanablePath(path) {
  if (!Array.isArray(path) || path.some(p => typeof p !== "string" || !p || p.includes("/"))) return false;
  if (path.length === 1) return path[0] === "groupChat";
  if (path.length === 3) return path[0] === "voiceRooms" && path[2] === "chat";
  return false;
}

export function makeChatCleanup(deps) {
  const { db, collection, query, orderBy, limit, where, getDocs, getCountFromServer, writeBatch } = deps;
  const last = new Map();      // path → เวลาที่ตรวจล่าสุด
  const inflight = new Set();  // path ที่กำลังทำอยู่

  async function deleteDocs(docs) {
    for (let i = 0; i < docs.length; i += BATCH) {
      const b = writeBatch(db);
      docs.slice(i, i + BATCH).forEach(d => b.delete(d.ref));
      await b.commit();
    }
  }

  // ลบข้อความที่เกิน keep (เก่าสุดก่อน) — คืนจำนวนที่ลบ
  async function trim(path, opts = {}) {
    if (!CHAT_CLEANUP_ENABLED || !isCleanablePath(path)) return { deleted: 0, skipped: "off" };
    const keep = Math.max(1, opts.keep || CHAT_KEEP_LATEST);
    const key = path.join("/");
    const now = (opts.now !== undefined ? opts.now : Date.now());
    if (inflight.has(key)) return { deleted: 0, skipped: "busy" };
    if (!opts.force && last.has(key) && now - last.get(key) < CHAT_TRIM_MIN_INTERVAL_MS) return { deleted: 0, skipped: "throttled" };
    last.set(key, now); inflight.add(key);
    let deleted = 0;
    try {
      const col = collection(db, ...path);
      // กฎอายุ (ถ้าเปิด): ลบข้อความที่เก่ากว่า N วัน
      if (CHAT_RETENTION_DAYS > 0) {
        const cutoff = new Date(now - CHAT_RETENTION_DAYS * 86400000);
        for (let r = 0; r < 5; r++) {
          const old = await getDocs(query(col, where("t", "<", cutoff), orderBy("t", "asc"), limit(BATCH)));
          if (old.empty) break;
          await deleteDocs(old.docs); deleted += old.docs.length;
          if (old.docs.length < BATCH) break;
        }
      }
      // กฎจำนวน: นับทั้งหมดก่อน (ค่าอ่านถูก) เกิน keep จึงค่อยดึงตัวที่เก่าที่สุดมาลบ
      for (let r = 0; r < 5; r++) {
        const total = (await getCountFromServer(col)).data().count;
        const excess = total - keep;
        if (excess <= 0) break;
        const snap = await getDocs(query(col, orderBy("t", "asc"), limit(Math.min(excess, BATCH))));
        if (snap.empty) break;
        const docs = snap.docs.slice(0, excess); // ไม่ลบเกินจำนวนที่เกินจริง
        await deleteDocs(docs); deleted += docs.length;
        if (docs.length < Math.min(excess, BATCH)) break;
      }
      return { deleted };
    } catch (e) {
      return { deleted, error: (e && (e.code || e.message)) || "error" };
    } finally {
      inflight.delete(key);
    }
  }

  // ลบแชทของห้องที่ปิดแล้วทั้งหมด
  async function purge(path) {
    if (!CHAT_CLEANUP_ENABLED || !CHAT_PURGE_ON_ROOM_CLOSE || !isCleanablePath(path) || path.length !== 3) return { deleted: 0, skipped: "off" };
    let deleted = 0;
    try {
      const col = collection(db, ...path);
      for (let r = 0; r < 10; r++) {
        const snap = await getDocs(query(col, limit(BATCH)));
        if (snap.empty) break;
        await deleteDocs(snap.docs); deleted += snap.docs.length;
        if (snap.docs.length < BATCH) break;
      }
      return { deleted };
    } catch (e) {
      return { deleted, error: (e && (e.code || e.message)) || "error" };
    }
  }

  return { trim, purge };
}
