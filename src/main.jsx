import React from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";

// กันจอขาว: ถ้าแอปพังจะโชว์ข้อความ error แทน
class Boundary extends React.Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(e) {
    return { err: String(e && e.stack ? e.stack : e).slice(0, 700) };
  }
  componentDidCatch(e) { console.error("App crashed:", e); }
  reset() {
    try { localStorage.clear(); } catch (e) {}
    try { indexedDB.deleteDatabase("firebaseLocalStorageDb"); } catch (e) {}
    setTimeout(() => location.reload(), 300);
  }
  render() {
    if (!this.state.err) return this.props.children;
    return (
      <div style={{ minHeight: "100dvh", background: "#0F0E17", color: "#F0EEFF", padding: 24, fontFamily: "sans-serif" }}>
        <div style={{ fontSize: 40 }}>⚠️</div>
        <div style={{ fontSize: 18, fontWeight: 700, margin: "8px 0" }}>แอปเจอปัญหา</div>
        <div style={{ fontSize: 13, color: "#9B94C4", marginBottom: 12 }}>
          ถ่ายภาพหน้าจอนี้ส่งให้ผู้พัฒนาได้เลย
        </div>
        <pre style={{ whiteSpace: "pre-wrap", wordBreak: "break-word", fontSize: 11, background: "#1A1825", padding: 12, borderRadius: 10, color: "#F43F5E" }}>
          {this.state.err}
        </pre>
        <button onClick={() => this.reset()} style={{ marginTop: 14, padding: "10px 18px", borderRadius: 12, border: "none", background: "#7C5CFC", color: "#fff", fontWeight: 700, fontSize: 14 }}>
          ล้างข้อมูลแล้วเริ่มใหม่
        </button>
      </div>
    );
  }
}

createRoot(document.getElementById("root")).render(
  <Boundary>
    <App />
  </Boundary>
);
