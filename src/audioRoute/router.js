// Audio Route — ตัวสลับอุปกรณ์เสียงของห้อง LiveKit (ห้องเสียงหลัก/สายส่วนตัว) ตามที่เชื่อมต่ออยู่
//   • ฟังเหตุการณ์ devicechange: เสียบ/เชื่อมต่อบลูทูธ → ย้ายเสียงไปที่หูฟัง · ถอด → กลับลำโพงเครื่อง
//   • ใช้ได้เฉพาะเบราว์เซอร์ที่รองรับ setSinkId (Chrome/Edge/Samsung Internet) — iPhone/Safari ไม่รองรับ → แผงเสียงบอกวิธีเลือกเอง
//   • ผู้ใช้เลือกอุปกรณ์เองในแผงเสียงได้ (ค่า "อัตโนมัติ" = ให้บลูทูธ/หูฟังมาก่อน)
import { AUDIO_ROUTE_ENABLED, RECHECK_DELAYS_MS } from "./config.js";
import { decideOutput, pairedInput, describeOutputs, isBluetoothLabel, isExternalLabel } from "./logic.js";
import { getRouteState, patchRouteState, getSpeakerMode } from "./store.js";

const rooms = new Set();
let activeSpk = false, appliedIn = null, timers = [], listening = false, appliedId = null, busy = false, again = false;

const md = () => (typeof navigator !== "undefined" ? navigator.mediaDevices : undefined);
export function canChooseOutput() {
  try { return !!(md() && md().enumerateDevices && typeof HTMLMediaElement !== "undefined" && "setSinkId" in HTMLMediaElement.prototype); } catch (e) { return false; }
}

function audioEls() { try { return Array.from(document.querySelectorAll("audio[data-lk],audio[data-lk-call]")); } catch (e) { return []; } }
async function setElementsSink(id) { await Promise.all(audioEls().map(el => (el.setSinkId ? el.setSinkId(id).catch(() => {}) : null))); }

// เสียงเพื่อนในห้อง: ถ้าเบราว์เซอร์/ระบบสั่งหยุด (เช่นเสียงอื่นแย่งโฟกัสเสียงบนมือถือ) ให้เล่นต่อเอง
const guarded = new WeakSet();
function guardEl(el) {
  if (!el || guarded.has(el)) return;
  guarded.add(el);
  el.addEventListener("pause", () => { if (el.isConnected && el.srcObject) setTimeout(() => { try { const r = el.play(); if (r && r.catch) r.catch(() => {}); } catch (e) { /* ignore */ } }, 150); });
}
const guardAll = () => audioEls().forEach(guardEl);

// ปุ่ม "เปิดเสียงเพื่อนอีกครั้ง": สั่งเล่นทุกแทร็กเสียงของห้อง แล้วรายงานสภาพจริง (ไว้ตรวจเมื่อได้ยินเพื่อนไม่ชัด/ไม่ได้ยิน)
export async function reviveRemoteAudio() {
  const els = audioEls();
  await Promise.all(els.map(el => { try { if (!getSpeakerMode()) { el.muted = false; if (el.volume === 0) el.volume = 1; } const r = el.play(); return r && r.catch ? r.catch(() => {}) : null; } catch (e) { return null; } }));
  await new Promise(r => setTimeout(r, 300));
  const live = els.filter(el => { const t = el.srcObject && el.srcObject.getAudioTracks ? el.srcObject.getAudioTracks() : []; return t.length && t.some(x => x.readyState === "live"); });
  return { total: els.length, live: live.length, playing: live.filter(el => !el.paused).length };
}

const isIOSLike = () => { try { const ua = navigator.userAgent || ""; return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1); } catch (e) { return false; } };

// Android Chrome ไม่มี setSinkId (เลือกเสียงออกตรง ๆ ไม่ได้) — แต่ถ้าเลือก "ไมค์ของหูฟังบลูทูธ" Android จะสลับทั้งเสียงพูดและเสียงที่ได้ยินไปที่หูฟังให้เอง
// คืนชื่ออุปกรณ์ที่ใช้อยู่ (null = ใช้ของเครื่อง)
async function applyInputOnly() {
  if (isIOSLike() || !md() || !md().enumerateDevices) return { via: null, inputs: [] };   // iPhone: ระบบเลือกให้เอง/เลือกจากศูนย์ควบคุม
  const devices = await md().enumerateDevices();
  const ins = devices.filter(d => d && d.kind === "audioinput" && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications");
  const pref = getRouteState().pref;   // เบราว์เซอร์ที่เลือกเสียงออกไม่ได้: ค่าที่เลือกในแผง = ไมค์/หูฟังที่จะใช้ ("auto" = หาเอง)
  const manual = pref && pref !== "auto" ? ins.find(d => d.deviceId === pref) : null;
  const hp = manual || ins.find(d => isBluetoothLabel(d.label)) || ins.find(d => isExternalLabel(d.label)) || null;
  const target = hp ? hp.deviceId : (appliedIn ? "default" : null);   // ถอดหูฟัง: คืนไมค์ของเครื่อง · ไม่เคยสลับ = ไม่แตะ
  if (target && target !== appliedIn) {
    for (const room of rooms) { try { await room.switchActiveDevice("audioinput", target, target !== "default"); } catch (e) { console.warn("audioRoute input-only", e); } }
    appliedIn = target === "default" ? null : target;
  }
  const inputs = ins.map((d, i) => ({ id: d.deviceId, label: d.label || ("ไมค์ " + (i + 1)), kind: isBluetoothLabel(d.label) ? "bluetooth" : isExternalLabel(d.label) ? "external" : "builtin" }));
  return { via: appliedIn && hp ? (hp.label || "หูฟัง") : null, inputs };
}

async function apply() {
  if (!AUDIO_ROUTE_ENABLED || !rooms.size) return;
  if (busy) { again = true; return; }
  busy = true;
  try {
    const supported = canChooseOutput();
    if (!supported) { const r = await applyInputOnly(); patchRouteState({ supported: false, outputs: [], activeId: null, viaInput: r.via, inputs: r.inputs }); return; }
    const devices = await md().enumerateDevices();
    const st = getRouteState();
    const { device } = decideOutput(devices, st.pref);
    const target = device ? device.deviceId : (appliedId ? "default" : null);   // ไม่มีหูฟัง: ถ้าเคยย้ายไปแล้วให้กลับค่าเดิม ไม่เคยย้าย = ไม่แตะ
    if (target && target !== appliedId) {
      for (const room of rooms) {
        try { await room.switchActiveDevice("audiooutput", target); } catch (e) { console.warn("audioRoute output", e); }
        const mic = device ? pairedInput(devices, device) : null;
        const micId = mic ? mic.deviceId : (target === "default" ? "default" : null);   // ถอดหูฟัง: คืนไมค์เป็นค่าเริ่มต้นของเครื่องด้วย
        if (micId) { try { await room.switchActiveDevice("audioinput", micId); } catch (e) { console.warn("audioRoute input", e); } }
      }
      await setElementsSink(target);
      appliedId = target === "default" ? null : target;
    } else if (target) {
      await setElementsSink(target);
    }
    patchRouteState({ supported: true, outputs: describeOutputs(devices), activeId: appliedId });
  } catch (e) { console.warn("audioRoute", e); }
  finally { busy = false; if (again) { again = false; apply(); } }
}

function schedule() { timers.forEach(clearTimeout); timers = RECHECK_DELAYS_MS.map(ms => setTimeout(apply, ms)); }
const onDeviceChange = () => { apply(); };

export const audioRoute = {
  attach(room) {
    if (!AUDIO_ROUTE_ENABLED || !room) return;
    rooms.add(room); activeSpk = getSpeakerMode();
    if (!listening && md() && md().addEventListener) { md().addEventListener("devicechange", onDeviceChange); listening = true; }
    try { room.on("trackSubscribed", () => setTimeout(() => { guardAll(); if (appliedId) setElementsSink(appliedId); }, 0)); room.on("localTrackPublished", () => schedule()); } catch (e) { /* ignore */ }
    apply(); schedule();
  },
  detach(room) {
    if (room) rooms.delete(room);
    if (!rooms.size) {
      timers.forEach(clearTimeout); timers = [];
      if (listening && md() && md().removeEventListener) { md().removeEventListener("devicechange", onDeviceChange); listening = false; }
      appliedId = null; appliedIn = null;
      patchRouteState({ activeId: null, viaInput: null });
    }
  },
  refresh: apply,
  speakerModeActive: () => activeSpk,   // โหมดเสียงผ่านลำโพงที่ใช้อยู่ในห้องตอนนี้ (ตั้งตอนเข้าห้อง)
};
