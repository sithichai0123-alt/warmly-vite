// Voice Aura — รายการเอฟเฟกต์ทั้งหมด (ข้อมูลล้วน ๆ ไม่มี UI / ไม่แตะฐานข้อมูล)
// ข้อมูลในฐานข้อมูล:
//   users/{uid}.inventory  มี "aura:<id>" เมื่อเป็นเจ้าของ
//   users/{uid}.aura       = <id> ที่สวมใส่อยู่ (ไม่มี/ null = วงเขียวเดิมฟรี)

export const AURA_DEFAULT = "green";

export const RARITY = {
  free:      { label: "ฟรี",        color: "#10B981" },
  common:    { label: "ทั่วไป",      color: "#9CA3AF" },
  rare:      { label: "หายาก",      color: "#38BDF8" },
  epic:      { label: "เอพิค",       color: "#F472B6" },
  legendary: { label: "ตำนาน",      color: "#F59E0B" },
  mythic:    { label: "มหัศจรรย์",   color: "#C084FC" },
};

// cur: "gold" = เหรียญทอง (users.coins) / "purple" = เหรียญม่วง (users.purple + users.purpleBought)
export const AURAS = [
  { id: "green",     name: "Green Pulse",     th: "วงเขียวพูดคุย",     cur: null,     price: 0,    rarity: "free",
    desc: "วงเขียวและคลื่นไมค์แบบเดิม — ฟรีสำหรับทุกคน", c: ["#10B981", "#34D399"] },

  { id: "fire",      name: "Fire Ring",       th: "วงเพลิง",          cur: "gold",   price: 300,  rarity: "common",
    desc: "วงไฟหมุนรอบรูปโปรไฟล์ พร้อมประกายไฟลอยขึ้น", c: ["#FF3D00", "#FFD54F"] },
  { id: "neon",      name: "Neon Pulse",      th: "นีออนเต้นตามเสียง", cur: "gold",   price: 400,  rarity: "common",
    desc: "วงนีออนซ้อนกันเต้นเป็นจังหวะตอนพูด", c: ["#22D3EE", "#E879F9"] },
  { id: "hearts",    name: "Floating Hearts", th: "หัวใจลอย",         cur: "gold",   price: 500,  rarity: "common",
    desc: "หัวใจดวงเล็กลอยขึ้นระหว่างพูด", c: ["#FF5C8A", "#FFB3C8"] },
  { id: "sakura",    name: "Sakura Bloom",    th: "ซากุระบาน",        cur: "gold",   price: 700,  rarity: "rare",
    desc: "กลีบซากุระปลิวรอบรูปโปรไฟล์", c: ["#FBCFE8", "#F472B6"] },
  { id: "rainbow",   name: "Rainbow Aura",    th: "ออร่าสายรุ้ง",      cur: "gold",   price: 1000, rarity: "rare",
    desc: "วงแสงสายรุ้งเรืองรองหมุนวน", c: ["#F43F5E", "#FACC15", "#22D3EE", "#A78BFA"] },
  { id: "lightning", name: "Lightning Ring",  th: "วงสายฟ้า",         cur: "gold",   price: 1500, rarity: "epic",
    desc: "สายฟ้าแลบวิ่งรอบรูปโปรไฟล์", c: ["#93C5FD", "#FDE047"] },
  { id: "butterfly", name: "Butterfly Dream", th: "ผีเสื้อในฝัน",      cur: "gold",   price: 2000, rarity: "epic",
    desc: "ผีเสื้อเรืองแสงบินวนรอบรูปโปรไฟล์", c: ["#67E8F9", "#C084FC"] },
  { id: "galaxy",    name: "Galaxy Stars",    th: "ดาราจักร",         cur: "gold",   price: 2500, rarity: "epic",
    desc: "ดวงดาวและประกายจักรวาลระยิบระยับ", c: ["#6366F1", "#F0ABFC"] },

  { id: "phoenix",   name: "Golden Phoenix",  th: "หงส์เพลิงทอง",     cur: "purple", price: 5,    rarity: "legendary",
    desc: "ปีกเพลิงสีทองสยายออก พร้อมประกายแสง", c: ["#F59E0B", "#FDE68A"] },
  { id: "crystal",   name: "Crystal Crown",   th: "มงกุฎคริสตัล",     cur: "purple", price: 8,    rarity: "legendary",
    desc: "มงกุฎคริสตัลเหนือรูปโปรไฟล์ แสงวิบวับ", c: ["#A5F3FC", "#E9D5FF"] },
  { id: "dragon",    name: "Dragon Aura",     th: "มังกรออร่า",        cur: "purple", price: 10,   rarity: "legendary",
    desc: "มังกรเรืองแสงเลื้อยวนรอบรูปโปรไฟล์", c: ["#10B981", "#FDE047"] },
  { id: "wings",     name: "Celestial Wings", th: "ปีกสวรรค์",        cur: "purple", price: 15,   rarity: "legendary",
    desc: "ปีกเรืองแสงพร้อมละอองดาวลอยรอบตัว", c: ["#E0F2FE", "#C4B5FD"] },
  { id: "universe",  name: "Royal Universe",  th: "จักรวาลราชัน",      cur: "purple", price: 25,   rarity: "mythic",
    desc: "วงเวทหลายชั้น ดวงดาว และแสงทองเคลื่อนไหว", c: ["#F59E0B", "#7C3AED"] },
  { id: "divine",    name: "Divine Rainbow",  th: "สายรุ้งเทวา",       cur: "purple", price: 50,   rarity: "mythic",
    desc: "สายรุ้งพรีเมียมหลายชั้น ประกายแสงทั่วทั้งวง", c: ["#F472B6", "#FDE047", "#34D399", "#818CF8"] },
];

export const AURA_BY_ID = Object.fromEntries(AURAS.map(a => [a.id, a]));
export const auraItemId = id => "aura:" + id;           // รหัสในสมุดไอเทม (inventory)
export const isPaid = id => !!(AURA_BY_ID[id] && AURA_BY_ID[id].price > 0);

// เป็นเจ้าของไหม (ฟรี = ทุกคนมี)
export function ownsAura(userDoc, id) {
  const a = AURA_BY_ID[id];
  if (!a) return false;
  if (!a.price) return true;
  const inv = userDoc && Array.isArray(userDoc.inventory) ? userDoc.inventory : [];
  return inv.includes(auraItemId(id));
}

// เอฟเฟกต์ที่ "สวมใส่อยู่และเป็นเจ้าของจริง" ของผู้ใช้คนหนึ่ง (null = ใช้วงเขียวเดิม)
// ตรวจความเป็นเจ้าของตอนแสดงผลด้วย กันคนแก้ค่า aura ในฐานข้อมูลเองโดยไม่ได้ซื้อ
export function equippedAura(userDoc) {
  const id = userDoc && userDoc.aura;
  if (!id || id === AURA_DEFAULT || !AURA_BY_ID[id]) return null;
  return ownsAura(userDoc, id) ? id : null;
}
