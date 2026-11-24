// ฝั่งฐานข้อมูลของโทรส่วนตัว
//   calls/{callId}     = {from,to,fromName,toName,status,createdAt,acceptedAt,endedAt,endedBy}  (สถานะสาย = ข้อมูลที่ทั้งสองฝ่ายดู)
//   callInbox/{uid}    = {callId,dir:"in"|"out",other,fromName,status,t}                         (ใช้ปลุกฝั่งผู้รับ + ตรวจ "ไม่ว่าง"; 1 เอกสารต่อคน ไม่งอก)
// สถานะ: ringing → accepted → ended | ringing → declined/busy/missed/cancelled
// ต้องรับสายจากทั้งสองฝ่ายก่อนถึงจะเปิดไมค์ได้: ผู้โทร = กดยืนยันโทร, ผู้รับ = accept()
import { inboxLive } from "./logic.js";

// server(action, body) → Promise<Response> (ไม่บังคับ): ทำผ่าน api/call.js ก่อน — เซิร์ฟเวอร์ยังไม่พร้อม (501/เน็ตล่ม) ค่อยเขียนตรงจากเครื่อง
export function makePrivateCallApi({ db, doc, collection, setDoc, updateDoc, deleteDoc, getDoc, onSnapshot, serverTimestamp, now = () => Date.now(), server }) {
  const callRef = (id) => doc(db, "calls", id);
  const inboxRef = (uid) => doc(db, "callInbox", uid);
  const bad = (m, code) => { throw Object.assign(new Error(m), { code }); };

  async function clearInbox(uid, callId) {
    try {
      const sn = await getDoc(inboxRef(uid));
      if (sn.exists() && (sn.data() || {}).callId === callId) await deleteDoc(inboxRef(uid)); // ไม่ลบกล่องของสายใหม่กว่า
    } catch (e) { /* best effort */ }
  }
  // เรียกเซิร์ฟเวอร์: คืนผลลัพธ์ · null = ใช้ทางเดิมแทน · error = เซิร์ฟเวอร์ปฏิเสธจริง (ส่งต่อให้ผู้ใช้เห็น)
  async function viaServer(action, body) {
    if (!server) return null;
    let r;
    try { r = await server(action, body); } catch (e) { return null; }
    let data = {}; try { data = await r.json(); } catch (e) { /* */ }
    if (r.ok) return data;
    if (r.status === 501 || r.status === 404 || r.status >= 502) return null;
    bad(data.error || ("server " + r.status), data.code || (r.status === 409 ? "busy" : "server-" + r.status));
  }
  async function finish(callId, me, status, extra) {
    const sv = await viaServer("finish", { callId, status });
    if (sv) return !!sv.changed;
    const sn = await getDoc(callRef(callId));
    if (!sn.exists()) return false;
    const d = sn.data() || {};
    if (d.from !== me && d.to !== me) bad("ไม่ใช่สายของคุณ", "forbidden");
    if (["declined", "busy", "missed", "cancelled", "ended"].includes(d.status)) return false; // จบไปแล้ว
    await updateDoc(callRef(callId), { status, endedAt: serverTimestamp(), endedBy: me, ...(extra || {}) });
    await clearInbox(d.from, callId); await clearInbox(d.to, callId);
    return true;
  }

  return {
    watchCall(id, cb, onErr) { return onSnapshot(callRef(id), sn => cb(sn.exists() ? { id: sn.id, ...sn.data({ serverTimestamps: "estimate" }) } : null), onErr || (() => {})); },
    watchInbox(uid, cb, onErr) { return onSnapshot(inboxRef(uid), sn => cb(sn.exists() ? { id: sn.id, ...sn.data({ serverTimestamps: "estimate" }) } : null), onErr || (() => {})); },

    // เริ่มโทร (ผู้โทรยืนยันแล้ว) — ถ้าปลายทางไม่ว่างจะ throw code "busy" และไม่สร้างอะไรเลย
    async start(me, { peer, fromName, toName }) {
      if (!me || !peer || me === peer) bad("ข้อมูลไม่ถูกต้อง", "invalid");
      const sv = await viaServer("start", { peer, fromName, toName });
      if (sv && sv.callId) return sv.callId;
      // ตรวจ "ไม่ว่าง" จากกล่องของปลายทาง — ถ้ากฎฐานข้อมูลไม่ให้อ่านกล่องคนอื่น (permission-denied) ให้ข้ามไป
      // ฝั่งผู้รับจะตอบ "ไม่ว่าง" ให้เองอยู่แล้วถ้ากำลังคุยสายอื่น
      try {
        const pin = await getDoc(inboxRef(peer));
        if (pin.exists() && inboxLive(pin.data(), now())) bad("ผู้ใช้นี้กำลังสายไม่ว่าง", "busy");
      } catch (e) { if (e && e.code === "busy") throw e; }
      const ref = doc(collection(db, "calls"));
      const callId = ref.id;
      await setDoc(ref, { from: me, to: peer, fromName: String(fromName || "").slice(0, 40), toName: String(toName || "").slice(0, 40), status: "ringing", createdAt: serverTimestamp() });
      await setDoc(inboxRef(peer), { callId, dir: "in", other: me, from: me, fromName: String(fromName || "").slice(0, 40), status: "ringing", t: serverTimestamp() });
      await setDoc(inboxRef(me), { callId, dir: "out", other: peer, from: me, status: "ringing", t: serverTimestamp() });
      return callId;
    },
    // ผู้รับกดรับสาย: ต้องเป็นสายที่โทรหาเรา และยังดังอยู่เท่านั้น
    async accept(callId, me) {
      const sv = await viaServer("accept", { callId });
      if (sv) return { from: sv.from };
      const sn = await getDoc(callRef(callId));
      const d = sn.exists() ? sn.data() : null;
      if (!d || d.to !== me || d.status !== "ringing") bad("สายนี้ถูกยกเลิกหรือหมดเวลาแล้ว", "gone");
      await updateDoc(callRef(callId), { status: "accepted", acceptedAt: serverTimestamp() });
      const t = serverTimestamp();
      await setDoc(inboxRef(d.to), { callId, dir: "in", other: d.from, from: d.from, status: "accepted", t });
      await setDoc(inboxRef(d.from), { callId, dir: "out", other: d.to, from: d.from, status: "accepted", t });
      return { from: d.from };
    },
    decline: (callId, me, reason) => finish(callId, me, reason === "busy" ? "busy" : "declined"),
    cancel: (callId, me) => finish(callId, me, "cancelled"),
    miss: (callId, me) => finish(callId, me, "missed"),
    end: (callId, me) => finish(callId, me, "ended"),
    // เก็บกวาดเอกสารสายที่จบแล้ว (เรียกหลังอีกฝ่ายเห็นสถานะแล้ว)
    async purge(callId) { try { await deleteDoc(callRef(callId)); } catch (e) { /* ignore */ } },
  };
}
