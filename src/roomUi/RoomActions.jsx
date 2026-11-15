// Room UI — ปุ่มทั้งหมดของห้องคุยในแถวเดียว: ทุกช่องกว้าง/สูงเท่ากัน · ไอคอนบน ชื่อสั้นคงที่ด้านล่าง
//   ชื่อปุ่มไม่เปลี่ยนตามสถานะ (ปุ่มจึงไม่ขยับ) — สถานะบอกด้วยไอคอน + สี:
//   tone: "primary" = กำลังทำงานหลัก (ไมค์เปิด) · "on" = แผงที่เปิดอยู่ · "warn" = ปิดอยู่ (สีแดง) · "idle" = ปกติ
//   al = คำอ่านสำหรับโปรแกรมอ่านหน้าจอ (บอกสถานะเต็ม) · dot = จุดเขียวมุมขวาบน (เช่น ห้องกำลังเปิดเพลง)
export const gridColumns = n => (n <= 6 ? Math.max(1, n) : Math.ceil(n / 2));   // ≤6 ปุ่ม = แถวเดียว

export default function RoomActions({ items, T }) {
  const list = (items || []).filter(x => x && x.show !== false);
  const cols = gridColumns(list.length);
  const tone = t => {
    if (t === "primary") return { background: T.brandGrad, border: "1px solid transparent", color: "#fff", boxShadow: "0 2px 10px rgba(124,92,252,.3)" };
    if (t === "warn") return { background: T.redBg, border: "1px solid " + T.red, color: T.red };
    if (t === "on") return { background: T.brandA33, border: "1px solid " + T.brand, color: T.brand2 };
    return { background: "transparent", border: "1px solid " + T.border, color: T.sub };
  };
  return (
    <div data-room-actions style={{ display: "grid", gridTemplateColumns: "repeat(" + cols + ",minmax(0,1fr))", gap: 6, marginBottom: 12 }}>
      {list.map(x => (
        <button key={x.k} data-room-action={x.k} onClick={x.fn} aria-label={x.al || x.l} aria-pressed={x.tone === "on" || x.tone === "primary" ? true : undefined} {...(x.attrs || {})}
          style={{ position: "relative", minWidth: 0, height: 50, padding: "5px 2px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2, transition: "background .15s,border-color .15s", ...tone(x.tone) }}>
          <span aria-hidden="true" style={{ fontSize: 17, lineHeight: 1 }}>{x.ic}</span>
          <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.l}</span>
          {x.dot && <span data-room-action-dot style={{ position: "absolute", top: 5, right: 6, width: 7, height: 7, borderRadius: "50%", background: T.green, boxShadow: "0 0 0 2px " + T.card }} />}
        </button>
      ))}
    </div>
  );
}
