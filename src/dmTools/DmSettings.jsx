// DM Tools — ตั้งค่าแชทส่วนตัว: เสียงแจ้งเตือน (เปิด/ปิด, เลือกเสียง, ความดัง, เสียงของฉัน) + รายชื่อที่บล็อก
import { useRef, useState } from "react";
import { useDmPrefs, setDmPrefs } from "./prefs.js";
import { TONES, playNotification } from "./sounds.js";
import { validateSoundFile } from "./logic.js";
import { MAX_CUSTOM_SOUND_BYTES, MAX_CUSTOM_SOUND_SECONDS, ALLOWED_SOUND_TYPES } from "./config.js";

const C = { card: "#221F33", surface: "#1A1825", border: "#2E2A45", borderHi: "#4F46A8", brand2: "#A78BFA", text: "#F0EEFF", sub: "#9B94C4", muted: "#8A84B0", yellow: "#F59E0B", red: "#F87171", grad: "linear-gradient(135deg,#7C5CFC,#A78BFA)" };
const chip = on => ({ fontFamily: "inherit", fontSize: 12, fontWeight: 700, padding: "6px 11px", borderRadius: 20, border: "1px solid " + (on ? C.brand2 : C.border), background: on ? "rgba(124,92,252,.25)" : "transparent", color: on ? C.text : C.sub, cursor: "pointer" });

function readDataUrl(file) { return new Promise((res, rej) => { const r = new FileReader(); r.onerror = () => rej(new Error("read")); r.onload = () => res(r.result); r.readAsDataURL(file); }); }
function audioDuration(url) {
  return new Promise((res, rej) => {
    const a = new Audio(); const t = setTimeout(() => rej(new Error("timeout")), 8000);
    a.onloadedmetadata = () => { clearTimeout(t); res(a.duration); };
    a.onerror = () => { clearTimeout(t); rej(new Error("decode")); };
    a.src = url;
  });
}

export default function DmSettings({ blocks, users, onClose }) {
  const p = useDmPrefs();
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const fileRef = useRef(null);

  async function onFile(e) {
    const f = e.target.files && e.target.files[0]; e.target.value = ""; if (!f) return;
    setMsg(""); const v = validateSoundFile(f); if (!v.ok) { setMsg(v.reason); return; }
    setBusy(true);
    try {
      const url = await readDataUrl(f);
      let dur; try { dur = await audioDuration(url); } catch (x) { setMsg((f.name || "ไฟล์") + ": เปิดไฟล์เสียงไม่ได้ (ไฟล์อาจเสียหาย)"); return; }
      if (!(dur > 0) || dur > MAX_CUSTOM_SOUND_SECONDS) { setMsg((f.name || "ไฟล์") + ": เสียงยาวเกิน " + MAX_CUSTOM_SOUND_SECONDS + " วินาที"); return; }
      if (!url.startsWith("data:audio/")) { setMsg((f.name || "ไฟล์") + ": รูปแบบไฟล์ไม่ถูกต้อง"); return; }
      if (!setDmPrefs({ customSound: url, tone: "custom" })) { setMsg("บันทึกเสียงไม่ได้ (พื้นที่ในเครื่องเต็มหรือเบราว์เซอร์บล็อกการเก็บข้อมูล)"); return; }
      playNotification({ ...p, customSound: url, tone: "custom" });
    } finally { setBusy(false); }
  }

  const list = blocks.list;
  return (
    <div data-dm-settings onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.72)", zIndex: 80, display: "flex", alignItems: "flex-start", justifyContent: "center", overflowY: "auto", padding: "20px 12px" }}>
      <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 440, background: C.card, border: "1px solid " + C.borderHi, borderRadius: 20, padding: 16, color: C.text }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ fontSize: 16, fontWeight: 800 }}>⚙️ ตั้งค่าแชทส่วนตัว</div>
          <button type="button" data-dms-close onClick={onClose} style={{ width: 30, height: 30, borderRadius: "50%", border: "none", background: "rgba(255,255,255,.1)", color: "#fff", cursor: "pointer", fontFamily: "inherit" }}>✕</button>
        </div>

        <div style={{ marginTop: 14, background: C.surface, border: "1px solid " + C.border, borderRadius: 14, padding: 12 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div><div style={{ fontSize: 14, fontWeight: 700 }}>🔔 เสียงแจ้งเตือนข้อความใหม่</div><div style={{ fontSize:12, color: C.muted }}>ดังเมื่อมีข้อความส่วนตัวใหม่เข้ามา (เฉพาะเครื่องนี้)</div></div>
            <div data-dms-sound-toggle data-on={p.soundOn ? "1" : "0"} onClick={() => setDmPrefs({ soundOn: !p.soundOn })} style={{ width: 46, height: 26, borderRadius: 13, cursor: "pointer", background: p.soundOn ? "#7C5CFC" : "#333", position: "relative", flexShrink: 0 }}><div style={{ width: 20, height: 20, borderRadius: "50%", background: "#fff", position: "absolute", top: 3, left: p.soundOn ? 23 : 3, transition: "left .2s" }} /></div>
          </div>
          <div style={{ opacity: p.soundOn ? 1 : 0.45, pointerEvents: p.soundOn ? "auto" : "none" }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: C.sub, margin: "12px 0 6px" }}>เลือกเสียง</div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {TONES.map(t => <button key={t.id} type="button" data-dms-tone={t.id} onClick={() => { setDmPrefs({ tone: t.id }); playNotification({ ...p, tone: t.id }); }} style={chip(p.tone === t.id)}>{t.label}</button>)}
              {p.customSound && <button type="button" data-dms-tone="custom" onClick={() => { setDmPrefs({ tone: "custom" }); playNotification({ ...p, tone: "custom" }); }} style={chip(p.tone === "custom")}>🎵 เสียงของฉัน</button>}
            </div>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", margin: "12px 0 0" }}>
              <label htmlFor="wm-dm-vol" style={{ fontSize: 12, fontWeight: 700, color: C.sub }}>ความดัง {Math.round(p.volume * 100)}%</label>
              <button type="button" data-dms-test onClick={() => playNotification(p)} style={{ fontFamily: "inherit", fontSize:12, fontWeight: 700, padding: "4px 10px", borderRadius: 8, border: "1px solid " + C.borderHi, background: "transparent", color: C.brand2, cursor: "pointer" }}>▶ ทดลองฟัง</button>
            </div>
            <input id="wm-dm-vol" data-dms-volume type="range" min="0" max="100" step="5" value={Math.round(p.volume * 100)} onChange={e => setDmPrefs({ volume: Number(e.target.value) / 100 })} style={{ width: "100%", accentColor: "#A78BFA", height: 28 }} />
            <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap", marginTop: 6 }}>
              <button type="button" data-dms-upload onClick={() => fileRef.current && fileRef.current.click()} disabled={busy} style={chip(false)}>{busy ? "⏳ กำลังตรวจไฟล์..." : "⬆️ อัปโหลดเสียงของฉัน"}</button>
              {p.customSound && <button type="button" data-dms-remove-custom onClick={() => setDmPrefs({ customSound: "", tone: p.tone === "custom" ? "pop" : p.tone })} style={{ ...chip(false), color: C.red, borderColor: "#5B2A35" }}>ลบเสียงของฉัน</button>}
            </div>
            <div style={{ fontSize:12, color: C.muted, marginTop: 4 }}>MP3 / WAV / OGG / M4A ไม่เกิน {Math.round(MAX_CUSTOM_SOUND_BYTES / 1024)} KB และยาวไม่เกิน {MAX_CUSTOM_SOUND_SECONDS} วินาที</div>
            <input ref={fileRef} data-dms-file type="file" accept={ALLOWED_SOUND_TYPES.join(",") + ",.mp3,.wav,.ogg,.m4a"} style={{ display: "none" }} onChange={onFile} />
          </div>
          {msg && <div data-dms-msg style={{ marginTop: 8, fontSize: 12, color: C.yellow }}>⚠️ {msg}</div>}
        </div>

        <div style={{ marginTop: 12, background: C.surface, border: "1px solid " + C.border, borderRadius: 14, padding: 12 }}>
          <div style={{ fontSize: 14, fontWeight: 700 }}>🚫 รายชื่อที่บล็อก <span style={{ fontSize: 12, color: C.muted, fontWeight: 600 }}>({list.length})</span></div>
          <div style={{ fontSize:12, color: C.muted, marginBottom: 6 }}>คนที่บล็อกจะส่งข้อความหาคุณไม่ได้ และข้อความของเขาจะไม่แสดงในแชทส่วนตัวของคุณ</div>
          {list.length === 0 && <div data-dms-nobloc style={{ fontSize: 12, color: C.muted, padding: "6px 0" }}>ยังไม่ได้บล็อกใคร</div>}
          {list.map(uid => (
            <div key={uid} data-blocked={uid} style={{ display: "flex", alignItems: "center", gap: 8, padding: "7px 0", borderTop: "1px solid " + C.border }}>
              <div style={{ flex: 1, fontSize: 13, fontWeight: 600 }}>{(users && users[uid] && users[uid].name) || "ผู้ใช้"}</div>
              <button type="button" data-dms-unblock onClick={async () => { const ok = await blocks.unblock(uid); if (!ok) setMsg("เลิกบล็อกไม่สำเร็จ ลองใหม่อีกครั้ง"); }} style={chip(false)}>เลิกบล็อก</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
