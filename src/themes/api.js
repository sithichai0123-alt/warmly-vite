// Themes — บันทึกธีมที่เลือกเข้าบัญชี (users/{uid}.theme = { voice, feed, chat, profile }) และซื้อธีม
// รับเครื่องมือ Firestore จากแอป (จึงไม่ต้อง import firebase ในไฟล์นี้)
// save/saveAll เขียนเฉพาะฟิลด์ theme ไม่แตะเหรียญ/ไอเทม — buy อยู่ใน wallet.js (เขียนเหรียญ/ไอเทม/ledger ใน transaction เดียว)
import { THEME_SECTIONS, canUseTheme, THEME_BY_ID } from "./catalog.js";
import { makeThemeWallet } from "./wallet.js";

export function makeThemeApi(deps) {
  const { db, getUid, setDoc, doc, runTransaction } = deps;
  const wallet = deps.runTransaction && deps.collection ? makeThemeWallet(deps) : null;

  // ตั้งค่าธีม: ถ้ามี runTransaction จะอ่านบัญชีจริงมาตรวจความเป็นเจ้าของอีกรอบก่อนบันทึก (กันข้อมูลในแอปค้าง/เก่า)
  async function write(userDoc, patchTheme, idsToCheck) {
    const ref = doc(db, "users", getUid());
    if (runTransaction && idsToCheck.length) {
      await runTransaction(db, async tx => {
        const sn = await tx.get(ref);
        const fresh = sn.exists() ? sn.data() : {};
        idsToCheck.forEach(id => { if (!canUseTheme(fresh, id)) throw new Error("ยังไม่ได้เป็นเจ้าของธีมนี้"); });
        tx.set(ref, { theme: patchTheme }, { merge: true });
      });
      return;
    }
    await setDoc(ref, { theme: patchTheme }, { merge: true });
  }

  return {
    // id = null → กลับธีมเดิม; ต้องเป็นธีมที่ใช้ได้ (ฟรี/เป็นเจ้าของ) เท่านั้น
    async save(userDoc, section, id) {
      if (!THEME_SECTIONS.includes(section)) throw new Error("ไม่รู้จักหน้านี้");
      if (id && !THEME_BY_ID[id]) throw new Error("ไม่พบธีมนี้");
      if (id && !canUseTheme(userDoc, id)) throw new Error("ยังไม่ได้เป็นเจ้าของธีมนี้");
      await write(userDoc, { [section]: id || null }, id ? [id] : []);
    },
    async saveAll(userDoc, id) {
      if (id && !THEME_BY_ID[id]) throw new Error("ไม่พบธีมนี้");
      if (id && !canUseTheme(userDoc, id)) throw new Error("ยังไม่ได้เป็นเจ้าของธีมนี้");
      const theme = {};
      THEME_SECTIONS.forEach(s => { theme[s] = id || null; });
      await write(userDoc, theme, id ? [id] : []);
    },
    // ซื้อธีม (คืน entry ของสมุดบัญชี รวมยอดคงเหลือใน entry.after)
    async buy(id) {
      if (!wallet) throw new Error("ระบบซื้อธีมยังไม่พร้อม");
      return wallet.buyTheme(id);
    },
  };
}
