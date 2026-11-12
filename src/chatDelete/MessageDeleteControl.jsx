// ปุ่ม 🗑️ เล็ก ๆ ข้างเวลาของ "ข้อความของเรา" ในแชทส่วนตัว → กดแล้วมีกล่องยืนยันในบรรทัด → ลบผ่าน Backend
// (ข้อความของอีกฝ่าย/ของขวัญ/ข้อความที่ยังส่งไม่เสร็จ จะไม่มีปุ่มนี้ — ตัดสินที่ BubbleChat)
import { useState } from "react";

const C = { border: "#2E2A45", sub: "#9B94C4", text: "#F0EEFF", red: "#F87171", yellow: "#F59E0B", card: "#221F33" };
const btn = (extra) => ({ border: "none", fontFamily: "inherit", fontSize: 11, cursor: "pointer", borderRadius: 8, padding: "4px 10px", ...extra });

export default function MessageDeleteControl({ onDelete }) {
  const [step, setStep] = useState("idle"); // idle | confirm | busy
  const [err, setErr] = useState("");
  async function go() {
    setStep("busy"); setErr("");
    try { await onDelete(); /* สำเร็จ = ข้อความหายจากรายการ คอมโพเนนต์นี้จะถูกถอดออกเอง */ }
    catch (e) { setErr((e && e.message) || "ลบไม่สำเร็จ"); setStep("confirm"); }
  }
  if (step === "idle") {
    return <button type="button" data-msg-del aria-label="ลบข้อความนี้" title="ลบข้อความ (อีกฝ่ายก็จะไม่เห็น)" onClick={() => setStep("confirm")} style={btn({ background: "transparent", color: C.sub, padding: "0 4px", opacity: 0.7, fontSize: 11 })}>🗑️</button>;
  }
  return (
    <div data-msg-del-confirm style={{ background: C.card, border: "1px solid " + C.border, borderRadius: 10, padding: "8px 10px", marginTop: 4, maxWidth: 240, flexBasis: "100%", textAlign: "left" }}>
      <div style={{ fontSize: 12, color: C.text, fontWeight: 700 }}>ลบข้อความนี้?</div>
      <div style={{ fontSize: 11, color: C.sub, margin: "2px 0 8px" }}>อีกฝ่ายจะไม่เห็นข้อความนี้อีก และกู้คืนไม่ได้</div>
      <div style={{ display: "flex", gap: 6 }}>
        <button type="button" data-msg-del-yes disabled={step === "busy"} onClick={go} style={btn({ background: C.red, color: "#fff", opacity: step === "busy" ? 0.6 : 1 })}>{step === "busy" ? "กำลังลบ..." : "ลบเลย"}</button>
        <button type="button" data-msg-del-no disabled={step === "busy"} onClick={() => { setStep("idle"); setErr(""); }} style={btn({ background: "transparent", color: C.sub, border: "1px solid " + C.border })}>ยกเลิก</button>
      </div>
      {err && <div data-msg-del-err style={{ fontSize: 11, color: C.yellow, marginTop: 6 }}>⚠️ {err}</div>}
    </div>
  );
}
