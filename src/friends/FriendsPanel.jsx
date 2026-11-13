// แท็บ "👥 เพื่อน" ในหน้าแชท: คำขอที่ได้รับ / เพื่อนของฉัน / คำขอที่ส่งไป
// รับคอมโพเนนต์ Avatar และฟังก์ชันชื่อ/การกระทำจาก App (ใช้หน้าตาเดิมของแอป)
import { useState } from "react";
import { useFriends } from "./hooks.jsx";

const C = { card: "#221F33", border: "#2E2A45", text: "#F0EEFF", sub: "#9B94C4", muted: "#6B648F", brand: "#7C6BF0", brand2: "#A78BFA", red: "#F87171" };
const pill = (p) => ({ border: p ? "none" : "1px solid " + C.border, background: p ? C.brand : "transparent", color: p ? "#fff" : C.sub, borderRadius: 14, padding: "5px 11px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" });
const head = { fontSize: 13, fontWeight: 700, color: C.sub, margin: "14px 0 8px" };

export default function FriendsPanel({ Avatar, nameOf, Name, isOnline, onProfile, onChat, onCall }) {
  const f = useFriends();
  const [err, setErr] = useState("");
  async function run(fn) { setErr(""); try { await fn(); } catch (e) { setErr("ทำไม่สำเร็จ (" + ((e && (e.code || e.message)) || "เน็ตมีปัญหา") + ")"); } }
  if (!f.enabled) return null;
  const order = [...f.friends].sort((a, b) => ((isOnline && isOnline(b.uid) ? 1 : 0) - (isOnline && isOnline(a.uid) ? 1 : 0)) || b.t - a.t);
  const row = (p, right) => (
    <div key={p.uid} data-fr-row={p.uid} style={{ display: "flex", gap: 11, alignItems: "center", padding: "9px 4px", borderBottom: "1px solid " + C.border }}>
      <div onClick={() => onProfile && onProfile(p.uid)} style={{ cursor: "pointer" }}><Avatar uid={p.uid} size={40}/></div>
      <div onClick={() => onProfile && onProfile(p.uid)} style={{ flex: 1, minWidth: 0, cursor: "pointer" }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{Name ? <Name uid={p.uid} /> : nameOf(p.uid)}</div>
        {isOnline && <div style={{ fontSize:12, color: isOnline(p.uid) ? "#10B981" : C.muted }}>{isOnline(p.uid) ? "ออนไลน์" : "ออฟไลน์"}</div>}
      </div>
      <div style={{ display: "flex", gap: 6 }}>{right}</div>
    </div>
  );
  return (
    <div data-friends-panel style={{ flex: 1, overflowY: "auto", padding: "4px 14px 16px" }}>
      {err && <div data-fr-err style={{ fontSize: 12, color: "#F59E0B", padding: "8px 0" }}>⚠️ {err}</div>}
      {f.incoming.length > 0 && (<div data-fr-incoming>
        <div style={head}>คำขอเป็นเพื่อน ({f.incoming.length})</div>
        {f.incoming.map(p => row(p, <>
          <button type="button" data-fr-accept onClick={() => run(() => f.accept(p.uid))} style={pill(true)}>ตอบรับ</button>
          <button type="button" data-fr-decline onClick={() => run(() => f.remove(p.uid))} style={pill(false)}>ปฏิเสธ</button>
        </>))}
      </div>)}
      <div style={head}>เพื่อนของฉัน ({f.friends.length})</div>
      {!f.ready && <div style={{ fontSize: 13, color: C.muted, padding: "8px 0" }}>⏳ กำลังโหลด...</div>}
      {f.ready && f.friends.length === 0 && <div data-fr-empty style={{ fontSize: 13, color: C.muted, padding: "8px 0 14px", lineHeight: 1.6 }}>ยังไม่มีเพื่อน — เปิดโปรไฟล์ของใครสักคน (แตะรูปในแชทรวมหรือในห้องเสียง) แล้วกด ➕ เพิ่มเพื่อน</div>}
      {order.map(p => row(p, <>
        {onChat && <button type="button" data-fr-chat onClick={() => onChat(p.uid)} style={pill(true)}>💬</button>}
        {onCall && <button type="button" data-fr-call onClick={() => onCall(p.uid)} style={pill(false)}>📞</button>}
      </>))}
      {f.outgoing.length > 0 && (<div data-fr-outgoing>
        <div style={head}>คำขอที่ส่งไป ({f.outgoing.length})</div>
        {f.outgoing.map(p => row(p, <button type="button" data-fr-cancel onClick={() => run(() => f.remove(p.uid))} style={pill(false)}>ยกเลิก</button>))}
      </div>)}
    </div>
  );
}
