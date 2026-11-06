// Text FX — จุดเข้าเดียวที่ App.jsx นำเข้า
export { TEXTFX_ENABLED, TEXTFX_LITE_COUNT } from "./config.js";
export { FX, FX_BY_ID, FX_DEFAULT, TIER_LABEL, KIND_LABEL, RARITY, fontItemId } from "./catalog.js";
export { TEXTFX_AREAS, AREA_LABEL, canUseFx, resolveTextFx } from "./resolve.js";
export { TEXTFX_MODES, getTextFxMode, setTextFxMode, useTextFxMode } from "./store.js";
export { ensureFont } from "./fonts.js";
export { buildCss } from "./css.js";
export { default as TextFx } from "./TextFx.jsx";
export { default as FxGallery } from "./FxGallery.jsx";
