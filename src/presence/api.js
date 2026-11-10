// Presence — ต่อ Firestore (รับฟังก์ชัน Firebase จาก App.jsx เหมือนโมดูลอื่น)
import { PRESENCE_COLLECTION } from "./config.js";

export function makePresenceApi({ db, doc, setDoc, collection, onSnapshot, serverTimestamp }) {
  return {
    write(uid, payload) {
      return setDoc(doc(db, PRESENCE_COLLECTION, uid), { ...payload, t: serverTimestamp() }, { merge: true });
    },
    subscribe(cb, onErr) {
      return onSnapshot(collection(db, PRESENCE_COLLECTION), snap => {
        const m = {};
        snap.docs.forEach(d => { m[d.id] = d.data({ serverTimestamps: "estimate" }); });
        cb(m);
      }, e => { try { onErr && onErr(e); } catch (x) { /* ignore */ } });
    },
  };
}
