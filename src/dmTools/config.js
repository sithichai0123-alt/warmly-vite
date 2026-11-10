// DM Tools — เครื่องมือแชทส่วนตัว: ลบประวัติ, บล็อก, เสียงแจ้งเตือน ไฟล์นี้ไฟล์เดียวควบคุมการเปิด/ปิด
//
// ปิดทั้งระบบ: เปลี่ยน DM_TOOLS_ENABLED เป็น false แล้วอัปโหลดไฟล์นี้ไฟล์เดียว
//   → เมนู ⋯ / ตั้งค่า / เสียงแจ้งเตือน หายหมด แชทส่วนตัวกลับเป็นแบบเดิม 100% (ข้อมูลบล็อก/ลบที่เคยตั้งไว้ไม่ถูกแตะ)
export const DM_TOOLS_ENABLED = true;

export const BLOCKS_COLLECTION = "userBlocks";   // userBlocks/{uid} = { list: [uid ที่บล็อก] }
export const MAX_BLOCKS = 200;                    // เพดานรายชื่อบล็อก (กันเอกสารโตไม่จำกัด)
export const MAX_CUSTOM_SOUND_BYTES = 300 * 1024; // เสียงที่อัปโหลดเอง ไม่เกิน 300 KB
export const MAX_CUSTOM_SOUND_SECONDS = 6;        // และยาวไม่เกิน 6 วินาที
export const ALLOWED_SOUND_TYPES = ["audio/mpeg", "audio/mp3", "audio/wav", "audio/x-wav", "audio/ogg", "audio/mp4", "audio/x-m4a", "audio/aac", "audio/webm"];
