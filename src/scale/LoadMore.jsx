// Scale — ปุ่ม "ดูโพสต์เก่ากว่า" ท้ายฟีด
import React from "react";

export default function LoadMore({ onClick, T }) {
  return (
    <div style={{ textAlign: "center", padding: "6px 0 18px" }}>
      <button data-feed-more onClick={onClick}
        style={{ background: "transparent", border: "1px solid " + T.borderHi, color: T.brand2, borderRadius: 14, padding: "10px 22px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "inherit" }}>
        ⬇️ ดูโพสต์เก่ากว่า
      </button>
    </div>
  );
}
