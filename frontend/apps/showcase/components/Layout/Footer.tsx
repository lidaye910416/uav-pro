export default function Footer() {
  return (
    <footer
      className="fixed bottom-0 left-0 right-0 z-40"
      style={{ borderTop: "1px solid var(--border)", background: "rgba(17,17,17,0.95)", backdropFilter: "blur(8px)" }}
    >
      <div className="max-w-6xl mx-auto px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="font-mono text-xs font-bold tracking-widest" style={{ color: "var(--accent-amber)" }}>
              UAV-SAFETY SYSTEM
            </div>
            <div className="h-3 w-px" style={{ background: "var(--border)" }} />
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              © 2026 无人机低空检测智能安全预警系统
            </p>
          </div>
          <div className="flex items-center gap-2 font-mono text-xs" style={{ color: "var(--text-muted)" }}>
            <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent-green)", boxShadow: "0 0 6px var(--accent-green)" }} />
            SYSTEM ONLINE
          </div>
        </div>
      </div>
    </footer>
  )
}
