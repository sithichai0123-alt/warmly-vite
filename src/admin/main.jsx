import React from "react";
import { createRoot } from "react-dom/client";
import Admin from "./Admin.jsx";

class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e) { return { err: String(e && e.stack ? e.stack : e).slice(0, 700) }; }
  componentDidCatch(e) { console.error("Admin crashed:", e); }
  render() {
    if (!this.state.err) return this.props.children;
    return <div style={{ minHeight: "100dvh", background: "#0F0E17", color: "#F0EEFF", padding: 24, fontFamily: "sans-serif" }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <div style={{ fontSize: 18, fontWeight: 700, margin: "8px 0" }}>หน้าแอดมินเจอปัญหา</div>
      <div style={{ fontSize: 13, color: "#9B94C4", marginBottom: 12 }}>แอปหลักไม่ได้รับผลกระทบ — กลับไปที่หน้าแรกได้ตามปกติ</div>
      <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, background: "#1A1825", padding: 12, borderRadius: 10, color: "#F43F5E" }}>{this.state.err}</pre>
    </div>;
  }
}
createRoot(document.getElementById("root")).render(<Boundary><Admin /></Boundary>);
