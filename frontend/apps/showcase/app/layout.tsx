import type { Metadata } from "next"
import "./globals.css"
import Header from "../components/Layout/Header"

export const metadata: Metadata = {
  title: "无人机低空检测智能安全预警系统",
  description: "基于空天地一体化和生成式AI驱动的高速公路智能安全预警决策关键技术研究",
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen scan-overlay" style={{ background: "var(--bg-primary)" }}>
        <Header />
        <main style={{ position: "relative" }}>{children}</main>
      </body>
    </html>
  )
}
