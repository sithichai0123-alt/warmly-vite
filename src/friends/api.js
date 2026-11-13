// ฝั่งฐานข้อมูลของระบบเพื่อน: 1 เอกสารต่อคู่ที่ friendships/{pairId} (กันซ้ำโดยโครงสร้าง)
//   {uids:[a,b], status:"pending"|"accepted", from, createdAt, acceptedAt}
// รับฟังก์ชัน Firestore จาก App.jsx
import { pairIdOf } from "./logic.js";

export function makeFriendsApi({ db, doc, setDoc, deleteDoc, getDoc, onSnapshot, collection, query, where, serverTimestamp }) {
  const ref = (a, b) => doc(db, "friendships", pairIdOf(a, b));
  const bad = (m) => { throw new Error(m); };
  return {
    subscribe(uid, cb, onErr) {
      return onSnapshot(query(collection(db, "friendships"), where("uids", "array-contains", uid)),
        snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))), onErr || (() => {}));
    },
    // ขอเป็นเพื่อน (ถ้าอีกฝ่ายขอเรามาก่อน = ตอบรับให้เลย; ถ้าเป็นเพื่อนอยู่แล้ว = ไม่ทำอะไร)
    async request(me, peer) {
      if (!me || !peer || me === peer) bad("ข้อมูลไม่ถูกต้อง");
      const r = ref(me, peer);
      const sn = await getDoc(r);
      if (sn.exists()) {
        const d = sn.data() || {};
        if (d.status === "accepted") return "already";
        if (d.status === "pending" && d.from === me) return "pending";
        if (d.status === "pending" && d.from === peer) { await setDoc(r, { status: "accepted", acceptedAt: serverTimestamp() }, { merge: true }); return "accepted"; }
      }
      await setDoc(r, { uids: [me, peer].sort(), status: "pending", from: me, createdAt: serverTimestamp() });
      return "requested";
    },
    // ตอบรับ: ต้องเป็นคำขอที่ "เขา" ส่งมาหาเรา และยังรอตอบอยู่เท่านั้น
    async accept(me, peer) {
      const r = ref(me, peer);
      const sn = await getDoc(r);
      const d = sn.exists() ? sn.data() : null;
      if (!d || d.status !== "pending" || d.from !== peer) bad("ไม่พบคำขอนี้แล้ว (อาจถูกยกเลิก)");
      await setDoc(r, { status: "accepted", acceptedAt: serverTimestamp() }, { merge: true });
    },
    // ปฏิเสธคำขอ / ยกเลิกคำขอที่ส่งไป / เลิกเป็นเพื่อน = ลบเอกสารคู่นี้ (ไม่แตะข้อมูลอื่น)
    async remove(me, peer) {
      if (!me || !peer || me === peer) bad("ข้อมูลไม่ถูกต้อง");
      await deleteDoc(ref(me, peer));
    },
  };
}
