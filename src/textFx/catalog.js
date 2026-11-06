// Text FX — รายการฟอนต์/เอฟเฟกต์ทั้งหมด (ข้อมูลล้วน ไม่มีตรรกะซื้อ)
//
// ระดับ (tier): free = ฟรี | gold = เหรียญทอง | purple = เหรียญม่วง (สูงกว่าทอง: หลายชั้น/หลายสี/เคลื่อนไหวซับซ้อน)
// kind: font = ฟอนต์พิเศษ | neon = นีออน | gradient = ไล่สี | animated = เคลื่อนไหว | premium = พรีเมียม
//
// สี: [โทนมืด, โทนสว่าง] — โทนมืดสดสว่าง (นีออนบนพื้นเข้ม) โทนสว่างเข้มลึกขึ้น (อ่านชัดบนธีมสว่าง)
//     ระบบเลือกให้เองตามธีมของหน้านั้น (ตัวแปร --wm-dark) → ตัวอักษรอ่านชัดทุกธีม
// เอฟเฟกต์ที่ใช้ได้ต่อไอเทม:
//   color:[d,l]                 สีตัวอักษรเดียว
//   glow:[[blur,สี,alpha],...]  เรืองแสง (text-shadow; จางหายบนธีมสว่าง) — จำกัดไม่เกิน 4 ชั้น/เบลอ ≤ 24px
//   grad:{stops,flow}           ไล่สี (flow = วินาทีต่อรอบถ้าให้ไหล)
//   dropGlow:[blur,สี,alpha]    เรืองแสงของตัวอักษรไล่สี
//   sweep:{base,hi,secs}        แสงวิ่งผ่านตัวอักษร
//   blink:secs                  กะพริบเบา ๆ (ความทึบ 1 → .7)
//   pulse:secs                  เรืองแสงหายใจเข้า-ออก
export const TIER_LABEL = { free: "ฟรี", gold: "เหรียญทอง", purple: "เหรียญม่วง" };
export const KIND_LABEL = { font: "ฟอนต์พิเศษ", neon: "นีออน", gradient: "ไล่สี", animated: "เคลื่อนไหว", premium: "พรีเมียม" };
export const RARITY = { free: "ธรรมดา", common: "ทั่วไป", rare: "หายาก", epic: "ยอดเยี่ยม", legendary: "ตำนาน" };

const F = (id, name, th, kind, tier, price, rarity, font, fx) => ({
  id, name, th, kind, tier, price, rarity,
  cur: tier === "gold" ? "gold" : tier === "purple" ? "purple" : null,
  font, ...fx,
});

export const FX = [
  // ── ฟรี: ฟอนต์พื้นฐาน อ่านง่าย ไม่มีเรืองแสง ──
  F("default", "ฟอนต์เดิม Warmly", "แบบมาตรฐานของแอป (ค่าเริ่มต้น)", "font", "free", 0, "free", null, { plain: true }),
  F("sarabun", "Sarabun", "สะอาด อ่านง่าย ทางการ", "font", "free", 0, "free", { key: "sarabun", w: 500 }, {}),
  F("kanit", "Kanit", "เหลี่ยมมน ทันสมัย", "font", "free", 0, "free", { key: "kanit", w: 400 }, {}),
  F("prompt", "Prompt", "เรียบ เท่ ดูโมเดิร์น", "font", "free", 0, "free", { key: "prompt", w: 500 }, {}),
  F("niramit", "Niramit", "เส้นบางเบา ดูนุ่มนวล", "font", "free", 0, "free", { key: "niramit", w: 500 }, {}),

  // ── ทอง: ฟอนต์ตกแต่ง ──
  F("chonburi", "Chonburi", "หัวหนา หรูแบบโปสเตอร์", "font", "gold", 200, "common", { key: "chonburi", w: 400 }, {}),
  F("pattaya", "Pattaya", "ตัวมน เป็นกันเอง น่ารัก", "font", "gold", 250, "common", { key: "pattaya", w: 400 }, {}),
  F("sriracha", "Sriracha", "ลายมือเขียนสบาย ๆ", "font", "gold", 250, "common", { key: "sriracha", w: 400 }, {}),
  F("charmonman", "Charmonman", "อ่อนช้อย แบบอักษรประดิษฐ์", "font", "gold", 300, "common", { key: "charmonman", w: 700 }, {}),

  // ── ทอง: นีออน ──
  F("neon-pink", "Neon Pink", "นีออนชมพูหวาน", "neon", "gold", 500, "rare", { key: "kanit", w: 600 },
    { color: ["#FF6FB5", "#B0124F"], glow: [[3, "#FF2E93", 0.85], [10, "#FF2E93", 0.5]] }),
  F("neon-cyan", "Neon Cyan", "นีออนฟ้าเย็น", "neon", "gold", 500, "rare", { key: "kanit", w: 600 },
    { color: ["#5CE1FF", "#00607A"], glow: [[3, "#00C8FF", 0.85], [10, "#00C8FF", 0.5]] }),
  F("neon-lime", "Neon Lime", "นีออนเขียวสด", "neon", "gold", 500, "rare", { key: "kanit", w: 600 },
    { color: ["#B6FF5C", "#2F6B00"], glow: [[3, "#7CFF00", 0.8], [10, "#7CFF00", 0.45]] }),

  // ── ทอง: ไล่สี ──
  F("grad-sunset", "Sunset", "ไล่สีพระอาทิตย์ตก ส้ม-ชมพู", "gradient", "gold", 600, "rare", { key: "prompt", w: 600 },
    { grad: { stops: [["#FFB454", "#B34700"], ["#FF6F91", "#B0124F"], ["#FF5CC8", "#8E1B8E"]] } }),
  F("grad-ocean", "Ocean", "ไล่สีทะเล ฟ้า-คราม", "gradient", "gold", 600, "rare", { key: "prompt", w: 600 },
    { grad: { stops: [["#5CE1FF", "#00607A"], ["#5C9DFF", "#0A4DB5"], ["#8F8FFF", "#3B2FB5"]] } }),
  F("grad-mint", "Mint", "ไล่สีมิ้นต์สดชื่น", "gradient", "gold", 600, "rare", { key: "prompt", w: 600 },
    { grad: { stops: [["#7CFFC4", "#006B45"], ["#5CE1FF", "#00607A"], ["#9CFF7C", "#2F6B00"]] } }),

  // ── ทอง: เคลื่อนไหว ──
  F("soft-blink", "Soft Blink", "นีออนอำพันกะพริบเบา ๆ", "animated", "gold", 700, "epic", { key: "kanit", w: 600 },
    { color: ["#FFC25C", "#8A4B00"], glow: [[3, "#FFA726", 0.8], [9, "#FFA726", 0.45]], blink: 3 }),
  F("move-light", "Moving Light", "แสงวิ่งผ่านตัวอักษร", "animated", "gold", 900, "epic", { key: "prompt", w: 600 },
    { sweep: { base: ["#CFC4FF", "#4B2FB5"], hi: ["#FFFFFF", "#D01C82"], secs: 3.6 } }),
  F("color-shift", "Color Shift", "สีไหลเปลี่ยนต่อเนื่อง", "animated", "gold", 1000, "epic", { key: "prompt", w: 600 },
    { grad: { stops: [["#FF8FB8", "#B0124F"], ["#FFC27C", "#8A4B00"], ["#9CFF9C", "#1F6B1F"], ["#7CE1FF", "#00607A"], ["#C09CFF", "#5B2FB5"]], flow: 8 } }),

  // ── ม่วง: พรีเมียม (หลายชั้น / หลายสี / เคลื่อนไหวซับซ้อน / ฟอนต์เฉพาะ) ──
  F("galaxy", "Galaxy", "กาแล็กซีม่วง-ชมพู ไหลช้า ๆ พร้อมแสงเรือง", "premium", "purple", 5, "legendary", { key: "kanit", w: 600 },
    { grad: { stops: [["#9D85FF", "#4B2FC9"], ["#C58CFF", "#7A1FB5"], ["#FF8FDA", "#B0124F"], ["#7CB6FF", "#0A4DB5"]], flow: 9 }, dropGlow: [6, "#A47CFF", 0.55] }),
  F("layered-neon", "Layered Neon", "นีออน 2 สี 4 ชั้น หายใจเข้า-ออก (ฟอนต์ Orbitron)", "premium", "purple", 6, "legendary", { key: "orbitron", w: 700 },
    { color: ["#FFE6F6", "#7A1257"], glow: [[2, "#FF2E93", 0.9], [8, "#FF2E93", 0.65], [16, "#00C8FF", 0.5], [24, "#00C8FF", 0.3]], pulse: 3.6 }),
  F("aurora", "Aurora", "แสงเหนือ เขียว-ฟ้า-ม่วง พร้อมแสงเรือง", "premium", "purple", 8, "legendary", { key: "mitr", w: 500 },
    { grad: { stops: [["#7CFFC4", "#006B45"], ["#5CE1FF", "#00607A"], ["#B58CFF", "#5B2FB5"]], flow: 7 }, dropGlow: [6, "#5CFFC8", 0.5] }),
  F("rainbow", "Rainbow", "รุ้ง 7 สี ไหลวนไม่สิ้นสุด", "premium", "purple", 10, "legendary", { key: "prompt", w: 700 },
    { grad: { stops: [["#FF6B6B", "#C21F1F"], ["#FFB454", "#A85A00"], ["#FFE45C", "#7A6A00"], ["#6CFF9C", "#0B7A3E"], ["#5CC8FF", "#0A5FA8"], ["#8C7CFF", "#4B2FC9"], ["#E77CFF", "#9A1FB0"]], flow: 6 }, dropGlow: [5, "#FFFFFF", 0.35] }),
  F("gold-foil", "Gold Foil", "ฟอยล์ทองมันวาว (ฟอนต์ Chonburi)", "premium", "purple", 12, "legendary", { key: "chonburi", w: 400 },
    { grad: { stops: [["#FFE08A", "#7A5200"], ["#F2B632", "#9A6B00"], ["#FFF2C0", "#7A5200"], ["#D99A1A", "#8A5C00"]], flow: 7 }, dropGlow: [5, "#FFC83D", 0.5] }),
  F("holo", "Holographic", "โฮโลแกรมเงาไข่มุก สีเลื่อมเปลี่ยนตามแสง", "premium", "purple", 15, "legendary", { key: "prompt", w: 700 },
    { grad: { stops: [["#FFB3E6", "#B0124F"], ["#B3E0FF", "#0A5FA8"], ["#C4FFD9", "#0B7A3E"], ["#FFF0B3", "#8A6A00"], ["#E0B3FF", "#6A2FB5"]], flow: 5 }, dropGlow: [5, "#FFFFFF", 0.4] }),
];

export const FX_BY_ID = Object.fromEntries(FX.map(t => [t.id, t]));
export const FX_DEFAULT = "default";
export const fontItemId = id => "font:" + id;
