// Admin Tools — ลบวิดีโอบน Cloudinary ผ่าน Admin API (ต้องมี API key/secret ใน Vercel)
// ลบได้เฉพาะ public_id ที่ส่งเข้ามา ครั้งละไม่เกิน 100 · เซิร์ฟเวอร์เท่านั้น (secret ห้ามอยู่ฝั่งแอป)
const CHUNK = 100;

export async function deleteVideos({ cloud, key, secret, fetchFn }, publicIds) {
  const f = fetchFn || fetch;
  const out = { requested: publicIds.length, deleted: 0, notFound: 0 };
  const auth = "Basic " + Buffer.from(key + ":" + secret).toString("base64");
  for (let i = 0; i < publicIds.length; i += CHUNK) {
    const body = new URLSearchParams();
    publicIds.slice(i, i + CHUNK).forEach(id => body.append("public_ids[]", id));
    body.set("invalidate", "true");                       // ล้างแคช CDN ด้วย ไม่ให้ลิงก์เดิมยังเล่นได้
    const r = await f("https://api.cloudinary.com/v1_1/" + encodeURIComponent(cloud) + "/resources/video/upload", {
      method: "DELETE",
      headers: { Authorization: auth, "Content-Type": "application/x-www-form-urlencoded" },
      body: body.toString(),
    });
    let j = null; try { j = await r.json(); } catch (e) { /* ไม่ใช่ JSON */ }
    if (!r.ok) throw new Error("Cloudinary ปฏิเสธคำสั่งลบ (" + r.status + ")" + (j && j.error && j.error.message ? ": " + j.error.message : ""));
    Object.values((j && j.deleted) || {}).forEach(v => { if (v === "deleted") out.deleted++; else out.notFound++; });
  }
  return out;
}
