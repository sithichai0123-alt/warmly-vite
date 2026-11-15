// Room Stage — ชิ้นส่วนหน้าจอ (รับสีธีม T จาก App) · ไม่มีตรรกะสิทธิ์ในไฟล์นี้ (ตรรกะอยู่ที่ logic.js)

// ป้ายบทบาทบนมุมรูป: 👑 เจ้าของห้อง · 🛡️ รอง
export function RoleBadge({ role, T }) {
  if (role !== "host" && role !== "cohost") return null;
  return (
    <span data-role-badge={role} title={role === "host" ? "เจ้าของห้อง" : "รองเจ้าของห้อง"}
      style={{ position: "absolute", top: -4, left: "calc(50% - 36px)", zIndex: 3, width: 22, height: 22, borderRadius: "50%",
        background: role === "host" ? "#F59E0B" : "#6366F1", border: "2px solid " + T.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11, lineHeight: 1 }}>
      {role === "host" ? "👑" : "🛡️"}
    </span>
  );
}

// หัวข้อเวที: ผู้พูด n/7 + คำอธิบายป้าย
export function StageHeader({ count, max, T }) {
  return (
    <div data-stage-header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: T.brand2 }}>🎙️ ผู้พูด {count}/{max}</div>
      <div style={{ fontSize: 12, color: T.muted }}>👑 เจ้าของ · 🛡️ รอง</div>
    </div>
  );
}

// ที่นั่งว่าง (แสดงช่องเดียวพร้อมจำนวน เพื่อไม่กินพื้นที่) — ผู้ฟังแตะเพื่อขึ้นพูดได้ทันที
export function EmptySeat({ free, canTake, onTake, T }) {
  if (free <= 0) return null;
  return (
    <div data-empty-seat onClick={canTake ? onTake : undefined} role={canTake ? "button" : undefined}
      style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5, cursor: canTake ? "pointer" : "default" }}>
      <div style={{ width: 59, height: 59, boxSizing: "border-box", borderRadius: "50%", border: "2px dashed " + (canTake ? T.brand : T.border),
        display: "flex", alignItems: "center", justifyContent: "center", color: canTake ? T.brand2 : T.muted, fontSize: 22 }}>＋</div>
      <div style={{ fontSize: 12, color: canTake ? T.brand2 : T.muted, fontWeight: canTake ? 700 : 400 }}>{canTake ? "ขึ้นพูด" : "ว่าง " + free + " ที่"}</div>
    </div>
  );
}

// แผงคำขอขึ้นพูด (เห็นเฉพาะเจ้าของห้อง/รอง)
export function RequestsPanel({ requests, free, max, T, avatar, onApprove, onDeny }) {
  if (!requests.length) return null;
  return (
    <div data-requests style={{ background: T.surface, border: "1px solid " + T.borderHi, borderRadius: 12, padding: "10px 12px", marginBottom: 12 }}>
      <div style={{ fontSize: 13, fontWeight: 800, color: T.text, marginBottom: 6 }}>✋ ขอขึ้นพูด {requests.length} คน</div>
      {requests.map(m => (
        <div key={m.uid || m.init} data-request={m.uid || m.init} style={{ display: "flex", alignItems: "center", gap: 8, padding: "4px 0" }}>
          {avatar(m)}
          <div style={{ flex: 1, minWidth: 0, fontSize: 13, fontWeight: 700, color: T.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{m.name || "ผู้ใช้"}</div>
          <button data-approve onClick={() => onApprove(m)} disabled={free <= 0}
            style={{ border: "none", background: free > 0 ? T.brandGrad : T.border, color: free > 0 ? "#fff" : T.muted, borderRadius: 16, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: free > 0 ? "pointer" : "not-allowed", fontFamily: "inherit" }}>
            {free > 0 ? "อนุมัติ" : "เวทีเต็ม"}
          </button>
          <button data-deny onClick={() => onDeny(m)}
            style={{ border: "1px solid " + T.border, background: "transparent", color: T.muted, borderRadius: 16, padding: "6px 10px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>ปฏิเสธ</button>
        </div>
      ))}
      {free <= 0 && <div style={{ fontSize: 12, color: T.muted, marginTop: 4 }}>เวทีเต็ม {max}/{max} — ให้ใครลงจากเวทีก่อนจึงอนุมัติได้ (แตะรูปคนบนเวที)</div>}
    </div>
  );
}

// สถานะของเราตอนเป็นผู้ฟัง
export function ListenerStatus({ hand, free, T }) {
  const text = hand ? "⏳ ยกมือแล้ว · รอเจ้าของห้องหรือรองอนุมัติ (แตะ ✋ อีกครั้งเพื่อยกเลิก)"
    : free > 0 ? "คุณเป็นผู้ฟัง · พิมพ์แชทได้ · เวทีว่าง " + free + " ที่ กด ⬆️ ขึ้นพูด ได้เลย"
    : "คุณเป็นผู้ฟัง · พิมพ์แชทได้ · เวทีเต็ม กด ✋ เพื่อขอขึ้นพูด";
  return (
    <div data-listener-status style={{ fontSize: 12, lineHeight: 1.5, color: hand ? T.brand2 : T.yellow, background: hand ? T.brandA22 : "rgba(245,158,11,.1)",
      border: "1px solid " + (hand ? T.borderHi : "rgba(245,158,11,.3)"), borderRadius: 10, padding: "7px 10px", marginBottom: 12 }}>{text}</div>
  );
}
