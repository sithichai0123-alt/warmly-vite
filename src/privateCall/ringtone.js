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

// เสียงรอสาย (ฝั่งผู้โทร) แบบโทรศัพท์บ้านเรา: 425Hz ดัง 1 วินาที เงียบ 4 วินาที — เบา ๆ ไม่สั่น
export function createRingback() {
  let ctx = null, timer = null;
  const tone = () => {
    try {
      const t = ctx.currentTime, o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "sine"; o.frequency.value = 425; o.connect(g); g.connect(ctx.destination);
      g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.12, t + 0.04);
      g.gain.setValueAtTime(0.12, t + 0.96); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.0);
      o.start(t); o.stop(t + 1.02);
    } catch (e) { /* */ }
  };
  return {
    start() {
      if (timer) return;
      try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ctx = ctx || new AC(); if (ctx.state === "suspended") ctx.resume(); } catch (e) { return; }
      tone(); timer = setInterval(tone, 5000);
    },
    stop() { if (timer) { clearInterval(timer); timer = null; } if (ctx) { try { ctx.close(); } catch (e) { /* */ } ctx = null; } },
  };
}
