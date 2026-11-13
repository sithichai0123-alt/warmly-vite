// เมนูเล็กตอนแตะรูปสมาชิกในห้องเสียง: โปรไฟล์ / ส่งของขวัญ / เพิ่มเพื่อน / โทรส่วนตัว
// รายการทั้งหมดส่งมาจาก App (ซ่อนรายการที่ใช้ไม่ได้ด้วย hidden:true)
const C = { card: "#221F33", border: "#2E2A45", borderHi: "#4F46A8", text: "#F0EEFF", sub: "#9B94C4", red: "#F87171" };

export default function MemberMenu({ title, subtitle, items, onClose }) {
  const shown = (items || []).filter(i => i && !i.hidden);
  return (
    <div data-member-menu onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.6)", zIndex: 70, display: "flex", alignItems: "flex-end", justifyContent: "center", padding: 12 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 420, background: C.card, border: "1px solid " + C.borderHi, borderRadius: 18, overflow: "hidden" }}>
        <div style={{ padding: "12px 16px", borderBottom: "1px solid " + C.border }}>
          <div style={{ fontSize: 15, fontWeight: 800, color: C.text }}>{title}</div>
          {subtitle && <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{subtitle}</div>}
        </div>
        {shown.map(i => (
          <button key={i.key} type="button" data-mm={i.key} disabled={i.disabled} onClick={() => { onClose(); i.onClick && i.onClick(); }} style={{ display: "block", width: "100%", textAlign: "left", border: "none", borderBottom: "1px solid " + C.border, background: "transparent", color: i.danger ? C.red : C.text, fontFamily: "inherit", fontSize: 14, padding: "13px 16px", cursor: i.disabled ? "default" : "pointer", opacity: i.disabled ? 0.5 : 1 }}>{i.label}</button>
        ))}
        <button type="button" data-mm-close onClick={onClose} style={{ display: "block", width: "100%", border: "none", background: "transparent", color: C.sub, fontFamily: "inherit", fontSize: 13, padding: "12px 16px", cursor: "pointer" }}>ปิด</button>
      </div>
    </div>
  );
}
