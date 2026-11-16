// Scale — ตรรกะล้วน (ไม่แตะ Firebase/React) เพื่อทดสอบได้ตรง ๆ

// เวลาสร้างโพสต์เป็นมิลลิวินาที: รองรับ Timestamp ของ Firestore / Date / ตัวเลข / ยังไม่มี (กำลังส่ง = ใหม่ที่สุด)
export function createdMs(p) {
  const c = p && p.createdAt;
  if (c == null) return Number.MAX_SAFE_INTEGER;
  if (typeof c.toMillis === "function") return c.toMillis();
  if (c instanceof Date) return c.getTime();
  if (typeof c === "number") return c;
  if (typeof c.seconds === "number") return c.seconds * 1000 + Math.floor((c.nanoseconds || 0) / 1e6);
  return 0;
}

// รวมหลายรายการโพสต์: ตัดซ้ำตาม id (รายการหลังสุดชนะ) แล้วเรียงใหม่สุดก่อน — ส่งรายการเดิมกลับถ้ามีรายการเดียวและไม่ซ้ำ
export function mergePosts(...lists) {
  const byId = new Map();
  for (const l of lists) for (const p of (l || [])) if (p && p.id != null) byId.set(p.id, p);
  return [...byId.values()].sort((a, b) => createdMs(b) - createdMs(a));
}

// จำนวนที่ขอจาก Firestore: ขอเกินที่แสดง 1 รายการ เพื่อรู้ว่า "ยังมีเก่ากว่านี้อีก" (ลบโพสต์ในช่วงที่โหลดก็ยังตอบถูก)
export function fetchLimit(shown, windowMin) {
  return Math.max(shown, windowMin) + 1;
}

// แยกผลที่ได้เป็น: ที่แสดงในฟีด / ทั้งหมดที่ใช้คำนวณแจ้งเตือน / มีให้ดูเพิ่มไหม
export function sliceFeed(docs, shown) {
  const list = docs || [];
  return { feed: list.slice(0, shown), all: list, hasMore: list.length > shown };
}

// ฟีดที่จะแสดง: ถ้ามีโพสต์ที่ต้องเปิด (จากการกดแจ้งเตือน) แต่เก่าเกินหน้าต่างที่โหลด → ใส่ไว้บนสุด เพื่อให้เปิดได้
export function withFocus(feed, all, focusId) {
  if (!focusId || feed.some(p => p.id === focusId)) return feed;
  const hit = all.find(p => p.id === focusId);
  return hit ? [hit, ...feed] : feed;
}
