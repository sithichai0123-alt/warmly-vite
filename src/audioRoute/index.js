// Audio Route — จุดเข้าเดียวที่ App.jsx นำเข้า
export { AUDIO_ROUTE_ENABLED } from "./config.js";
export { audioRoute, canChooseOutput, reviveRemoteAudio } from "./router.js";
export { useRouteState, setRoutePref, getRouteState, getSpeakerMode, setSpeakerMode } from "./store.js";
export { isBluetoothLabel, pickAutoOutput, pairedInput, decideOutput, describeOutputs } from "./logic.js";
