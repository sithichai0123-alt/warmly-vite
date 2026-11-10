// Profile Photos — ต่อ Firestore (รับฟังก์ชัน Firebase จาก App.jsx เหมือนโมดูลอื่น)
import { COLLECTION } from "./config.js";
import { normalize } from "./photos.js";

export function makePhotosApi({ db, doc, setDoc, onSnapshot }) {
  return {
    subscribe(uid, cb, onErr) {
      return onSnapshot(doc(db, COLLECTION, uid), sn => cb(normalize(sn.exists() ? sn.data() : null)), e => { try { onErr && onErr(e); } catch (x) { /* ignore */ } });
    },
    // เขียนทั้งเอกสาร (ไม่ merge) เพื่อให้รูปที่ลบหายจริง
    save(uid, state) {
      return setDoc(doc(db, COLLECTION, uid), { photos: state.photos, mainId: state.mainId || null, updatedAt: Date.now() });
    },
  };
}
