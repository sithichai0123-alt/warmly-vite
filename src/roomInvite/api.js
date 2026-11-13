// ฝั่งฐานข้อมูล: กล่องคำเชิญของผู้รับที่ inbox/{toUid}/roomInvites/{fromUid}
// (1 เอกสารต่อผู้เชิญ → เชิญซ้ำ = เขียนทับ ไม่งอกเป็นร้อยเอกสาร และฟังด้วย path ตรง ๆ ไม่ต้องมี query)
export function makeInviteApi({ db, doc, setDoc, deleteDoc, onSnapshot, collection, serverTimestamp }) {
  return {
    subscribe(uid, cb, onErr) {
      return onSnapshot(collection(db, "inbox", uid, "roomInvites"),
        snap => cb(snap.docs.map(d => ({ id: d.id, ...d.data({ serverTimestamps: "estimate" }) }))), onErr || (() => {}));
    },
    async send(from, { fromName, to, roomId, roomName }) {
      if (!from || !to || from === to || !roomId) throw new Error("ข้อมูลไม่ถูกต้อง");
      await setDoc(doc(db, "inbox", to, "roomInvites", from), { from, fromName: String(fromName || "").slice(0, 40), roomId, roomName: String(roomName || "").slice(0, 60), status: "pending", t: serverTimestamp() });
    },
    async dismiss(me, from) { await deleteDoc(doc(db, "inbox", me, "roomInvites", from)); },
  };
}
