// Voice Token — ฝั่งแอป: แนบบัตรผ่าน (Firebase ID token) ไปกับคำขอโทเคน
//   ไม่มีบัญชี/ขอบัตรไม่ได้ → ส่งคำขอแบบไม่แนบ ให้เซิร์ฟเวอร์ตัดสิน (จะตอบ 401 พร้อมข้อความที่อ่านรู้เรื่อง)
export function makeAuthedFetch({ getIdToken, fetchFn }) {
  return async (url, init = {}) => {
    let token = null;
    try { token = await getIdToken(); } catch (e) { /* ไม่มีบัญชี */ }
    const headers = { ...(init.headers || {}) };
    if (token) headers.Authorization = "Bearer " + token;
    return fetchFn(url, { ...init, headers });
  };
}
