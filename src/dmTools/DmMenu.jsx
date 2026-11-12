// DM Tools — เมนู ⋯ ในหัวแชทส่วนตัว: ปิดเสียงแชทนี้ / ลบประวัติ (ฝั่งเรา) / บล็อก-เลิกบล็อก
import { useState } from "react";

const C = { card: "#221F33", border: "#2E2A45", borderHi: "#4F46A8", brand2: "#A78BFA", text: "#F0EEFF", sub: "#9B94C4", yellow: "#F59E0B", red: "#F87171" };
const item = (extra) => ({ display: "block", width: "100%", textAlign: "left", fontFamily: "inherit", fontSize: 13, padding: "10px 12px", border: "none", background: "transparent", color: C.text, cursor: "pointer", ...extra });

export default function DmMenu({ peerName, muted, blocked, onToggleMute, onClear, onToggleBlock, onDeleteAll }) {
  const [open, setOpen] = useState(false);
  const [confirm, setConfirm] = useState(null); // "clear" | "all" | "block"
  const [err, setErr] = useState("");
  const close = () => { setOpen(false); setConfirm(null); };
  async function run(fn) { setErr(""); try { const r = await fn(); if (r === false) { setErr("ทำไม่สำเร็จ ลองใหม่อีกครั้ง"); return; } close(); } catch (e) { setErr("ทำไม่สำเร็จ (" + ((e && (e.code || e.message)) || "เน็ตมีปัญหา") + ")"); } }
  return (
    <div style={{ position: "relative" }}>
      <button type="button" data-dm-menu-btn onClick={() => { setOpen(o => !o); setConfirm(null); setErr(""); }} aria-label="เมนูแชท" style={{ border: "none", background: "transparent", color: C.sub, fontSize: 22, cursor: "pointer", padding: "0 8px", fontFamily: "inherit", lineHeight: 1 }}>⋯</button>
      {open && (<>
        <div onClick={close} style={{ position: "fixed", inset: 0, zIndex: 40 }} />
        <div data-dm-menu style={{ position: "absolute", right: 0, top: "100%", zIndex: 41, minWidth: 230, background: C.card, border: "1px solid " + C.borderHi, borderRadius: 12, overflow: "hidden", boxShadow: "0 8px 24px rgba(0,0,0,.5)" }}>
          {!confirm && (<>
            <button type="button" data-dm-mute onClick={() => { onToggleMute(); close(); }} style={item()}>{muted ? "🔔 เปิดเสียงแจ้งเตือนแชทนี้" : "🔕 ปิดเสียงแจ้งเตือนแชทนี้"}</button>
            <button type="button" data-dm-clear onClick={() => setConfirm("clear")} style={item({ borderTop: "1px solid " + C.border })}>{onDeleteAll ? "🧹 ล้างประวัติ (เฉพาะฝั่งฉัน)" : "🗑️ ลบประวัติแชทนี้"}</button>
            {onDeleteAll && <button type="button" data-dm-delete-all onClick={() => setConfirm("all")} style={item({ borderTop: "1px solid " + C.border, color: C.red })}>🗑️ ลบข้อความทั้งหมด (หายทั้งสองฝั่ง)</button>}
            <button type="button" data-dm-block onClick={() => blocked ? run(onToggleBlock) : setConfirm("block")} style={item({ borderTop: "1px solid " + C.border, color: blocked ? C.brand2 : C.red })}>{blocked ? "✅ เลิกบล็อกผู้ใช้นี้" : "🚫 บล็อกผู้ใช้นี้"}</button>
          </>)}
          {confirm === "clear" && (
            <div data-dm-confirm="clear" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>ลบประวัติแชทกับ {peerName}?</div>
              <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 10px" }}>ข้อความเก่าจะหายจากหน้าจอของคุณเท่านั้น อีกฝ่ายยังเห็นตามเดิม ข้อความใหม่หลังจากนี้จะแสดงตามปกติ</div>
              <div style={{ display: "flex", gap: 6 }}><button type="button" data-dm-confirm-yes onClick={() => run(onClear)} style={item({ flex: 1, textAlign: "center", background: C.red, color: "#fff", borderRadius: 8, padding: "8px" })}>ลบเลย</button><button type="button" onClick={() => setConfirm(null)} style={item({ flex: 1, textAlign: "center", border: "1px solid " + C.border, borderRadius: 8, padding: "8px" })}>ยกเลิก</button></div>
            </div>
          )}
          {confirm === "all" && (
            <div data-dm-confirm="all" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>ลบข้อความทั้งหมดกับ {peerName}?</div>
              <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 10px" }}>ข้อความทุกข้อความในแชทนี้ (รวมของ {peerName}) จะหายไปจากหน้าจอของทั้งสองฝั่งทันที และกู้คืนไม่ได้ แชทอื่นไม่ได้รับผลกระทบ</div>
              <div style={{ display: "flex", gap: 6 }}><button type="button" data-dm-confirm-yes onClick={() => run(onDeleteAll)} style={item({ flex: 1, textAlign: "center", background: C.red, color: "#fff", borderRadius: 8, padding: "8px" })}>ลบทั้งหมด</button><button type="button" onClick={() => setConfirm(null)} style={item({ flex: 1, textAlign: "center", border: "1px solid " + C.border, borderRadius: 8, padding: "8px" })}>ยกเลิก</button></div>
            </div>
          )}
          {confirm === "block" && (
            <div data-dm-confirm="block" style={{ padding: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>บล็อก {peerName}?</div>
              <div style={{ fontSize: 11, color: C.sub, margin: "4px 0 10px" }}>เขาจะส่งข้อความหาคุณไม่ได้ ข้อความของเขาจะไม่แสดงในแชทส่วนตัวของคุณ และคุณจะไม่ได้ยินเสียงแจ้งเตือนจากเขา เลิกบล็อกได้ทุกเมื่อ</div>
              <div style={{ display: "flex", gap: 6 }}><button type="button" data-dm-confirm-yes onClick={() => run(onToggleBlock)} style={item({ flex: 1, textAlign: "center", background: C.red, color: "#fff", borderRadius: 8, padding: "8px" })}>บล็อก</button><button type="button" onClick={() => setConfirm(null)} style={item({ flex: 1, textAlign: "center", border: "1px solid " + C.border, borderRadius: 8, padding: "8px" })}>ยกเลิก</button></div>
            </div>
          )}
          {err && <div data-dm-err style={{ padding: "6px 12px 10px", fontSize: 11, color: C.yellow }}>⚠️ {err}</div>}
        </div>
      </>)}
    </div>
  );
}
