// Presence — ต่อ Firestore (รับฟังก์ชัน Firebase จาก App.jsx เหมือนโมดูลอื่น)
import { PRESENCE_COLLECTION } from "./config.js";

export function makePresenceApi({ db, doc, setDoc, collection, onSnapshot, serverTimestamp, query, where, getDoc }) {
  return {
    write(uid, payload) {
      return setDoc(doc(db, PRESENCE_COLLECTION, uid), { ...payload, t: serverTimestamp() }, { merge: true });
    },
    // sinceMs = ฟังเฉพาะเอกสารที่ t ใหม่กว่านี้ (คนที่เพิ่ง active) · ไม่ส่ง = ฟังทุกคนแบบเดิม
    subscribe(cb, onErr, sinceMs) {
      const src = (sinceMs != null && query && where)
        ? query(collection(db, PRESENCE_COLLECTION), where("t", ">", new Date(sinceMs)))
        : collection(db, PRESENCE_COLLECTION);
      return onSnapshot(src, snap => {
        const m = {};
        snap.docs.forEach(d => { m[d.id] = d.data({ serverTimestamps: "estimate" }); });
        cb(m);
      }, e => { try { onErr && onErr(e); } catch (x) { /* ignore */ } });
    },
    // อ่านสถานะของคนเดียวครั้งเดียว (ไม่ฟังต่อ) — ใช้กับ "ออนไลน์ล่าสุด" ของคนที่เงียบนาน และของตัวเองตอนเปิดแอป
    getOne: getDoc ? (async uid => {
      const s = await getDoc(doc(db, PRESENCE_COLLECTION, uid));
      return s.exists() ? s.data({ serverTimestamps: "estimate" }) : null;
    }) : undefined,
  };
}
