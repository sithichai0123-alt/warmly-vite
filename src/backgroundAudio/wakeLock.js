// กันจอดับ (Screen Wake Lock API) — ระบบจะปล่อยล็อกเองเมื่อซ่อนหน้า จึงขอใหม่เมื่อกลับมาเห็นหน้า
export function createWakeLock(nav, doc) {
  const supported = !!(nav && nav.wakeLock && typeof nav.wakeLock.request === "function");
  let sentinel = null, wanted = false;
  async function acquire() {
    if (!supported || sentinel) return !!sentinel;
    try {
      const s = await nav.wakeLock.request("screen");
      sentinel = s;
      if (s && s.addEventListener) s.addEventListener("release", () => { if (sentinel === s) sentinel = null; });
      return true;
    } catch (e) { sentinel = null; return false; } // เช่น โหมดประหยัดแบต
  }
  const onVis = () => { if (wanted && doc && doc.visibilityState === "visible") acquire(); };
  return {
    supported,
    async enable() { wanted = true; if (doc) doc.addEventListener("visibilitychange", onVis); return acquire(); },
    async disable() {
      wanted = false; if (doc) doc.removeEventListener("visibilitychange", onVis);
      const s = sentinel; sentinel = null;
      if (s && s.release) { try { await s.release(); } catch (e) { /* ignore */ } }
    },
    isHeld: () => !!sentinel,
  };
}
