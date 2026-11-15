// Room Stage — จุดเข้าเดียวที่ App.jsx นำเข้า
export { ROOM_STAGE_ENABLED, STAGE_MAX, COHOST_MAX } from "./config.js";
export { keyOf, isHostOf, cohostsOf, roleOf, stageView, isOnStage, canModerate, canManageCohosts, joinEntry, takeSeat, leaveSeat, setHand, setMicAllowed, setCohost } from "./logic.js";
export { RoleBadge, StageHeader, EmptySeat, RequestsPanel, ListenerStatus } from "./StageParts.jsx";
