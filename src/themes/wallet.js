// Themes — ซื้อธีม (ตรรกะล้วน + ตัวห่อ transaction)
// ใช้ร่วมกันทั้งในแอป (Firestore client) และฟังก์ชันเซิร์ฟเวอร์ api/theme-buy.js → กฎเดียวกันทุกที่
// ไม่ยุ่งกับฟังก์ชันกระเป๋าเดิม: เขียนเฉพาะฟิลด์เดิมที่ระบบเหรียญใช้อยู่ (coins / purple / purpleBought / inventory / purpleSrc)
// และสมุดบัญชี ledger ด้วยรูปแบบเดียวกับของเดิม (kind: "buy_theme")
import { THEME_BY_ID, themeItemId } from "./catalog.js";

// ตัวคำนวณล้วน ๆ: คืน {patch, entry} หรือ throw ข้อความไทย (ไม่แตะฐานข้อมูล ทดสอบง่าย)
export function planBuyTheme(d, id) {
  const t = THEME_BY_ID[id];
  if (!t || !t.price || !t.cur) throw new Error("ไม่พบธีมนี้ในร้านค้า");
  if (d.isGuest) throw new Error("บัญชีผู้เยี่ยมชมซื้อธีมไม่ได้ — ล็อกอินด้วย Google ก่อน");
  const item = themeItemId(id);
  const inv = Array.isArray(d.inventory) ? d.inventory : [];
  if (inv.includes(item)) throw new Error("คุณมีธีมนี้แล้ว");
  const label = "ซื้อธีม " + t.name;

  if (t.cur === "gold") {
    const gold = d.coins || 0;
    if (gold < t.price) throw new Error("เหรียญทองไม่พอ (ต้องใช้ " + t.price.toLocaleString() + ")");
    return {
      patch: { coins: gold - t.price, inventory: [...inv, item] },
      entry: { kind: "buy_theme", label, ref: item, gold: -t.price, purple: 0, purpleBought: 0,
        after: { gold: gold - t.price, purple: d.purple || 0, purpleBought: d.purpleBought || 0 } },
    };
  }
  // เหรียญม่วง: ใช้ที่ได้ฟรีก่อน แล้วค่อยใช้ที่ซื้อด้วยเงินจริง (เหมือน planBuyPremium / planBuyAura)
  const earned = d.purple || 0, bought = d.purpleBought || 0;
  if (earned + bought < t.price) throw new Error("เหรียญม่วงไม่พอ (ต้องใช้ " + t.price + ")");
  const fromE = Math.min(earned, t.price), fromB = t.price - fromE;
  const patch = { purple: earned - fromE, inventory: [...inv, item], purpleSrc: { ...(d.purpleSrc || {}), [item]: fromB === 0 ? "earned" : (fromE === 0 ? "bought" : "mixed") } };
  if (fromB > 0) patch.purpleBought = bought - fromB;
  return {
    patch,
    entry: { kind: "buy_theme", label, ref: item, gold: 0, purple: -fromE, purpleBought: -fromB,
      after: { gold: d.coins || 0, purple: earned - fromE, purpleBought: bought - fromB } },
  };
}

// ตัวห่อ: รับเครื่องมือ Firestore จากแอป (จึงไม่ต้อง import firebase ในไฟล์นี้)
export function makeThemeWallet(deps) {
  const { db, getUid, runTransaction, doc, collection, serverTimestamp } = deps;
  const inflight = new Set(); // กันกดซ้ำ/ส่งซ้ำพร้อมกันในเครื่องเดียว

  async function buyTheme(id) {
    const key = "buy:" + id;
    if (inflight.has(key)) throw new Error("กำลังดำเนินการอยู่ กรุณารอสักครู่");
    inflight.add(key);
    try {
      if (deps.serverMode && deps.getToken) {
        const token = await deps.getToken();
        const r = await fetch("/api/theme-buy", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ id }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "ซื้อไม่สำเร็จ");
        return j.entry || { kind: "buy_theme" };
      }
      const uid = getUid(), ref = doc(db, "users", uid);
      // transaction เดียว: ตรวจยอด + ตรวจว่ายังไม่มี + หักเหรียญ + เพิ่มไอเทม + เขียนประวัติ (สำเร็จพร้อมกันหรือไม่สำเร็จเลย)
      return await runTransaction(db, async tx => {
        const sn = await tx.get(ref);
        const p = planBuyTheme(sn.exists() ? sn.data() : {}, id);
        tx.set(ref, p.patch, { merge: true });
        tx.set(doc(collection(db, "ledger")), { uid, gold: 0, purple: 0, purpleBought: 0, ...p.entry, t: serverTimestamp() });
        return p.entry;
      });
    } finally {
      inflight.delete(key);
    }
  }

  return { buyTheme };
}
