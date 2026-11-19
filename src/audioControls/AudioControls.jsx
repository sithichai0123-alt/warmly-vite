// Audio Controls — แผงปรับเสียง: ไมค์ของฉัน / เพลง (แยกกัน) ใช้ในห้องเสียง
// ไฟล์แยกอิสระ ไม่ import จาก App.jsx — ปุ่มปิด/เปิดไมค์เดิมยังอยู่ที่เดิม (ปุ่มไมค์ปิดเสียง ≠ แถบระดับเสียง)
import { useAudioPrefs, setMicGain, setMusicVolume, setMusicMuted, useMicStatus } from "./store.js";
import { MIC_GAIN_MAX } from "./config.js";
import { isIOS } from "./ytVolume.js";
import { AUDIO_ROUTE_ENABLED, useRouteState, setRoutePref, audioRoute } from "../audioRoute/index.js";

const C = { onBrand: "var(--on-primary, #fff)", card: "var(--panel-background, #221F33)", surface: "var(--surface-background, #1A1825)", border: "var(--border-color, #2E2A45)", borderHi: "var(--border-strong, #4F46A8)", brand2: "var(--secondary-color, #A78BFA)", text: "var(--text-primary, #F0EEFF)", sub: "var(--text-secondary, #9B94C4)", muted: "var(--text-muted, #8A84B0)", yellow: "var(--warning-color, #F59E0B)" };
const range = { width: "100%", accentColor: "var(--secondary-color,#A78BFA)", height: 28, cursor: "pointer" };

// เสียงออก: เลือกลำโพง/หูฟังบลูทูธ (เฉพาะเบราว์เซอร์ที่รองรับ) — "อัตโนมัติ" = ใช้บลูทูธ/หูฟังเมื่อเชื่อมต่อ
function OutputPicker({ ios }) {
  const r = useRouteState();
  const active = r.outputs.find(o => o.id === r.activeId);
  return (
    <div data-ac-output style={{ marginTop: 10 }}>
      <label htmlFor="wm-out-sel" style={{ fontSize: 13, fontWeight: 700, color: C.sub }}>🔊 เสียงออก</label>
      {r.supported ? (<>
        <select id="wm-out-sel" data-ac-output-select value={r.pref} onChange={e => { setRoutePref(e.target.value); audioRoute.refresh(); }} style={{ width: "100%", marginTop: 4, padding: "8px 10px", borderRadius: 10, border: "1px solid " + C.border, background: C.card, color: C.text, fontFamily: "inherit", fontSize: 14 }}>
          <option value="auto">อัตโนมัติ (ใช้บลูทูธ/หูฟังเมื่อเชื่อมต่อ)</option>
          {r.outputs.map(o => <option key={o.id} value={o.id}>{(o.kind === "bluetooth" ? "🎧 " : o.kind === "external" ? "🎧 " : "🔈 ") + o.label}</option>)}
        </select>
        <div style={{ fontSize: 13, color: C.muted, marginTop: 4 }}>{active ? "กำลังส่งเสียงไป: " + active.label : "ตอนนี้ใช้ลำโพง/หูฟังตามที่เครื่องเลือก (ยังไม่พบบลูทูธที่เชื่อมต่อ)"}</div>
      </>) : (
        <div style={{ fontSize: 13, color: C.yellow, marginTop: 2, lineHeight: 1.5 }}>{ios ? "⚠️ iPhone/iPad ให้เว็บเลือกเสียงออกเองไม่ได้ — เลือกบลูทูธ/AirPlay จากศูนย์ควบคุมของเครื่อง (ปัดจากมุมขวาบน แล้วแตะไอคอนเสียง)" : "⚠️ เบราว์เซอร์นี้เลือกเสียงออกจากเว็บไม่ได้ — ใช้ Chrome หรือเลือกอุปกรณ์เสียงที่ตัวเครื่อง"}</div>
      )}
    </div>
  );
}

export default function AudioControls({ micOn, onToggleMic, connected, hasMusic }) {
  const p = useAudioPrefs();
  const st = useMicStatus();
  const ios = isIOS();
  const micPct = Math.round(p.mic * 100);
  return (
    <div data-audio-controls style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 14, padding: "10px 14px", color: C.text }}>
      <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>🎚️ ระดับเสียง <span style={{ fontWeight: 500, color: C.muted }}>ไมค์ = ความดังเสียงของคุณที่คนอื่นได้ยิน · เพลง = เฉพาะเครื่องนี้ · ไม่กระทบเสียงพูดของคนอื่น</span></div>

      <div style={{ marginTop: 8 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <label htmlFor="wm-mic-vol" style={{ fontSize: 13, fontWeight: 700, color: C.sub }}>🎙️ ไมค์ของฉัน {micPct}%</label>
          <div style={{ display: "flex", gap: 6 }}>
            {micPct !== 100 && <button type="button" data-ac-mic-reset onClick={() => setMicGain(1)} style={{ fontFamily: "inherit", fontSize:13, padding: "3px 9px", borderRadius: 8, border: "1px solid " + C.borderHi, background: "transparent", color: C.brand2, cursor: "pointer" }}>↺ 100%</button>}
            <button type="button" data-ac-mic-toggle onClick={onToggleMic} disabled={!connected} style={{ fontFamily: "inherit", fontSize:13, fontWeight: 700, padding: "3px 10px", borderRadius: 8, border: "none", background: micOn ? "var(--button-background, linear-gradient(135deg,#7C5CFC,#A78BFA))" : "#3A3555", color: micOn ? C.onBrand : "#fff", cursor: connected ? "pointer" : "default", opacity: connected ? 1 : 0.5 }}>{micOn ? "🎙️ ไมค์เปิด" : "🔇 ไมค์ปิด"}</button>
          </div>
        </div>
        <input id="wm-mic-vol" data-ac-mic type="range" min="0" max={Math.round(MIC_GAIN_MAX * 100)} step="5" value={micPct} onChange={e => setMicGain(Number(e.target.value) / 100)} style={range} aria-label="ระดับเสียงไมค์" />
        {st === "unsupported" && <div style={{ fontSize:13, color: C.yellow }}>⚠️ เครื่อง/เบราว์เซอร์นี้ปรับเสียงไมค์ไม่ได้ — ใช้ระดับเสียงปกติแทน</div>}
        {micPct === 0 && <div style={{ fontSize:13, color: C.yellow }}>⚠️ ระดับ 0% = คนอื่นจะไม่ได้ยินเสียงคุณ แม้ไมค์เปิดอยู่</div>}
      </div>

      <div style={{ marginTop: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
          <label htmlFor="wm-music-vol" style={{ fontSize: 13, fontWeight: 700, color: C.sub }}>🎵 เสียงเพลง {p.musicMuted ? "(ปิดเสียง)" : p.music + "%"}</label>
          <button type="button" data-ac-music-mute onClick={() => setMusicMuted(!p.musicMuted)} style={{ fontFamily: "inherit", fontSize:13, fontWeight: 700, padding: "3px 10px", borderRadius: 8, border: "1px solid " + C.borderHi, background: p.musicMuted ? "#3A3555" : "transparent", color: C.brand2, cursor: "pointer" }}>{p.musicMuted ? "🔇 เปิดเสียงเพลง" : "🔊 ปิดเสียงเพลง"}</button>
        </div>
        <input id="wm-music-vol" data-ac-music type="range" min="0" max="100" step="5" value={p.music} onChange={e => setMusicVolume(Number(e.target.value))} style={{ ...range, opacity: p.musicMuted ? 0.45 : 1 }} aria-label="ระดับเสียงเพลง" />
        {!hasMusic && <div style={{ fontSize:13, color: C.muted }}>ยังไม่มีเพลงเล่นในห้อง — ค่าที่ตั้งไว้จะใช้ตอนมีเพลง</div>}
        {ios && <div style={{ fontSize:13, color: C.yellow }}>⚠️ iPhone/iPad ไม่อนุญาตให้เว็บปรับเสียงเพลง — ใช้ปุ่มเสียงข้างเครื่องแทน</div>}
      </div>
      {AUDIO_ROUTE_ENABLED && connected && <OutputPicker ios={ios} />}
    </div>
  );
}
