// Text FX — ปุ่ม "Aa" ข้างช่องพิมพ์แชท: เลือกสไตล์ให้ข้อความที่จะส่ง (เฉพาะที่ใช้ได้: ของฟรี + ที่ซื้อแล้ว)
// ค่าเริ่มต้นคือข้อความปกติ (ไม่ใส่สไตล์) — ผู้ใช้ต้องกดเลือกเองทุกครั้งที่เปิดแชท; ถ้าตั้ง "ข้อความแชท" ไว้ในเมนูตัวอักษรจะมีทางลัดให้
import { useState, useEffect, useRef } from "react";
import { FX, FX_DEFAULT, FX_BY_ID } from "./catalog.js";
import { canUseFx, resolveTextFx } from "./resolve.js";
import { TEXTFX_ENABLED } from "./config.js";
import TextFx from "./TextFx.jsx";

const C = { card: "#221F33", border: "#2E2A45", borderHi: "#4F46A8", brand2: "#A78BFA", text: "#F0EEFF", sub: "#9B94C4", green: "#10B981" };

// value = รหัสไอเทมที่เลือกไว้ (null = ปกติ), onChange(id|null), me = เอกสารผู้ใช้ของตัวเอง (ไว้ตรวจว่าใช้อะไรได้)
// inline = เมนูแสดงต่อท้ายแถวเดียวกัน (ในกล่องที่ตัดขอบ เช่นการ์ดโพสต์ — ใช้เมนูลอยไม่ได้) ต้องอยู่ในแถว flex ที่ flex-wrap
export default function MsgFxButton({ me, value, onChange, inline }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const f = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", f); document.addEventListener("touchstart", f);
    return () => { document.removeEventListener("mousedown", f); document.removeEventListener("touchstart", f); };
  }, [open]);
  if (!TEXTFX_ENABLED) return null;
  const list = FX.filter(t => t.id !== FX_DEFAULT && canUseFx(me, t.id));
  const saved = resolveTextFx(me, "message");
  const on = !!value && !!FX_BY_ID[value];
  return (
    <span ref={ref} style={inline ? { display: "contents" } : { position: "relative", flexShrink: 0 }}>
      <button type="button" data-msgfx-btn aria-label="เลือกสไตล์ข้อความ" onClick={() => setOpen(o => !o)}
        style={{ width: 36, height: 36, borderRadius: "50%", border: "1px solid " + (on ? "transparent" : C.borderHi), background: on ? "linear-gradient(135deg,#7C5CFC,#A78BFA)" : "transparent", color: on ? "#fff" : C.brand2, cursor: "pointer", fontSize: 13, fontWeight: 800, flexShrink: 0, fontFamily: "inherit" }}>Aa</button>
      {open && (
        <div data-msgfx-pop style={{ ...(inline ? { order: 99, flexBasis: "100%", boxSizing: "border-box" } : { position: "absolute", bottom: 44, left: 0, width: 230, zIndex: 20, boxShadow: "0 8px 28px rgba(0,0,0,.5)" }), maxHeight: 240, overflowY: "auto", background: C.card, border: "1px solid " + C.borderHi, borderRadius: 14, padding: 6, color: C.text, "--wm-dark": 1 }}>
          <div style={{ fontSize: 10, color: C.sub, padding: "2px 6px 6px" }}>สไตล์ของข้อความที่จะส่ง/โพสต์ (เลือกเองทุกครั้ง)</div>
          <div data-msgfx-opt="none" onClick={() => { onChange(null); setOpen(false); }} style={{ padding: "8px 8px", borderRadius: 9, cursor: "pointer", fontSize: 13, background: !on ? "#4F46A833" : "transparent" }}>ข้อความปกติ {!on && <b style={{ color: C.green, fontSize: 11 }}>● เลือกอยู่</b>}</div>
          {list.map(t => (
            <div key={t.id} data-msgfx-opt={t.id} onClick={() => { onChange(t.id); setOpen(false); }} style={{ padding: "8px 8px", borderRadius: 9, cursor: "pointer", background: value === t.id ? "#4F46A833" : "transparent" }}>
              <div style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.4 }}><TextFx fx={t.id} lite>ข้อความตัวอย่าง Hello</TextFx></div>
              <div style={{ fontSize: 10, color: C.sub }}>{t.name}{saved === t.id ? " · ★ ที่ตั้งไว้" : ""}{value === t.id ? " · ● เลือกอยู่" : ""}</div>
            </div>
          ))}
          {list.length === 0 && <div style={{ fontSize: 11, color: C.sub, padding: 6 }}>ยังไม่มีสไตล์ที่ใช้ได้</div>}
        </div>
      )}
    </span>
  );
}
