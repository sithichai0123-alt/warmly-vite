// Voice Saver — แถบเล็กตอนพักเสียงห้องอัตโนมัติ (ผู้ฟังแตะเพื่อฟังสดได้ทันที)
import React from "react";

export default function ResumeChip({ onResume, T }) {
  return (
    <div data-voice-paused onClick={onResume} role="button"
      style={{ margin: "0 0 10px", padding: "8px 12px", borderRadius: 12, cursor: "pointer",
        background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.35)", color: T.yellow,
        fontSize: 12, fontWeight: 700, lineHeight: 1.5, display: "flex", alignItems: "center", gap: 8 }}>
      <span style={{ fontSize: 16 }}>💤</span>
      <span>พักเสียงห้องชั่วคราวเพื่อประหยัด (ห้องกำลังเงียบ) · เพลงยังเล่นอยู่ — แตะเพื่อฟังสด</span>
    </div>
  );
}
