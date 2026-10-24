// Vercel Serverless Function — สร้าง LiveKit token สำหรับเข้าห้องเสียง
import { AccessToken } from "livekit-server-sdk";

export default async function handler(req, res) {
  const { room, identity, name } = req.query;
  if (!room || !identity) {
    return res.status(400).json({ error: "room and identity required" });
  }
  const { LIVEKIT_API_KEY, LIVEKIT_API_SECRET, LIVEKIT_URL } = process.env;
  if (!LIVEKIT_API_KEY || !LIVEKIT_API_SECRET || !LIVEKIT_URL) {
    return res.status(500).json({ error: "LIVEKIT env vars missing on server" });
  }
  try {
    const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
      identity: String(identity).slice(0, 64),
      name: String(name || identity).slice(0, 64),
      ttl: "10h",
    });
    at.addGrant({
      roomJoin: true,
      room: String(room).slice(0, 128),
      canPublish: true,
      canSubscribe: true,
    });
    const token = await at.toJwt();
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ token, url: LIVEKIT_URL });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}
