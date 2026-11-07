// Text FX — แผง "ตัวอักษร": เลือกฟอนต์/เอฟเฟกต์แยกกันได้ 5 จุด → ดูตัวอย่าง → ใช้ / กลับแบบเดิม
// ไฟล์แยกอิสระ ไม่ import จาก App.jsx (รับข้อมูลและฟังก์ชันบันทึกผ่าน props) — ฝังในเมนู "ธีมและการแสดงผล" เป็นแท็บ
import { useState, useMemo, useEffect } from "react";
import { FX, FX_BY_ID, FX_DEFAULT, TIER_LABEL, KIND_LABEL, RARITY, fontItemId } from "./catalog.js";
import { TEXTFX_AREAS, AREA_LABEL, canUseFx, resolveTextFx } from "./resolve.js";
import { TEXTFX_SHOP_ENABLED } from "./config.js";
import { planBuyFx } from "./wallet.js";
import { TEXTFX_MODES, useTextFxMode, setTextFxMode } from "./store.js";
import TextFx from "./TextFx.jsx";

const C = { card: "#221F33", surface: "#1A1825", border: "#2E2A45", borderHi: "#4F46A8", brand2: "#A78BFA", text: "#F0EEFF", sub: "#9B94C4", muted: "#8A84B0", green: "#10B981", red: "#F43F5E", yellow: "#F59E0B", purple: "#C084FC" };
const MODE_LABEL = { full: "เคลื่อนไหว", reduced: "ลดแอนิเมชัน", off: "ปิดเอฟเฟกต์" };
const AREA_HINT = {
  name: "ชื่อของคุณในโปรไฟล์ โพสต์ และแชท",
  voiceName: "ชื่อใต้รูปของคุณในห้องเสียง และชื่อในแชทของห้อง",
  roomName: "ชื่อห้องที่คุณเป็นโฮสต์ (ในรายการห้องและในห้อง)",
  bio: "ข้อความแนะนำตัวในโปรไฟล์",
  message: "ใช้กับข้อความที่คุณเลือกส่งเอง — กดปุ่ม Aa ข้างช่องพิมพ์ในแชท (ข้อความอื่นยังเป็นปกติ)",
};
const btn = (primary, extra) => ({ fontFamily: "inherit", fontWeight: 700, fontSize: 12, padding: "7px 13px", borderRadius: 10, cursor: "pointer", border: primary ? "none" : "1px solid " + C.borderHi, background: primary ? "linear-gradient(135deg,#7C5CFC,#A78BFA)" : "transparent", color: primary ? "#fff" : C.brand2, ...extra });
const pill = on => ({ fontFamily: "inherit", fontWeight: 700, fontSize: 11, padding: "5px 11px", borderRadius: 20, cursor: "pointer", border: "1px solid " + (on ? "transparent" : C.borderHi), background: on ? "linear-gradient(135deg,#7C5CFC,#A78BFA)" : "transparent", color: on ? "#fff" : C.brand2 });

function Price({ t }) {
  if (!t.price) return <span style={{ color: C.green, fontWeight: 800 }}>ฟรี</span>;
  return t.cur === "gold" ? <span style={{ color: C.yellow, fontWeight: 800 }}>🪙 {t.price.toLocaleString()}</span> : <span style={{ color: C.purple, fontWeight: 800 }}>💜 {t.price}</span>;
}

export default function FxSettings({ me, user, api }) {
  const [area, setArea] = useState("name");
  const [pv, setPv] = useState(null);
  const [light, setLight] = useState(false);
  const [local, setLocal] = useState({}); // ค่าที่เพิ่งบันทึก (แสดงทันทีก่อนข้อมูลบัญชีอัปเดต)
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState("shop"); // shop = ร้านฟอนต์ | mine = ฟอนต์ของฉัน
  const [bought, setBought] = useState([]); // ที่เพิ่งซื้อ (แสดงผลทันทีก่อนข้อมูลบัญชีอัปเดต)
  const [after, setAfter] = useState(null); // ยอดคงเหลือหลังซื้อ
  const [confirm, setConfirm] = useState(null); // รหัสที่รอยืนยันการซื้อ
  const mode = useTextFxMode();
  const guest = !!(user && user.isGuest);
  const myName = (me && me.name) || (user && user.name) || "ผู้ใช้";

  const meX = useMemo(() => ({
    ...(me || {}),
    inventory: [...(me && Array.isArray(me.inventory) ? me.inventory : []), ...bought.map(fontItemId)],
    textFx: { ...((me && me.textFx) || {}), ...local },
  }), [me, local, bought]);
  useEffect(() => { setAfter(null); }, [me && me.coins, me && me.purple, me && me.purpleBought]);
  const bal = after ? { gold: after.gold, purple: after.purple + after.purpleBought } : { gold: (me && me.coins) || 0, purple: ((me && me.purple) || 0) + ((me && me.purpleBought) || 0) };
  // ซื้อได้ไหม: คืนเหตุผล (ข้อความไทย) ถ้าซื้อไม่ได้ — ใช้ตรรกะชุดเดียวกับตอนซื้อจริง
  const quote = id => { try { return { why: null, plan: planBuyFx({ ...meX, isGuest: guest }, id) }; } catch (e) { return { why: e.message, plan: null }; } };
  const cur = a => resolveTextFx(meX, a) || FX_DEFAULT;
  const current = cur(area);
  const shown = pv || current;
  const item = FX_BY_ID[shown];
  const usable = canUseFx(meX, shown);

  const SAMPLE = {
    name: { text: myName, size: 20, weight: 800 },
    voiceName: { text: myName, size: 13, weight: 700 },
    roomName: { text: "ห้องคุยสบาย ๆ", size: 17, weight: 700 },
    bio: { text: "ชอบคุยเล่น • ฟังเพื่อนใหม่ 💜", size: 14, weight: 500 },
    message: { text: "สวัสดีทุกคน วันนี้เป็นไงบ้าง 😊", size: 14, weight: 500 },
  }[area];

  async function save(a, id, ok) {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      if (guest) throw new Error("ล็อกอินด้วย Google ก่อนจึงจะบันทึกได้");
      if (id && !canUseFx(meX, id)) throw new Error("ยังไม่ได้เป็นเจ้าของฟอนต์นี้");
      await api.save(meX, a, id); // บันทึกก่อน สำเร็จแล้วค่อยเปลี่ยนจริง
      setLocal(l => ({ ...l, [a]: id || null }));
      setMsg(ok);
    } catch (e) { setMsg("⚠️ " + (e.message || e.code || "ผิดพลาด")); }
    setBusy(false);
  }
  async function doBuy(id) {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      if (!TEXTFX_SHOP_ENABLED) throw new Error("ปิดร้านฟอนต์ชั่วคราว");
      if (guest) throw new Error("ล็อกอินด้วย Google ก่อนจึงจะซื้อฟอนต์ได้");
      if (!api.buy) throw new Error("ระบบซื้อฟอนต์ยังไม่พร้อม");
      const entry = await api.buy(id);
      setBought(b => (b.includes(id) ? b : [...b, id]));
      if (entry && entry.after) setAfter(entry.after);
      setConfirm(null); setPv(id);
      setMsg("🎉 ซื้อ " + FX_BY_ID[id].name + " สำเร็จ — กด \"ใช้กับ" + AREA_LABEL[area] + "\" ได้เลย");
    } catch (e) { setConfirm(null); setMsg("⚠️ " + (e.message || e.code || "ซื้อไม่สำเร็จ")); }
    setBusy(false);
  }
  async function saveAll(id, ok) {
    if (busy) return;
    setBusy(true); setMsg("");
    try {
      if (guest) throw new Error("ล็อกอินด้วย Google ก่อนจึงจะบันทึกได้");
      if (id && !canUseFx(meX, id)) throw new Error("ยังไม่ได้เป็นเจ้าของฟอนต์นี้");
      await api.saveAll(meX, id);
      const l = {}; TEXTFX_AREAS.forEach(a => { l[a] = id || null; });
      setLocal(l);
      setMsg(ok);
    } catch (e) { setMsg("⚠️ " + (e.message || e.code || "ผิดพลาด")); }
    setBusy(false);
  }

  const pvBg = light ? { background: "#FFFFFF", color: "#1F1B2E", "--wm-dark": 0 } : { background: C.card, color: C.text, "--wm-dark": 1 };

  return (
    <div data-fx-settings style={{ "--wm-dark": 1 }}>
      <div style={{ padding: "10px 14px 0", fontSize: 11, color: C.sub, lineHeight: 1.5 }}>
        เลือกฟอนต์/เอฟเฟกต์แยกกันได้ในแต่ละจุด คนอื่นจะเห็นตามที่คุณเลือก กด "ดูตัวอย่าง" ก่อนได้ — ยังไม่บันทึกจนกว่าจะกด "ใช้"
      </div>
      <div style={{ display: "flex", gap: 6, padding: "10px 14px 0", flexWrap: "wrap" }}>
        {TEXTFX_AREAS.map(a => (
          <button key={a} data-fx-area={a} onClick={() => { setArea(a); setPv(null); setMsg(""); setConfirm(null); }} style={{ ...btn(area === a), flex: "1 0 auto", padding: "6px 10px", textAlign: "center", lineHeight: 1.3 }}>
            <div>{AREA_LABEL[a]}</div>
            <div style={{ fontSize: 9, fontWeight: 600, opacity: 0.85 }}>{FX_BY_ID[cur(a)].name}</div>
          </button>
        ))}
      </div>

      <div style={{ padding: "12px 14px 0" }}>
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 6, fontWeight: 700 }}>ตัวอย่าง: {item.name}{pv && pv !== current ? " (ยังไม่ได้ใช้)" : ""}</div>
        <div data-fx-preview style={{ ...pvBg, borderRadius: 14, padding: "14px 14px", border: "1px solid " + C.border, minHeight: 46 }}>
          <div style={{ fontSize: SAMPLE.size, fontWeight: SAMPLE.weight, lineHeight: 1.4 }}><TextFx fx={shown}>{SAMPLE.text}</TextFx></div>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
          <span style={{ fontSize: 10, color: C.muted }}>{AREA_HINT[area]}</span>
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
          <button onClick={() => setLight(false)} style={pill(!light)}>พื้นมืด</button>
          <button onClick={() => setLight(true)} style={pill(light)}>พื้นสว่าง (ธีมสว่าง)</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap", alignItems: "center" }}>
          {usable
            ? (shown === current
              ? <span style={{ fontSize: 12, color: C.green, fontWeight: 800 }}>● ใช้อยู่ที่ {AREA_LABEL[area]}</span>
              : <button disabled={busy} data-fx-apply onClick={() => save(area, shown === FX_DEFAULT ? null : shown, "ใช้ " + item.name + " กับ" + AREA_LABEL[area] + " แล้ว")} style={btn(true)}>ใช้กับ{AREA_LABEL[area]}</button>)
            : (!TEXTFX_SHOP_ENABLED
              ? <span style={{ fontSize: 12, color: C.yellow, fontWeight: 700 }}>🔒 ปิดร้านฟอนต์ชั่วคราว (ดูตัวอย่างได้)</span>
              : guest
                ? <span style={{ fontSize: 12, color: C.yellow, fontWeight: 700 }}>🔒 ล็อกอินด้วย Google ก่อนจึงจะซื้อฟอนต์ได้ (ดูตัวอย่างได้)</span>
                : <button disabled={busy} data-fx-buy onClick={() => setConfirm(shown)} style={btn(true)}>ซื้อฟอนต์นี้ · {item.cur === "gold" ? "🪙 " + item.price.toLocaleString() : "💜 " + item.price}</button>)}
          {usable && area !== "message" && <button disabled={busy} data-fx-apply-all onClick={() => saveAll(shown === FX_DEFAULT ? null : shown, "ใช้ " + item.name + " กับทุกจุดแล้ว")} style={btn(false)}>ใช้กับทุกจุด</button>}
        </div>
        {!usable && TEXTFX_SHOP_ENABLED && !guest && !confirm && (() => { const q = quote(shown); return q.why ? <div style={{ fontSize: 11, color: C.red, marginTop: 6 }}>{q.why}</div> : null; })()}
        {confirm && (() => {
          const ct = FX_BY_ID[confirm], cq = quote(confirm);
          return (
            <div role="dialog" aria-label="ยืนยันการซื้อ" data-fx-confirm style={{ marginTop: 10, border: "1px solid " + C.borderHi, background: C.surface, borderRadius: 14, padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800 }}>ยืนยันซื้อ {ct.name}?</div>
              <div style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>
                ราคา <Price t={ct} />
                {cq.plan
                  ? <span> · คงเหลือหลังซื้อ {ct.cur === "gold" ? <b style={{ color: C.yellow }}>🪙 {cq.plan.entry.after.gold.toLocaleString()}</b> : <b style={{ color: C.purple }}>💜 {(cq.plan.entry.after.purple + cq.plan.entry.after.purpleBought).toLocaleString()}</b>}</span>
                  : <span style={{ color: C.red }}> · {cq.why}</span>}
              </div>
              <div style={{ fontSize: 10, color: C.muted, marginTop: 4 }}>ซื้อแล้วเป็นของคุณถาวร ใช้ได้ทุกจุด ไม่คืนเหรียญ</div>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                <button disabled={busy || !cq.plan} data-fx-confirm-yes onClick={() => doBuy(confirm)} style={btn(true, { opacity: cq.plan ? 1 : 0.5 })}>{busy ? "กำลังซื้อ…" : "ยืนยันซื้อ"}</button>
                <button disabled={busy} onClick={() => setConfirm(null)} style={btn(false)}>ยกเลิก</button>
              </div>
            </div>
          );
        })()}
        {msg && <div role="status" style={{ fontSize: 12, color: msg.startsWith("⚠️") ? C.red : C.green, marginTop: 8, lineHeight: 1.5 }}>{msg}</div>}
      </div>

      <div style={{ padding: "12px 14px 0" }}>
        <div style={{ fontSize: 11, color: C.sub, marginBottom: 5, fontWeight: 700 }}>การเคลื่อนไหว (เฉพาะเครื่องนี้ — มีผลกับสิ่งที่คุณเห็น)</div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>{TEXTFX_MODES.map(m => <button key={m} onClick={() => setTextFxMode(m)} style={pill(mode === m)}>{MODE_LABEL[m]}</button>)}</div>
      </div>

      <div style={{ padding: "8px 14px 10px" }}>
        {!guest && <div data-fx-balance style={{ fontSize: 12, fontWeight: 800, display: "flex", gap: 14, padding: "2px 0 4px" }}><span style={{ color: C.yellow }}>🪙 {bal.gold.toLocaleString()}</span><span style={{ color: C.purple }}>💜 {bal.purple.toLocaleString()}</span></div>}
        <div style={{ display: "flex", gap: 6, padding: "6px 0 2px" }}>
          <button data-fx-tab="shop" onClick={() => setTab("shop")} style={btn(tab === "shop", { flex: 1 })}>🛍️ ร้านฟอนต์</button>
          <button data-fx-tab="mine" onClick={() => setTab("mine")} style={btn(tab === "mine", { flex: 1 })}>🎒 ฟอนต์ของฉัน ({FX.filter(t => canUseFx(meX, t.id)).length})</button>
        </div>
        {["free", "gold", "purple"].map(tier => FX.some(t => t.tier === tier && (tab === "shop" || canUseFx(meX, t.id))) && (
          <div key={tier}>
            <div style={{ fontSize: 12, fontWeight: 800, margin: "12px 0 2px", color: tier === "gold" ? C.yellow : tier === "purple" ? C.purple : C.green }}>{tier === "free" ? "🆓 " : tier === "gold" ? "🪙 " : "💜 "}ระดับ{TIER_LABEL[tier]}</div>
            {FX.filter(t => t.tier === tier && (tab === "shop" || canUseFx(meX, t.id))).map(t => {
              const ok = canUseFx(meX, t.id);
              const isCur = current === t.id;
              return (
                <div key={t.id} data-fx-row={t.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 2px", borderBottom: "1px solid " + C.border }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.4, color: C.text, "--wm-dark": 1 }}><TextFx fx={t.id} lite>{myName}</TextFx></div>
                    <div style={{ fontSize: 11, color: C.sub }}>{t.name} · {KIND_LABEL[t.kind]} · {RARITY[t.rarity]}{isCur ? <b style={{ color: C.green }}> ● ใช้อยู่</b> : null}</div>
                    <div style={{ fontSize: 12, marginTop: 2 }}>{t.price && ok ? <span style={{ color: C.green, fontWeight: 800 }}>✓ เป็นเจ้าของแล้ว</span> : <Price t={t} />}{!ok && <span style={{ marginLeft: 8, fontSize: 10, color: C.muted }}>🔒</span>}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    <button onClick={() => { setPv(t.id); setMsg(""); setConfirm(null); }} style={btn(shown === t.id, { fontSize: 11, padding: "5px 11px" })}>ดูตัวอย่าง</button>
                    {ok && !isCur && <button disabled={busy} onClick={() => save(area, t.id === FX_DEFAULT ? null : t.id, "ใช้ " + t.name + " กับ" + AREA_LABEL[area] + " แล้ว")} style={btn(true, { fontSize: 11, padding: "5px 11px" })}>ใช้</button>}
                    {!ok && TEXTFX_SHOP_ENABLED && !guest && <button disabled={busy} data-fx-row-buy onClick={() => { setPv(t.id); setMsg(""); setConfirm(t.id); }} style={btn(true, { fontSize: 11, padding: "5px 11px" })}>ซื้อ</button>}
                  </div>
                </div>
              );
            })}
          </div>
        ))}
      </div>

      <div style={{ padding: "10px 14px 14px", borderTop: "1px solid " + C.border, display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button disabled={busy} data-fx-reset onClick={() => save(area, null, "กลับแบบเดิมที่" + AREA_LABEL[area] + " แล้ว")} style={btn(false)}>↺ กลับแบบเดิม (จุดนี้)</button>
        <button disabled={busy} data-fx-reset-all onClick={() => saveAll(null, "กลับแบบเดิมทุกจุดแล้ว")} style={btn(false)}>↺ กลับแบบเดิมทุกจุด</button>
      </div>
    </div>
  );
}
