// ปุ่มควบคุม/ชื่อห้องบนหน้าจอล็อกและแถบแจ้งเตือน (Media Session API)
// ปุ่ม "หยุด" บนจอล็อก = ปิดไมค์เท่านั้น (ไม่ออกจากห้อง และไม่เปิดไมค์ให้เองเด็ดขาด)
export function createMediaSession(nav) {
  const ms = nav && nav.mediaSession;
  const supported = !!ms && typeof MediaMetadata !== "undefined";
  const handlers = ["play", "pause"];
  return {
    supported,
    set({ title, onPause, onPlay }) {
      if (!supported) return false;
      try {
        ms.metadata = new MediaMetadata({ title, artist: "Warmly", album: "ห้องเสียง" });
        ms.playbackState = "playing";
        ms.setActionHandler("pause", () => { try { onPause && onPause(); } finally { ms.playbackState = "playing"; } });
        ms.setActionHandler("play", () => { ms.playbackState = "playing"; onPlay && onPlay(); });
        return true;
      } catch (e) { return false; }
    },
    clear() {
      if (!supported) return;
      try { handlers.forEach(h => { try { ms.setActionHandler(h, null); } catch (e) { /* ignore */ } }); ms.metadata = null; ms.playbackState = "none"; } catch (e) { /* ignore */ }
    },
  };
}
