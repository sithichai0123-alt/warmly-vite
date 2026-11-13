// ปุ่มเพิ่มเพื่อนในหน้าโปรไฟล์ของคนอื่น: เพิ่มเพื่อน / ส่งคำขอแล้ว(ยกเลิกได้) / ตอบรับ-ปฏิเสธ / เป็นเพื่อนกัน(เลิกได้)
import { useState } from "react";
import { useFriends } from "./hooks.jsx";

const REASON = { blocked: "คุณบล็อกผู้ใช้นี้อยู่ — เลิกบล็อกก่อนจึงจะเพิ่มเพื่อนได้", limit: "จำนวนเพื่อนเต็มแล้ว", invalid: "เพิ่มเพื่อนไม่ได้", already: "เป็นเพื่อนกันอยู่แล้ว", pending: "ส่งคำขอไปแล้ว รออีกฝ่ายตอบรับ" };

// compact = ใช้ในหัวห้องแชทส่วนตัว (ที่แคบ): ข้อความสั้นลง, ถ้าเป็นเพื่อนกันแล้วแสดงเป็นป้ายเฉย ๆ (เลิกเป็นเพื่อนทำที่โปรไฟล์), ข้อผิดพลาดแสดงใต้ปุ่ม
export default function FriendButton({ uid, name, Btn, hidden, compact }) {
  const f = useFriends();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [confirm, setConfirm] = useState(false);
  if (!f.enabled || hidden || !uid) return null;
  const rel = f.relation(uid);
  if (compact) {
    return (
      <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 2 }}>
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {rel === "none" && <Btn onClick={() => run(() => f.request(uid))} v="outline" sz="sm" style={{ opacity: busy ? .6 : 1, whiteSpace: "nowrap" }}><span data-fr-add>➕ เพิ่มเพื่อน</span></Btn>}
          {rel === "outgoing" && <Btn onClick={() => run(() => f.remove(uid))} v="ghost" sz="sm"><span data-fr-cancel>⏳ ส่งคำขอแล้ว</span></Btn>}
          {rel === "incoming" && <>
            <Btn onClick={() => run(() => f.accept(uid))} v="primary" sz="sm"><span data-fr-accept>✅ ตอบรับ</span></Btn>
            <Btn onClick={() => run(() => f.remove(uid))} v="ghost" sz="sm"><span data-fr-decline>ปฏิเสธ</span></Btn>
          </>}
          {rel === "friends" && <span data-fr-friends-badge style={{ fontSize: 11, color: "#34D399", fontWeight: 700, whiteSpace: "nowrap" }}>✅ เพื่อน</span>}
        </div>
        {err && <div data-fr-err style={{ fontSize: 10, color: "#F59E0B", maxWidth: 150, textAlign: "right" }}>⚠️ {err}</div>}
      </div>
    );
  }
  async function run(fn) { setBusy(true); setErr(""); try { const r = await fn(); if (r && r.ok === false) setErr(REASON[r.reason] || "ทำไม่สำเร็จ"); } catch (e) { setErr("ทำไม่สำเร็จ (" + ((e && (e.code || e.message)) || "เน็ตมีปัญหา") + ")"); } finally { setBusy(false); setConfirm(false); } }
  return (
    <>
      {rel === "none" && <Btn onClick={() => run(() => f.request(uid))} v="outline" sz="sm" style={{ opacity: busy ? .6 : 1 }}><span data-fr-add>➕ เพิ่มเพื่อน</span></Btn>}
      {rel === "outgoing" && <Btn onClick={() => run(() => f.remove(uid))} v="ghost" sz="sm"><span data-fr-cancel>⏳ ส่งคำขอแล้ว (แตะเพื่อยกเลิก)</span></Btn>}
      {rel === "incoming" && <>
        <Btn onClick={() => run(() => f.accept(uid))} v="primary" sz="sm"><span data-fr-accept>✅ ตอบรับเป็นเพื่อน</span></Btn>
        <Btn onClick={() => run(() => f.remove(uid))} v="ghost" sz="sm"><span data-fr-decline>ปฏิเสธ</span></Btn>
      </>}
      {rel === "friends" && !confirm && <Btn onClick={() => setConfirm(true)} v="ghost" sz="sm"><span data-fr-friends>✅ เป็นเพื่อนกัน</span></Btn>}
      {rel === "friends" && confirm && (
        <span data-fr-confirm style={{ display: "inline-flex", gap: 6, alignItems: "center", fontSize: 12 }}>
          <span>เลิกเป็นเพื่อนกับ {name || "คนนี้"}?</span>
          <Btn onClick={() => run(() => f.remove(uid))} v="danger" sz="sm"><span data-fr-remove-yes>เลิก</span></Btn>
          <Btn onClick={() => setConfirm(false)} v="ghost" sz="sm">ยกเลิก</Btn>
        </span>
      )}
      {err && <div data-fr-err style={{ flexBasis: "100%", fontSize: 11, color: "#F59E0B" }}>⚠️ {err}</div>}
    </>
  );
}
