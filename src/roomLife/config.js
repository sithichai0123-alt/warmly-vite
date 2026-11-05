// Room Life — ปิดห้องเสียงอัตโนมัติเมื่อโฮสต์ไม่อยู่
//
// ปิดทั้งระบบ: เปลี่ยน ROOM_AUTOCLOSE_ENABLED เป็น false แล้วอัปโหลดไฟล์นี้ไฟล์เดียว → ห้องเป็นแบบเดิม (ไม่ปิดเอง)
export const ROOM_AUTOCLOSE_ENABLED = true;

// โฮสต์ไม่อยู่ในห้องนานเกินนี้ → ห้องปิดเอง (มิลลิวินาที) — 5 นาที
export const ROOM_HOST_AWAY_MS = 5 * 60 * 1000;

// โฮสต์ที่อยู่ในห้องจะ "เช็กชื่อ" ทุกกี่มิลลิวินาที (เขียน hostSeen ที่เอกสารห้อง)
export const ROOM_HEARTBEAT_MS = 60 * 1000;

// โฮสต์หายไปเกินนี้ → แสดงข้อความนับถอยหลังให้คนที่อยู่ในห้อง
export const ROOM_WARN_AFTER_MS = 90 * 1000;
