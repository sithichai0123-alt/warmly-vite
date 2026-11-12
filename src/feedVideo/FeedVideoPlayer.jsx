// Feed Video — ตัวเล่นวิดีโอในฟีด (แทน FeedVideo เดิมเมื่อเปิดโมดูล)
import { useEffect, useRef, useState } from "react";
import { MAX_VIDEO_SECONDS, MAX_HEIGHT_PX, MAX_HEIGHT_VH } from "./config.js";
import { feedVideoManager } from "./manager.js";
import { originalVideoUrl, isTrimmed } from "./trim.js";
import { getSoundOn, setSoundOn } from "./sound.js";
import { frameAspect } from "./layout.js";

let seq = 0;
const THRESHOLDS = Array.from({ length: 21 }, (_, i) => i / 20);

export default function FeedVideoPlayer({ src, single = false, manager = feedVideoManager }) {
  const ref = useRef(null);
  const idRef = useRef(null);
  if (idRef.current == null) idRef.current = "fv" + (++seq);
  const exp = useRef({ play: 0, pause: 0 }); // จำนวนเหตุการณ์ play/pause ที่ระบบสั่งเอง (ไว้แยกจากผู้ใช้กดเอง)
  const [url, setUrl] = useState(src);
  const [failed, setFailed] = useState(false);
  const [ar, setAr] = useState(16 / 9);
  const [muted, setMuted] = useState(true);
  useEffect(() => { setUrl(src); setFailed(false); }, [src]);

  useEffect(() => {
    const v = ref.current; if (!v) return undefined;
    const id = idRef.current;
    const sysPlay = () => {
      if (v.paused) exp.current.play++;
      const pr = v.play();
      if (pr && pr.catch) pr.catch(() => { if (v.paused && exp.current.play > 0) exp.current.play--; });
      return pr;
    };
    manager.register(id, {
      play() {
        const wantSound = getSoundOn();
        v.muted = !wantSound; setMuted(!wantSound);
        const pr = sysPlay();
        if (pr && pr.catch) pr.catch(() => {
          // เบราว์เซอร์ไม่ยอมเล่นพร้อมเสียง → ลองเล่นแบบปิดเสียง
          if (!v.muted) { v.muted = true; setMuted(true); const p2 = sysPlay(); if (p2 && p2.catch) p2.catch(() => manager.markPaused(id)); } else manager.markPaused(id);
        });
      },
      pause() { if (!v.paused) { exp.current.pause++; v.pause(); } },
    });
    let io = null;
    if (typeof IntersectionObserver !== "undefined") {
      io = new IntersectionObserver(([en]) => manager.report(id, en.intersectionRatio, en.boundingClientRect.top), { threshold: THRESHOLDS });
      io.observe(v);
    }
    return () => { if (io) io.disconnect(); manager.unregister(id); };
  }, [manager]);

  const onMeta = e => { const v = e.currentTarget; setAr(frameAspect(v.videoWidth, v.videoHeight)); };
  const onTime = e => { const v = e.currentTarget; if (v.currentTime >= MAX_VIDEO_SECONDS + 0.05) { v.currentTime = 0; } }; // เพดาน 30 วินาทีแม้ไฟล์จริงยาวกว่า
  const onPlay = () => { if (exp.current.play > 0) { exp.current.play--; return; } manager.claim(idRef.current); };
  const onPause = () => { if (exp.current.pause > 0) { exp.current.pause--; return; } if (ref.current && !ref.current.ended) manager.userPause(idRef.current); };
  const onErr = () => {
    const o = originalVideoUrl(url);
    if (isTrimmed(url) && o !== url) { setUrl(o); return; } // Cloudinary ตัดให้ไม่ได้ → ใช้ลิงก์ต้นฉบับ (ตัวเล่นยังจำกัด 30 วินาทีเอง)
    setFailed(true);
  };
  const toggleSound = e => {
    e.stopPropagation();
    const v = ref.current; if (!v) return;
    const next = !v.muted; v.muted = next; setMuted(next); setSoundOn(!next);
    if (!next && v.paused) { manager.claim(idRef.current); v.play().catch(() => {}); }
  };

  const box = single
    ? { position: "relative", width: "100%", aspectRatio: String(ar), maxHeight: "min(" + MAX_HEIGHT_VH + "vh," + MAX_HEIGHT_PX + "px)", background: "#000" }
    : { position: "relative", width: "100%", height: "100%", minHeight: 130, background: "#000" };
  if (failed) return <div data-feedvideo-failed style={{ ...box, display: "flex", alignItems: "center", justifyContent: "center", color: "#9B94C4", fontSize: 12, aspectRatio: undefined, minHeight: 100 }}>เล่นวิดีโอนี้ไม่ได้</div>;
  return (
    <div data-feedvideo={idRef.current} style={box}>
      <video ref={ref} src={url} controls loop playsInline preload="metadata" muted={muted}
        onLoadedMetadata={onMeta} onTimeUpdate={onTime} onPlay={onPlay} onPause={onPause} onError={onErr} onVolumeChange={e => setMuted(e.currentTarget.muted)}
        style={{ width: "100%", height: "100%", objectFit: "contain", display: "block", background: "#000" }} />
      <button type="button" data-feedvideo-sound={muted ? "off" : "on"} aria-label={muted ? "เปิดเสียง" : "ปิดเสียง"} onClick={toggleSound}
        style={{ position: "absolute", top: 8, right: 8, width: 34, height: 34, borderRadius: "50%", border: "none", background: "rgba(0,0,0,.55)", color: "#fff", fontSize: 16, cursor: "pointer", fontFamily: "inherit", lineHeight: 1 }}>{muted ? "🔇" : "🔊"}</button>
    </div>
  );
}
