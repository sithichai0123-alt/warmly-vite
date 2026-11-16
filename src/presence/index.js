// Presence — จุดเข้าเดียวที่ App.jsx นำเข้า
export { PRESENCE_ENABLED, DOT_MIN_SIZE, HEARTBEAT_MS, STALE_MS, PRESENCE_WINDOW_ENABLED, PRESENCE_WINDOW_MS } from "./config.js";
export { computeStatus, formatLastSeen, statusLabel, buildPresenceWrite, windowStart, countOnline } from "./logic.js";
export { makePresenceApi } from "./api.js";
export { createPresenceController } from "./controller.js";
export { getPresencePrefs, setPresencePrefs, usePresencePrefs } from "./store.js";
export { PresenceProvider, PresenceDot, PresenceText, usePresence, usePresenceEnabled, useIsOnline, useOnlineCount } from "./PresenceProvider.jsx";
