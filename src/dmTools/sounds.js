// DM Tools — เสียงแจ้งเตือน: สังเคราะห์ด้วย Web Audio (ไม่ต้องมีไฟล์เสียง) + เสียงที่ผู้ใช้อัปโหลดเอง
export const TONES = [
  { id: "pop", label: "ป๊อป", notes: [{ f: 880, t: 0, d: 0.09 }, { f: 1320, t: 0.09, d: 0.14 }] },
  { id: "bell", label: "กระดิ่ง", notes: [{ f: 1046, t: 0, d: 0.55 }, { f: 2092, t: 0, d: 0.35, g: 0.3 }] },
  { id: "chime", label: "ระฆังสามจังหวะ", notes: [{ f: 784, t: 0, d: 0.18 }, { f: 988, t: 0.16, d: 0.18 }, { f: 1175, t: 0.32, d: 0.32 }] },
  { id: "knock", label: "เคาะ", notes: [{ f: 220, t: 0, d: 0.08, type: "triangle" }, { f: 220, t: 0.13, d: 0.08, type: "triangle" }] },
  { id: "soft", label: "นุ่มนวล", notes: [{ f: 523, t: 0, d: 0.3, g: 0.8 }, { f: 659, t: 0.12, d: 0.35, g: 0.8 }] },
];
export const toneById = id => TONES.find(t => t.id === id) || TONES[0];

// ตั้งเวลาเล่นโน้ตบน ctx (แยกออกมาเพื่อทดสอบด้วย ctx จำลองได้) คืนจำนวนโน้ตที่ตั้ง
export function scheduleTone(ctx, tone, volume = 0.7, at = ctx.currentTime || 0) {
  const vol = Math.min(1, Math.max(0, Number(volume)));
  let n = 0;
  for (const note of tone.notes) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = note.type || "sine"; o.frequency.value = note.f;
    const peak = 0.35 * vol * (note.g == null ? 1 : note.g), s = at + note.t, e = s + note.d;
    g.gain.setValueAtTime(0.0001, s);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), s + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, e);
    o.connect(g); g.connect(ctx.destination);
    o.start(s); o.stop(e + 0.02); n++;
  }
  return n;
}

let ctx = null;
function getCtx() {
  if (ctx) return ctx;
  const AC = typeof window !== "undefined" && (window.AudioContext || window.webkitAudioContext);
  if (!AC) return null;
  try { ctx = new AC(); } catch (e) { ctx = null; }
  return ctx;
}
// เบราว์เซอร์ต้องมีการแตะ/คลิกก่อนถึงจะเล่นเสียงได้ → เรียกตอนผู้ใช้แตะครั้งแรก
export function unlockAudio() { const c = getCtx(); if (c && c.state === "suspended") { try { c.resume(); } catch (e) { /* ignore */ } } }

// เล่นเสียงตามค่าตั้ง; คืน true ถ้าสั่งเล่นแล้ว (ไม่การันตีว่าเบราว์เซอร์อนุญาต)
export function playNotification(prefs) {
  try {
    if (prefs.tone === "custom" && prefs.customSound) {
      const a = new Audio(prefs.customSound); a.volume = Math.min(1, Math.max(0, prefs.volume));
      const p = a.play(); if (p && p.catch) p.catch(() => {});
      return true;
    }
    const c = getCtx(); if (!c) return false;
    if (c.state === "suspended") c.resume().catch(() => {});
    scheduleTone(c, toneById(prefs.tone), prefs.volume);
    return true;
  } catch (e) { return false; }
}
