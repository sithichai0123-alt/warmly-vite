// ทางสำรอง (ปิดไว้เป็นค่าเริ่มต้น — CLIENT_FALLBACK=false): ลบจากฝั่งแอปตรง ๆ เมื่อเซิร์ฟเวอร์ยังไม่ได้ตั้งค่า
// ใช้กฎเดียวกับ Backend (ข้อความตัวเองเท่านั้น, ห้ามลบของขวัญ, แตะเฉพาะ dms/{pair}) แต่ปลอดภัยน้อยกว่า
// เพราะกฎ Firestore เป็นตัวตัดสินจริง — เปิดเฉพาะกรณีจำเป็น
import { pairIdOf, validPeer, validMsgId, previewOf, MAX_BATCH, MAX_ROUNDS } from "./logic.js";

export function makeClientFallback({ db, getUid, doc, collection, query, orderBy, limit, getDocs, getDoc, deleteDoc, setDoc, writeBatch }) {
  const fail = (m) => { throw Object.assign(new Error(m), { kind: "forbidden" }); };
  return {
    async deleteOne(peer, messageId) {
      const uid = getUid();
      if (!uid || !validPeer(uid, peer) || !validMsgId(messageId)) fail("ข้อมูลไม่ถูกต้อง");
      const pid = pairIdOf(uid, peer);
      const mref = doc(db, "dms", pid, "messages", messageId);
      const sn = await getDoc(mref);
      if (!sn.exists()) return { ok: true, deleted: 0, already: true };
      const m = sn.data() || {};
      if (m.uid !== uid) fail("ลบได้เฉพาะข้อความของตัวเอง");
      if (m.gift) fail("ข้อความของขวัญลบไม่ได้");
      await deleteDoc(mref);
      const pref = doc(db, "dms", pid);
      const left = await getDocs(query(collection(db, "dms", pid, "messages"), orderBy("t", "desc"), limit(1)));
      if (left.empty) { await deleteDoc(pref); return { ok: true, deleted: 1, conversationRemoved: true }; }
      const d = left.docs[0].data() || {};
      const patch = { last: previewOf(d), lastFrom: d.uid || null };
      if (d.t !== undefined) patch.lastT = d.t;
      await setDoc(pref, patch, { merge: true });
      return { ok: true, deleted: 1, conversationRemoved: false };
    },
    async deleteAll(peer) {
      const uid = getUid();
      if (!uid || !validPeer(uid, peer)) fail("ข้อมูลไม่ถูกต้อง");
      const pid = pairIdOf(uid, peer);
      let deleted = 0;
      for (let r = 0; r < MAX_ROUNDS; r++) {
        const snap = await getDocs(query(collection(db, "dms", pid, "messages"), limit(MAX_BATCH)));
        if (snap.empty) break;
        const b = writeBatch(db);
        snap.docs.forEach(d => b.delete(d.ref));
        await b.commit();
        deleted += snap.docs.length;
        if (snap.docs.length < MAX_BATCH) break;
      }
      await deleteDoc(doc(db, "dms", pid));
      return { ok: true, deleted, conversationRemoved: true };
    },
  };
}
