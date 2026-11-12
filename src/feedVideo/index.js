// Feed Video — จุดเข้าเดียวที่ App.jsx นำเข้า
export { FEED_VIDEO_ENABLED, MAX_VIDEO_SECONDS, TRIM_ON_UPLOAD } from "./config.js";
export { trimVideoUrl, originalVideoUrl, isTrimmed, isCloudinaryVideo, needsTrim } from "./trim.js";
export { createVideoManager, feedVideoManager } from "./manager.js";
export { frameAspect } from "./layout.js";
export { getSoundOn, setSoundOn } from "./sound.js";
export { default as FeedVideoPlayer } from "./FeedVideoPlayer.jsx";
