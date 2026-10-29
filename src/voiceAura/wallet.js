// Voice Aura — ซื้อ/สวมใส่เอฟเฟกต์ (ตรรกะล้วน + ตัวห่อ transaction)
// ใช้ร่วมกันทั้งในแอป (Firestore client) และฟังก์ชันเซิร์ฟเวอร์ api/aura-buy.js → กฎเดียวกันทุกที่
// ไม่ยุ่งกับฟังก์ชันกระเป๋าเดิม: เขียนเฉพาะฟิลด์เดิมที่ระบบเหรียญใช้อยู่ (coins / purple / purpleBought / inventory / purpleSrc)
// และสมุดบัญชี ledger ด้วยรูปแบบเดียวกับของเดิม (kind: "buy_aura")
import { AURA_BY_ID, auraItemId } from "./catalog.js";

// ตัวคำนวณล้วน ๆ: คืน {patch, entry} หรือ throw ข้อความไทย (ไม่แตะฐานข้อมูล ทดสอบง่าย)
export function planBuyAura(d, id) {
  const a = AURA_BY_ID[id];
  if (!a || !a.price || !a.cur) throw new Error("ไม่พบเอฟเฟกต์นี้ในร้านค้า");
  if (d.isGuest) throw new Error("บัญชีผู้เยี่ยมชมซื้อเอฟเฟกต์ไม่ได้ — ล็อกอินด้วย Google ก่อน");
  const item = auraItemId(id);
  const inv = Array.isArray(d.inventory) ? d.inventory : [];
  if (inv.includes(item)) throw new Error("คุณมีเอฟเฟกต์นี้แล้ว");
  const label = "ซื้อเอฟเฟกต์เสียง " + a.name;

  if (a.cur === "gold") {
    const gold = d.coins || 0;
    if (gold < a.price) throw new Error("เหรียญทองไม่พอ (ต้องใช้ " + a.price + ")");
    return {
      patch: { coins: gold - a.price, inventory: [...inv, item] },
      entry: { kind: "buy_aura", label, ref: item, gold: -a.price, purple: 0, purpleBought: 0,
        after: { gold: gold - a.price, purple: d.purple || 0, purpleBought: d.purpleBought || 0 } },
    };
  }
  // เหรียญม่วง: ใช้ที่ได้ฟรีก่อน แล้วค่อยใช้ที่ซื้อด้วยเงินจริง (เหมือน planBuyPremium)
  const earned = d.purple || 0, bought = d.purpleBought || 0;
  if (earned + bought < a.price) throw new Error("เหรียญม่วงไม่พอ (ต้องใช้ " + a.price + ")");
  const fromE = Math.min(earned, a.price), fromB = a.price - fromE;
  const patch = { purple: earned - fromE, inventory: [...inv, item], purpleSrc: { ...(d.purpleSrc || {}), [item]: fromB === 0 ? "earned" : (fromE === 0 ? "bought" : "mixed") } };
  if (fromB > 0) patch.purpleBought = bought - fromB;
  return {
    patch,
    entry: { kind: "buy_aura", label, ref: item, gold: 0, purple: -fromE, purpleBought: -fromB,
      after: { gold: d.coins || 0, purple: earned - fromE, purpleBought: bought - fromB } },
  };
}

// สวมใส่: id = null → กลับไปวงเขียวเดิม; ต้องเป็นเจ้าของจริงเท่านั้น
export function planEquipAura(d, id) {
  if (id === null || id === undefined || id === "green") return { patch: { aura: null } };
  const a = AURA_BY_ID[id];
  if (!a) throw new Error("ไม่พบเอฟเฟกต์นี้");
  const inv = Array.isArray(d.inventory) ? d.inventory : [];
  if (a.price && !inv.includes(auraItemId(id))) throw new Error("ยังไม่ได้เป็นเจ้าของเอฟเฟกต์นี้");
  return { patch: { aura: id } };
}

// ตัวห่อ: รับเครื่องมือ Firestore จากแอป (จึงไม่ต้อง import firebase ในไฟล์นี้)
export function makeAuraWallet(deps) {
  const { db, getUid, runTransaction, doc, collection, serverTimestamp } = deps;
  const inflight = new Set(); // กันกดซ้ำ/ส่งซ้ำพร้อมกันในเครื่องเดียว

  async function buyAura(id) {
    const key = "buy:" + id;
    if (inflight.has(key)) throw new Error("กำลังดำเนินการอยู่ กรุณารอสักครู่");
    inflight.add(key);
    try {
      if (deps.serverMode && deps.getToken) {
        const token = await deps.getToken();
        const r = await fetch("/api/aura-buy", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token }, body: JSON.stringify({ id }) });
        const j = await r.json().catch(() => ({}));
        if (!r.ok) throw new Error(j.error || "ซื้อไม่สำเร็จ");
        return j.entry || { kind: "buy_aura" };
      }
      const uid = getUid(), ref = doc(db, "users", uid);
      // transaction เดียว: ตรวจยอด + ตรวจว่ายังไม่มี + หักเหรียญ + เพิ่มไอเทม + เขียนประวัติ (สำเร็จพร้อมกันหรือไม่สำเร็จเลย)
      return await runTransaction(db, async tx => {
        const sn = await tx.get(ref);
        const p = planBuyAura(sn.exists() ? sn.data() : {}, id);
        tx.set(ref, p.patch, { merge: true });
        tx.set(doc(collection(db, "ledger")), { uid, gold: 0, purple: 0, purpleBought: 0, ...p.entry, t: serverTimestamp() });
        return p.entry;
      });
    } finally {
      inflight.delete(key);
    }
  }

  async function equipAura(id) {
    const uid = getUid(), ref = doc(db, "users", uid);
    await runTransaction(db, async tx => {
      const sn = await tx.get(ref);
      const p = planEquipAura(sn.exists() ? sn.data() : {}, id);
      tx.set(ref, p.patch, { merge: true });
    });
  }

  return { buyAura, equipAura };
}
