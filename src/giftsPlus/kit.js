// Gifts Plus — เครื่องมือกลางของโมเดล 3D (วัสดุ, อนุภาค, แสงเรือง, สุ่มแบบกำหนดผลได้)

export const mat = (T, c, o = {}) => new T.MeshStandardMaterial({ color: c, roughness: .45, metalness: .1, ...o });
export const glow = (T, c, o = {}) => new T.MeshBasicMaterial({ color: c, transparent: true, depthWrite: false, blending: T.AdditiveBlending, ...o });
export const sph = (T, r, m, w = 16, h = 12) => new T.Mesh(new T.SphereGeometry(r, w, h), m);
export const clamp01 = x => Math.max(0, Math.min(1, x));
export const fract = x => x - Math.floor(x);
// สุ่มแบบกำหนดผลได้ (โมเดลหน้าตาเหมือนกันทุกครั้ง และเทสต์ซ้ำได้)
export function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }

export function dotTexture(T) {
  if (typeof document === "undefined") return null;
  const cv = document.createElement("canvas"); cv.width = cv.height = 32;
  const cx = cv.getContext("2d"); if (!cx) return null;
  const gr = cx.createRadialGradient(16, 16, 0, 16, 16, 16);
  gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(.45, "rgba(255,255,255,.55)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  cx.fillStyle = gr; cx.fillRect(0, 0, 32, 32);
  return new T.CanvasTexture(cv);
}
// กลุ่มอนุภาคแสง (Points) — ตำแหน่ง/สีเขียนทับได้ทุกเฟรม
export function cloud(T, n, size, color, opts = {}) {
  const pos = new Float32Array(n * 3), col = opts.vertexColors ? new Float32Array(n * 3).fill(1) : null;
  const geo = new T.BufferGeometry();
  geo.setAttribute("position", new T.BufferAttribute(pos, 3));
  if (col) geo.setAttribute("color", new T.BufferAttribute(col, 3));
  const m = new T.PointsMaterial({ size, color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, vertexColors: !!col, map: dotTexture(T), opacity: opts.opacity == null ? 1 : opts.opacity });
  const pts = new T.Points(geo, m); pts.frustumCulled = false;
  return { pts, pos, col, geo, m, n };
}
// แสงเรืองแบบนุ่ม (บิลบอร์ดไล่สีรัศมี) — ใช้แทนจานวงกลมทึบ
export function halo(T, color, size, op) {
  const s = new T.Sprite(new T.SpriteMaterial({ map: dotTexture(T), color, transparent: true, depthWrite: false, blending: T.AdditiveBlending, opacity: op }));
  s.scale.set(size, size, 1); return s;
}
export function ringMesh(T, r0, r1, color, op) {
  const m = new T.Mesh(new T.RingGeometry(r0, r1, 48), glow(T, color, { opacity: op, side: T.DoubleSide }));
  m.rotation.x = -Math.PI / 2; return m;
}

