// Text FX — บันทึกสไตล์ที่เลือกเข้าบัญชี (users/{uid}.textFx = { name, voiceName, roomName, bio, message })
// รับเครื่องมือ Firestore จากแอป (ไม่ import firebase ในไฟล์นี้) เขียนเฉพาะฟิลด์ textFx — ไม่แตะเหรียญ/ไอเทม
import { FX_BY_ID } from "./catalog.js";
import { TEXTFX_AREAS, canUseFx } from "./resolve.js";
import { makeFxWallet } from "./wallet.js";

export function makeTextFxApi(deps) {
  const { db, getUid, setDoc, doc, runTransaction } = deps;
  const wallet = deps.runTransaction && deps.collection ? makeFxWallet(deps) : null;

  async function write(userDoc, patch, idsToCheck) {
    const uid = getUid();
    if (!uid) throw new Error("ต้องล็อกอินก่อน");
    const ref = doc(db, "users", uid);
    if (runTransaction && idsToCheck.length) {
      // ตรวจความเป็นเจ้าของจากบัญชีจริงอีกรอบก่อนบันทึก (กันข้อมูลในแอปค้าง/เก่า)
      await runTransaction(db, async tx => {
        const sn = await tx.get(ref);
        const fresh = sn.exists() ? sn.data() : {};
        idsToCheck.forEach(id => { if (!canUseFx(fresh, id)) throw new Error("ยังไม่ได้เป็นเจ้าของฟอนต์นี้"); });
        tx.set(ref, { textFx: patch }, { merge: true });
      });
      return;
    }
    await setDoc(ref, { textFx: patch }, { merge: true });
  }

  return {
    // id = null → กลับแบบเดิมของจุดนั้น
    async save(userDoc, area, id) {
      if (!TEXTFX_AREAS.includes(area)) throw new Error("ไม่รู้จักจุดนี้");
      if (id && !FX_BY_ID[id]) throw new Error("ไม่พบฟอนต์นี้");
      if (id && !canUseFx(userDoc, id)) throw new Error("ยังไม่ได้เป็นเจ้าของฟอนต์นี้");
      await write(userDoc, { [area]: id || null }, id && FX_BY_ID[id].price ? [id] : []);
    },
    // ใช้ไอเทมเดียวกับทุกจุด (id = null → รีเซ็ตทุกจุด)
    async saveAll(userDoc, id) {
      if (id && !FX_BY_ID[id]) throw new Error("ไม่พบฟอนต์นี้");
      if (id && !canUseFx(userDoc, id)) throw new Error("ยังไม่ได้เป็นเจ้าของฟอนต์นี้");
      const patch = {};
      TEXTFX_AREAS.forEach(a => { patch[a] = id || null; });
      await write(userDoc, patch, id && FX_BY_ID[id].price ? [id] : []);
    },
    // ซื้อฟอนต์ (คืน entry ของสมุดบัญชี รวมยอดคงเหลือใน entry.after)
    async buy(id) {
      if (!wallet) throw new Error("ระบบซื้อฟอนต์ยังไม่พร้อม");
      return wallet.buyFx(id);
    },
  };
}
