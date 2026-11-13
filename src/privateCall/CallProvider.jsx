// ตัวคุมโทรส่วนตัวทั้งแอป: ยืนยันก่อนโทร → ดังที่ปลายทาง → ต้อง "รับสาย" ถึงเริ่มคุย → วางสายได้ทั้งสองฝั่ง
// เสียงอยู่ใน LiveKit ห้องแยก call_<id> (audio.js) และห้องเสียงหลักจะถูกปิดไมค์/เงียบเฉพาะฝั่งเรา (duck.js) ระหว่างสาย
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { createCallAudio } from "./audio.js";
import { setCallActive } from "./store.js";
import { createRingtone } from "./ringtone.js";
import { showBanner, hideBanner } from "../social/bus.js";
import { RING_TIMEOUT_MS, MAX_CALL_MS } from "./config.js";
import { canStartCall, reasonText, incomingRing, callRoomName, fmtDuration, endText, TERMINAL, toMs } from "./logic.js";

const OFF = { enabled: false, busy: false, requestCall: () => ({ ok: false, reason: "off" }) };
const Ctx = createContext(OFF);
export const useCall = () => useContext(Ctx);

const C = { card: "#221F33", border: "#4F46A8", text: "#F0EEFF", sub: "#9B94C4", brand: "#7C6BF0", green: "#10B981", red: "#F43F5E" };
const btn = (bg, extra) => ({ border: "none", background: bg, color: "#fff", borderRadius: 14, padding: "10px 20px", fontSize: 14, fontWeight: 800, cursor: "pointer", fontFamily: "inherit", ...extra });

export function CallProvider({ api, uid, myName, guest, nameOf, isUserGuest, Avatar, blocked, lk, fetchFn, children }) {
  const enabled = !!(api && uid && !guest && lk);
  const [call, setCall] = useState(null);            // {id, role, peer, phase:"ringing"|"active", startedAt}
  const [confirm, setConfirm] = useState(null);      // {peer, name}
  const [incoming, setIncoming] = useState(null);    // {callId, from, name, leftMs}
  const [aud, setAud] = useState({ connected: false, micOn: false, needAudio: false, error: "" });
  const [, tick] = useState(0);
  const callRef = useRef(null), incomingRef = useRef(null), confirmRef = useRef(null);
  const unwatch = useRef(null), ringTimer = useRef(null), connectP = useRef(null), startedBusy = useRef(false);
  const P = useRef({}); P.current = { nameOf, blocked, myName, uid, api };
  const ringtone = useRef(null);
  incomingRef.current = incoming; confirmRef.current = confirm;

  const audio = useRef(null);
  if (!audio.current && enabled) audio.current = createCallAudio({ ...lk, fetchFn, onChange: setAud, onRemoteLeft: () => hangupRef.current && hangupRef.current() });
  const hangupRef = useRef(null);

  const setCallState = (c) => { callRef.current = c; setCall(c); setCallActive(!!c && c.phase === "active"); };

  const endLocal = useCallback((status) => {
    const c = callRef.current;
    if (ringTimer.current) { clearTimeout(ringTimer.current); ringTimer.current = null; }
    if (unwatch.current) { unwatch.current(); unwatch.current = null; }
    connectP.current = null;
    if (audio.current) audio.current.disconnect();
    setCallState(null);
    if (c) {
      showBanner({ key: "call-end", title: "📞 " + endText(status, c.role, P.current.nameOf(c.peer)), ttl: 5000 });
      setTimeout(() => P.current.api.purge(c.id), 6000);
    }
  }, []);

  const onCallDoc = useCallback((d) => {
    const c = callRef.current; if (!c) return;
    if (!d) { endLocal("ended"); return; }
    if (d.status === "accepted" && c.phase !== "active") {
      const started = toMs(d.acceptedAt) || Date.now();
      if (ringTimer.current) { clearTimeout(ringTimer.current); ringTimer.current = null; }
      setCallState({ ...c, phase: "active", startedAt: started });
      if (c.role === "caller" && connectP.current) connectP.current.then(ok => { if (ok && callRef.current && callRef.current.id === c.id) audio.current.setMic(true); });
    } else if (TERMINAL.has(d.status)) endLocal(d.status);
  }, [endLocal]);

  const watch = (id) => { if (unwatch.current) unwatch.current(); unwatch.current = P.current.api.watchCall(id, onCallDoc, e => console.error("call watch", e)); };

  const hangup = useCallback(async () => {
    const c = callRef.current; if (!c) return;
    const a = P.current.api;
    endLocal(c.phase === "ringing" ? "cancelled" : "ended");
    try { if (c.phase === "ringing") await a.cancel(c.id, P.current.uid); else await a.end(c.id, P.current.uid); } catch (e) { console.error("hangup", e); }
  }, [endLocal]);
  hangupRef.current = hangup;

  // ── ผู้โทร ──
  const requestCall = useCallback((peer, ctx) => {
    const g = canStartCall({ me: uid, peer, guest, peerGuest: !!(isUserGuest && isUserGuest(peer)), sameRoom: !!(ctx && ctx.sameRoom), isFriend: !!(ctx && ctx.isFriend), blockedByMe: !!(blocked && blocked.has(peer)), inCall: !!callRef.current || !!incomingRef.current || !!confirmRef.current });
    if (!g.ok) { showBanner({ key: "call-err", title: "📞 " + reasonText(g.reason), ttl: 5000 }); return g; }
    setConfirm({ peer, name: nameOf(peer) });
    return { ok: true };
  }, [uid, guest, isUserGuest, blocked, nameOf]);

  async function confirmCall() {
    const peer = confirm && confirm.peer; if (!peer) return;
    setConfirm(null);
    if (startedBusy.current) return; startedBusy.current = true;
    try {
      const id = await api.start(uid, { peer, fromName: myName, toName: nameOf(peer) });
      setCallState({ id, role: "caller", peer, phase: "ringing", startedAt: 0 });
      watch(id);
      connectP.current = audio.current.connect(callRoomName(id), uid, myName, { mic: false }); // เข้าห้องรอไว้ก่อน (ยังไม่เปิดไมค์ จนกว่าอีกฝ่ายรับสาย)
      ringTimer.current = setTimeout(async () => { const c = callRef.current; if (c && c.id === id && c.phase === "ringing") { endLocal("missed"); try { await api.miss(id, uid); } catch (e) { /* */ } } }, RING_TIMEOUT_MS);
    } catch (e) {
      showBanner({ key: "call-err", title: "📞 " + (e && e.code === "busy" ? reasonText("peer-busy") : "โทรไม่สำเร็จ (" + ((e && (e.code || e.message)) || "เน็ตมีปัญหา") + ")"), ttl: 5000 });
    } finally { startedBusy.current = false; }
  }

  // ── ผู้รับ ──
  useEffect(() => {
    if (!enabled) return undefined;
    return api.watchInbox(uid, entry => {
      const ring = incomingRing(entry, Date.now());
      if (!ring) { setIncoming(null); return; }
      if (P.current.blocked && P.current.blocked.has(ring.from)) { api.decline(ring.callId, uid, "declined").catch(() => {}); return; }
      if (callRef.current || confirmRef.current) { api.decline(ring.callId, uid, "busy").catch(() => {}); return; }
      setIncoming(prev => (prev && prev.callId === ring.callId ? prev : { ...ring, name: P.current.nameOf(ring.from) || ring.fromName || "ผู้ใช้" }));
    }, e => console.error("callInbox", e));
  }, [api, uid, enabled]);

  useEffect(() => {
    if (!incoming) { if (ringtone.current) ringtone.current.stop(); return undefined; }
    if (!ringtone.current) ringtone.current = createRingtone();
    ringtone.current.start();
    const t = setTimeout(() => setIncoming(null), incoming.leftMs || RING_TIMEOUT_MS);
    return () => { clearTimeout(t); if (ringtone.current) ringtone.current.stop(); };
  }, [incoming]);

  async function acceptIncoming() {
    const inc = incoming; if (!inc) return;
    setIncoming(null);
    try {
      await api.accept(inc.callId, uid);
    } catch (e) { showBanner({ key: "call-end", title: "📞 สายนี้ถูกยกเลิกหรือหมดเวลาแล้ว", ttl: 5000 }); return; }
    setCallState({ id: inc.callId, role: "callee", peer: inc.from, phase: "active", startedAt: Date.now() });
    watch(inc.callId);
    connectP.current = audio.current.connect(callRoomName(inc.callId), uid, myName, { mic: true });
  }
  async function declineIncoming() {
    const inc = incoming; if (!inc) return;
    setIncoming(null);
    try { await api.decline(inc.callId, uid, "declined"); } catch (e) { /* */ }
    setTimeout(() => api.purge(inc.callId), 6000);
  }

  // ตัวนับเวลา + เพดานความยาวสาย
  useEffect(() => {
    if (!call || call.phase !== "active") return undefined;
    const t = setInterval(() => { tick(x => x + 1); if (Date.now() - call.startedAt > MAX_CALL_MS) hangupRef.current && hangupRef.current(); }, 1000);
    return () => clearInterval(t);
  }, [call]);

  // ปิดแท็บ/ออกจากแอประหว่างสาย → วางสายให้ (เท่าที่เบราว์เซอร์อนุญาต) และออกจากระบบ → เคลียร์
  useEffect(() => {
    if (!enabled) return undefined;
    const bye = () => { const c = callRef.current; if (c) { if (c.phase === "ringing") api.cancel(c.id, uid).catch(() => {}); else api.end(c.id, uid).catch(() => {}); } };
    window.addEventListener("pagehide", bye);
    return () => { window.removeEventListener("pagehide", bye); bye(); if (unwatch.current) unwatch.current(); if (audio.current) audio.current.disconnect(); if (ringTimer.current) clearTimeout(ringTimer.current); setCallActive(false); hideBanner("call-end"); };
  }, [enabled, api, uid]);

  const value = useMemo(() => enabled ? { enabled: true, busy: !!call || !!incoming || !!confirm, requestCall } : OFF, [enabled, call, incoming, confirm, requestCall]);
  const peerName = call ? nameOf(call.peer) : "";

  return (
    <Ctx.Provider value={value}>
      {children}
      {confirm && (
        <div data-call-confirm onClick={() => setConfirm(null)} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,.65)", zIndex: 98, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 340, background: C.card, border: "1px solid " + C.border, borderRadius: 18, padding: 18, textAlign: "center" }}>
            <div style={{ fontSize: 34 }}>📞</div>
            <div style={{ fontSize: 16, fontWeight: 800, color: C.text, margin: "6px 0" }}>โทรส่วนตัวหา {confirm.name}?</div>
            <div style={{ fontSize: 12, color: C.sub, lineHeight: 1.6, marginBottom: 14 }}>เริ่มคุยเมื่อ {confirm.name} กดรับสายเท่านั้น<br/>เสียงสายแยกจากห้องเสียง — ระหว่างคุย ไมค์ห้องจะปิดและคุณจะไม่ได้ยินเสียงห้อง คนในห้องไม่ได้ยินสายนี้</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "center" }}>
              <button type="button" data-call-confirm-yes onClick={confirmCall} style={btn(C.green)}>📞 โทร</button>
              <button type="button" data-call-confirm-no onClick={() => setConfirm(null)} style={btn("transparent", { border: "1px solid " + C.border, color: C.sub })}>ยกเลิก</button>
            </div>
          </div>
        </div>
      )}
      {incoming && (
        <div data-call-incoming style={{ position: "fixed", inset: 0, background: "rgba(10,8,25,.92)", zIndex: 100, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ width: "100%", maxWidth: 340, textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "center" }}><Avatar uid={incoming.from} size={84}/></div>
            <div style={{ fontSize: 20, fontWeight: 800, color: C.text, marginTop: 14 }}>{incoming.name}</div>
            <div style={{ fontSize: 13, color: C.sub, margin: "4px 0 22px" }}>📞 โทรส่วนตัวหาคุณ…<br/><span style={{ fontSize: 11 }}>เสียงแยกจากห้องเสียง • ไมค์ห้องจะปิดระหว่างสาย</span></div>
            <div style={{ display: "flex", gap: 14, justifyContent: "center" }}>
              <button type="button" data-call-accept onClick={acceptIncoming} style={btn(C.green)}>📞 รับสาย</button>
              <button type="button" data-call-decline onClick={declineIncoming} style={btn(C.red)}>ปฏิเสธ</button>
            </div>
          </div>
        </div>
      )}
      {call && (
        <div data-call-bar={call.phase} style={{ position: "fixed", left: "50%", transform: "translateX(-50%)", bottom: 70, width: "calc(100% - 20px)", maxWidth: 460, zIndex: 55, background: C.card, border: "1px solid " + (call.phase === "active" ? C.green : C.border), borderRadius: 16, padding: "10px 12px", boxShadow: "0 8px 28px rgba(0,0,0,.55)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{call.phase === "ringing" ? "📞 กำลังโทรหา " + peerName + "…" : "📞 คุยส่วนตัวกับ " + peerName}</div>
              <div style={{ fontSize: 11, color: C.sub }}>{call.phase === "ringing" ? "รออีกฝ่ายรับสาย (ไมค์ยังไม่เปิด)" : <span data-call-timer>{fmtDuration(Date.now() - call.startedAt)}</span>}{call.phase === "active" && " • " + (aud.connected ? (aud.micOn ? "🎙️ ไมค์เปิด" : "🔇 ไมค์ปิด") : "⏳ กำลังเชื่อมต่อเสียง")}</div>
            </div>
            {call.phase === "active" && <button type="button" data-call-mic onClick={() => audio.current.setMic(!aud.micOn)} style={btn(aud.micOn ? C.brand : "#3A3552", { padding: "8px 12px", fontSize: 13 })}>{aud.micOn ? "🎙️" : "🔇"}</button>}
            <button type="button" data-call-end onClick={hangup} style={btn(C.red, { padding: "8px 12px", fontSize: 13 })}>{call.phase === "ringing" ? "ยกเลิก" : "📵 วางสาย"}</button>
          </div>
          {aud.needAudio && <div data-call-audio onClick={() => audio.current.enableAudio()} style={{ fontSize: 12, color: "#F59E0B", marginTop: 6, cursor: "pointer", fontWeight: 700 }}>🔊 แตะที่นี่เพื่อเปิดเสียงสาย</div>}
          {aud.error && <div data-call-err style={{ fontSize: 11, color: "#F59E0B", marginTop: 6 }}>⚠️ {aud.error}</div>}
        </div>
      )}
    </Ctx.Provider>
  );
}
