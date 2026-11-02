// Themes — เมนู "ธีมและการแสดงผล": เลือกหน้า → ดูตัวอย่าง → ใช้ธีม
// ไฟล์แยกอิสระ ไม่ import จาก App.jsx (รับข้อมูลและฟังก์ชันบันทึกผ่าน props)
// ดูตัวอย่าง: วาดหน้าจอจำลองด้วยธีมที่เลือก (ThemeScope themeId) — ไม่แตะค่าที่บันทึกไว้จนกว่าจะกดใช้
import { useState, useRef } from "react";
import { THEMES, THEME_BY_ID, THEME_SECTIONS, SECTION_LABEL, DEFAULT_THEME, RARITY_T, canUseTheme } from "./catalog.js";
import { useSectionTheme, setSectionTheme } from "./store.js";
import ThemeScope from "./ThemeScope.jsx";

const C = { card: "#221F33", surface: "#1A1825", border: "#2E2A45", borderHi: "#4F46A8", brand2: "#A78BFA", text: "#F0EEFF", sub: "#9B94C4", muted: "#8A84B0", green: "#10B981", red: "#F43F5E", yellow: "#F59E0B", purple: "#C084FC" };
const btn = (primary, extra) => ({ fontFamily: "inherit", fontWeight: 700, fontSize: 12, padding: "7px 13px", borderRadius: 10, cursor: "pointer", border: primary ? "none" : "1px solid " + C.borderHi, background: primary ? "linear-gradient(135deg,#7C5CFC,#A78BFA)" : "transparent", color: primary ? "#fff" : C.brand2, ...extra });

function Price({ t }) {
  if (!t.price) return <span style={{ color: C.green, fontWeight: 800 }}>ฟรี</span>;
  return t.cur === "gold"
    ? <span style={{ color: C.yellow, fontWeight: 800 }}>🪙 {t.price.toLocaleString()}</span>
    : <span style={{ color: C.purple, fontWeight: 800 }}>💜 {t.price}</span>;
}
function Chip({ t }) {
  const r = RARITY_T[t.rarity] || RARITY_T.common;
  return <span style={{ fontSize: 10, fontWeight: 800, color: r.color, border: "1px solid " + r.color + "66", background: r.color + "1A", borderRadius: 20, padding: "1px 7px" }}>{r.label}</span>;
}
function Swatch({ t }) {
  const [bg, card, acc] = t.preview;
  return (
    <div style={{ width: 46, height: 46, borderRadius: 12, background: bg, border: "1px solid " + C.border, position: "relative", flexShrink: 0, overflow: "hidden" }}>
      <div style={{ position: "absolute", left: 6, right: 6, top: 8, height: 18, borderRadius: 6, background: card }} />
      <div style={{ position: "absolute", left: 6, bottom: 7, width: 20, height: 7, borderRadius: 4, background: acc }} />
    </div>
  );
}

// หน้าจอจำลอง: ใช้ตัวแปรสีของธีม (สำรองเป็นสีเดิม) — โพสต์ / แชท / ห้องเสียง
function Mock({ id }) {
  const t = THEME_BY_ID[id];
  const v = (n, d) => "var(" + n + "," + d + ")";
  const panel = v("--panel-background", "#221F33"), border = v("--border-color", "#2E2A45"), text = v("--text-primary", "#F0EEFF");
  const sub = v("--text-secondary", "#9B94C4"), muted = v("--text-muted", "#5C5780"), grad = v("--button-background", "linear-gradient(135deg,#7C5CFC,#A78BFA)");
  const acc = v("--secondary-color", "#A78BFA"), green = v("--success-color", "#10B981");
  return (
    <ThemeScope themeId={id} section="">
      <div style={{ background: v("--page-background", v("--app-background", "#0F0E17")), borderRadius: 14, padding: 12, border: "1px solid " + C.border, transition: "background .3s" }} data-mock={t.id}>
        <div style={{ background: panel, border: "1px solid " + border, borderRadius: 14, padding: 10, boxShadow: v("--card-shadow", "0 4px 24px rgba(0,0,0,.3)") }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <div style={{ width: 28, height: 28, borderRadius: "50%", background: grad, color: "#fff", fontSize: 11, fontWeight: 800, display: "flex", alignItems: "center", justifyContent: "center" }}>TO</div>
            <div><div style={{ fontSize: 12, fontWeight: 800, color: text }}>Toi</div><div style={{ fontSize: 10, color: muted }}>เมื่อกี้</div></div>
            <div style={{ marginLeft: "auto", fontSize: 10, fontWeight: 700, color: acc, border: "1px solid " + border, borderRadius: 20, padding: "1px 8px" }}>✦ สบายดี</div>
          </div>
          <div style={{ fontSize: 12, color: sub, margin: "8px 0", lineHeight: 1.5 }}>วันนี้อากาศดีจัง ใครอยู่ในห้องเสียงบ้าง 🌿</div>
          <div style={{ display: "flex", gap: 6 }}>
            <span style={{ background: grad, color: "#fff", borderRadius: 10, padding: "5px 12px", fontSize: 11, fontWeight: 700 }}>ถูกใจ</span>
            <span style={{ border: "1px solid " + border, color: sub, borderRadius: 10, padding: "5px 12px", fontSize: 11, fontWeight: 600 }}>ความคิดเห็น</span>
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "10px 0" }}>
          <div style={{ alignSelf: "flex-start", background: v("--message-bubble", "#221F33"), border: "1px solid " + border, color: text, borderRadius: 14, padding: "6px 11px", fontSize: 12, maxWidth: "70%" }}>เข้ามาคุยกันหน่อยสิ</div>
          <div style={{ alignSelf: "flex-end", background: grad, color: "#fff", borderRadius: 14, padding: "6px 11px", fontSize: 12, maxWidth: "70%" }}>ไปเลย กำลังเข้าห้อง 🎙️</div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", background: panel, border: "1px solid " + border, borderRadius: 14, padding: "8px 10px" }}>
          {["A", "B", "C"].map((x, i) => (
            <div key={x} style={{ textAlign: "center" }}>
              <div style={{ width: 34, height: 34, borderRadius: "50%", border: "2.5px solid " + (i === 1 ? green : border), color: acc, fontWeight: 800, fontSize: 12, display: "flex", alignItems: "center", justifyContent: "center", background: panel }}>{x}</div>
              <div style={{ fontSize: 9, color: muted, marginTop: 2 }}>{i === 1 ? "กำลังพูด" : "เงียบ"}</div>
            </div>
          ))}
          <div style={{ marginLeft: "auto", fontSize: 11, color: sub }}>🎙️ ห้องเสียง</div>
        </div>
      </div>
    </ThemeScope>
  );
}

function SectionChip({ s, active, onClick }) {
  const id = useSectionTheme(s);
  return (
    <button onClick={onClick} style={{ ...btn(active), flex: "1 0 auto", padding: "6px 10px", textAlign: "center", lineHeight: 1.3 }}>
      <div>{SECTION_LABEL[s]}</div>
      <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.85 }}>{THEME_BY_ID[id].name}</div>
    </button>
  );
}

export default function AppearanceModal({ me, user, onClose, api, startSection }) {
  const [section, setSection] = useState(THEME_SECTIONS.includes(startSection) ? startSection : "voice");
  const current = useSectionTheme(section);
  const [pv, setPv] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const mockRef = useRef(null);
  const shown = pv || current;
  const showPreview = id => { setPv(id); setMsg(""); if (mockRef.current && mockRef.current.scrollIntoView) mockRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); };

  async function apply(sec, id, okMsg) {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      if (id && !canUseTheme(me, id)) throw new Error("ยังไม่ได้เป็นเจ้าของธีมนี้");
      if (!user.isGuest) await api.save(me, sec, id); // บันทึกเข้าบัญชีก่อน สำเร็จแล้วค่อยเปลี่ยนจริง
      setSectionTheme(sec, id);
      setMsg(okMsg);
    } catch (e) { setMsg("⚠️ " + (e.message || e.code || "ผิดพลาด")); }
    setBusy(false);
  }
  async function applyAll(id) {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      if (id && !canUseTheme(me, id)) throw new Error("ยังไม่ได้เป็นเจ้าของธีมนี้");
      if (!user.isGuest) await api.saveAll(me, id);
      THEME_SECTIONS.forEach(s => setSectionTheme(s, id));
      setMsg(id ? "ใช้ธีมนี้กับทุกหน้าแล้ว" : "กลับธีมเดิมทุกหน้าแล้ว");
    } catch (e) { setMsg("⚠️ " + (e.message || e.code || "ผิดพลาด")); }
    setBusy(false);
  }

  const st = THEME_BY_ID[shown];
  const usable = canUseTheme(me, shown);

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "20px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: C.card, border: "1px solid " + C.borderHi, borderRadius: 20, overflow: "hidden", color: C.text }}>
        <div style={{ padding: "16px 16px 12px", background: "linear-gradient(135deg,#7C5CFC33," + C.card + ")" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>🎨 ธีมและการแสดงผล</div>
            <button onClick={onClose} aria-label="ปิด" style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.4)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>เลือกธีมแยกกันได้ในแต่ละหน้า (ส่วนหัวและเมนูล่างไม่เปลี่ยนสี) กด "ดูตัวอย่าง" ก่อนได้ — ยังไม่บันทึกจนกว่าจะกด "ใช้ธีมนี้"</div>
          {msg && <div style={{ fontSize: 12, color: msg.startsWith("⚠️") ? C.red : C.green, marginTop: 8, lineHeight: 1.5 }}>{msg}</div>}
        </div>

        <div style={{ display: "flex", gap: 6, padding: "10px 14px 0", flexWrap: "wrap" }}>
          {THEME_SECTIONS.map(s => <SectionChip key={s} s={s} active={section === s} onClick={() => { setSection(s); setPv(null); setMsg(""); }} />)}
        </div>

        <div ref={mockRef} style={{ padding: "12px 14px 0" }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 6, fontWeight: 700 }}>ตัวอย่าง: {st.name}{pv && pv !== current ? " (ยังไม่ได้ใช้)" : ""}</div>
          <Mock id={shown} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            {usable
              ? (shown === current
                ? <span style={{ fontSize: 12, color: C.green, fontWeight: 800 }}>● ใช้อยู่ที่หน้า{SECTION_LABEL[section]}</span>
                : <button disabled={busy} onClick={() => apply(section, shown === DEFAULT_THEME ? null : shown, "ใช้ " + st.name + " กับหน้า" + SECTION_LABEL[section] + " แล้ว")} style={btn(true)}>ใช้ธีมนี้กับหน้า{SECTION_LABEL[section]}</button>)
              : <span style={{ fontSize: 12, color: C.yellow, fontWeight: 700 }}>🔒 ธีมนี้ต้องซื้อ — เปิดให้ซื้อในเฟสถัดไป (ดูตัวอย่างได้ก่อน)</span>}
            {usable && <button disabled={busy} onClick={() => applyAll(shown === DEFAULT_THEME ? null : shown)} style={btn(false)}>ใช้กับทุกหน้า</button>}
          </div>
        </div>

        <div style={{ padding: "8px 14px 10px" }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: C.sub, padding: "10px 2px 2px" }}>ธีมทั้งหมด</div>
          {THEMES.map(t => {
            const ok = canUseTheme(me, t.id);
            return (
              <div key={t.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 2px", borderBottom: "1px solid " + C.border }}>
                <Swatch t={t} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><span style={{ fontSize: 13, fontWeight: 800 }}>{t.name}</span><Chip t={t} />{current === t.id && <span style={{ fontSize: 10, color: C.green, fontWeight: 800 }}>● ใช้อยู่</span>}</div>
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{t.th}</div>
                  <div style={{ fontSize: 12, marginTop: 3 }}><Price t={t} />{!ok && <span style={{ marginLeft: 8, fontSize: 10, color: C.muted }}>🔒</span>}</div>
                </div>
                <button onClick={() => showPreview(t.id)} style={btn(shown === t.id, { fontSize: 11, padding: "5px 11px" })}>ดูตัวอย่าง</button>
              </div>
            );
          })}
        </div>

        <div style={{ padding: "10px 14px 14px", borderTop: "1px solid " + C.border, display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button disabled={busy} onClick={() => apply(section, null, "กลับธีมเดิมที่หน้า" + SECTION_LABEL[section] + " แล้ว")} style={btn(false)}>↺ กลับธีมเดิม (หน้านี้)</button>
          <button disabled={busy} onClick={() => applyAll(null)} style={btn(false)}>↺ กลับธีมเดิมทุกหน้า</button>
        </div>
      </div>
    </div>
  );
}
