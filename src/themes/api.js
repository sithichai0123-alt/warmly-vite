// Themes — บันทึกธีมที่เลือกเข้าบัญชี (users/{uid}.theme = { voice, feed, chat, profile })
// รับเครื่องมือ Firestore จากแอป (จึงไม่ต้อง import firebase ในไฟล์นี้) — เขียนเฉพาะฟิลด์ theme ไม่แตะเหรียญ/ไอเทม
import { THEME_SECTIONS, canUseTheme, THEME_BY_ID } from "./catalog.js";

export function makeThemeApi(deps) {
  const { db, getUid, setDoc, doc } = deps;
  return {
    // id = null → กลับธีมเดิม; ต้องเป็นธีมที่ใช้ได้ (ฟรี/เป็นเจ้าของ) เท่านั้น
    async save(userDoc, section, id) {
      if (!THEME_SECTIONS.includes(section)) throw new Error("ไม่รู้จักหน้านี้");
      if (id && !THEME_BY_ID[id]) throw new Error("ไม่พบธีมนี้");
      if (id && !canUseTheme(userDoc, id)) throw new Error("ยังไม่ได้เป็นเจ้าของธีมนี้");
      await setDoc(doc(db, "users", getUid()), { theme: { [section]: id || null } }, { merge: true });
    },
    async saveAll(userDoc, id) {
      if (id && !canUseTheme(userDoc, id)) throw new Error("ยังไม่ได้เป็นเจ้าของธีมนี้");
      const theme = {};
      THEME_SECTIONS.forEach(s => { theme[s] = id || null; });
      await setDoc(doc(db, "users", getUid()), { theme }, { merge: true });
    },
  };
}
