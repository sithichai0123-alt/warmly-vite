// Background Audio — จุดเข้าเดียวที่ App.jsx นำเข้า
export { BACKGROUND_AUDIO_ENABLED } from "./config.js";
export { detectPlatform, platformNotice, planResume, pruneTries, mediaTitle } from "./logic.js";
export { registerSession } from "./store.js";
export { BackgroundAudioKeeper, BackgroundAudioPanel } from "./hooks.jsx";
