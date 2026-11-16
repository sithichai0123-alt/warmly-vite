// Scale/ผู้ใช้ — ตรรกะล้วน (ไม่แตะ Firebase/React) เพื่อทดสอบได้ตรง ๆ

// ชื่อคุณสมบัติที่ "หน้าตาเหมือนรหัสผู้ใช้" (uid ของ Firebase ยาว 28 ตัว) — กันไม่ให้ระบบพยายามโหลดผู้ใช้จากคีย์อื่น (constructor, then, ...)
//   รหัสจริงมี 2 แบบ: Firebase 28 ตัว / รหัสสำรองในเครื่อง 16 ตัว · ตัดชื่อมาตรฐานของออบเจกต์ (constructor, hasOwnProperty, ...) ที่บังเอิญยาวพอ
export const isUidLike = p => typeof p === "string" && /^[A-Za-z0-9_-]{10,128}$/.test(p) && !(p in Object.prototype);

// แบ่งรหัสใหม่เป็นกลุ่มละไม่เกิน size (ใช้กับ where(documentId(), "in", กลุ่ม))
export function chunkIds(ids, size) {
  const out = [];
  for (let i = 0; i < ids.length; i += size) out.push(ids.slice(i, i + size));
  return out;
}

// รวมผลเข้าแคช: ได้ออบเจกต์ใหม่เสมอ (ให้ React เห็นว่าเปลี่ยน) · null = ไม่มีเอกสารนี้ (จำไว้ ไม่ถามซ้ำ)
export const mergeCache = (prev, got) => ({ ...prev, ...got });

// ค้นชื่อฝั่งเซิร์ฟเวอร์ทำได้แค่ "ขึ้นต้นด้วย" และแยกตัวพิมพ์ → ลองรูปแบบที่คนมักพิมพ์: ตามที่พิมพ์ / ตัวแรกพิมพ์ใหญ่ / ตัวเล็กทั้งหมด / ตัวแรกพิมพ์เล็ก
export function nameVariants(q) {
  const s = String(q || "").trim();
  if (!s) return [];
  return [...new Set([s, s.charAt(0).toUpperCase() + s.slice(1), s.toLowerCase(), s.charAt(0).toLowerCase() + s.slice(1)])];
}

// รวมผลหลายคำค้นเป็นรายการเดียว: ตัดซ้ำ ตัดตัวเอง ใส่ id ให้ แล้วเรียงตามชื่อ (เฉพาะตอนค้นหา)
export function mergePeople(lists, myUid, { sortByName = false, max = Infinity } = {}) {
  const seen = new Map();
  for (const l of lists) for (const p of l) if (p && p.id !== myUid && !seen.has(p.id)) seen.set(p.id, p);
  let arr = [...seen.values()];
  if (sortByName) arr.sort((a, b) => String(a.name || "").localeCompare(String(b.name || ""), "th"));
  return arr.slice(0, max);
}
