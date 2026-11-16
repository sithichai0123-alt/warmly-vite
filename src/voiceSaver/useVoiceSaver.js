// Voice Saver — ฮุกที่ตัด/คืนการเชื่อมต่อเสียงของผู้ฟังตามความเงียบของห้อง
//   ใช้ร่วมกับ useVoice (ต้องมี .pause() / .resumeFromPause() / .paused) และเอกสารห้อง inRoom (ฟิลด์ voiceActiveAt)
import { useCallback, useEffect, useRef } from "react";
import { VOICE_IDLE_PAUSE_ENABLED, QUIET_MS, CHECK_MS, STAMP_THROTTLE_MS, RESUME_GRACE_MS } from "./config.js";
import { tsMs, hasVoiceActivity, shouldPause, shouldResume, shouldStamp } from "./logic.js";

export function useVoiceSaver({ enabled = VOICE_IDLE_PAUSE_ENABLED, inRoomId, voiceActiveAt, listener, isHost, connected, paused, speaking, voice, stamp, now = Date.now, quietMs = QUIET_MS, checkMs = CHECK_MS, throttleMs = STAMP_THROTTLE_MS, graceMs = RESUME_GRACE_MS }) {
  const lastActiveRef = useRef(now());   // ครั้งล่าสุดที่มีคนพูด (เวลาเครื่องเรา)
  const pausedAtRef = useRef(0);
  const voiceAtMs = tsMs(voiceActiveAt);

  // เข้าห้อง/เชื่อมต่อใหม่ → เริ่มนับความเงียบใหม่ (ไม่พักทันที)
  useEffect(() => { if (connected) lastActiveRef.current = now(); }, [connected, inRoomId]); // eslint-disable-line

  // มีคนพูด → รีเซ็ตตัวนับความเงียบ · เจ้าของห้องประทับเวลาลงห้องให้ผู้ฟังที่พักอยู่รู้ (เขียนถี่สุดตาม throttle)
  useEffect(() => {
    if (!enabled || !connected) return;
    const activity = hasVoiceActivity(speaking);
    if (activity) {
      lastActiveRef.current = now();
      if (stamp && shouldStamp({ isHost, connected, activity, roomVoiceAtMs: voiceAtMs, now: now(), throttleMs })) stamp();
    }
  }, [enabled, connected, speaking, isHost, voiceAtMs]); // eslint-disable-line

  // รอบตรวจ: เป็นผู้ฟัง + เงียบนานพอ → พักเสียง
  useEffect(() => {
    if (!enabled || !connected || paused || !listener) return undefined;
    const id = setInterval(() => {
      if (shouldPause({ enabled, connected: true, listener: true, lastActiveAt: lastActiveRef.current, now: now(), quietMs })) {
        pausedAtRef.current = now();
        voice.pause();
      }
    }, checkMs);
    return () => clearInterval(id);
  }, [enabled, connected, paused, listener]); // eslint-disable-line

  // พักอยู่ + มีคนเริ่มพูด (voiceActiveAt ใหม่กว่า) → กลับเข้าเสียงเอง
  useEffect(() => {
    if (!paused) return;
    if (shouldResume({ paused, roomVoiceAtMs: voiceAtMs, pausedAt: pausedAtRef.current, graceMs })) {
      lastActiveRef.current = now();
      voice.resumeFromPause();
    }
  }, [paused, voiceAtMs]); // eslint-disable-line

  // พักอยู่แต่ได้ขึ้นเวที/กลายเป็นผู้พูด (ไม่ใช่ผู้ฟังแล้ว) → ต้องกลับเข้าเสียงทันที
  useEffect(() => {
    if (paused && !listener) { lastActiveRef.current = now(); voice.resumeFromPause(); }
  }, [paused, listener]); // eslint-disable-line

  // เปลี่ยนห้อง → ล้างตัวนับ
  useEffect(() => { lastActiveRef.current = now(); pausedAtRef.current = 0; }, [inRoomId]); // eslint-disable-line

  const resume = useCallback(() => { lastActiveRef.current = now(); return voice.resumeFromPause(); }, [voice]); // eslint-disable-line
  return { resume };
}
