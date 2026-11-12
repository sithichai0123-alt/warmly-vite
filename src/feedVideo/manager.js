// Feed Video — ตัวควบคุมการเล่น: เล่นได้ทีละคลิปเท่านั้น, เล่นอัตโนมัติเมื่อเข้าจอ, หยุดเมื่อออกจากจอ
//   ไม่แตะ DOM/React โดยตรง — แต่ละตัวเล่นลงทะเบียน handlers { play(), pause() } แล้วรายงานสัดส่วนที่มองเห็น
import { PLAY_RATIO, SWITCH_MARGIN } from "./config.js";

export function createVideoManager({ threshold = PLAY_RATIO, margin = SWITCH_MARGIN } = {}) {
  const items = new Map(); // id → { ratio, top, play, pause, userPaused, playing }
  let active = null;       // id ที่ควรกำลังเล่นอยู่
  let hidden = false;      // แท็บ/แอปถูกซ่อน
  let claimed = false;     // active มาจากผู้ใช้กดเล่นเอง (ยังเล่นต่อได้แม้เห็นไม่ถึง threshold ตราบที่ยังอยู่บนจอ)

  const setPlaying = (id, on) => {
    const it = items.get(id); if (!it) return;
    if (on && !it.playing) { it.playing = true; try { it.play(); } catch (e) { it.playing = false; } }
    else if (!on && it.playing) { it.playing = false; try { it.pause(); } catch (e) { /* ignore */ } }
  };

  function pickWinner() {
    const cands = [];
    for (const [id, it] of items) if (it.ratio >= threshold && !it.userPaused) cands.push([id, it]);
    const cur = active != null ? items.get(active) : null;
    // คลิปที่ผู้ใช้กดเล่นเอง: ถือสิทธิ์ต่อไปตราบที่ยังเห็นอยู่บนจอ (ไม่ให้คลิปอื่นแย่งเล่น)
    if (claimed && cur && cur.ratio >= 0.05 && !cur.userPaused) return active;
    // คลิปที่เล่นอยู่ยังเห็นพอ → เล่นต่อ (เว้นแต่มีคลิปอื่นเด่นกว่าชัดเจน)
    if (cur && cur.ratio >= threshold && !cur.userPaused) {
      const better = cands.filter(([id, it]) => id !== active && it.ratio > cur.ratio + margin);
      if (!better.length) return active;
    }
    if (cands.length) {
      cands.sort((a, b) => (b[1].ratio - a[1].ratio) || (a[1].top - b[1].top) || (String(a[0]) < String(b[0]) ? -1 : 1));
      return cands[0][0];
    }
    return null;
  }

  function evaluate() {
    if (hidden) { for (const id of items.keys()) setPlaying(id, false); return; }
    const w = pickWinner();
    if (w !== active) { claimed = false; active = w; }
    for (const id of items.keys()) setPlaying(id, id === w);
  }

  return {
    register(id, handlers) { items.set(id, { ratio: 0, top: Infinity, userPaused: false, playing: false, ...handlers }); },
    unregister(id) { const it = items.get(id); if (!it) return; setPlaying(id, false); items.delete(id); if (active === id) { active = null; claimed = false; } evaluate(); },
    report(id, ratio, top = 0) {
      const it = items.get(id); if (!it) return;
      it.ratio = ratio; it.top = top;
      if (ratio < 0.05) it.userPaused = false; // ออกจากจอแล้ว → รอบหน้าเข้าจอเล่นเองได้อีก
      evaluate();
    },
    // ผู้ใช้กดเล่นเอง (ปุ่มของเบราว์เซอร์): คลิปนี้ได้สิทธิ์ ที่เหลือหยุดทันที
    claim(id) {
      const it = items.get(id); if (!it) return;
      it.userPaused = false; it.playing = true; active = id; claimed = true;
      for (const other of items.keys()) if (other !== id) setPlaying(other, false);
    },
    // ผู้ใช้กดหยุดเอง: ไม่เล่นกลับเองจนกว่าจะเลื่อนออกจากจอแล้วกลับมา
    userPause(id) { const it = items.get(id); if (!it) return; it.userPaused = true; it.playing = false; if (active === id) { active = null; claimed = false; } evaluate(); },
    // เล่นจบ/หยุดเองด้วยเหตุอื่น ให้ตัวจัดการรู้สถานะจริง
    markPaused(id) { const it = items.get(id); if (it) it.playing = false; },
    setHidden(h) { hidden = !!h; evaluate(); },
    pauseAll() { for (const id of items.keys()) setPlaying(id, false); active = null; claimed = false; },
    _state: () => ({ active, claimed, hidden, playing: [...items].filter(([, i]) => i.playing).map(([id]) => id) }),
  };
}

// ตัวจัดการกลางของทั้งแอป (ทุกตัวเล่นในฟีดใช้ตัวนี้ร่วมกัน = เล่นได้ทีละคลิปทั้งหน้า)
export const feedVideoManager = createVideoManager();
if (typeof document !== "undefined" && document.addEventListener) {
  document.addEventListener("visibilitychange", () => feedVideoManager.setHidden(document.visibilityState === "hidden"));
}
