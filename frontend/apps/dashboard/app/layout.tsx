"use client"
import "./globals.css"
import Providers from "../components/Providers"

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-primary text-primary">
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  )
}
