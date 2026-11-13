// Text FX — หน้าแกลเลอรีดูตัวอย่างทุกฟอนต์/เอฟเฟกต์ (เปิดด้วย ?fxdemo=1 ต่อท้ายที่อยู่เว็บ)
// ใช้ตรวจหน้าตาบนมือถือจริง/เทียบระดับ ฟรี-ทอง-ม่วง — ยังไม่มีการซื้อ/บันทึก (ร้านจริงมาในเฟส 3)
import { useState } from "react";
import { FX, TIER_LABEL, KIND_LABEL, RARITY } from "./catalog.js";
import { TEXTFX_MODES, useTextFxMode, setTextFxMode } from "./store.js";
import TextFx from "./TextFx.jsx";

const C = { card: "#221F33", surface: "#1A1825", border: "#2E2A45", borderHi: "#4F46A8", brand2: "#A78BFA", text: "#F0EEFF", sub: "#9B94C4", muted: "#8A84B0", green: "#10B981", yellow: "#F59E0B", purple: "#C084FC" };
const MODE_LABEL = { full: "เคลื่อนไหว", reduced: "ลดแอนิเมชัน", off: "ปิดเอฟเฟกต์" };
// พื้นหลังจำลองธีมต่าง ๆ ของ Warmly (dark=1 พื้นเข้ม, 0 พื้นสว่าง)
const BGS = [
  { id: "dark", label: "มืด (ค่าเริ่มต้น)", bg: "#221F33", fg: "#F0EEFF", dark: 1 },
  { id: "cozy", label: "Warm & Cozy", bg: "#2F211A", fg: "#F5E6DA", dark: 1 },
  { id: "ocean", label: "Ocean", bg: "#0F2B36", fg: "#E3F6FF", dark: 1 },
  { id: "light", label: "สว่าง", bg: "#FFFFFF", fg: "#1F1B2E", dark: 0 },
];
const SAMPLES = ["สวัสดี Warmly 💜", "ชื่อยาวมาก ๆ ภาษาไทยอ่านได้ไหม"];

const pill = on => ({ fontFamily: "inherit", fontWeight: 700, fontSize: 12, padding: "6px 12px", borderRadius: 20, cursor: "pointer", border: "1px solid " + (on ? "transparent" : C.borderHi), background: on ? "linear-gradient(135deg,#7C5CFC,#A78BFA)" : "transparent", color: on ? "#fff" : C.brand2 });

export default function FxGallery({ onClose }) {
  const mode = useTextFxMode();
  const [bgId, setBgId] = useState("dark");
  const bg = BGS.find(b => b.id === bgId);
  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.75)", zIndex: 70, overflowY: "auto", padding: "16px 10px" }}>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: 460, margin: "0 auto", background: C.surface, border: "1px solid " + C.borderHi, borderRadius: 20, overflow: "hidden", color: C.text, fontFamily: "inherit" }}>
        <div style={{ padding: "14px 16px", display: "flex", justifyContent: "space-between", alignItems: "center", background: "linear-gradient(135deg,#7C5CFC33," + C.card + ")" }}>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800 }}>🔤 ตัวอย่างฟอนต์และเอฟเฟกต์ตัวอักษร</div>
            <div style={{ fontSize:12, color: C.sub, marginTop: 3 }}>หน้าดูตัวอย่างเท่านั้น (ยังไม่เปิดขาย) — เทียบ ฟรี / ทอง / ม่วง</div>
          </div>
          <button onClick={onClose} aria-label="ปิด" style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.4)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>
        <div style={{ padding: "10px 14px 4px" }}>
          <div style={{ fontSize:12, color: C.sub, marginBottom: 5, fontWeight: 700 }}>การเคลื่อนไหว</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{TEXTFX_MODES.map(m => <button key={m} onClick={() => setTextFxMode(m)} style={pill(mode === m)}>{MODE_LABEL[m]}</button>)}</div>
          <div style={{ fontSize:12, color: C.sub, margin: "10px 0 5px", fontWeight: 700 }}>พื้นหลังทดสอบ (จำลองธีม)</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{BGS.map(b => <button key={b.id} onClick={() => setBgId(b.id)} style={pill(bgId === b.id)}>{b.label}</button>)}</div>
        </div>
        {["free", "gold", "purple"].map(tier => (
          <div key={tier} style={{ padding: "12px 14px 4px" }}>
            <div style={{ fontSize: 13, fontWeight: 800, color: tier === "gold" ? C.yellow : tier === "purple" ? C.purple : C.green, marginBottom: 6 }}>
              {tier === "free" ? "🆓 " : tier === "gold" ? "🪙 " : "💜 "}ระดับ{TIER_LABEL[tier]}
            </div>
            {FX.filter(t => t.tier === tier).map(t => (
              <div key={t.id} data-fx-row={t.id} style={{ marginBottom: 10, border: "1px solid " + C.border, borderRadius: 14, overflow: "hidden" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 11px", background: C.card, fontSize: 12 }}>
                  <span style={{ fontWeight: 800 }}>{t.name} <span style={{ color: C.muted, fontWeight: 600 }}>· {KIND_LABEL[t.kind]} · {RARITY[t.rarity]}</span></span>
                  <span style={{ fontWeight: 800, color: t.cur === "gold" ? C.yellow : t.cur === "purple" ? C.purple : C.green }}>{t.cur === "gold" ? "🪙 " + t.price.toLocaleString() : t.cur === "purple" ? "💜 " + t.price : "ฟรี"}</span>
                </div>
                <div style={{ padding: "10px 12px", background: bg.bg, color: bg.fg, "--wm-dark": bg.dark }}>
                  <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1.35 }}><TextFx fx={t.id}>{SAMPLES[0]}</TextFx></div>
                  <div style={{ fontSize: 14, marginTop: 2, lineHeight: 1.5 }}><TextFx fx={t.id}>{SAMPLES[1]}</TextFx></div>
                  <div style={{ fontSize:12, opacity: 0.7, marginTop: 4 }}>{t.th}</div>
                </div>
              </div>
            ))}
          </div>
        ))}
        <div style={{ height: 12 }} />
      </div>
    </div>
  );
}
