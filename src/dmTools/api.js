// DM Tools — ต่อ Firestore (รับฟังก์ชัน Firebase จาก App.jsx เหมือนโมดูลอื่น)
import { BLOCKS_COLLECTION } from "./config.js";
import { normalizeBlocks, pairIdOf } from "./logic.js";

export function makeDmApi({ db, doc, setDoc, onSnapshot, collection, query, where, serverTimestamp }) {
  return {
    // บทสนทนาของเรา (ใช้กับตัวแจ้งเตือนเสียง) — อ่านเวลาที่ยังรอเซิร์ฟเวอร์แบบประมาณ
    subscribeConvs(myUid, cb, onErr) {
      const q = query(collection(db, "dms"), where("uids", "array-contains", myUid));
      return onSnapshot(q, snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))), e => { try { onErr && onErr(e); } catch (x) { /* ignore */ } });
    },
    // ลบประวัติเฉพาะฝั่งเรา (ไม่แตะข้อความจริง/ฝั่งอีกคน)
    clearHistory(myUid, peerUid) {
      return setDoc(doc(db, "dms", pairIdOf(myUid, peerUid)), { uids: [myUid, peerUid].sort(), clearedAt: { [myUid]: serverTimestamp() } }, { merge: true });
    },
    subscribeBlocks(uid, cb, onErr) {
      return onSnapshot(doc(db, BLOCKS_COLLECTION, uid), sn => cb(normalizeBlocks(sn.exists() ? sn.data() : null)), e => { try { onErr && onErr(e); } catch (x) { /* ignore */ } });
    },
    saveBlocks(uid, list) {
      return setDoc(doc(db, BLOCKS_COLLECTION, uid), { list: normalizeBlocks({ list }), updatedAt: Date.now() });
    },
  };
}
