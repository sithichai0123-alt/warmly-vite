// เสียงเงียบวนซ้ำ — ทำให้ระบบมองว่าหน้านี้ "กำลังเล่นสื่อ" ต่อเนื่อง เพื่อลดโอกาสถูกหยุดเมื่อล็อกจอ (ไม่มีเสียงออกจริง)
export function silentWavDataUrl(seconds = 1, rate = 8000) {
  const n = Math.max(1, Math.floor(seconds * rate));
  const h = new Uint8Array(44), dv = new DataView(h.buffer);
  const w = (o, s) => { for (let i = 0; i < s.length; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, "RIFF"); dv.setUint32(4, 36 + n, true); w(8, "WAVE"); w(12, "fmt "); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate, true);
  dv.setUint16(32, 1, true); dv.setUint16(34, 8, true); w(36, "data"); dv.setUint32(40, n, true);
  let bin = ""; for (let i = 0; i < 44; i++) bin += String.fromCharCode(h[i]);
  bin += String.fromCharCode(128).repeat(n); // 8-bit PCM: 128 = เงียบสนิท
  return "data:audio/wav;base64," + btoa(bin);
}

export function createKeepAlive(doc) {
  let el = null;
  async function start() {
    if (!doc) return false;
    if (!el) {
      el = doc.createElement("audio");
      el.setAttribute("data-bg-keepalive", "1");
      el.setAttribute("playsinline", ""); el.loop = true; el.src = silentWavDataUrl();
      el.style.display = "none";
      doc.body.appendChild(el);
    }
    if (!el.paused) return true;
    try { await el.play(); return true; } catch (e) { return false; } // ต้องมีการแตะก่อน (กฎ autoplay) — ลองใหม่เมื่อแตะ
  }
  function stop() { if (!el) return; try { el.pause(); el.removeAttribute("src"); el.load && el.load(); } catch (e) { /* ignore */ } el.remove(); el = null; }
  return { start, stop, isPlaying: () => !!el && !el.paused };
}
