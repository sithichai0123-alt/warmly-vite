// Audio Controls — ปรับเสียงเพลง YouTube ที่ฝังด้วย iframe (ต้องมี enablejsapi=1 ในลิงก์ฝัง)
// ส่งคำสั่งผ่าน postMessage ให้ตัวเล่นของ YouTube — ทำงานแยกจากเสียงพูด (LiveKit) ที่เป็นองค์ประกอบเสียงคนละตัว
// ข้อจำกัด: iPhone/iPad (iOS) ไม่ยอมให้เว็บปรับระดับเสียงวิดีโอ — ต้องใช้ปุ่มเสียงของเครื่อง
export function isIOS() {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  return /iPad|iPhone|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
}

export function ytCommand(iframe, func, args = []) {
  try {
    if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify({ event: "command", func, args }), "*");
  } catch (e) { /* ignore */ }
}

// ตั้งระดับเสียง (0..100) และสถานะปิดเสียง
export function applyYtVolume(iframe, vol, muted) {
  const v = Math.round(Math.min(100, Math.max(0, Number(vol) || 0)));
  ytCommand(iframe, "setVolume", [v]);
  ytCommand(iframe, muted || v === 0 ? "mute" : "unMute");
}

// ตัวเล่นต้องโหลดเสร็จก่อนจึงรับคำสั่ง — ส่งซ้ำหลายจังหวะหลัง iframe โหลด (คืนฟังก์ชันยกเลิก)
export function applyYtVolumeWhenReady(iframe, getPrefs) {
  const timers = [];
  [0, 400, 1200, 2500, 5000].forEach(ms => timers.push(setTimeout(() => {
    const p = getPrefs();
    applyYtVolume(iframe, p.music, p.musicMuted);
  }, ms)));
  try { if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage(JSON.stringify({ event: "listening", id: 1, channel: "widget" }), "*"); } catch (e) { /* ignore */ }
  return () => timers.forEach(clearTimeout);
}
