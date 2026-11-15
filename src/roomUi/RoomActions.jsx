// Room UI — ปุ่มทั้งหมดของห้องคุยในตารางเดียว: ทุกช่องสูง/กว้างเท่ากัน · ไอคอนบน ชื่อล่าง · สีมีความหมายเดียวกันทุกปุ่ม
//   tone: "primary" = กำลังทำงานหลัก (ไมค์เปิด) · "on" = แผงที่เปิดอยู่ · "warn" = ปิดอยู่/ต้องระวัง · "idle" = ปกติ
//   dot = จุดเขียวมุมขวาบน (เช่น ห้องกำลังเปิดเพลงอยู่)
//   จำนวนคอลัมน์: ≤4 ปุ่ม = แถวเดียว · 5–6 ปุ่ม = 3 คอลัมน์ (2 แถว คอลัมน์ตรงกัน)
export const gridColumns = n => (n <= 4 ? Math.max(1, n) : 3);

export default function RoomActions({ items, T }) {
  const list = (items || []).filter(x => x && x.show !== false);
  const cols = gridColumns(list.length);
  const tone = t => {
    if (t === "primary") return { background: T.brandGrad, border: "1px solid transparent", color: "#fff", boxShadow: "0 3px 12px rgba(124,92,252,.35)" };
    if (t === "warn") return { background: T.redBg, border: "1px solid " + T.red, color: T.red };
    if (t === "on") return { background: T.brandA33, border: "1px solid " + T.brand, color: T.brand2 };
    return { background: "transparent", border: "1px solid " + T.border, color: T.sub };
  };
  return (
    <div data-room-actions style={{ display: "grid", gridTemplateColumns: "repeat(" + cols + ",minmax(0,1fr))", gap: 8, marginBottom: 12 }}>
      {list.map(x => (
        <button key={x.k} data-room-action={x.k} onClick={x.fn} aria-label={x.l} aria-pressed={x.tone === "on" || x.tone === "primary" ? true : undefined} {...(x.attrs || {})}
          style={{ position: "relative", minWidth: 0, minHeight: 58, padding: "8px 4px", borderRadius: 12, cursor: "pointer", fontFamily: "inherit",
            display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, transition: "background .15s,border-color .15s", ...tone(x.tone) }}>
          <span aria-hidden="true" style={{ fontSize: 19, lineHeight: 1 }}>{x.ic}</span>
          <span style={{ fontSize: 12, fontWeight: 600, lineHeight: 1.2, maxWidth: "100%", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{x.l}</span>
          {x.dot && <span data-room-action-dot style={{ position: "absolute", top: 6, right: 8, width: 7, height: 7, borderRadius: "50%", background: T.green, boxShadow: "0 0 0 2px " + T.card }} />}
        </button>
      ))}
    </div>
  );
}
