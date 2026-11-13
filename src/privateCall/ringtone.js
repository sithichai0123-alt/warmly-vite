// เสียงเรียกเข้า (สังเคราะห์ด้วย WebAudio ไม่ต้องมีไฟล์เสียง) — วนจนกว่าจะ stop()
export function createRingtone() {
  let ctx = null, timer = null;
  const beep = (when, f) => {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine"; o.frequency.value = f; o.connect(g); g.connect(ctx.destination);
    g.gain.setValueAtTime(0.0001, when); g.gain.exponentialRampToValueAtTime(0.25, when + 0.03); g.gain.exponentialRampToValueAtTime(0.0001, when + 0.4);
    o.start(when); o.stop(when + 0.45);
  };
  const cycle = () => { try { const t = ctx.currentTime; beep(t, 880); beep(t + 0.5, 660); if (navigator.vibrate) navigator.vibrate([300, 150, 300]); } catch (e) { /* */ } };
  return {
    start() {
      if (timer) return;
      try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = ctx || new AC(); if (ctx.state === "suspended") ctx.resume(); } catch (e) { return; }
      cycle(); timer = setInterval(cycle, 2200);
    },
    stop() { if (timer) { clearInterval(timer); timer = null; } try { if (navigator.vibrate) navigator.vibrate(0); } catch (e) { /* */ } if (ctx) { try { ctx.close(); } catch (e) { /* */ } ctx = null; } },
  };
}
