// Themes — เมนู "ธีมและการแสดงผล": เลือกหน้า → ดูตัวอย่าง → ใช้ธีม
// ไฟล์แยกอิสระ ไม่ import จาก App.jsx (รับข้อมูลและฟังก์ชันบันทึกผ่าน props)
// ดูตัวอย่าง: วาดหน้าจอจำลองด้วยธีมที่เลือก (ThemeScope themeId) — ไม่แตะค่าที่บันทึกไว้จนกว่าจะกดใช้
import { useState, useRef, useMemo, useEffect } from "react";
import { THEMES, THEME_BY_ID, THEME_SECTIONS, SECTION_LABEL, DEFAULT_THEME, RARITY_T, canUseTheme, themeItemId } from "./catalog.js";
import { THEME_SHOP_ENABLED } from "./config.js";
import { planBuyTheme } from "./wallet.js";
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


function Wallet({ gold, purple }) {
  return (
    <div style={{ display: "flex", gap: 14, alignItems: "center", fontSize: 12, fontWeight: 800 }}>
      <span style={{ color: C.yellow }}>🪙 {gold.toLocaleString()}</span>
      <span style={{ color: C.purple }}>💜 {purple.toLocaleString()}</span>
    </div>
  );
}

export default function AppearanceModal({ me, user, onClose, api, startSection }) {
  const [section, setSection] = useState(THEME_SECTIONS.includes(startSection) ? startSection : "voice");
  const current = useSectionTheme(section);
  const [tab, setTab] = useState("shop"); // shop = ร้านธีม | mine = ธีมของฉัน
  const [pv, setPv] = useState(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [bought, setBought] = useState([]); // ธีมที่เพิ่งซื้อ (แสดงผลทันทีก่อนข้อมูลบัญชีอัปเดต)
  const [after, setAfter] = useState(null); // ยอดคงเหลือหลังซื้อ
  const [confirm, setConfirm] = useState(null); // รหัสธีมที่รอยืนยันการซื้อ
  const mockRef = useRef(null);
  const shown = pv || current;
  const guest = !!user.isGuest;

  const meX = useMemo(() => (bought.length ? { ...me, inventory: [...(Array.isArray(me.inventory) ? me.inventory : []), ...bought.map(themeItemId)] } : me), [me, bought]);
  useEffect(() => { setAfter(null); }, [me.coins, me.purple, me.purpleBought]);
  const bal = after ? { gold: after.gold, purple: after.purple + after.purpleBought } : { gold: me.coins || 0, purple: (me.purple || 0) + (me.purpleBought || 0) };

  const showPreview = id => { setPv(id); setMsg(""); setConfirm(null); if (mockRef.current && mockRef.current.scrollIntoView) mockRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); };
  // ซื้อได้ไหม: คืนเหตุผล (ข้อความไทย) ถ้าซื้อไม่ได้, null ถ้าซื้อได้ — ใช้ตรรกะชุดเดียวกับตอนซื้อจริง
  const quote = id => { try { return { why: null, plan: planBuyTheme({ ...meX, isGuest: guest }, id) }; } catch (e) { return { why: e.message, plan: null }; } };

  async function apply(sec, id, okMsg) {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      if (id && !canUseTheme(meX, id)) throw new Error("ยังไม่ได้เป็นเจ้าของธีมนี้");
      if (!guest) await api.save(meX, sec, id); // บันทึกเข้าบัญชีก่อน สำเร็จแล้วค่อยเปลี่ยนจริง
      setSectionTheme(sec, id);
      setMsg(okMsg);
    } catch (e) { setMsg("⚠️ " + (e.message || e.code || "ผิดพลาด")); }
    setBusy(false);
  }
  async function applyAll(id) {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      if (id && !canUseTheme(meX, id)) throw new Error("ยังไม่ได้เป็นเจ้าของธีมนี้");
      if (!guest) await api.saveAll(meX, id);
      THEME_SECTIONS.forEach(s => setSectionTheme(s, id));
      setMsg(id ? "ใช้ธีมนี้กับทุกหน้าแล้ว" : "กลับธีมเดิมทุกหน้าแล้ว");
    } catch (e) { setMsg("⚠️ " + (e.message || e.code || "ผิดพลาด")); }
    setBusy(false);
  }
  async function doBuy(id) {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      if (!THEME_SHOP_ENABLED) throw new Error("ปิดร้านธีมชั่วคราว");
      if (guest) throw new Error("ล็อกอินด้วย Google ก่อนจึงจะซื้อธีมได้");
      if (!api.buy) throw new Error("ระบบซื้อธีมยังไม่พร้อม");
      const entry = await api.buy(id);
      setBought(b => (b.includes(id) ? b : [...b, id]));
      if (entry && entry.after) setAfter(entry.after);
      setConfirm(null); setPv(id);
      setMsg("🎉 ซื้อ " + THEME_BY_ID[id].name + " สำเร็จ — กด \"ใช้ธีมนี้\" ได้เลย");
    } catch (e) { setConfirm(null); setMsg("⚠️ " + (e.message || e.code || "ซื้อไม่สำเร็จ")); }
    setBusy(false);
  }

  const st = THEME_BY_ID[shown];
  const usable = canUseTheme(meX, shown);
  const q = !usable ? quote(shown) : null;
  const cq = confirm ? quote(confirm) : null;
  const list = tab === "mine" ? THEMES.filter(t => canUseTheme(meX, t.id)) : THEMES;

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "20px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: C.card, border: "1px solid " + C.borderHi, borderRadius: 20, overflow: "hidden", color: C.text }}>
        <div style={{ padding: "16px 16px 12px", background: "linear-gradient(135deg,#7C5CFC33," + C.card + ")" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>🎨 ธีมและการแสดงผล</div>
            <button onClick={onClose} aria-label="ปิด" style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.4)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>เลือกธีมแยกกันได้ในแต่ละหน้า (ส่วนหัวและเมนูล่างไม่เปลี่ยนสี) กด "ดูตัวอย่าง" ก่อนได้ — ยังไม่บันทึกจนกว่าจะกด "ใช้ธีมนี้"</div>
          {!guest && <div style={{ marginTop: 8 }}><Wallet gold={bal.gold} purple={bal.purple} /></div>}
        </div>

        <div style={{ display: "flex", gap: 6, padding: "10px 14px 0", flexWrap: "wrap" }}>
          {THEME_SECTIONS.map(s => <SectionChip key={s} s={s} active={section === s} onClick={() => { setSection(s); setPv(null); setMsg(""); setConfirm(null); }} />)}
        </div>

        <div ref={mockRef} style={{ padding: "12px 14px 0" }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 6, fontWeight: 700 }}>ตัวอย่าง: {st.name}{pv && pv !== current ? " (ยังไม่ได้ใช้)" : ""}</div>
          <Mock id={shown} />
          <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
            {usable
              ? (shown === current
                ? <span style={{ fontSize: 12, color: C.green, fontWeight: 800 }}>● ใช้อยู่ที่หน้า{SECTION_LABEL[section]}</span>
                : <button disabled={busy} onClick={() => apply(section, shown === DEFAULT_THEME ? null : shown, "ใช้ " + st.name + " กับหน้า" + SECTION_LABEL[section] + " แล้ว")} style={btn(true)}>ใช้ธีมนี้กับหน้า{SECTION_LABEL[section]}</button>)
              : (!THEME_SHOP_ENABLED
                ? <span style={{ fontSize: 12, color: C.yellow, fontWeight: 700 }}>🔒 ปิดร้านธีมชั่วคราว (ดูตัวอย่างได้)</span>
                : guest
                  ? <span style={{ fontSize: 12, color: C.yellow, fontWeight: 700 }}>🔒 ล็อกอินด้วย Google ก่อนจึงจะซื้อธีมได้ (ดูตัวอย่างได้)</span>
                  : <button disabled={busy} onClick={() => setConfirm(shown)} style={btn(true)}>ซื้อธีมนี้ · {st.cur === "gold" ? "🪙 " + st.price.toLocaleString() : "💜 " + st.price}</button>)}
            {usable && <button disabled={busy} onClick={() => applyAll(shown === DEFAULT_THEME ? null : shown)} style={btn(false)}>ใช้กับทุกหน้า</button>}
          </div>
          {!usable && THEME_SHOP_ENABLED && !guest && q && q.why && !confirm && <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>{q.why}</div>}

          {confirm && cq && (
            <div role="dialog" aria-label="ยืนยันการซื้อ" style={{ marginTop: 10, border: "1px solid " + C.borderHi, background: C.surface, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>ยืนยันซื้อ {THEME_BY_ID[confirm].name}?</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>
                ราคา <Price t={THEME_BY_ID[confirm]} />
                {cq.plan
                  ? <span> · คงเหลือหลังซื้อ {THEME_BY_ID[confirm].cur === "gold" ? <b style={{ color: C.yellow }}>🪙 {cq.plan.entry.after.gold.toLocaleString()}</b> : <b style={{ color: C.purple }}>💜 {(cq.plan.entry.after.purple + cq.plan.entry.after.purpleBought).toLocaleString()}</b>}</span>
                  : <span style={{ color: C.red }}> · {cq.why}</span>}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>ซื้อแล้วเป็นของคุณถาวร ใช้ได้ทุกหน้า ไม่คืนเหรียญ</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button disabled={busy || !cq.plan} onClick={() => doBuy(confirm)} style={btn(true, { opacity: cq.plan ? 1 : 0.5 })}>{busy ? "กำลังซื้อ…" : "ยืนยันซื้อ"}</button>
                <button disabled={busy} onClick={() => setConfirm(null)} style={btn(false)}>ยกเลิก</button>
              </div>
            </div>
          )}
          {msg && <div role="status" style={{ fontSize: 12, color: msg.startsWith("⚠️") ? C.red : C.green, marginTop: 8, lineHeight: 1.5 }}>{msg}</div>}
        </div>

        <div style={{ padding: "8px 14px 10px" }}>
          <div style={{ display: "flex", gap: 6, padding: "10px 0 4px" }}>
            <button onClick={() => setTab("shop")} style={btn(tab === "shop", { flex: 1 })}>🛍️ ร้านธีม</button>
            <button onClick={() => setTab("mine")} style={btn(tab === "mine", { flex: 1 })}>🎒 ธีมของฉัน ({THEMES.filter(t => canUseTheme(meX, t.id)).length})</button>
          </div>
          {list.map(t => {
            const ok = canUseTheme(meX, t.id);
            const isCur = current === t.id;
            return (
              <div key={t.id} data-theme-row={t.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 2px", borderBottom: "1px solid " + C.border }}>
                <Swatch t={t} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><span style={{ fontSize: 13, fontWeight: 800 }}>{t.name}</span><Chip t={t} />{isCur && <span style={{ fontSize: 10, color: C.green, fontWeight: 800 }}>● ใช้อยู่</span>}</div>
                  <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{t.th}</div>
                  <div style={{ fontSize: 12, marginTop: 3 }}>{t.price && ok ? <span style={{ color: C.green, fontWeight: 800 }}>✓ เป็นเจ้าของแล้ว</span> : <Price t={t} />}{!ok && <span style={{ marginLeft: 8, fontSize: 10, color: C.muted }}>🔒</span>}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                  <button onClick={() => showPreview(t.id)} style={btn(shown === t.id, { fontSize: 11, padding: "5px 11px" })}>ดูตัวอย่าง</button>
                  {ok && !isCur && tab === "mine" && <button disabled={busy} onClick={() => apply(section, t.id === DEFAULT_THEME ? null : t.id, "ใช้ " + t.name + " กับหน้า" + SECTION_LABEL[section] + " แล้ว")} style={btn(true, { fontSize: 11, padding: "5px 11px" })}>ใช้</button>}
                  {!ok && THEME_SHOP_ENABLED && !guest && <button disabled={busy} onClick={() => { setPv(t.id); setMsg(""); setConfirm(t.id); if (mockRef.current && mockRef.current.scrollIntoView) mockRef.current.scrollIntoView({ behavior: "smooth", block: "center" }); }} style={btn(true, { fontSize: 11, padding: "5px 11px" })}>ซื้อ</button>}
                </div>
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
