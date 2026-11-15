// Admin — หน้าต่างลบ/ระงับผู้ใช้ทั้งหมด (เฉพาะแอดมิน) · ทำงานผ่านเซิร์ฟเวอร์ ไม่ลบจากหน้าเว็บตรงๆ
// ขั้นตอน: ดูว่าจะลบอะไรบ้าง → (แนะนำ) ระงับบัญชีก่อน → พิมพ์ยืนยัน 6 ตัวท้ายของ uid → ลบ
import { useEffect, useState } from "react";
import { callAdmin } from "./fb.js";

const C = { bg: "#0F0E17", card: "#221F33", surface: "#1A1825", border: "#2E2A45", borderHi: "#4F46A8",
  text: "#F0EEFF", sub: "#9B94C4", muted: "#8A84B0", brand: "#7C5CFC", brand2: "#A78BFA", red: "#F43F5E", yellow: "#FBBF24", green: "#22C55E" };

const LABELS = [
  ["users", "โปรไฟล์ (ชื่อ รูปเล็ก ฯลฯ)"], ["profilePhotos", "รูปโปรไฟล์หลายรูป"], ["covers", "รูปปก"], ["presence", "สถานะออนไลน์"],
  ["userBlocks", "รายชื่อที่เขาบล็อก"], ["callInbox", "กล่องสายโทร"], ["roomInvites", "คำเชิญเข้าห้องที่เขาได้รับ"],
  ["posts", "โพสต์"], ["groupChat", "ข้อความในห้องรวม"], ["friendships", "ความเป็นเพื่อน"], ["calls", "สายโทร"],
  ["dms", "ห้องแชทส่วนตัว (ลบทั้งห้อง รวมข้อความของอีกฝ่ายด้วย)"], ["dmMessages", "↳ จำนวนข้อความในห้องแชทเหล่านั้น"], ["rooms", "ห้องเสียงที่เขาเป็นโฮสต์"],
];
const rowsOf = counts => {
  const c = { ...counts, calls: (counts.callsFrom || 0) + (counts.callsTo || 0) };
  return LABELS.map(([k, l]) => [k, l, c[k] || 0]).filter(r => r[2] > 0);
};
const btn = (bd, bg, col, off) => ({ border: "1px solid " + bd, background: bg, color: col, borderRadius: 20, padding: "8px 16px", fontSize: 13, fontWeight: 700,
  cursor: off ? "not-allowed" : "pointer", opacity: off ? .45 : 1, fontFamily: "inherit" });

export default function DeleteUser({ uid, name, onClose, onDeleted, api = callAdmin }) {
  const [plan, setPlan] = useState(null), [err, setErr] = useState(""), [busy, setBusy] = useState(false);
  const [txt, setTxt] = useState(""), [delAuth, setDelAuth] = useState(false), [done, setDone] = useState(null), [note, setNote] = useState("");
  const word = uid.slice(-6);

  const load = () => api("plan", { uid }).then(p => { setPlan(p); setErr(""); }).catch(e => setErr(e.message));
  useEffect(() => { load(); }, [uid]); // eslint-disable-line

  const run = async (fn, okMsg) => {
    setBusy(true); setErr(""); setNote("");
    try { await fn(); if (okMsg) setNote(okMsg); await load(); } catch (e) { setErr(e.message); }
    setBusy(false);
  };
  const toggleDisable = () => run(() => api(plan.auth.disabled ? "enable" : "disable", { uid }), plan.auth.disabled ? "เปิดบัญชีคืนแล้ว" : "ระงับบัญชีแล้ว — เขาล็อกอินใหม่ไม่ได้ (เซสชันที่เปิดค้างจะหลุดภายในประมาณ 1 ชั่วโมง)");
  const doDelete = async () => {
    setBusy(true); setErr("");
    try { const r = await api("delete", { uid, confirm: txt.trim(), deleteAuth: delAuth }); setDone(r); onDeleted && onDeleted(uid); }
    catch (e) { setErr(e.message); }
    setBusy(false);
  };

  const rows = plan ? rowsOf(plan.counts) : [];
  const au = plan && plan.auth;
  return (
    <div data-del-modal onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 50, background: "rgba(0,0,0,.72)", overflowY: "auto", padding: "16px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ maxWidth: 520, margin: "0 auto", background: C.card, border: "1px solid " + C.borderHi, borderRadius: 18, padding: 16, color: C.text }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 800 }}>🗑️ ลบผู้ใช้</div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 2, wordBreak: "break-all" }}>{(plan && plan.name) || name || "(ไม่มีโปรไฟล์)"} · <span data-del-uid>{uid}</span></div>
          </div>
          <button data-del-close onClick={onClose} aria-label="ปิด" style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>

        {err && <div data-del-err style={{ marginTop: 12, padding: "9px 12px", borderRadius: 10, background: "rgba(244,63,94,.14)", border: "1px solid rgba(244,63,94,.4)", color: "#FCA5A5", fontSize: 13, lineHeight: 1.5 }}>⚠️ {err}</div>}
        {note && <div data-del-note style={{ marginTop: 12, padding: "9px 12px", borderRadius: 10, background: "rgba(34,197,94,.12)", border: "1px solid rgba(34,197,94,.4)", color: "#86EFAC", fontSize: 13, lineHeight: 1.5 }}>✅ {note}</div>}
        {!plan && !err && <div style={{ padding: "22px 0", textAlign: "center", color: C.muted, fontSize: 14 }}>กำลังตรวจว่ามีข้อมูลอะไรบ้าง...</div>}

        {done ? (
          <div data-del-done style={{ marginTop: 14 }}>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.green }}>ลบเรียบร้อยแล้ว</div>
            <div style={{ fontSize: 13, color: C.sub, marginTop: 6, lineHeight: 1.7 }}>
              {rowsOf(done.counts).map(([k, l, n]) => <div key={k}>• {l}: {n}</div>)}
              {done.kept && done.kept.ledger > 0 && <div style={{ marginTop: 4 }}>• ประวัติเหรียญ {done.kept.ledger} รายการ <b>เก็บไว้</b> (ไม่ลบ)</div>}
              <div>• บัญชีล็อกอิน: {done.authAction === "deleted" ? "ลบแล้ว" : "ยังอยู่ (ไม่ได้ติ๊กลบ)"}</div>
            </div>
            <div style={{ marginTop: 10, padding: "9px 12px", borderRadius: 10, background: "rgba(251,191,36,.1)", border: "1px solid rgba(251,191,36,.3)", color: C.yellow, fontSize: 12, lineHeight: 1.6 }}>
              ถ้าเขายังเปิดแอปค้างอยู่ แอปอาจสร้างโปรไฟล์ขึ้นใหม่ได้ ให้ระงับบัญชีแล้วกดลบอีกครั้งหลังผ่านไปประมาณ 1 ชั่วโมง
            </div>
            <div style={{ marginTop: 12, textAlign: "right" }}><button onClick={onClose} style={btn(C.borderHi, C.brand, "#fff")}>ปิด</button></div>
          </div>
        ) : plan && (
          <div>
            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: .5 }}>จะถูกลบ</div>
            <div data-del-plan style={{ marginTop: 6, fontSize: 13, color: C.sub, lineHeight: 1.75 }}>
              {rows.length === 0 ? <div style={{ color: C.muted }}>ไม่พบข้อมูลของ uid นี้เหลืออยู่ (อาจลบไปหมดแล้ว)</div>
                : rows.map(([k, l, n]) => <div key={k}>• {l}: <b style={{ color: C.text }}>{n}</b></div>)}
              {plan.kept && plan.kept.ledger > 0 && <div style={{ color: C.muted }}>• ประวัติเหรียญ {plan.kept.ledger} รายการ <b>จะเก็บไว้</b> (เป็นหลักฐาน)</div>}
            </div>

            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: C.muted, letterSpacing: .5 }}>บัญชีล็อกอิน</div>
            <div data-del-auth style={{ marginTop: 6, fontSize: 13, color: C.sub, lineHeight: 1.6 }}>
              {!au.exists ? "ไม่มีบัญชีล็อกอิน (ผู้เยี่ยมชมรุ่นเก่า หรือถูกลบไปแล้ว) — ลบได้เฉพาะข้อมูล"
                : <>{au.email ? <span style={{ wordBreak: "break-all" }}>{au.email} · </span> : null}{au.disabled ? <b style={{ color: C.green }}>ถูกระงับแล้ว ล็อกอินไม่ได้</b> : <b style={{ color: C.yellow }}>ยังล็อกอินได้อยู่</b>}</>}
            </div>
            {au.exists && (
              <div style={{ marginTop: 8 }}>
                <button data-del-disable disabled={busy} onClick={toggleDisable} style={btn(C.borderHi, "transparent", C.brand2, busy)}>{au.disabled ? "▶ เปิดบัญชีคืน" : "⏸ ระงับบัญชี (แนะนำทำก่อน)"}</button>
                <div style={{ fontSize: 12, color: C.muted, marginTop: 6, lineHeight: 1.6 }}>ระงับ = เขาล็อกอินไม่ได้ แต่ยังกู้คืนได้ · ลบบัญชีล็อกอินแล้ว คนที่ใช้ Google ล็อกอินใหม่ได้ ระบบจะสร้างบัญชีใหม่ให้</div>
              </div>
            )}

            <div style={{ marginTop: 16, paddingTop: 14, borderTop: "1px solid " + C.border }}>
              {au.exists && (
                <label style={{ display: "flex", gap: 8, alignItems: "flex-start", fontSize: 13, color: C.sub, lineHeight: 1.5, cursor: "pointer" }}>
                  <input data-del-auth-check type="checkbox" checked={delAuth} onChange={e => setDelAuth(e.target.checked)} style={{ marginTop: 3 }} />
                  <span>ลบบัญชีล็อกอินถาวรด้วย <span style={{ color: C.muted }}>(ไม่แนะนำ — ใช้การระงับแทนจะกันไม่ให้กลับมาได้ดีกว่า)</span></span>
                </label>
              )}
              <div style={{ fontSize: 13, color: C.sub, margin: "12px 0 6px" }}>พิมพ์ <b data-del-word style={{ color: C.yellow, fontSize: 15, letterSpacing: 1 }}>{word}</b> เพื่อยืนยัน (6 ตัวท้ายของ uid)</div>
              <input data-del-input value={txt} onChange={e => setTxt(e.target.value)} placeholder={word} autoCapitalize="off" autoCorrect="off" spellCheck={false}
                style={{ width: "100%", boxSizing: "border-box", border: "1px solid " + C.border, borderRadius: 12, padding: "10px 14px", fontSize: 15, background: C.surface, color: C.text, outline: "none", fontFamily: "inherit" }} />
              <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "flex-end" }}>
                <button onClick={onClose} style={btn(C.border, "transparent", C.sub)}>ยกเลิก</button>
                <button data-del-go disabled={busy || txt.trim() !== word} onClick={doDelete} style={btn("rgba(244,63,94,.6)", C.red, "#fff", busy || txt.trim() !== word)}>{busy ? "กำลังลบ..." : "ลบข้อมูลทั้งหมด (กู้คืนไม่ได้)"}</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
