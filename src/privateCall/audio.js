// เสียงของสายส่วนตัว: LiveKit "ห้องแยก" (call_<id>) คนละ Room กับห้องเสียงหลัก
//  - เสียงของสายใช้ attribute data-lk-call (ห้องเสียงหลักใช้ data-lk) จึงไม่ปนและไม่ถูกลบข้ามกัน
//  - ไม่ผูกกับ React/Firebase: รับคลาส Room/RoomEvent/Track เข้ามา ทดสอบด้วยของปลอมได้
import { TOKEN_ENDPOINT, REMOTE_LEFT_GRACE_MS } from "./config.js";

export function createCallAudio({ Room, RoomEvent, Track, fetchFn, tokenEndpoint = TOKEN_ENDPOINT, onChange, onRemoteLeft, graceMs = REMOTE_LEFT_GRACE_MS, doc }) {
  const D = doc || (typeof document !== "undefined" ? document : null);
  let room = null, grace = null, everRemote = false;
  let st = { connected: false, micOn: false, remoteJoined: false, needAudio: false, error: "" };
  const set = (p) => { st = { ...st, ...p }; onChange && onChange(st); };
  const clearGrace = () => { if (grace) { clearTimeout(grace); grace = null; } };
  const sync = () => { const r = room; if (!r) return; set({ micOn: !!r.localParticipant.isMicrophoneEnabled, remoteJoined: r.remoteParticipants.size > 0 }); };
  const wipeAudio = () => { if (D) D.querySelectorAll("audio[data-lk-call]").forEach(el => { try { el.srcObject = null; } catch (e) { /* */ } el.remove(); }); };

  async function disconnect() {
    clearGrace(); everRemote = false;
    const r = room; room = null;
    if (r) { try { r.removeAllListeners(); r.disconnect(); } catch (e) { /* */ } }
    wipeAudio();
    set({ connected: false, micOn: false, remoteJoined: false, needAudio: false });
  }

  async function connect(roomName, identity, name, { mic = false } = {}) {
    await disconnect();
    set({ error: "" });
    const r = new Room({ adaptiveStream: true, dynacast: true, audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
    room = r;
    r.on(RoomEvent.TrackSubscribed, (track) => {
      if (track.kind === Track.Kind.Audio && D) { const el = track.attach(); el.setAttribute("data-lk-call", "1"); el.style.display = "none"; D.body.appendChild(el); }
      sync();
    });
    r.on(RoomEvent.TrackUnsubscribed, (track) => { track.detach().forEach(el => el.remove()); sync(); });
    r.on(RoomEvent.AudioPlaybackStatusChanged, () => set({ needAudio: !r.canPlaybackAudio }));
    r.on(RoomEvent.ParticipantConnected, () => { everRemote = true; clearGrace(); sync(); });
    r.on(RoomEvent.ParticipantDisconnected, () => {
      sync();
      if (everRemote && r.remoteParticipants.size === 0) { clearGrace(); grace = setTimeout(() => { grace = null; if (room === r && r.remoteParticipants.size === 0) onRemoteLeft && onRemoteLeft(); }, graceMs); }
    });
    [RoomEvent.TrackMuted, RoomEvent.TrackUnmuted, RoomEvent.LocalTrackPublished, RoomEvent.LocalTrackUnpublished].forEach(ev => r.on(ev, sync));
    r.on(RoomEvent.Disconnected, () => { if (room === r) set({ connected: false, micOn: false }); });
    try {
      const f = fetchFn || ((...a) => fetch(...a));
      const res = await f(tokenEndpoint + "?room=" + encodeURIComponent(roomName) + "&identity=" + encodeURIComponent(identity) + "&name=" + encodeURIComponent(name || identity));
      let data = {}; try { data = await res.json(); } catch (e) { /* */ }
      if (!res.ok || !data.token || !data.url) throw new Error(data.error || ("token " + res.status));
      await r.connect(data.url, data.token);
      if (room !== r) { r.disconnect(); return false; }
      if (r.remoteParticipants.size > 0) everRemote = true;
      set({ connected: true, error: "" });
      try { await r.startAudio(); } catch (e) { /* ต้องแตะเพื่อเปิดเสียง */ }
      set({ needAudio: !r.canPlaybackAudio });
      if (mic) await setMic(true);
      sync();
      return true;
    } catch (e) {
      if (room === r) set({ error: "เชื่อมต่อสายไม่สำเร็จ: " + ((e && e.message) || e) });
      return false;
    }
  }

  async function setMic(on) {
    const r = room; if (!r) return false;
    try { await r.localParticipant.setMicrophoneEnabled(on); set({ error: "" }); }
    catch (e) { set({ error: "เปิดไมค์ไม่ได้ — อนุญาตไมค์ในเบราว์เซอร์ก่อน" }); }
    sync();
    return !!(room === r && r.localParticipant.isMicrophoneEnabled);
  }
  async function enableAudio() { const r = room; if (!r) return; try { await r.startAudio(); } catch (e) { /* */ } set({ needAudio: !r.canPlaybackAudio }); }

  return { connect, disconnect, setMic, enableAudio, getState: () => st, isConnected: () => !!room };
}
