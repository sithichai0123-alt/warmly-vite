// Gifts Plus — ตรรกะจ่ายเหรียญม่วงเมื่อส่งของขวัญ (ล้วน ไม่แตะฐานข้อมูล ทดสอบง่าย)
// กติกาเดียวกับการซื้อไอเทมพรีเมียม: ใช้เหรียญม่วงที่ "ได้ฟรี" ก่อน แล้วค่อยใช้ที่ซื้อด้วยเงินจริง
// (เหรียญที่ซื้อจึงเหลือให้คืนเงินได้มากที่สุด) — ผู้รับ "ไม่ได้" รับมูลค่าเข้า giftValue (กันวนเหรียญม่วงเป็นรางวัล)
// รับเฉพาะตัวเลขจริง (ข้อความ/null/NaN/ติดลบ = 0) — กันเอกสารผิดรูปทำให้เหรียญงอก
const num = v => (typeof v === "number" && Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
export function isPurpleGift(g) { return !!g && g.cur === "purple"; }

export function planSendGiftPurple(d, gift, toName) {
  if (!isPurpleGift(gift)) throw new Error("ไม่ใช่ของขวัญเหรียญม่วง");
  const price = gift.price;
  if (!Number.isInteger(price) || price < 1) throw new Error("ราคาของขวัญไม่ถูกต้อง");
  const doc = d && typeof d === "object" ? d : {};
  const earned = num(doc.purple), bought = num(doc.purpleBought);
  if (earned + bought < price) throw new Error("เหรียญม่วงไม่พอ");
  const fromE = Math.min(earned, price), fromB = price - fromE;
  const patch = { purple: earned - fromE };
  if (fromB > 0) patch.purpleBought = bought - fromB;
  return {
    patch,
    entry: {
      kind: "gift_sent", label: "ส่ง " + gift.emoji + " " + gift.name + (toName ? " ให้ " + toName : ""), ref: gift.id,
      gold: 0, purple: fromE ? -fromE : 0, purpleBought: fromB ? -fromB : 0,
      after: { gold: num(doc.coins), purple: earned - fromE, purpleBought: bought - fromB },
    },
  };
}

// ยอดเหรียญของสกุลที่ของขวัญชิ้นนั้นใช้ (สำหรับแสดงว่าพอไหม)
export function giftBalance(me, g) {
  const m = me && typeof me === "object" ? me : {};
  return isPurpleGift(g) ? num(m.purple) + num(m.purpleBought) : num(m.coins);
}
