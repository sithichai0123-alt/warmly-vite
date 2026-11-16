// AI Content — ตรรกะล้วน (ไม่แตะ Firebase/เครือข่าย) จึงทดสอบได้ง่าย

// ตัด ```json ... ``` หรือข้อความเกินรอบ ๆ ออก แล้ว parse เอาแค่ {content, posterLines, topic}
// คำตอบไม่ใช่ JSON ที่ใช้ได้ / content ว่าง → คืน null (ผู้เรียกต้องไม่เขียนอะไรต่อ)
export function parseAiReply(text) {
  if (typeof text !== "string") return null;
  const m = text.match(/\{[\s\S]*\}/);
  if (!m) return null;
  let obj;
  try { obj = JSON.parse(m[0]); } catch (e) { return null; }
  if (!obj || typeof obj !== "object") return null;
  const content = typeof obj.content === "string" ? obj.content.trim() : "";
  if (!content) return null;
  const topic = typeof obj.topic === "string" ? obj.topic.trim().slice(0, 120) : "";
  const posterLines = Array.isArray(obj.posterLines)
    ? obj.posterLines.map(l => String(l || "").trim()).filter(Boolean).slice(0, 5).map(l => l.slice(0, 40))
    : [];
  return { content: content.slice(0, 1200), topic, posterLines };
}

// สำรองไว้เผื่อ AI ไม่ได้ให้ posterLines มา — ตัดบรรทัดแบบหยาบๆ ตามความยาวตัวอักษร (ภาษาไทยไม่มีช่องว่างระหว่างคำเสมอไป)
export function fallbackPosterLines(content, maxCharsPerLine = 14) {
  const text = String(content || "").trim();
  const lines = [];
  let i = 0;
  while (i < text.length && lines.length < 5) {
    let end = Math.min(i + maxCharsPerLine, text.length);
    if (end < text.length) {
      const sp = text.lastIndexOf(" ", end);
      if (sp > i + maxCharsPerLine * 0.4) end = sp;
    }
    const line = text.slice(i, end).trim();
    if (line) lines.push(line);
    i = end;
    while (text[i] === " ") i++;
  }
  return lines.length ? lines : [text.slice(0, 60)];
}

// ขนาดตัวอักษรของการ์ดโปสเตอร์ ให้พอดีกับบรรทัดที่ยาวที่สุด
export function posterFontSize(lines) {
  const longest = Math.max(...lines.map(l => l.length), 1);
  if (longest <= 8) return 58;
  if (longest <= 11) return 50;
  if (longest <= 14) return 42;
  if (longest <= 18) return 36;
  if (longest <= 24) return 30;
  return 24;
}

const escXml = s => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const POSTER_FONT_STACK = "'Kanit','Prompt','Noto Sans Thai','Segoe UI',sans-serif";

// การ์ดโปสเตอร์ (SVG, 600x600) — ข้อความสไตล์มีมตัวหนา ขอบเข้ม + มาสคอตหัมน้อยมุมล่างขวา/ป้ายมุมซ้ายบน
// mascotImage = data URI รูปมาสคอต (ส่งมาจาก AI_MASCOT_IMAGE ใน config.js เพื่อให้ไฟล์นี้ยังเป็น pure logic ไม่ import config ตรงๆ)
export function buildPosterSvg({ lines, mascotImage }) {
  const fontSize = posterFontSize(lines);
  const lineHeight = fontSize * 1.28;
  const totalH = lines.length * lineHeight;
  const startY = 280 - totalH / 2 + fontSize * 0.75;
  const textEls = lines.map((l, i) => {
    const y = startY + i * lineHeight;
    return `<text x="300" y="${y}" text-anchor="middle" font-family="${POSTER_FONT_STACK}" font-weight="900" font-size="${fontSize}" fill="#FFFFFF" stroke="#3A2E2A" stroke-width="${(fontSize * 0.1).toFixed(1)}" stroke-linejoin="round" paint-order="stroke">${escXml(l)}</text>`;
  }).join("\n  ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 600">
  <defs>
    <linearGradient id="bgGrad" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#FFE3C2"/>
      <stop offset="100%" stop-color="#D8C8FF"/>
    </linearGradient>
  </defs>
  <rect width="600" height="600" fill="url(#bgGrad)"/>
  <g transform="translate(18,18)">
    <image href="${mascotImage}" x="0" y="0" width="60" height="60"/>
    <text x="68" y="38" font-family="${POSTER_FONT_STACK}" font-weight="800" font-size="22" fill="#5B3A8C">หัมน้อย</text>
  </g>
  ${textEls}
  <image href="${mascotImage}" x="320" y="330" width="260" height="260"/>
</svg>`;
}

// สร้างเอกสาร draft ที่จะเขียนลง AI_DRAFTS_COLLECTION
export function buildDraft({ content, topic, model, now, images, mediaTypes }) {
  return {
    content, topic: topic || "",
    images: images || [], mediaTypes: mediaTypes || [],
    model: model || "", status: "pending",
    createdAt: now, reviewedAt: null, reviewedBy: null, rejectReason: null, publishedPostId: null,
  };
}

// สร้างเอกสาร post จริง (schema เดียวกับที่ NewPostBox ใช้) จาก draft ที่อนุมัติแล้ว
export function buildPublishedPost({ content, bot, now, images, mediaTypes }) {
  return {
    author: bot.name, authorInit: bot.init, authorUid: bot.uid,
    content, mood: "", privacy: "public",
    images: images || [], mediaTypes: mediaTypes || [],
    likes: 0, liked: false, likers: [], comments: [],
    createdAt: now,
  };
}

// โพสต์ตรงทันทีไหม (true) หรือรอแอดมินอนุมัติก่อน (false) — อ่านจาก env var ฝั่งเซิร์ฟเวอร์เท่านั้น
export const isAutoPublishOn = raw => raw === "1" || raw === "true";
