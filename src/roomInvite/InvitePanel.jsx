// หน้าต่าง "เชิญเพื่อนเข้าห้อง": รายชื่อเพื่อน (ออนไลน์ก่อน) + ปุ่มเชิญ
import { useEffect, useState } from "react";
import { inviteStates } from "./logic.js";

const C = { card: "#221F33", border: "#2E2A45", borderHi: "#4F46A8", text: "#F0EEFF", sub: "#9B94C4", muted: "#6B648F", brand: "#7C6BF0", green: "#10B981" };
export const sentRegistry = new Map(); // `${roomId}:${uid}` → เวลาที่เชิญล่าสุด (อยู่ข้ามการปิด/เปิดหน้าต่าง)

export default function InvitePanel({ roomId, roomName, friends, memberUids, Avatar, nameOf, Name, isOnline, onInvite, onClose }) {
  const [, tick] = useState(0);
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");
  useEffect(() => { const t = setInterval(() => tick(x => x + 1), 1000); return () => clearInterval(t); }, []);
  const sent = new Map(); sentRegistry.forEach((t, k) => { if (k.startsWith(roomId + ":")) sent.set(k.slice(roomId.length + 1), t); });
  const on = (u) => (isOnline ? isOnline(u) : false);
  const order = [...friends].sort((a, b) => ((on(b.uid) ? 1 : 0) - (on(a.uid) ? 1 : 0)) || b.t - a.t);
  const st = Object.fromEntries(inviteStates(order.map(f => f.uid), memberUids, sent, Date.now()).map(s => [s.uid, s]));
  async function go(uid) {
    setBusy(uid); setErr("");
    try { await onInvite(uid); sentRegistry.set(roomId + ":" + uid, Date.now()); }
    catch (e) { setErr("เชิญไม่สำเร็จ (" + ((e && (e.code || e.message)) || "เน็ตมีปัญหา") + ")"); }
    finally { setBusy(""); }
  }
  return (
    <div data-invite-panel onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 65, display: "flex", alignItems: "center", justifyContent: "center", padding: 14 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 400, maxHeight: "80dvh", display: "flex", flexDirection: "column", background: C.card, border: "1px solid " + C.borderHi, borderRadius: 18, overflow: "hidden" }}>
        <div style={{ padding: "14px 16px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>➕ เชิญเพื่อนเข้าห้อง</div>
            <div style={{ fontSize: 11, color: C.sub, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{roomName}</div>
          </div>
          <button type="button" data-invite-close onClick={onClose} style={{ border: "none", background: "transparent", color: C.sub, fontSize: 18, cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>
        <div style={{ overflowY: "auto", padding: "4px 14px 12px" }}>
          {err && <div data-invite-err style={{ fontSize: 12, color: "#F59E0B", padding: "8px 0" }}>⚠️ {err}</div>}
          {order.length === 0 && <div data-invite-empty style={{ fontSize: 13, color: C.muted, padding: "18px 0", textAlign: "center", lineHeight: 1.6 }}>ยังไม่มีเพื่อนให้เชิญ<br/>เพิ่มเพื่อนก่อนที่แท็บ แชท → 👥 เพื่อน</div>}
          {order.map(f => {
            const s = st[f.uid] || { state: "can" };
            const label = s.state === "in-room" ? "อยู่ในห้องแล้ว" : s.state === "cooldown" ? "ส่งแล้ว ✓" : s.state === "again" ? "เชิญอีกครั้ง" : "เชิญ";
            const dis = s.state === "in-room" || s.state === "cooldown" || busy === f.uid;
            return (
              <div key={f.uid} data-invite-row={f.uid} style={{ display: "flex", gap: 11, alignItems: "center", padding: "9px 0", borderBottom: "1px solid " + C.border }}>
                <Avatar uid={f.uid} size={38}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{Name ? <Name uid={f.uid} /> : nameOf(f.uid)}</div>
                  {isOnline && <div style={{ fontSize: 11, color: on(f.uid) ? C.green : C.muted }}>{on(f.uid) ? "ออนไลน์" : "ออฟไลน์"}</div>}
                </div>
                <button type="button" data-invite-btn={s.state} disabled={dis} onClick={() => go(f.uid)} style={{ background: dis ? "transparent" : C.brand, color: dis ? C.sub : "#fff", borderRadius: 14, padding: "6px 13px", fontSize: 12, fontWeight: 700, cursor: dis ? "default" : "pointer", fontFamily: "inherit", border: dis ? "1px solid " + C.border : "none" }}>{label}</button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
