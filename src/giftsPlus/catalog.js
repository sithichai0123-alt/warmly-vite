// Gifts Plus — รายการของขวัญชุดใหม่ (ข้อมูลล้วน ไม่ import อะไร)
// เรียงตามความพิเศษของเหรียญ: ทอง (ราคาน้อย → มาก) แล้วตามด้วยม่วง (ราคาน้อย → มาก)
//   cur: "gold" (ค่าเริ่มต้น, ไม่ต้องใส่) | "purple"   price = จำนวนเหรียญสกุลนั้น
//   model: มีโมเดล 3 มิติ (giftsPlus/models3d.js) — ทองที่ราคา > 120 และของขวัญเหรียญม่วงทุกชิ้นเป็น 3D
//   ของขวัญทอง: ระดับ (tier) คำนวณจากราคาเหมือนของเดิม — ของขวัญม่วง: กำหนด tier เอง (พิเศษกว่าเสมอ)
//   fx: ท่าและอนุภาคของแอนิเมชัน (motion: rise|bounce|drop|spin|fly|zoom|drive)
export const GOLD_PLUS = [
  { id: "icecream", emoji: "🍦", name: "ไอศกรีม", price: 6, fx: { motion: "bounce", p: ["🍦", "❄️", "✨"] } },
  { id: "balloon", emoji: "🎈", name: "ลูกโป่ง", price: 12, fx: { motion: "rise", p: ["🎈", "🎉", "✨"] } },
  { id: "chocolate", emoji: "🍫", name: "ช็อกโกแลต", price: 18, fx: { motion: "drop", p: ["🍫", "💕", "✨"] } },
  { id: "unicorn", emoji: "🦄", name: "ยูนิคอร์น", price: 35, fx: { motion: "bounce", p: ["🌈", "✨", "🦄"] } },
  { id: "guitar", emoji: "🎸", name: "กีตาร์", price: 55, fx: { motion: "spin", p: ["🎵", "🎶", "✨"] } },
  { id: "champagne", emoji: "🍾", name: "แชมเปญ", price: 90, fx: { motion: "rise", p: ["🍾", "🥂", "✨"] } },
  { id: "dragon", emoji: "🐉", name: "มังกรไฟ", price: 150, model: "dragon", fx: { motion: "zoom", p: ["🔥", "🐉", "✨"], tint: "#EF4444" } },
  { id: "yacht", emoji: "🛥️", name: "เรือยอร์ช", price: 250, model: "yacht", fx: { motion: "drive", p: ["🌊", "✨", "💎"], tint: "#38BDF8" } },
  { id: "jet", emoji: "✈️", name: "เครื่องบินส่วนตัว", price: 450, model: "jet", fx: { motion: "fly", p: ["☁️", "✨", "💨"], tint: "#60A5FA" } },
  { id: "island", emoji: "🏝️", name: "เกาะส่วนตัว", price: 800, model: "island", fx: { motion: "zoom", p: ["🌴", "🌊", "✨", "🥥"], tint: "#10B981" } },
];

export const PURPLE_PLUS = [
  { id: "crystal", emoji: "🔮", name: "ลูกแก้ววิเศษ", price: 1, cur: "purple", tier: 3, model: "crystal", fx: { motion: "spin", p: ["🔮", "✨", "💜"], tint: "#C084FC" } },
  { id: "butterfly", emoji: "🦋", name: "ผีเสื้อแสง", price: 2, cur: "purple", tier: 3, model: "butterfly", fx: { motion: "rise", p: ["🦋", "✨", "💜"], tint: "#A78BFA" } },
  { id: "comet", emoji: "☄️", name: "ดาวหาง", price: 4, cur: "purple", tier: 4, model: "comet", fx: { motion: "fly", p: ["☄️", "⭐", "✨"], tint: "#A855F7" } },
  { id: "genie", emoji: "🧞", name: "จินนี่ผู้ให้พร", price: 7, cur: "purple", tier: 5, model: "genie", fx: { motion: "zoom", p: ["✨", "💜", "🌟", "💫"], tint: "#9333EA" } },
  { id: "meteor", emoji: "🌠", name: "ฝนดาวตก", price: 12, cur: "purple", tier: 5, model: "meteor", fx: { motion: "drop", p: ["🌠", "⭐", "💫", "✨"], tint: "#C084FC" } },
];

// รายการที่ใช้งานจริง (ตัดส่วนที่ปิดด้วยสวิตช์ออก) + ตารางท่าแอนิเมชัน
export function plusGifts({ purple = true } = {}) {
  const src = purple ? [...GOLD_PLUS, ...PURPLE_PLUS] : GOLD_PLUS;
  return src.map(({ fx, ...g }) => g);
}
export function plusFx({ purple = true } = {}) {
  const o = {};
  (purple ? [...GOLD_PLUS, ...PURPLE_PLUS] : GOLD_PLUS).forEach(g => { o[g.id] = g.fx; });
  return o;
}

// ลำดับแสดงในหน้าเลือกของขวัญ: ทองเรียงราคาน้อย→มาก (ของเทศกาลแทรกตามราคา) แล้วม่วงเรียงราคาน้อย→มาก
// (sort เสถียร: ราคาเท่ากันคงลำดับเดิม) — ไม่แก้อาร์เรย์ที่ส่งเข้ามา
export function sortGifts(list) {
  const gold = list.filter(g => g.cur !== "purple"), pur = list.filter(g => g.cur === "purple");
  const by = (a, b) => a.price - b.price;
  return { gold: [...gold].sort(by), purple: [...pur].sort(by) };
}
