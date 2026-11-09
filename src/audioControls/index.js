// Audio Controls — จุดเข้าเดียวที่ App.jsx นำเข้า
export { AUDIO_CONTROLS_ENABLED, MIC_GAIN_MAX } from "./config.js";
export { useAudioPrefs, getAudioPrefs, setMicGain, setMusicVolume, setMusicMuted } from "./store.js";
export { createMicGainController, createGainProcessor } from "./micGain.js";
export { applyYtVolume, applyYtVolumeWhenReady, isIOS } from "./ytVolume.js";
export { default as AudioControls } from "./AudioControls.jsx";
