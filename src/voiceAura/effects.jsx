// Voice Aura — ตัวแสดงแอนิเมชันรอบรูปโปรไฟล์ (CSS ล้วน ไม่มีเสียง ไม่ตรวจจับเสียงเอง)
// ทำงานจากสถานะ "กำลังพูด" ที่ LiveKit รายงานอยู่แล้ว (speaking map ของ useVoice) เท่านั้น
import { useState, useEffect } from "react";
import { VOICE_AURA_ENABLED, AURA_FADE_MS, AURA_SCALE } from "./config.js";
import { AURA_BY_ID, equippedAura } from "./catalog.js";

// ── โหมดของผู้ชม: full / reduced / off (เก็บในเครื่องผู้ชมเอง ไม่กระทบคนอื่น) ──
const MODE_KEY = "wm_auraMode";
const modeListeners = new Set();
function readMode() {
  try {
    const v = localStorage.getItem(MODE_KEY);
    if (v === "full" || v === "reduced" || v === "off") return v;
  } catch (e) { /* ใช้ค่าเริ่มต้น */ }
  // เครื่องแรงต่ำ (CPU ≤ 2 คอร์) เริ่มที่โหมดลดเอฟเฟกต์
  return (typeof navigator !== "undefined" && (navigator.hardwareConcurrency || 8) <= 2) ? "reduced" : "full";
}
export function setAuraMode(m) {
  try { localStorage.setItem(MODE_KEY, m); } catch (e) { /* ไม่เป็นไร */ }
  modeListeners.forEach(f => f(m));
}
export function useAuraMode() {
  const [m, setM] = useState(readMode);
  useEffect(() => { modeListeners.add(setM); return () => { modeListeners.delete(setM); }; }, []);
  return [m, setAuraMode];
}
export function usePrefersReduced() {
  const [r, setR] = useState(() => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches);
  useEffect(() => {
    if (!window.matchMedia) return undefined;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const f = () => setR(mq.matches);
    if (mq.addEventListener) mq.addEventListener("change", f); else if (mq.addListener) mq.addListener(f);
    return () => { if (mq.removeEventListener) mq.removeEventListener("change", f); else if (mq.removeListener) mq.removeListener(f); };
  }, []);
  return r;
}

// aura ที่จะแสดงให้สมาชิกคนนี้ (null = ใช้วงเขียวเดิม) — รวมสวิตช์ปิดทั้งระบบและโหมด off
export function resolveAura(userDoc, mode) {
  if (!VOICE_AURA_ENABLED || mode === "off") return null;
  const id = equippedAura(userDoc);
  return id && EFFECTS[id] ? id : null;
}

// ── CSS (ฉีดครั้งเดียว) ─────────────────────────────────────
const AURA_CSS = `
/* วงหลักอยู่ห่างรูป 4px; ชั้นเอฟเฟกต์ถูกขยายพื้นที่ 1/s เท่าแล้วย่อ s เท่า → วงหลักตำแหน่งเดิม ส่วนที่ยื่นออกไปเล็กลง s เท่า */
.wm-aura{position:absolute;inset:calc(-3px - ${((1 / AURA_SCALE - 1) / 2).toFixed(4)} * (100% + 6px));transform:scale(${AURA_SCALE});pointer-events:none;z-index:0;opacity:0;transition:opacity ${AURA_FADE_MS}ms ease}
.wm-aura.on{opacity:1}
.wm-aura-core{position:absolute;inset:0;animation:wm-breath 1.1s ease-in-out infinite alternate;will-change:transform}
.wm-aura.calm .wm-aura-core,.wm-aura.calm .wm-aura-core *{animation:none!important}
.wm-ring{position:absolute;inset:0;border-radius:50%;
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - var(--w,4px)),#000 calc(100% - var(--w,4px) + 1px));
  mask:radial-gradient(farthest-side,transparent calc(100% - var(--w,4px)),#000 calc(100% - var(--w,4px) + 1px))}
.wm-spin{animation:wm-spin var(--d,3s) linear infinite;will-change:transform}
.wm-spin-r{animation:wm-spin var(--d,3s) linear infinite reverse}
@keyframes wm-spin{to{transform:rotate(360deg)}}
/* กรอบรูปวาดด้วย SVG (cat/daisy/frost/moon) — ขยับพลิ้วแบบนุ่ม ๆ; โหมด calm ปิดแอนิเมชันอัตโนมัติ */
.wmf-ear{transform-box:fill-box;transform-origin:50% 100%;animation:wmf-twitch 2.2s ease-in-out infinite}
.wmf-ear.r{animation-delay:-1.11s}
@keyframes wmf-twitch{0%,58%,100%{transform:rotate(0)}64%{transform:rotate(-8deg)}70%{transform:rotate(3deg)}78%{transform:rotate(-2.5deg)}88%{transform:rotate(.5deg)}}
.wmf-bell{transform-box:fill-box;transform-origin:50% 0;animation:wmf-swing 1.8s cubic-bezier(.36,.07,.19,.97) infinite}
@keyframes wmf-swing{0%{transform:rotate(0)}14%{transform:rotate(10deg)}30%{transform:rotate(-8deg)}46%{transform:rotate(5deg)}62%{transform:rotate(-3deg)}78%,100%{transform:rotate(0)}}
.wmf-fl{transform-box:fill-box;transform-origin:50% 62%;animation:wmf-sway 3.2s ease-in-out infinite;filter:drop-shadow(0 1px 1px rgba(0,0,0,.35))}
@keyframes wmf-sway{0%,100%{transform:rotate(-7deg) scale(.96)}50%{transform:rotate(7deg) scale(1.08)}}
.wmf-tw{transform-box:fill-box;transform-origin:center;animation:wmf-twk 2.4s ease-in-out infinite}
@keyframes wmf-twk{0%,100%{opacity:.4;transform:scale(.85) rotate(-8deg)}50%{opacity:1;transform:scale(1.12) rotate(14deg)}}
.wmf-drift{transform-origin:50% 50%;transform-box:view-box;animation:wmf-drift 5.5s ease-in-out infinite alternate}
@keyframes wmf-drift{from{transform:rotate(-2deg)}to{transform:rotate(2deg)}}

@keyframes wm-breath{from{transform:scale(1)}to{transform:scale(1.045)}}
@keyframes wm-flicker{0%{opacity:.55;transform:scale(1)}100%{opacity:.95;transform:scale(1.06)}}
.wm-flick{animation:wm-flicker .45s ease-in-out infinite alternate}
/* ไฟ */
.wm-fire-ring{background:conic-gradient(from 0deg,#ff3d00,#ff9100 18%,#ffd54f 32%,#ff9100 46%,#ff3d00 60%,#b71c1c 78%,#ff3d00)}
.wm-fire-glow{filter:blur(5px);opacity:.75}
.wm-ember{position:absolute;width:5px;height:5px;border-radius:50%;background:radial-gradient(circle,#fff3b0,#ff9100 60%,transparent 72%);opacity:0;animation:wm-ember var(--t,1.3s) ease-out infinite;animation-delay:var(--dl,0s)}
@keyframes wm-ember{0%{transform:translate(0,0) scale(1);opacity:0}15%{opacity:1}100%{transform:translate(var(--dx,0),-30px) scale(.2);opacity:0}}
/* หัวใจ */
.wm-heart{position:absolute;width:13px;height:13px;opacity:0;animation:wm-heart var(--t,2.2s) ease-out infinite;animation-delay:var(--dl,0s)}
.wm-heart svg{display:block;width:100%;height:100%}
@keyframes wm-heart{0%{transform:translate(0,4px) scale(.4);opacity:0}15%{opacity:1}60%{opacity:.95}100%{transform:translate(var(--dx,0),-34px) scale(1.05);opacity:0}}
.wm-pink-ring{background:conic-gradient(#ff5c8a,#ffb3c8,#ff5c8a,#ff8fb1,#ff5c8a)}
/* สายรุ้ง */
.wm-rainbow{background:conic-gradient(from 0deg,#f43f5e,#fb923c,#facc15,#4ade80,#22d3ee,#818cf8,#e879f9,#f43f5e)}
.wm-rainbow-glow{filter:blur(6px);opacity:.7}
/* นีออน */
.wm-neon{position:absolute;inset:0;border-radius:50%;border:2px solid var(--c);box-shadow:0 0 8px var(--c),inset 0 0 6px var(--c);animation:wm-neon var(--t,1.2s) ease-out infinite;animation-delay:var(--dl,0s);opacity:0}
@keyframes wm-neon{0%{transform:scale(.97);opacity:.95}100%{transform:scale(1.2);opacity:0}}
.wm-neon-base{border:2px solid #22d3ee;box-shadow:0 0 8px #22d3ee,inset 0 0 6px #e879f9;animation:none;opacity:.95}
/* ซากุระ */
.wm-petal{position:absolute;width:7px;height:9px;border-radius:80% 0 80% 0;background:linear-gradient(135deg,#fff1f6,#f9a8d4);opacity:0;animation:wm-petal var(--t,2.6s) ease-in-out infinite;animation-delay:var(--dl,0s)}
@keyframes wm-petal{0%{transform:translate(0,-6px) rotate(0);opacity:0}15%{opacity:1}100%{transform:translate(var(--dx,0),46px) rotate(var(--r,200deg));opacity:0}}
.wm-sakura-ring{background:conic-gradient(#fbcfe8,#f9a8d4,#fff1f6,#f9a8d4,#fbcfe8)}
/* ดาราจักร */
.wm-galaxy-ring{background:conic-gradient(from 0deg,#312e81,#6366f1 25%,#f0abfc 45%,#6366f1 65%,#1e1b4b 85%,#312e81)}
.wm-star{position:absolute;width:7px;height:7px;background:#fff;clip-path:polygon(50% 0,62% 38%,100% 50%,62% 62%,50% 100%,38% 62%,0 50%,38% 38%);opacity:0;animation:wm-twinkle var(--t,1.6s) ease-in-out infinite;animation-delay:var(--dl,0s)}
@keyframes wm-twinkle{0%,100%{transform:scale(.3);opacity:0}50%{transform:scale(1.15);opacity:1}}
.wm-orbit{position:absolute;inset:0}
.wm-orbit i{position:absolute;left:50%;top:-3px;width:6px;height:6px;margin-left:-3px;border-radius:50%;background:radial-gradient(circle,#fff,#f0abfc 55%,transparent 72%)}
/* สายฟ้า */
.wm-bolt-ring{background:conic-gradient(from 0deg,#1e3a8a,#93c5fd 12%,#fff 16%,#93c5fd 20%,#1e3a8a 40%,#1e3a8a 60%,#93c5fd 72%,#fff 76%,#93c5fd 80%,#1e3a8a)}
.wm-bolt{position:absolute;inset:-8px;opacity:0;animation:wm-flash var(--t,1.5s) steps(1,end) infinite;animation-delay:var(--dl,0s)}
.wm-bolt svg{position:absolute;left:50%;top:0;width:14px;height:16px;margin-left:-7px;display:block;overflow:visible}
@keyframes wm-flash{0%{opacity:0}4%{opacity:1}12%{opacity:.2}18%{opacity:1}30%{opacity:0}100%{opacity:0}}
/* ผีเสื้อ */
.wm-bfly-orbit{position:absolute;inset:-4px;animation:wm-spin var(--d,5s) linear infinite;animation-delay:var(--dl,0s)}
.wm-bfly{position:absolute;left:50%;top:-6px;width:15px;height:13px;margin-left:-7px}
.wm-bfly svg{display:block;width:100%;height:100%;overflow:visible;animation:wm-flap .22s ease-in-out infinite alternate;transform-origin:50% 55%}
@keyframes wm-flap{from{transform:scaleX(1)}to{transform:scaleX(.35)}}
.wm-bfly-ring{background:conic-gradient(#67e8f9,#c084fc,#67e8f9,#a78bfa,#67e8f9)}
/* ปีก (ฟีนิกซ์ / ปีกสวรรค์) */
.wm-wingbox{position:absolute;inset:70px}
.wm-wingmask{position:absolute;inset:-70px;-webkit-mask:radial-gradient(circle 31px at 50% 50%,transparent 30px,#000 31px);mask:radial-gradient(circle 31px at 50% 50%,transparent 30px,#000 31px)}
.wm-wing{position:absolute;top:1%;width:60px;height:60px}
.wm-wing.r{left:62%}
.wm-wing.l{right:62%;transform:scaleX(-1)}
.wm-wing .f{position:absolute;inset:0;transform-origin:7% 57%;animation:wm-flap2 var(--t,.7s) ease-in-out infinite alternate;will-change:transform}
.wm-wing svg{position:absolute;inset:0;width:100%;height:100%;overflow:visible}
@keyframes wm-flap2{from{transform:rotate(-9deg) scale(.96)}to{transform:rotate(9deg) scale(1.03)}}
.wm-gold-ring{background:conic-gradient(from 0deg,#fde68a,#f59e0b 20%,#dc2626 38%,#f59e0b 55%,#fef3c7 70%,#f59e0b 85%,#fde68a)}
.wm-spark{position:absolute;width:6px;height:6px;border-radius:50%;background:radial-gradient(circle,#fff,#fbbf24 55%,transparent 72%);opacity:0;animation:wm-ember var(--t,1.5s) ease-out infinite;animation-delay:var(--dl,0s)}
/* มงกุฎคริสตัล */
.wm-crown{position:absolute;left:50%;top:-17px;width:30px;height:20px;margin-left:-15px;animation:wm-crownbob 1.6s ease-in-out infinite alternate}
.wm-crown svg{display:block;width:100%;height:100%;overflow:visible}
@keyframes wm-crownbob{from{transform:translateY(0)}to{transform:translateY(-2px)}}
.wm-crystal-ring{background:conic-gradient(from 0deg,#e0f2fe,#a5f3fc 12%,#fff 18%,#e9d5ff 30%,#a5f3fc 50%,#e0f2fe 60%,#fff 66%,#c4b5fd 82%,#e0f2fe)}
/* มังกร */
.wm-dseg{position:absolute;left:50%;top:-4px;border-radius:50%;background:radial-gradient(circle at 35% 35%,#fef9c3,#34d399 55%,#047857)}
.wm-dhead{position:absolute;left:50%;top:-9px;width:22px;height:18px;margin-left:-11px}
.wm-dhead svg{display:block;width:100%;height:100%;overflow:visible}
.wm-dragon-ring{background:conic-gradient(#065f46,#10b981,#fde047 30%,#10b981 55%,#065f46)}
/* จักรวาลราชัน */
.wm-magic{position:absolute;inset:-12px;animation:wm-spin var(--d,16s) linear infinite}
.wm-magic svg{position:absolute;inset:0;width:100%;height:100%}
.wm-nebula{position:absolute;inset:-14px;border-radius:50%;background:radial-gradient(circle,rgba(124,58,237,0) 50%,rgba(124,58,237,.28) 68%,rgba(245,158,11,.16) 84%,rgba(0,0,0,0) 100%)}
/* สายรุ้งเทวา */
.wm-rays{position:absolute;inset:-16px;border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(255,240,200,.5) 0 2.5deg,rgba(255,255,255,0) 2.5deg 15deg);-webkit-mask:radial-gradient(circle,transparent 56%,#000 62%,transparent 98%);mask:radial-gradient(circle,transparent 56%,#000 62%,transparent 98%);animation:wm-spin 14s linear infinite}
.wm-pearl{position:absolute;inset:-11px;border-radius:50%;border:1.5px dashed rgba(255,255,255,.75)}
.wm-halo{position:absolute;inset:-8px;border-radius:50%;background:radial-gradient(circle,rgba(216,180,254,0) 58%,rgba(216,180,254,.32) 74%,rgba(216,180,254,0) 100%);animation:wm-flicker .9s ease-in-out infinite alternate}
@media (prefers-reduced-motion:reduce){.wm-aura-core,.wm-aura-core *{animation:none!important}}
/* ── เอฟเฟกต์แบบ 3 มิติ (วงนูน เงา ประกาย) — ใช้หน่วย cqw ของชั้นเอฟเฟกต์ ขนาดจึงสัมพันธ์กับรูปทุกขนาด ── */
.wm-aura{container-type:size}
.wm-flame{position:absolute;background:linear-gradient(to top,#ff6d00,#ffd54f 70%,rgba(255,236,150,0));border-radius:60% 60% 50% 50%/80% 80% 30% 30%;transform-origin:50% 100%;animation:wm-flame var(--t,.5s) ease-in-out infinite alternate}
@keyframes wm-flame{0%{transform:scaleY(.85) translateY(1px);opacity:.75}100%{transform:scaleY(1.15) translateY(-1px);opacity:1}}
.wm-feather{position:absolute;background:linear-gradient(to top,#ea580c,#fbbf24 70%,rgba(254,243,199,0));border-radius:60% 60% 40% 40%/90% 90% 20% 20%;transform-origin:50% 100%;animation:wm-flame var(--t,.5s) ease-in-out infinite alternate}
.wm-flame-glow{background:radial-gradient(circle,rgba(255,90,0,0),rgba(255,110,0,.4));filter:blur(3px);animation:wm-flame .5s ease-in-out infinite alternate}
.wm-fire3d{background:conic-gradient(#b71c1c,#ff3d00 12%,#ff9100 28%,#ffe082 40%,#ff9100 52%,#ff3d00 66%,#b71c1c 82%,#ff3d00);filter:drop-shadow(0 0 5px rgba(255,100,0,.9))}
.wm-ember3{position:absolute;width:3.7cqw;height:3.7cqw;border-radius:50%;background:#ffd54f;box-shadow:0 0 4px #ff9100;opacity:0;animation:wm-ember var(--t,1.3s) ease-out infinite;animation-delay:var(--dl,0s)}
.wm-neon3{background:linear-gradient(135deg,#f472b6,#a78bfa 50%,#22d3ee);filter:drop-shadow(0 0 4px #f472b6) drop-shadow(0 0 9px rgba(34,211,238,.7))}
.wm-pulse3{background:linear-gradient(135deg,#f472b6,#22d3ee);opacity:0;animation:wm-pulse3 1.6s ease-out infinite;animation-delay:var(--dl,0s)}
@keyframes wm-pulse3{0%{transform:scale(.97);opacity:.8}100%{transform:scale(1.2);opacity:0}}
.wm-crystal3{background:conic-gradient(from 20deg,#bae6fd,#e9d5ff,#fff,#fbcfe8,#a5f3fc,#bae6fd)}
.wm-galaxy3{background:conic-gradient(#312e81,#6366f1 22%,#f0abfc 42%,#818cf8 60%,#1e1b4b 80%,#312e81);filter:drop-shadow(0 0 4px rgba(129,140,248,.8))}
.wm-galaxy-halo{background:radial-gradient(circle,rgba(240,171,252,0),rgba(129,140,248,.35));filter:blur(2px)}
.wm-gold3{background:conic-gradient(from 210deg,#fff3b0,#f5b942 18%,#a86a10 36%,#ffe082 52%,#f5b942 68%,#8a5208 84%,#fff3b0);filter:drop-shadow(0 1px 3px rgba(0,0,0,.6)) drop-shadow(0 0 6px rgba(245,185,66,.6))}
.wm-gold3b{background:conic-gradient(from 30deg,#8a5208,#ffe9a8 25%,#c98a1c 55%,#fff3b0 80%,#8a5208);opacity:.9}
.wm-gem{position:absolute;transform:translateX(-50%) rotate(45deg);background:linear-gradient(135deg,#fff,#fde68a 50%,#f59e0b);border:1px solid #fff3b0;border-radius:2px;box-shadow:0 0 7px #fbbf24}
`;
if (typeof document !== "undefined" && !document.getElementById("wm-aura-css")) {
  const s = document.createElement("style");
  s.id = "wm-aura-css";
  s.textContent = AURA_CSS;
  document.head.appendChild(s);
}

// ── เอฟเฟกต์ (แต่ละตัวรับ calm = ไม่มีอนุภาค/ไม่มีเบลอ) ──────────
const HEART_PATH = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

// หน่วยของเอฟเฟกต์ 3 มิติ: 1 หน่วย = 1.4706cqw → วงหลักรัศมี 34 หน่วย = ครึ่งหนึ่งของชั้นเอฟเฟกต์ (ขนาดตามสัดส่วนของรูป)
const U = n => (n * 1.4706).toFixed(2) + "cqw";
const NU = n => "-" + U(n);
const polar = (ang, r, child, key) => (
  <div key={key} style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, transform: `rotate(${ang}deg) translateY(${NU(r)})` }}>{child}</div>
);

function FireRing({ calm }) {
  const flames = calm ? [] : [-70, -45, -20, 5, 30, 55, 80, 200, 160];
  const embers = calm ? [] : [[25, -4], [48, 3], [70, -2], [58, 5]];
  return (
    <>
      {!calm && <div className="wm-ring wm-flame-glow" style={{ inset: NU(2), "--w": U(10) }} />}
      {flames.map((ang, i) => polar(ang, 37, <div className="wm-flame" style={{ left: NU(2.5), top: NU(7 + (i % 3) * 3), width: U(5), height: U(7 + (i % 3) * 3), "--t": (0.35 + i * 0.06).toFixed(2) + "s" }} />, i))}
      <div className="wm-ring wm-fire3d wm-spin" style={{ "--w": U(5), "--d": "3s" }} />
      <div className="wm-ring" style={{ inset: U(5), "--w": U(2), background: "rgba(90,10,0,.75)" }} />
      <div className="wm-ring wm-spin-r" style={{ "--w": U(1.6), "--d": "2.4s", background: "conic-gradient(transparent 0 70%,rgba(255,255,230,.95) 82%,transparent 92%)" }} />
      {embers.map(([x, dx], i) => <span key={i} className="wm-ember3" style={{ left: x + "%", top: "8%", "--dx": dx + "px", "--t": (1.2 + i * 0.2).toFixed(1) + "s", "--dl": i * 0.35 + "s" }} />)}
    </>
  );
}

function FloatingHearts({ calm }) {
  const hs = calm ? [] : [
    { l: "14%", c: "#ff5c8a", dx: "-8px", dl: "0s", t: "2.1s" }, { l: "32%", c: "#ffb3c8", dx: "6px", dl: ".6s", t: "2.4s" },
    { l: "50%", c: "#ff3d71", dx: "-4px", dl: "1.1s", t: "2s" }, { l: "66%", c: "#ff8fb1", dx: "9px", dl: ".3s", t: "2.5s" },
    { l: "82%", c: "#ff5c8a", dx: "-6px", dl: "1.5s", t: "2.2s" },
  ];
  return (
    <>
      <div className="wm-ring wm-pink-ring" style={{ "--w": "3px", opacity: 0.85 }} />
      {hs.map((h, i) => (
        <span key={i} className="wm-heart" style={{ left: h.l, top: "-2%", "--dx": h.dx, "--dl": h.dl, "--t": h.t }}>
          <svg viewBox="0 0 24 24"><path d={HEART_PATH} fill={h.c} /></svg>
        </span>
      ))}
    </>
  );
}

function RainbowAura({ calm }) {
  return (
    <>
      {!calm && <div className="wm-ring wm-rainbow wm-rainbow-glow wm-spin-r" style={{ "--w": "9px", "--d": "5s", inset: -2 }} />}
      <div className="wm-ring wm-rainbow wm-spin" style={{ "--w": "4px", "--d": "3.2s" }} />
    </>
  );
}


function NeonPulse({ calm }) {
  return (
    <>
      <div className="wm-ring" style={{ inset: U(1.2), "--w": U(3.2), background: "rgba(0,0,0,.55)", filter: "blur(1.2px)" }} />
      {!calm && [0, 0.8].map(d => <div key={d} className="wm-ring wm-pulse3" style={{ "--w": U(1.5), "--dl": d + "s" }} />)}
      <div className="wm-ring wm-neon3" style={{ "--w": U(3.8) }} />
      <div className="wm-ring" style={{ inset: U(1.3), "--w": U(1.3), background: "rgba(255,255,255,.95)" }} />
      <div className="wm-ring" style={{ inset: U(4), "--w": U(1.2), background: "conic-gradient(from 270deg,rgba(255,255,255,.5) 0 18%,transparent 25%)" }} />
    </>
  );
}

function SakuraBloom({ calm }) {
  const ps = calm ? [] : [
    { l: "8%", dx: "-10px", dl: "0s", t: "2.6s", r: "220deg" }, { l: "25%", dx: "8px", dl: ".7s", t: "2.9s", r: "-200deg" },
    { l: "45%", dx: "-6px", dl: "1.3s", t: "2.5s", r: "260deg" }, { l: "62%", dx: "12px", dl: ".3s", t: "3s", r: "-240deg" },
    { l: "80%", dx: "-8px", dl: "1.7s", t: "2.7s", r: "200deg" }, { l: "92%", dx: "6px", dl: "1s", t: "2.8s", r: "-220deg" },
  ];
  return (
    <>
      <div className="wm-ring wm-sakura-ring" style={{ "--w": "3px", opacity: 0.9 }} />
      {ps.map((q, i) => <span key={i} className="wm-petal" style={{ left: q.l, top: "-4%", "--dx": q.dx, "--dl": q.dl, "--t": q.t, "--r": q.r }} />)}
    </>
  );
}

const STAR_POS = (() => {
  const out = [];
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 + 0.3, r = 56 + (i % 2) * 8;
    out.push({ l: (50 + Math.cos(a) * r).toFixed(1) + "%", t: (50 + Math.sin(a) * r).toFixed(1) + "%", dl: ((i * 0.37) % 1.6).toFixed(2) + "s", t2: (1.3 + (i % 3) * 0.35) + "s" });
  }
  return out;
})();
function GalaxyStars({ calm }) {
  const st = calm ? [] : [[8, 26, 0], [88, 30, 0.5], [78, 86, 1.0], [16, 80, 0.3]];
  return (
    <>
      <div className="wm-ring wm-galaxy-halo" style={{ inset: NU(3), "--w": U(3) }} />
      <div className="wm-ring wm-galaxy3 wm-spin" style={{ "--w": U(4.2), "--d": "7s" }} />
      <div className="wm-ring" style={{ inset: U(4.2), "--w": U(1.4), background: "rgba(15,10,50,.8)" }} />
      <div className="wm-ring wm-spin-r" style={{ "--w": U(1.5), "--d": "3.6s", background: "conic-gradient(transparent 0 72%,rgba(255,255,255,.9) 84%,transparent 94%)" }} />
      {!calm && [[4.5, "#f0abfc", false], [6.5, "#93c5fd", true]].map(([d, c, rev], i) => (
        <div key={i} className={rev ? "wm-spin-r" : "wm-spin"} style={{ position: "absolute", inset: 0, "--d": d + "s" }}>
          {polar(0, 34, <i style={{ position: "absolute", left: NU(2), top: NU(2), width: U(4), height: U(4), borderRadius: "50%", background: "#fff", boxShadow: "0 0 6px " + c }} />, "o")}
        </div>
      ))}
      {st.map(([x, y, d], i) => <span key={i} className="wm-star" style={{ left: x + "%", top: y + "%", marginLeft: -3, marginTop: -3, "--dl": d + "s", "--t": "1.8s" }} />)}
    </>
  );
}

function LightningRing({ calm }) {
  const bolts = calm ? [] : [{ a: 20, dl: "0s", t: "1.4s" }, { a: 140, dl: ".5s", t: "1.7s" }, { a: 250, dl: ".95s", t: "1.5s" }];
  return (
    <>
      <div className="wm-ring wm-bolt-ring wm-spin" style={{ "--w": "4px", "--d": "1.8s" }} />
      {bolts.map((b, i) => (
        <div key={i} className="wm-bolt" style={{ transform: "rotate(" + b.a + "deg)", "--dl": b.dl, "--t": b.t }}>
          <svg viewBox="0 0 14 16"><polyline points="8,0 3,7 8,8 4,16" fill="none" stroke="#fef08a" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" /></svg>
        </div>
      ))}
    </>
  );
}

function Butterfly({ c1, c2 }) {
  return (
    <svg viewBox="-2 0 28 24">
      <path d="M12 12C20 1 27 7 21 13C26 17 19 23 12 14Z" fill={c1} />
      <path d="M12 12C4 1 -3 7 3 13C-2 17 5 23 12 14Z" fill={c2} />
      <rect x="11.2" y="7" width="1.6" height="11" rx=".8" fill="#fff" />
    </svg>
  );
}
function ButterflyDream({ calm }) {
  const bs = calm ? [{ d: "5s", dl: "0s" }] : [{ d: "5s", dl: "0s" }, { d: "5s", dl: "-1.7s" }, { d: "5s", dl: "-3.4s" }];
  return (
    <>
      <div className="wm-ring wm-bfly-ring wm-spin" style={{ "--w": "3px", "--d": "7s", opacity: 0.8 }} />
      {bs.map((b, i) => (
        <div key={i} className="wm-bfly-orbit" style={{ "--d": b.d, "--dl": b.dl }}>
          <span className="wm-bfly"><Butterfly c1={i % 2 ? "#c084fc" : "#67e8f9"} c2={i % 2 ? "#f0abfc" : "#a78bfa"} /></span>
        </div>
      ))}
    </>
  );
}

// ── พรีเมียม (เหรียญม่วง) ────────────────────────────────────
// ปีก: ขนนก n เส้นกางเป็นพัด ชี้ขึ้นและออกด้านข้าง (ไม่ทับรูปเพื่อนข้างเคียง) แผ่นปีกอยู่ใต้รูปเสมอ
function Wing({ side, variant }) {
  const flame = variant === "flame";
  const angles = [-100, -80, -60, -40, -20];
  const lens = flame ? [32, 42, 47, 42, 33] : [30, 40, 46, 43, 34];
  const id = "wg" + variant + side;
  const by = 34;
  return (
    <div className={"wm-wing " + side}>
      <div className="f" style={{ "--t": flame ? ".6s" : "1.5s" }}>
        <svg viewBox="0 0 60 60">
          <defs>
            <linearGradient id={id} x1="0" y1="0" x2="1" y2="0">
              {flame
                ? <><stop offset="0" stopColor="#fde68a" /><stop offset=".5" stopColor="#f59e0b" /><stop offset="1" stopColor="#dc2626" /></>
                : <><stop offset="0" stopColor="#ffffff" /><stop offset=".6" stopColor="#e0e7ff" /><stop offset="1" stopColor="#c4b5fd" /></>}
            </linearGradient>
          </defs>
          {angles.map((a, i) => {
            const L = lens[i], w = flame ? 3.6 : 5;
            const d = flame
              ? "M4 " + by + "Q" + (4 + L * 0.5) + " " + (by - w * 2) + " " + (4 + L) + " " + by + "Q" + (4 + L * 0.5) + " " + (by + w) + " 4 " + by + "Z"
              : "M4 " + by + "Q" + (4 + L * 0.35) + " " + (by - w * 1.6) + " " + (4 + L) + " " + (by - 1) + "Q" + (4 + L) + " " + (by + 3) + " " + (4 + L * 0.4) + " " + (by + w) + "Z";
            return <path key={i} d={d} fill={"url(#" + id + ")"} opacity={0.92} transform={"rotate(" + a + " 4 " + by + ")"} />;
          })}
        </svg>
      </div>
    </div>
  );
}

function GoldenPhoenix({ calm }) {
  const feathers = calm ? [] : [-80, -58, -36, -14, 14, 36, 58, 80];
  const embers = calm ? [] : [[30, -3], [52, 3], [70, -2]];
  return (
    <>
      {feathers.map((a, i) => polar(a, 37.7, <div className="wm-feather" style={{ left: NU(3), top: NU(11 + (Math.abs(a) % 3) * 2), width: U(6), height: U(11 + (Math.abs(a) % 3) * 2), "--t": (0.45 + Math.abs(a) / 300).toFixed(2) + "s" }} />, i))}
      <div className="wm-ring wm-gold3" style={{ "--w": U(5.5) }} />
      <div className="wm-ring wm-gold3b" style={{ inset: U(3), "--w": U(1.9) }} />
      {!calm && <div className="wm-ring wm-spin" style={{ "--w": U(5.5), "--d": "3.6s", background: "conic-gradient(transparent 0 80%,rgba(255,255,255,.9) 90%,transparent 97%)" }} />}
      <div className="wm-gem" style={{ left: "50%", top: NU(4), width: U(8.2), height: U(8.2) }} />
      {embers.map(([x, dx], i) => <span key={i} className="wm-ember3" style={{ left: x + "%", top: "6%", "--dx": dx + "px", "--t": (1.3 + i * 0.25).toFixed(2) + "s", "--dl": i * 0.4 + "s", background: "#fde68a" }} />)}
    </>
  );
}

function CrystalCrown({ calm }) {
  const st = calm ? [] : [[12, 34, 0], [88, 44, 0.7], [80, 82, 1.2]];
  return (
    <>
      <div className="wm-ring wm-crystal3" style={{ "--w": U(5.5) }} />
      <div className="wm-ring" style={{ inset: U(5.5), "--w": U(1.4), background: "rgba(80,100,140,.55)" }} />
      {!calm && <div className="wm-ring wm-spin" style={{ "--w": U(5.5), "--d": "3.2s", background: "conic-gradient(transparent 0 78%,rgba(255,255,255,.95) 88%,transparent 96%)" }} />}
      <div style={{ position: "absolute", left: "50%", top: NU(15 * 0.62), width: U(26), height: U(15), transform: "translateX(-50%)" }}>
        <svg viewBox="0 0 40 23" width="100%" height="100%" style={{ display: "block", overflow: "visible" }}>
          <defs>
            <linearGradient id="wm-cg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fff" /><stop offset=".5" stopColor="#a5f3fc" /><stop offset="1" stopColor="#c4b5fd" /></linearGradient>
            <linearGradient id="wm-cg2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stopColor="#7dd3fc" /><stop offset="1" stopColor="#f5d0fe" /></linearGradient>
            <clipPath id="wm-cc"><polygon points="2,20 6,6 14,13 20,2 26,13 34,6 38,20" /></clipPath>
          </defs>
          <polygon points="2,20 6,6 14,13 20,2 26,13 34,6 38,20" fill="url(#wm-cg)" stroke="#fff" strokeWidth=".8" strokeLinejoin="round" />
          <polygon points="14,13 20,2 26,13 20,20" fill="url(#wm-cg2)" opacity=".75" />
          <polygon points="2,20 6,6 14,13 10,20" fill="#fff" opacity=".35" />
          <circle cx="6" cy="6" r="1.6" fill="#fff" /><circle cx="20" cy="2.5" r="1.8" fill="#fff" /><circle cx="34" cy="6" r="1.6" fill="#fff" />
          {!calm && <g clipPath="url(#wm-cc)"><rect x="-20" y="-2" width="9" height="28" fill="#fff" opacity=".85" transform="skewX(-20)"><animate attributeName="x" values="-20;56" dur="2.4s" repeatCount="indefinite" /></rect></g>}
        </svg>
      </div>
      {st.map(([x, y, d], i) => <span key={i} className="wm-star" style={{ left: x + "%", top: y + "%", marginLeft: -3, "--dl": d + "s", "--t": "1.8s" }} />)}
    </>
  );
}

function DragonHead() {
  return (
    <svg viewBox="0 0 24 18">
      <defs><linearGradient id="dh1" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#047857" /><stop offset="1" stopColor="#fde047" /></linearGradient></defs>
      <path d="M9 4L4 0L11 3.4Z M9 14L4 18L11 14.6Z" fill="#fde047" />
      <path d="M2 9L10 3.4L20 5L23.5 9L20 13L10 14.6Z" fill="url(#dh1)" stroke="#d1fae5" strokeWidth=".6" strokeLinejoin="round" />
      <circle cx="16" cy="7.3" r="1.5" fill="#fff" /><circle cx="16.4" cy="7.3" r=".8" fill="#dc2626" />
      <path d="M22 8.2L24 7.2M22 9.8L24 10.8" stroke="#fde047" strokeWidth=".9" strokeLinecap="round" />
    </svg>
  );
}
function DragonAura({ calm }) {
  const N = calm ? 0 : 9, step = 0.2, D = 4.2;
  const segs = [];
  for (let i = 1; i <= N; i++) segs.push({ size: Math.max(3, 9 - i * 0.62), dl: "-" + ((N + 1 - i) * step + 0.1).toFixed(2) + "s" });
  return (
    <>
      <div className="wm-ring wm-dragon-ring wm-spin" style={{ "--w": "3px", "--d": "6s", opacity: 0.85 }} />
      {segs.reverse().map((g, i) => (
        <div key={i} className="wm-bfly-orbit" style={{ "--d": D + "s", "--dl": g.dl, inset: -3 }}>
          <span className="wm-dseg" style={{ width: g.size, height: g.size, marginLeft: -g.size / 2, top: -g.size / 2 }} />
        </div>
      ))}
      <div className="wm-bfly-orbit" style={{ "--d": D + "s", "--dl": calm ? "0s" : "-" + (((N + 1) * step) + 0.1).toFixed(2) + "s", inset: -3, animation: calm ? "none" : undefined }}>
        <span className="wm-dhead"><DragonHead /></span>
      </div>
    </>
  );
}

function CelestialWings({ calm }) {
  const st = calm ? [] : [
    { l: "6%", t: "70%", dx: "-6px", dl: "0s" }, { l: "20%", t: "40%", dx: "-3px", dl: ".6s" }, { l: "82%", t: "40%", dx: "4px", dl: ".3s" },
    { l: "96%", t: "72%", dx: "6px", dl: "1s" }, { l: "50%", t: "-2%", dx: "0px", dl: ".9s" },
  ];
  return (
    <>
      <div className="wm-ring wm-sakura-ring wm-spin" style={{ "--w": "3px", "--d": "8s", opacity: 0.9, background: "conic-gradient(#fff,#c4b5fd,#e0f2fe,#fff,#a5b4fc,#fff)" }} />
      <div className="wm-wingmask"><div className="wm-wingbox"><Wing side="l" variant="feather" /><Wing side="r" variant="feather" /></div></div>
      {st.map((q, i) => <span key={i} className="wm-star" style={{ left: q.l, top: q.t, marginLeft: -3, "--dl": q.dl, "--t": "1.8s", background: "#fff" }} />)}
    </>
  );
}

function RoyalUniverse({ calm }) {
  const stars = calm ? [] : STAR_POS.slice(0, 6);
  const ticks = Array.from({ length: 24 }, (_, i) => { const a = (i / 24) * Math.PI * 2; return [50 + Math.cos(a) * 46, 50 + Math.sin(a) * 46, 50 + Math.cos(a) * (i % 2 ? 48 : 49.5), 50 + Math.sin(a) * (i % 2 ? 48 : 49.5)]; });
  const tri = r => [0, 1, 2].map(k => { const a = -Math.PI / 2 + k * (Math.PI * 2 / 3); return (50 + Math.cos(a) * r).toFixed(1) + "," + (50 + Math.sin(a) * r).toFixed(1); }).join(" ");
  const tri2 = r => [0, 1, 2].map(k => { const a = Math.PI / 2 + k * (Math.PI * 2 / 3); return (50 + Math.cos(a) * r).toFixed(1) + "," + (50 + Math.sin(a) * r).toFixed(1); }).join(" ");
  return (
    <>
      {!calm && <div className="wm-nebula" />}
      <div className="wm-magic" style={{ "--d": "18s" }}>
        <svg viewBox="0 0 100 100" fill="none" stroke="#fbbf24" strokeWidth=".9">
          <circle cx="50" cy="50" r="48.5" /><circle cx="50" cy="50" r="44" strokeDasharray="2 2.4" opacity=".8" />
          {ticks.map((t, i) => <line key={i} x1={t[0]} y1={t[1]} x2={t[2]} y2={t[3]} />)}
          <polygon points={tri(41)} stroke="#fde68a" /><polygon points={tri2(41)} stroke="#fde68a" />
        </svg>
      </div>
      <div className="wm-magic" style={{ "--d": "11s", animationDirection: "reverse", inset: -4 }}>
        <svg viewBox="0 0 100 100" fill="none" stroke="#c4b5fd" strokeWidth="1.1">
          <circle cx="50" cy="50" r="47" strokeDasharray="6 4" />
          <circle cx="50" cy="50" r="3" fill="#fbbf24" stroke="none" style={{ transformOrigin: "50% 50%" }} />
        </svg>
      </div>
      <div className="wm-ring wm-gold-ring wm-spin" style={{ "--w": "3px", "--d": "4s" }} />
      {stars.map((s, i) => <span key={i} className="wm-star" style={{ left: s.l, top: s.t, marginLeft: -3, marginTop: -3, "--dl": s.dl, "--t": s.t2, background: i % 2 ? "#fde68a" : "#ddd6fe" }} />)}
      {!calm && <div className="wm-orbit wm-spin" style={{ "--d": "5s", inset: -12 }}><i style={{ background: "radial-gradient(circle,#fff,#fbbf24 55%,transparent 72%)" }} /></div>}
    </>
  );
}

function DivineRainbow({ calm }) {
  const stars = calm ? [] : STAR_POS;
  return (
    <>
      {!calm && <div className="wm-pearl wm-spin" style={{ "--d": "12s" }} />}
      {!calm && <div className="wm-halo" />}
      {!calm && <div className="wm-ring wm-rainbow wm-rainbow-glow wm-spin-r" style={{ "--w": "11px", "--d": "6s", inset: -4 }} />}
      <div className="wm-ring wm-rainbow wm-spin" style={{ "--w": "4px", "--d": "3.6s", inset: -3 }} />
      <div className="wm-ring wm-rainbow wm-spin-r" style={{ "--w": "3px", "--d": "5.2s", inset: 3 }} />
      {stars.map((s, i) => <span key={i} className="wm-star" style={{ left: s.l, top: s.t, marginLeft: -3, marginTop: -3, "--dl": s.dl, "--t": s.t2 }} />)}
    </>
  );
}

// Starry Orbit: วงโคจรเอียงรอบรูป — เส้นหลังรูป (ชั้นล่าง) + เส้นหน้ารูป (ชั้นบน ผ่าน VoiceAura.Front) ดาวเคราะห์โคจรผ่านทั้งสองฝั่ง
function OrbitArc({ front, calm }) {
  const gid = "wm-og-" + (front ? "f" : "b");
  const d = front ? "M-7 50 A57 20 0 0 0 107 50" : "M-7 50 A57 20 0 0 1 107 50";
  return (
    <svg viewBox="0 0 100 100" width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <defs>
        <linearGradient id={gid} x1="0" x2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity="0" /><stop offset=".5" stopColor="#a5b4fc" /><stop offset="1" stopColor="#22d3ee" stopOpacity="0" /></linearGradient>
        <radialGradient id="wm-pl" cx=".35" cy=".3"><stop offset="0" stopColor="#fff7d6" /><stop offset="1" stopColor="#f59e0b" /></radialGradient>
      </defs>
      <g transform="rotate(-22 50 50)">
        <path d={d} fill="none" stroke={"url(#" + gid + ")"} strokeWidth="2.6" strokeLinecap="round" opacity={front ? 0.95 : 0.55} />
        {!calm && (
          <g>
            <circle r="4.6" fill="url(#wm-pl)" />
            <ellipse rx="8.2" ry="1.8" fill="none" stroke="#fde68a" strokeWidth="1" transform="rotate(-20)" />
            <animate attributeName="opacity" values={front ? "0;0;1;1" : "1;1;0;0"} keyTimes="0;.499;.5;1" dur="4.2s" repeatCount="indefinite" calcMode="discrete" />
            <animateMotion dur="4.2s" repeatCount="indefinite" path="M-7 50 A57 20 0 1 1 107 50 A57 20 0 1 1 -7 50" />
          </g>
        )}
      </g>
    </svg>
  );
}
function StarryOrbit({ calm }) {
  return (
    <>
      <div className="wm-ring" style={{ inset: NU(0.5), "--w": U(3.4), background: "conic-gradient(from 200deg,#38bdf8,#6366f1,#22d3ee,#e0f2fe,#38bdf8)", filter: "drop-shadow(0 0 5px rgba(56,189,248,.8))" }} />
      <div className="wm-ring" style={{ inset: U(3), "--w": U(1.2), background: "rgba(255,255,255,.35)" }} />
      <OrbitArc front={false} calm={calm} />
    </>
  );
}
StarryOrbit.Front = function StarryOrbitFront({ calm }) {
  const st = calm ? [] : [[8, 24, 0], [86, 30, 0.6], [76, 84, 1.1], [18, 78, 0.3]];
  return (
    <>
      <OrbitArc front calm={calm} />
      {st.map(([x, y, d], i) => <span key={i} className="wm-star" style={{ left: x + "%", top: y + "%", marginLeft: -3, "--dl": d + "s", "--t": "1.8s" }} />)}
    </>
  );
};

// ── กรอบรูปวาดด้วย SVG (วาดทั้งหมดเป็นชั้นบน Front เพื่อให้ดอกไม้/ดาวทับขอบรูปได้) ──
// พิกัด 0–100 ตามแบบร่าง: วงหลักรัศมี 37.5 → viewBox 75 ทำให้วงหลักตรงกับขอบรูปพอดี ส่วนที่ยื่นออกไปได้สัดส่วนเดิม
function FrameSvg({ drift, children }) {
  return (
    <svg viewBox="12.5 12.5 75 75" width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      {drift ? <g className="wmf-drift">{children}</g> : children}
    </svg>
  );
}
const frameFx = Front => { const Fx = () => null; Fx.Front = Front; return Fx; };
const dl = i => ({ animationDelay: "-" + (i * 0.5 + 0.01).toFixed(2) + "s" });

function CatEarsFront() {
  return (
    <FrameSvg>
      <defs><linearGradient id="wmf-cr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#fed7aa" /><stop offset="1" stopColor="#fb923c" /></linearGradient></defs>
      <circle cx="50" cy="50" r="37.5" fill="none" stroke="url(#wmf-cr)" strokeWidth="5" />
      <circle cx="50" cy="50" r="34.6" fill="none" stroke="#fff7ed" strokeWidth="1.4" opacity=".8" />
      <g className="wmf-ear">
        <polygon points="18.97,29.85 15.29,8.63 35.54,15.94" fill="#fb923c" stroke="#fb923c" strokeWidth="3.2" strokeLinejoin="round" />
        <polygon points="23.59,27.04 20.43,14.76 31.97,20.00" fill="#fda4af" stroke="#fda4af" strokeWidth="1.6" strokeLinejoin="round" />
      </g>
      <g className="wmf-ear r">
        <polygon points="64.46,15.94 84.71,8.63 81.03,29.85" fill="#fb923c" stroke="#fb923c" strokeWidth="3.2" strokeLinejoin="round" />
        <polygon points="68.03,20.00 79.57,14.76 76.41,27.04" fill="#fda4af" stroke="#fda4af" strokeWidth="1.6" strokeLinejoin="round" />
      </g>
      <g className="wmf-bell">
        <polygon points="50,86 41,82 41,92" fill="#f472b6" /><polygon points="50,86 59,82 59,92" fill="#f472b6" />
        <circle cx="50" cy="87" r="2.6" fill="#ec4899" />
        <circle cx="50" cy="94" r="3.4" fill="#fde047" stroke="#f59e0b" strokeWidth=".9" />
        <path d="M47.6 94 H52.4" stroke="#b45309" strokeWidth=".7" />
      </g>
    </FrameSvg>
  );
}
const CatEars = frameFx(CatEarsFront);

const DAISIES = [[0, 1], [60, 0.756], [125, 0.865], [190, 0.701], [255, 0.891], [305, 0.73]];
function Daisy({ s }) {
  return (
    <g transform={`scale(${s})`}>
      {[0, 45, 90, 135, 180, 225, 270, 315].map(r => <ellipse key={r} cx="0" cy="-5.33" rx="2.22" ry="3.85" fill="#fff" stroke="#e5e7eb" strokeWidth=".4" transform={`rotate(${r})`} />)}
      <circle r="2.37" fill="#fbbf24" /><circle r="1.04" cx="-.59" cy="-.59" fill="#fde68a" />
    </g>
  );
}
function DaisyWreathFront() {
  const pt = (a, r) => { const t = a * Math.PI / 180; return [50 + r * Math.sin(t), 50 - r * Math.cos(t)]; };
  return (
    <FrameSvg drift>
      <circle cx="50" cy="50" r="37" fill="none" stroke="#16a34a" strokeWidth="2.6" opacity=".9" />
      <circle cx="50" cy="50" r="37" fill="none" stroke="#86efac" strokeWidth="1" opacity=".7" strokeDasharray="2 3" />
      {Array.from({ length: 10 }, (_, i) => { const a = 28 + 36 * i, [x, y] = pt(a, 37); return <ellipse key={i} cx={x} cy={y} rx="2.2" ry="5" fill="#22c55e" opacity=".9" transform={`rotate(${a} ${x} ${y})`} />; })}
      {DAISIES.map(([a, s], i) => { const [x, y] = pt(a, 38); return <g key={i} transform={`translate(${x.toFixed(2)} ${y.toFixed(2)})`}><g className="wmf-fl" style={dl(i)}><Daisy s={s} /></g></g>; })}
    </FrameSvg>
  );
}
const DaisyWreath = frameFx(DaisyWreathFront);

const CRYSTALS = [[37, 14.29, -20, 13], [69, 17.09, 30, 9], [17.09, 69, 240, 10], [79.11, 74.43, 130, 8]];
const SNOWS = [[56.95, 10.61, 5], [89.39, 56.95, 4], [43.05, 89.39, 5.5], [13.75, 33.1, 4.2]];
function IceSnowFront() {
  return (
    <FrameSvg drift>
      <defs><linearGradient id="wmf-ir" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e0f2fe" /><stop offset=".5" stopColor="#7dd3fc" /><stop offset="1" stopColor="#38bdf8" /></linearGradient></defs>
      <circle cx="50" cy="50" r="37.5" fill="none" stroke="url(#wmf-ir)" strokeWidth="4.6" />
      <circle cx="50" cy="50" r="35.5" fill="none" stroke="#fff" strokeWidth="1" opacity=".7" />
      {CRYSTALS.map(([x, y, a, h], i) => (
        <g key={i} transform={`translate(${x} ${y}) rotate(${a})`}>
          <polygon points={`0,-${h} 3.2,-2 0,3 -3.2,-2`} fill="#bae6fd" stroke="#fff" strokeWidth=".7" strokeLinejoin="round" />
          <polygon points={`0,-${h} 3.2,-2 0,-2`} fill="#fff" opacity=".6" />
        </g>
      ))}
      {SNOWS.map(([x, y, k], i) => (
        <g key={i} transform={`translate(${x} ${y})`}>
          <g className="wmf-tw" style={{ animationDelay: "-" + (i * 0.8 + 0.01).toFixed(2) + "s" }}>
            <g stroke="#fff" strokeWidth="1.1" strokeLinecap="round" fill="none">
              {[0, 60, 120].map(r => <line key={r} x1="0" y1={-k} x2="0" y2={k} transform={`rotate(${r})`} />)}
            </g>
          </g>
        </g>
      ))}
    </FrameSvg>
  );
}
const IceSnow = frameFx(IceSnowFront);

const MOON_STARS = [
  "43.05,6.41 44.16,9.08 47.05,9.31 44.85,11.19 45.52,14.01 43.05,12.50 40.59,14.01 41.26,11.19 39.06,9.31 41.94,9.08",
  "89.60,57.21 90.50,59.37 92.84,59.56 91.06,61.08 91.60,63.36 89.60,62.14 87.60,63.36 88.15,61.08 86.37,59.56 88.70,59.37",
  "30.00,80.04 31.22,82.97 34.37,83.22 31.97,85.28 32.70,88.36 30.00,86.71 27.30,88.36 28.03,85.28 25.63,83.22 28.78,82.97",
  "11.47,32.98 12.27,34.89 14.33,35.05 12.76,36.39 13.24,38.40 11.47,37.33 9.71,38.40 10.19,36.39 8.62,35.05 10.68,34.89",
];
const MOON_DOTS = [[91.35, 34.95], [65.39, 92.29], [7.5, 61.39], [34.95, 8.65]];
function MoonStarsFront() {
  return (
    <FrameSvg drift>
      <defs><linearGradient id="wmf-mr" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#818cf8" /><stop offset=".6" stopColor="#6366f1" /><stop offset="1" stopColor="#4c1d95" /></linearGradient></defs>
      <circle cx="50" cy="50" r="37.2" fill="none" stroke="url(#wmf-mr)" strokeWidth="3.4" />
      <circle cx="50" cy="50" r="35.4" fill="none" stroke="#c7d2fe" strokeWidth=".8" opacity=".6" />
      <g className="wmf-tw" style={{ animationDelay: "-0.41s" }}>
        <path transform="translate(76.77 20.27) rotate(-20)" d="M0 -9 A9 9 0 1 0 8 6 A7 7 0 1 1 0 -9 Z" fill="#fde68a" stroke="#fff7d6" strokeWidth=".5" />
      </g>
      {MOON_STARS.map((pts, i) => <g key={i} className="wmf-tw" style={{ animationDelay: "-" + (i + 0.01).toFixed(2) + "s" }}><polygon points={pts} fill="#fde68a" stroke="#fff7d6" strokeWidth=".4" strokeLinejoin="round" /></g>)}
      {MOON_DOTS.map(([x, y], i) => <circle key={i} className="wmf-tw" style={{ animationDelay: "-" + (i * 0.7 + 0.01).toFixed(2) + "s" }} cx={x} cy={y} r="1.2" fill="#e0e7ff" />)}
    </FrameSvg>
  );
}
const MoonStars = frameFx(MoonStarsFront);

export const EFFECTS = {
  fire: FireRing,
  hearts: FloatingHearts,
  rainbow: RainbowAura,
  neon: NeonPulse,
  sakura: SakuraBloom,
  galaxy: GalaxyStars,
  orbit: StarryOrbit,
  cat: CatEars,
  daisy: DaisyWreath,
  frost: IceSnow,
  moon: MoonStars,
  lightning: LightningRing,
  butterfly: ButterflyDream,
  phoenix: GoldenPhoenix,
  crystal: CrystalCrown,
  dragon: DragonAura,
  wings: CelestialWings,
  universe: RoyalUniverse,
  divine: DivineRainbow,
};

// ── ค่อย ๆ ปรากฏ/จางหาย: ไม่พูดแล้วถอด DOM ออก (ไม่กินเครื่อง) ──
function useFade(active, ms) {
  const [mounted, setMounted] = useState(active);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (active) {
      setMounted(true);
      const r = requestAnimationFrame(() => setShown(true));
      return () => cancelAnimationFrame(r);
    }
    setShown(false);
    const t = setTimeout(() => setMounted(false), ms);
    return () => clearTimeout(t);
  }, [active, ms]);
  return { mounted, shown };
}

// ห่อรูปโปรไฟล์: <VoiceAura aura="fire" active={กำลังพูดและไมค์เปิด}>…รูป…</VoiceAura>
// ชั้นเอฟเฟกต์อยู่ "ใต้" รูป/ปุ่ม และ pointer-events:none จึงไม่บังรูป ชื่อ หรือปุ่มควบคุมใด ๆ
export function VoiceAura({ aura, active, lite, forceCalm, children }) {
  const [mode] = useAuraMode();
  const reduced = usePrefersReduced();
  const { mounted, shown } = useFade(!!active, AURA_FADE_MS);
  const Fx = EFFECTS[aura];
  const calm = mode === "reduced" || reduced || !!lite || !!forceCalm;
  return (
    <div style={{ position: "relative" }}>
      {Fx && mounted && (
        <div className={"wm-aura" + (shown ? " on" : "") + (calm ? " calm" : "")} aria-hidden="true" data-aura={aura}>
          <div className="wm-aura-core"><Fx calm={calm} /></div>
        </div>
      )}
      <div style={{ position: "relative", zIndex: 1 }}>{children}</div>
      {Fx && Fx.Front && mounted && (
        <div className={"wm-aura wm-aura-front" + (shown ? " on" : "") + (calm ? " calm" : "")} aria-hidden="true" style={{ zIndex: 2 }}>
          <div className="wm-aura-core"><Fx.Front calm={calm} /></div>
        </div>
      )}
    </div>
  );
}

export { AURA_BY_ID };
