// Audio Route — ตรรกะล้วน (ไม่แตะเบราว์เซอร์/LiveKit) เพื่อทดสอบง่าย

// ชื่ออุปกรณ์ที่ "บลูทูธแน่ ๆ" และที่ "เป็นหูฟังภายนอก" (สาย/อื่น ๆ)
const BT_RE = /bluetooth|blue-?tooth|airpods?|buds|earbuds?|\bwh-|\bwf-|\bhfp\b|\ba2dp\b|บลูทูธ|บลูทูธ/i;
const EXT_RE = /headset|headphones?|หูฟัง|earphones?/i;
const BUILTIN_RE = /speakerphone|^speaker|earpiece|built-?in|ลำโพง|handset/i;

export const isBluetoothLabel = l => BT_RE.test(String(l || ""));
export const isExternalLabel = l => !BUILTIN_RE.test(String(l || "")) && EXT_RE.test(String(l || ""));

// อุปกรณ์เสียงออกที่ใช้ได้จริง (ตัดรายการเสมือน default/communications ออก)
export function realOutputs(devices) {
  return (devices || []).filter(d => d && d.kind === "audiooutput" && d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications");
}

// เลือกอัตโนมัติ: บลูทูธมาก่อน → หูฟังสาย/ภายนอก → ไม่มี (ปล่อยให้ระบบเลือกเอง)
export function pickAutoOutput(devices) {
  const outs = realOutputs(devices);
  return outs.find(d => isBluetoothLabel(d.label)) || outs.find(d => isExternalLabel(d.label)) || null;
}

// ไมค์ของอุปกรณ์เดียวกับเสียงออก (หูฟังตัวเดียวกันมี groupId เดียวกัน) — Chrome บน Android ต้องใช้ไมค์ของหูฟังด้วย เสียงถึงจะออกหูฟัง
export function pairedInput(devices, output) {
  if (!output || !output.groupId) return null;
  return (devices || []).find(d => d && d.kind === "audioinput" && d.deviceId && d.groupId === output.groupId && d.deviceId !== "default" && d.deviceId !== "communications") || null;
}

// รายการสำหรับแสดงในแผง: [{id,label,kind:"bluetooth"|"external"|"builtin"}]
export function describeOutputs(devices) {
  return realOutputs(devices).map((d, i) => ({
    id: d.deviceId,
    label: d.label || ("อุปกรณ์เสียง " + (i + 1)),
    kind: isBluetoothLabel(d.label) ? "bluetooth" : isExternalLabel(d.label) ? "external" : "builtin",
  }));
}

// ตัดสินใจว่าจะส่งเสียงไปที่ไหน: pref = "auto" | deviceId · คืน { id|null, reason }
//   id = null → ไม่ต้องบังคับ (ให้ระบบเลือก) · "default" ที่ต้องย้อนกลับ ให้เรียกใช้ตัวเรียกจัดการเอง
export function decideOutput(devices, pref) {
  const outs = realOutputs(devices);
  if (pref && pref !== "auto") {
    const hit = outs.find(d => d.deviceId === pref);
    if (hit) return { device: hit, reason: "manual" };
  }
  const auto = pickAutoOutput(devices);
  return auto ? { device: auto, reason: "auto" } : { device: null, reason: "none" };
}
