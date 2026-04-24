interface CardProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export function Card({ children, className = "", style }: CardProps) {
  return (
    <div
      className={`rounded-xl p-4 ${className}`}
      style={{
        background: "var(--bg-card)",
        border: "1px solid var(--border)",
        ...style,
      }}
    >
      {children}
    </div>
  )
}
