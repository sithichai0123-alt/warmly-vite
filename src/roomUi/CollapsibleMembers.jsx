// Room UI — รายชื่อสมาชิกในห้องคุย: แสดงไม่เกิน rows แถว ถ้ามีมากกว่านั้นมีปุ่ม "ดูทั้งหมด (+N คน)"
// ห่อรายการรูปสมาชิกเดิมไว้ข้างใน (ไม่แก้หน้าตาของแต่ละคน) · วัดจากของจริงบนจอ จึงใช้ได้ทั้งมือถือและคอม
import { useLayoutEffect, useRef, useState } from "react";

const GAP = 12, TOP_ROOM = 12; // เผื่อพื้นที่ด้านบนให้ปุ่มของ Host ที่ลอยเหนือรูป (top:-10) ไม่ถูกตัด

export default function CollapsibleMembers({ count, rows = 2, T, children }) {
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [cut, setCut] = useState(null); // { max, hidden } เมื่อเกินจำนวนแถว · null = แสดงครบอยู่แล้ว

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const measure = () => {
      const kids = [...el.children];
      if (!kids.length) { setCut(null); return; }
      const top0 = kids[0].offsetTop;
      const tops = [...new Set(kids.map(k => k.offsetTop))].sort((a, b) => a - b);
      if (tops.length <= rows) { setCut(null); return; }
      const limit = tops[rows];                       // แถวแรกที่ต้องซ่อน
      const hidden = kids.filter(k => k.offsetTop >= limit).length;
      setCut({ max: limit - top0 - GAP, hidden });   // max-height นับเฉพาะเนื้อหา (ไม่รวม paddingTop) → ตัดพอดีก่อนแถวที่ซ่อน รวมปุ่ม Host ที่ลอยเหนือรูป
    };
    measure();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(measure) : null;
    if (ro) ro.observe(el);
    return () => { if (ro) ro.disconnect(); };
  }, [count, rows]);

  const folded = !!cut && !open;
  return (
    <div data-members-wrap style={{ paddingBottom: 16 }}>
      <div ref={ref} data-members style={{ display: "flex", gap: GAP, flexWrap: "wrap", paddingTop: cut ? TOP_ROOM : 0,
        ...(folded ? { maxHeight: cut.max, overflow: "hidden" } : null) }}>
        {children}
      </div>
      {cut && (
        <button data-members-toggle onClick={() => setOpen(o => !o)}
          style={{ marginTop: 10, width: "100%", border: "1px solid " + T.border, background: "transparent", color: T.brand2, borderRadius: 10,
            padding: "7px 10px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
          {open ? "▴ ย่อรายชื่อ" : "▾ ดูทั้งหมด (+" + cut.hidden + " คน) · ในห้อง " + count + " คน"}
        </button>
      )}
    </div>
  );
}
