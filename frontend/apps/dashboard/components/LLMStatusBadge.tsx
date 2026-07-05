"use client";
import Link from "next/link";
import { buildAdminUrl } from "@uav/api";
import { useLLMStatus } from "@uav/hooks";

/**
 * Low-key LLM Provider status pill.
 * - amber: local Ollama
 * - purple: external multi-modal LLM
 * - muted: detecting / unknown
 *
 * Clicking the pill deep-links to Admin → Settings → Provider (open in new tab
 * since dashboard/admin run on different ports).
 */
export default function LLMStatusBadge() {
  const { status } = useLLMStatus();

  const isExternal =
    !!status?.provider && status.provider !== "ollama" && status.provider !== "unknown";
  const colorVar = isExternal ? "var(--accent-purple)" : "var(--accent-amber)";
  const tooltip =
    `点击前往 Admin → Settings 切换 LLM 提供商 · ` +
    `${status?.description || "系统支持本地 Ollama 和外部多模态 LLM 两种模式"}`;

  const label = status ? status.display_name || "Unknown" : "检测中...";

  return (
    <Link
      href={buildAdminUrl("/settings?tab=provider")}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 px-2.5 py-1 rounded-full font-mono text-[11px] tracking-wide transition-all hover:brightness-110"
      style={{
        background: "rgba(16,16,16,0.7)",
        border: status ? `1px solid ${colorVar}55` : "1px solid var(--border)",
        color: status ? colorVar : "var(--text-muted)",
        boxShadow: status ? `0 0 8px ${colorVar}22` : "none",
      }}
      title={tooltip}
    >
      <span>🤖</span>
      <span>
        LLM: <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      </span>
    </Link>
  );
}