// Voice Aura — ตัวแสดงแอนิเมชันรอบรูปโปรไฟล์ (CSS ล้วน ไม่มีเสียง ไม่ตรวจจับเสียงเอง)
// ทำงานจากสถานะ "กำลังพูด" ที่ LiveKit รายงานอยู่แล้ว (speaking map ของ useVoice) เท่านั้น
import { useState, useEffect } from "react";
import { VOICE_AURA_ENABLED, AURA_FADE_MS } from "./config.js";
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
.wm-aura{position:absolute;inset:-6px;pointer-events:none;z-index:0;opacity:0;transition:opacity ${AURA_FADE_MS}ms ease}
.wm-aura.on{opacity:1}
.wm-aura-core{position:absolute;inset:0;animation:wm-breath 1.1s ease-in-out infinite alternate;will-change:transform}
.wm-aura.calm .wm-aura-core,.wm-aura.calm .wm-aura-core *{animation:none!important}
.wm-ring{position:absolute;inset:0;border-radius:50%;
  -webkit-mask:radial-gradient(farthest-side,transparent calc(100% - var(--w,4px)),#000 calc(100% - var(--w,4px) + 1px));
  mask:radial-gradient(farthest-side,transparent calc(100% - var(--w,4px)),#000 calc(100% - var(--w,4px) + 1px))}
.wm-spin{animation:wm-spin var(--d,3s) linear infinite;will-change:transform}
.wm-spin-r{animation:wm-spin var(--d,3s) linear infinite reverse}
@keyframes wm-spin{to{transform:rotate(360deg)}}
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
`;
if (typeof document !== "undefined" && !document.getElementById("wm-aura-css")) {
  const s = document.createElement("style");
  s.id = "wm-aura-css";
  s.textContent = AURA_CSS;
  document.head.appendChild(s);
}

// ── เอฟเฟกต์ (แต่ละตัวรับ calm = ไม่มีอนุภาค/ไม่มีเบลอ) ──────────
const HEART_PATH = "M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z";

function FireRing({ calm }) {
  const embers = calm ? [] : [
    { l: "18%", dx: "-6px", dl: "0s", t: "1.3s" }, { l: "36%", dx: "5px", dl: ".35s", t: "1.1s" },
    { l: "55%", dx: "-4px", dl: ".7s", t: "1.4s" }, { l: "72%", dx: "7px", dl: ".15s", t: "1.2s" },
    { l: "84%", dx: "-3px", dl: ".95s", t: "1.3s" },
  ];
  return (
    <>
      {!calm && <div className="wm-ring wm-fire-ring wm-fire-glow wm-flick" style={{ "--w": "9px", inset: -2 }} />}
      <div className="wm-ring wm-fire-ring wm-spin" style={{ "--w": "5px", "--d": "2.6s" }} />
      {embers.map((e, i) => <span key={i} className="wm-ember" style={{ left: e.l, top: "2%", "--dx": e.dx, "--dl": e.dl, "--t": e.t }} />)}
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
  if (calm) return <div className="wm-neon wm-neon-base" />;
  return (
    <>
      <div className="wm-neon wm-neon-base" style={{ opacity: 0.55 }} />
      <div className="wm-neon" style={{ "--c": "#22d3ee", "--dl": "0s" }} />
      <div className="wm-neon" style={{ "--c": "#e879f9", "--dl": ".4s" }} />
      <div className="wm-neon" style={{ "--c": "#22d3ee", "--dl": ".8s" }} />
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
  return (
    <>
      <div className="wm-ring wm-galaxy-ring wm-spin" style={{ "--w": "4px", "--d": "6s" }} />
      {!calm && STAR_POS.map((s, i) => <span key={i} className="wm-star" style={{ left: s.l, top: s.t, marginLeft: -3, marginTop: -3, "--dl": s.dl, "--t": s.t2 }} />)}
      {!calm && <div className="wm-orbit wm-spin" style={{ "--d": "3.4s" }}><i /></div>}
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
  const sp = calm ? [] : [
    { l: "10%", dx: "-8px", dl: "0s", t: "1.4s" }, { l: "30%", dx: "6px", dl: ".4s", t: "1.2s" }, { l: "52%", dx: "-3px", dl: ".8s", t: "1.5s" },
    { l: "74%", dx: "8px", dl: ".2s", t: "1.3s" }, { l: "90%", dx: "-6px", dl: ".6s", t: "1.6s" },
  ];
  return (
    <>
      {!calm && <div className="wm-ring wm-gold-ring wm-fire-glow wm-flick" style={{ "--w": "9px", inset: -2 }} />}
      <div className="wm-wingmask"><div className="wm-wingbox"><Wing side="l" variant="flame" /><Wing side="r" variant="flame" /></div></div>
      <div className="wm-ring wm-gold-ring wm-spin" style={{ "--w": "4px", "--d": "3s" }} />
      {sp.map((e, i) => <span key={i} className="wm-spark" style={{ left: e.l, top: "0%", "--dx": e.dx, "--dl": e.dl, "--t": e.t }} />)}
    </>
  );
}

function CrystalCrown({ calm }) {
  const tw = calm ? [] : [{ l: "26%", t: "-18px", dl: "0s" }, { l: "50%", t: "-22px", dl: ".5s" }, { l: "74%", t: "-18px", dl: "1s" }, { l: "10%", t: "30%", dl: ".8s" }, { l: "92%", t: "55%", dl: ".3s" }];
  return (
    <>
      <div className="wm-ring wm-crystal-ring wm-spin" style={{ "--w": "3px", "--d": "5s" }} />
      <div className="wm-crown">
        <svg viewBox="0 0 30 20">
          <defs>
            <linearGradient id="cc1" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#ecfeff" /><stop offset=".5" stopColor="#a5f3fc" /><stop offset="1" stopColor="#a78bfa" /></linearGradient>
          </defs>
          <path d="M2 18L4 6L10 11L15 2L20 11L26 6L28 18Z" fill="url(#cc1)" stroke="#fff" strokeWidth=".8" strokeLinejoin="round" />
          <path d="M15 2L10 11L15 18L20 11Z" fill="#fff" opacity=".35" />
          <path d="M4 6L10 11L8 18L2 18Z" fill="#67e8f9" opacity=".35" />
          <circle cx="15" cy="2" r="1.6" fill="#fff" /><circle cx="4" cy="6" r="1.2" fill="#e9d5ff" /><circle cx="26" cy="6" r="1.2" fill="#e9d5ff" />
        </svg>
      </div>
      {tw.map((q, i) => <span key={i} className="wm-star" style={{ left: q.l, top: q.t, marginLeft: -3, "--dl": q.dl, "--t": "1.5s", background: "#e0f2fe" }} />)}
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

export const EFFECTS = {
  fire: FireRing,
  hearts: FloatingHearts,
  rainbow: RainbowAura,
  neon: NeonPulse,
  sakura: SakuraBloom,
  galaxy: GalaxyStars,
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
    </div>
  );
}

export { AURA_BY_ID };
