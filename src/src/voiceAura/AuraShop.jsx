// Voice Aura — เมนู "Voice Effects": ร้านค้า / ของฉัน / ดูตัวอย่าง
// ไฟล์แยกอิสระ ไม่ import จาก App.jsx (รับข้อมูลและฟังก์ชันซื้อ/สวมใส่ผ่าน props)
import { useState, useEffect, useRef } from "react";
import { AURAS, AURA_BY_ID, RARITY, ownsAura } from "./catalog.js";
import { VoiceAura, useAuraMode } from "./effects.jsx";

const C = { bg: "#0F0E17", card: "#221F33", surface: "#1A1825", border: "#2E2A45", borderHi: "#4F46A8", brand: "#7C5CFC", brand2: "#A78BFA", text: "#F0EEFF", sub: "#9B94C4", muted: "#5C5780", green: "#10B981", red: "#F43F5E", yellow: "#F59E0B", purple: "#C084FC" };
const btn = (primary, extra) => ({ fontFamily: "inherit", fontWeight: 700, fontSize: 12, padding: "7px 13px", borderRadius: 10, cursor: "pointer", border: primary ? "none" : "1px solid " + C.borderHi, background: primary ? "linear-gradient(135deg,#7C5CFC,#A78BFA)" : "transparent", color: primary ? "#fff" : C.brand2, ...extra });

function PCoin({ size = 13 }) {
  return <span style={{ display: "inline-block", width: size, height: size, borderRadius: "50%", background: "radial-gradient(circle at 30% 30%,#F3E8FF,#A855F7 55%,#6B21A8)", boxShadow: "0 0 6px rgba(168,85,247,.7)", verticalAlign: "-2px" }} />;
}
function Price({ a }) {
  if (!a.price) return <span style={{ color: C.green, fontWeight: 800 }}>ฟรี</span>;
  return a.cur === "gold"
    ? <span style={{ color: C.yellow, fontWeight: 800 }}>🪙 {a.price.toLocaleString()}</span>
    : <span style={{ color: C.purple, fontWeight: 800, display: "inline-flex", alignItems: "center", gap: 4 }}><PCoin />{a.price}</span>;
}
function RarityChip({ a }) {
  const r = RARITY[a.rarity];
  return <span style={{ fontSize: 10, fontWeight: 800, color: r.color, border: "1px solid " + r.color + "66", background: r.color + "1A", borderRadius: 20, padding: "1px 7px" }}>{r.label}</span>;
}

// รูปจำลองของผู้ใช้ (ใช้รูปจริงถ้ามี)
function MiniAvatar({ me, user, size }) {
  const img = me && (me.avatar || me.photo);
  const init = (user && user.init) || "ME";
  const inner = img
    ? <img src={img} alt="" referrerPolicy="no-referrer" style={{ width: size, height: size, borderRadius: "50%", objectFit: "cover", display: "block" }} />
    : <div style={{ width: size, height: size, borderRadius: "50%", background: "linear-gradient(135deg,#7C5CFC,#A78BFA)", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: size * 0.32 }}>{init}</div>;
  return <div style={{ padding: 3, borderRadius: "50%", border: "2.5px solid " + C.border }}>{inner}</div>;
}

// รูปย่อแบบนิ่งในรายการ (ไม่เล่นแอนิเมชันหลายอันพร้อมกัน → ลื่นบนมือถือ)
function Thumb({ a }) {
  const cs = a.c.length > 1 ? a.c : [a.c[0], a.c[0]];
  const ring = "conic-gradient(" + [...cs, cs[0]].join(",") + ")";
  return (
    <div style={{ width: 46, height: 46, borderRadius: "50%", background: ring, padding: 4, flexShrink: 0, boxShadow: "0 0 12px " + a.c[0] + "55" }}>
      <div style={{ width: "100%", height: "100%", borderRadius: "50%", background: C.card, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 14, color: C.brand2, fontWeight: 800 }}>{a.id === "green" ? "🎙️" : "✨"}</div>
    </div>
  );
}

export default function AuraShop({ me, user, onClose, api }) {
  const [tab, setTab] = useState("shop");
  const [sel, setSel] = useState("fire");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmId, setConfirmId] = useState(null);
  const [speak, setSpeak] = useState(true);
  const [auto, setAuto] = useState(true);
  const [mode, setMode] = useAuraMode();
  const confirmTimer = useRef(null);

  const gold = me.coins || 0;
  const purple = (me.purple || 0) + (me.purpleBought || 0);
  const equipped = me.aura && AURA_BY_ID[me.aura] && ownsAura(me, me.aura) ? me.aura : "green";

  // จำลองพูด/หยุดพูดอัตโนมัติในแท็บดูตัวอย่าง
  useEffect(() => {
    if (tab !== "preview" || !auto) return undefined;
    const t = setInterval(() => setSpeak(s => !s), 2600);
    return () => clearInterval(t);
  }, [tab, auto]);
  useEffect(() => () => clearTimeout(confirmTimer.current), []);

  async function run(fn, okMsg) {
    if (busy) return;
    setBusy(true); setMsg("");
    try { await fn(); setMsg(okMsg || ""); } catch (e) { setMsg("⚠️ " + (e.message || e.code || "ผิดพลาด")); }
    setBusy(false);
  }
  function tryBuy(a) {
    if (busy) return;
    if (confirmId !== a.id) { // กดครั้งแรก = ขอยืนยัน (กันกดพลาด)
      setConfirmId(a.id); setMsg("");
      clearTimeout(confirmTimer.current);
      confirmTimer.current = setTimeout(() => setConfirmId(null), 4000);
      return;
    }
    clearTimeout(confirmTimer.current); setConfirmId(null);
    run(() => api.buy(a.id), "🎉 ซื้อ " + a.name + " สำเร็จ — กด 'สวมใส่' ได้เลย");
  }
  const equip = (id, text) => run(() => api.equip(id), text);

  function BuyBtn({ a }) {
    if (!a.price) return null;
    if (ownsAura(me, a.id)) return <span style={{ fontSize: 11, color: C.green, fontWeight: 800 }}>✓ เป็นเจ้าของ</span>;
    const enough = a.cur === "gold" ? gold >= a.price : purple >= a.price;
    if (!enough) return <button disabled style={btn(false, { opacity: 0.45, cursor: "not-allowed", borderColor: C.border, color: C.muted })}>เหรียญไม่พอ</button>;
    const ask = confirmId === a.id;
    return <button disabled={busy} onClick={() => tryBuy(a)} style={btn(true, ask ? { background: "linear-gradient(135deg,#F59E0B,#F43F5E)" } : {})}>{ask ? "ยืนยันซื้อ ✓" : "ซื้อ"}</button>;
  }

  const tabs = [["shop", "🛍️ ร้านค้า"], ["mine", "🎒 ของฉัน"], ["preview", "👁️ ดูตัวอย่าง"]];
  const owned = AURAS.filter(a => ownsAura(me, a.id));
  const sa = AURA_BY_ID[sel];

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.7)", zIndex: 60, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "20px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: C.card, border: "1px solid " + C.borderHi, borderRadius: 20, overflow: "hidden", color: C.text }}>
        <div style={{ padding: "16px 16px 12px", background: "linear-gradient(135deg,#7C5CFC33," + C.card + ")" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ fontSize: 17, fontWeight: 800 }}>✨ Voice Aura</div>
            <button onClick={onClose} aria-label="ปิด" style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.4)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginTop: 10, flexWrap: "wrap" }}>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.yellow }}>🪙 {gold.toLocaleString()}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: C.purple, display: "flex", alignItems: "center", gap: 6 }}><PCoin size={16} />{purple}</div>
          </div>
          <div style={{ fontSize: 11, color: C.sub, marginTop: 6, lineHeight: 1.5 }}>เอฟเฟกต์จะแสดงรอบรูปของคุณตอนพูดในห้องเสียง ทุกคนในห้องเห็นเหมือนกัน</div>
          {msg && <div style={{ fontSize: 12, color: msg.startsWith("⚠️") ? C.red : C.green, marginTop: 8, lineHeight: 1.5 }}>{msg}</div>}
        </div>

        <div style={{ display: "flex", borderTop: "1px solid " + C.border, borderBottom: "1px solid " + C.border }}>
          {tabs.map(([k, l]) => (
            <button key={k} onClick={() => { setTab(k); setConfirmId(null); }} style={{ flex: 1, padding: "10px 6px", border: "none", borderBottom: "2px solid " + (tab === k ? C.brand : "transparent"), background: "transparent", color: tab === k ? C.brand2 : C.muted, fontWeight: 700, fontSize: 13, cursor: "pointer", fontFamily: "inherit" }}>{l}</button>
          ))}
        </div>

        {tab === "shop" && (
          <div style={{ padding: "6px 14px 10px" }}>
            {["gold", "purple"].map(cur => (
              <div key={cur}>
                <div style={{ fontSize: 12, fontWeight: 800, color: cur === "gold" ? C.yellow : C.purple, padding: "12px 2px 4px" }}>{cur === "gold" ? "🪙 เหรียญทอง" : "💜 เหรียญม่วง (พรีเมียม)"}</div>
                {AURAS.filter(a => a.cur === cur).map(a => (
                  <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 2px", borderBottom: "1px solid " + C.border }}>
                    <div onClick={() => { setSel(a.id); setTab("preview"); setSpeak(true); }} style={{ cursor: "pointer" }}><Thumb a={a} /></div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                        <span style={{ fontSize: 13, fontWeight: 800 }}>{a.name}</span><RarityChip a={a} />
                      </div>
                      <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{a.th}</div>
                      <div style={{ fontSize: 12, marginTop: 3 }}><Price a={a} /></div>
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                      <BuyBtn a={a} />
                      <button onClick={() => { setSel(a.id); setTab("preview"); setSpeak(true); }} style={btn(false, { fontSize: 11, padding: "4px 10px" })}>ดูตัวอย่าง</button>
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {tab === "mine" && (
          <div style={{ padding: "6px 14px 10px" }}>
            <div style={{ fontSize: 11, color: C.sub, padding: "8px 2px" }}>เลือกเอฟเฟกต์ที่ใช้ตอนพูด หรือกลับไปใช้วงเขียวเดิมได้ตลอดเวลา</div>
            {owned.map(a => {
              const on = equipped === a.id;
              return (
                <div key={a.id} style={{ display: "flex", alignItems: "center", gap: 11, padding: "9px 2px", borderBottom: "1px solid " + C.border }}>
                  <Thumb a={a} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}><span style={{ fontSize: 13, fontWeight: 800 }}>{a.name}</span><RarityChip a={a} /></div>
                    <div style={{ fontSize: 11, color: C.sub, marginTop: 2 }}>{a.id === "green" ? "ค่าเริ่มต้น (ฟรี)" : a.th}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5, alignItems: "flex-end" }}>
                    {on
                      ? <span style={{ fontSize: 11, color: C.green, fontWeight: 800 }}>● ใช้อยู่</span>
                      : <button disabled={busy} onClick={() => equip(a.id === "green" ? null : a.id, a.id === "green" ? "กลับไปใช้วงเขียวเดิมแล้ว" : "สวมใส่ " + a.name + " แล้ว")} style={btn(true)}>{a.id === "green" ? "ใช้วงเขียว" : "สวมใส่"}</button>}
                    <button onClick={() => { setSel(a.id); setTab("preview"); setSpeak(true); }} style={btn(false, { fontSize: 11, padding: "4px 10px" })}>ดูตัวอย่าง</button>
                  </div>
                </div>
              );
            })}
            {owned.length === 1 && <div style={{ textAlign: "center", color: C.muted, fontSize: 12, padding: "18px 0 8px" }}>ยังไม่มีเอฟเฟกต์พิเศษ — ไปเลือกซื้อที่แท็บร้านค้าได้เลย ✨</div>}
          </div>
        )}

        {tab === "preview" && sa && (
          <div style={{ padding: "14px 16px 16px" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
              {AURAS.filter(a => a.id !== "green").map(a => (
                <button key={a.id} onClick={() => setSel(a.id)} style={btn(sel === a.id, { fontSize: 11, padding: "4px 9px" })}>{a.name}</button>
              ))}
            </div>
            <div style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 16, height: 168, display: "flex", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <VoiceAura aura={sel} active={speak}><MiniAvatar me={me} user={user} size={72} /></VoiceAura>
                <div style={{ fontSize: 11, color: C.brand2, fontWeight: 700 }}>คุณ</div>
              </div>
              <div style={{ position: "absolute", top: 8, left: 10, fontSize: 11, fontWeight: 800, color: speak ? C.green : C.muted }}>{speak ? "● กำลังพูด" : "○ เงียบ"}</div>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 10, flexWrap: "wrap" }}>
              <button onClick={() => { setAuto(false); setSpeak(true); }} style={btn(speak && !auto)}>▶ เริ่มพูด</button>
              <button onClick={() => { setAuto(false); setSpeak(false); }} style={btn(!speak && !auto)}>■ หยุดพูด</button>
              <button onClick={() => setAuto(a => !a)} style={btn(auto)}>{auto ? "⟳ สลับอัตโนมัติ: เปิด" : "⟳ สลับอัตโนมัติ: ปิด"}</button>
            </div>
            <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <span style={{ fontSize: 15, fontWeight: 800 }}>{sa.name}</span><RarityChip a={sa} />
              <span style={{ marginLeft: "auto", fontSize: 13 }}><Price a={sa} /></span>
            </div>
            <div style={{ fontSize: 12, color: C.sub, marginTop: 4, lineHeight: 1.6 }}>{sa.th} — {sa.desc}</div>
            {mode !== "full" && <div style={{ fontSize: 11, color: C.yellow, marginTop: 8 }}>{mode === "off" ? "คุณปิดเอฟเฟกต์ไว้ — ตัวอย่างนี้จึงไม่แสดงในห้องเสียง (เปลี่ยนได้ด้านล่าง)" : "โหมดลดเอฟเฟกต์เปิดอยู่ — ตัวอย่างแสดงแบบเบา (ไม่มีอนุภาค)"}</div>}
            <div style={{ marginTop: 12, display: "flex", gap: 8, alignItems: "center", justifyContent: "flex-end" }}>
              {ownsAura(me, sa.id)
                ? (equipped === sa.id
                  ? <span style={{ fontSize: 12, color: C.green, fontWeight: 800 }}>● ใช้อยู่</span>
                  : <button disabled={busy} onClick={() => equip(sa.id, "สวมใส่ " + sa.name + " แล้ว")} style={btn(true)}>สวมใส่</button>)
                : <BuyBtn a={sa} />}
            </div>
          </div>
        )}

        <div style={{ padding: "10px 16px 14px", borderTop: "1px solid " + C.border }}>
          <div style={{ fontSize: 11, color: C.sub, marginBottom: 6, fontWeight: 700 }}>การแสดงผลเอฟเฟกต์ (เฉพาะเครื่องคุณ)</div>
          <div style={{ display: "flex", gap: 6 }}>
            {[["full", "เต็ม"], ["reduced", "ลดเอฟเฟกต์"], ["off", "ปิด"]].map(([k, l]) => (
              <button key={k} onClick={() => setMode(k)} style={btn(mode === k, { flex: 1 })}>{l}</button>
            ))}
          </div>
          <div style={{ fontSize: 10, color: C.muted, marginTop: 6, lineHeight: 1.5 }}>"ปิด" = กลับเป็นวงเขียวแบบเดิมสำหรับทุกคน • ถ้าเครื่องตั้งค่า "ลดการเคลื่อนไหว" ไว้ ระบบจะใช้แบบเบาให้อัตโนมัติ • ไม่มีเสียงประกอบเอฟเฟกต์</div>
        </div>
      </div>
    </div>
  );
}

