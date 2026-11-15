// Room UI — หน้าห้องคุยให้กระชับ: ปุ่มแถวเดียว + รายชื่อสมาชิกพับได้ (แชท/เพลงไม่ถูกดันลงไปไกลเมื่อคนเยอะ)
// ปิดทีละส่วนได้: เปลี่ยนเป็น false แล้วอัปโหลดไฟล์นี้ไฟล์เดียว → ส่วนนั้นกลับเป็นแบบเดิม 100%
export const ROOM_ACTIONS_GRID_ENABLED = true;    // ปุ่มทั้งหมดในแถวเดียว ขนาดเท่ากัน (false = ปุ่ม 2 แถวแบบเดิม)
export const ROOM_MEMBERS_COLLAPSE_ENABLED = true; // รายชื่อสมาชิกแสดงไม่เกิน MEMBERS_VISIBLE_ROWS แถว + ปุ่มดูทั้งหมด (false = แสดงทุกคนแบบเดิม)
export const MEMBERS_VISIBLE_ROWS = 2;
