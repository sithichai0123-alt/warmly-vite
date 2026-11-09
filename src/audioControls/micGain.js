// Audio Controls — ปรับระดับเสียงไมค์ของตัวเองบนแทร็กไมค์ของ LiveKit (ผ่าน Web Audio GainNode)
// ใช้ตัวประมวลผลแทร็ก (TrackProcessor) ของ LiveKit — แทรกเฉพาะเมื่อผู้ใช้ปรับค่าไม่ใช่ 100%
// (ค่า 100% = ไม่แตะสตรีมเดิมเลย จึงไม่เสี่ยงกับผู้ที่ไม่ได้ใช้ฟีเจอร์นี้)
import { getAudioPrefs, subscribeAudioPrefs, setMicStatus } from "./store.js";

export function createGainProcessor(initial = 1) {
  let ctx = null, source = null, node = null, dest = null, value = initial;
  const teardown = () => {
    try { if (source) source.disconnect(); if (node) node.disconnect(); if (dest) dest.disconnect(); } catch (e) { /* ignore */ }
    source = node = dest = null;
  };
  const build = async opts => {
    teardown();
    ctx = opts.audioContext;
    source = ctx.createMediaStreamSource(new MediaStream([opts.track]));
    node = ctx.createGain();
    node.gain.value = value;
    dest = ctx.createMediaStreamDestination();
    source.connect(node); node.connect(dest);
    proc.processedTrack = dest.stream.getAudioTracks()[0];
  };
  const proc = {
    name: "wm-mic-gain",
    processedTrack: undefined,
    init: build,
    restart: build,
    async destroy() { teardown(); proc.processedTrack = undefined; },
    setGain(g) {
      value = g;
      if (node) { try { node.gain.setTargetAtTime(g, ctx.currentTime, 0.02); } catch (e) { node.gain.value = g; } }
    },
  };
  return proc;
}

// ตัวคุมที่ผูกกับห้อง LiveKit: ฟังค่าที่ผู้ใช้ตั้ง → ใช้กับแทร็กไมค์ (รวมถึงแทร็กที่เพิ่งเผยแพร่ใหม่)
export function createMicGainController() {
  let room = null, proc = null, off = null, busy = false, again = false;

  async function apply() {
    if (!room) return;
    if (busy) { again = true; return; }
    busy = true;
    try {
      const gain = getAudioPrefs().mic;
      const pub = room.localParticipant && room.localParticipant.getTrackPublication ? room.localParticipant.getTrackPublication("microphone") : null;
      const track = pub && pub.audioTrack;
      if (!track) return;
      const current = track.getProcessor ? track.getProcessor() : undefined;
      if (!current && gain === 1) return; // ยังไม่เคยปรับ = ไม่แตะ
      // ถือตัวประมวลผลไว้ในตัวแปรของรอบนี้ — ถ้าออกจากห้อง (unbind) ระหว่างรอ จะไม่พังเพราะ proc ถูกล้าง
      const mine = proc || (proc = createGainProcessor(gain));
      if (current === mine) { mine.setGain(gain); setMicStatus("ok"); return; }
      if (current && current !== mine) return; // มีตัวประมวลผลอื่นอยู่ (เช่น ตัดเสียงรบกวน) — ไม่ทับ
      mine.setGain(gain);
      await track.setProcessor(mine);
      mine.setGain(getAudioPrefs().mic);
      if (room) setMicStatus("ok");
    } catch (e) {
      console.error("mic gain", e);
      setMicStatus("unsupported");
    } finally {
      busy = false;
      if (again) { again = false; apply(); }
    }
  }
  const onPublished = () => { apply(); };

  return {
    bind(r) {
      this.unbind();
      room = r; proc = null;
      if (r && r.on) r.on("localTrackPublished", onPublished);
      off = subscribeAudioPrefs(() => { apply(); });
      apply();
    },
    unbind() {
      if (off) { off(); off = null; }
      if (room && room.off) { try { room.off("localTrackPublished", onPublished); } catch (e) { /* ignore */ } }
      room = null; proc = null;
    },
    apply,
  };
}
