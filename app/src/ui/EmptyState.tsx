import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";

export function EmptyState({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children?: ReactNode }) {
  return (
    <div
      style={{
        display: "grid",
        justifyItems: "center",
        gap: "var(--sp-2)",
        padding: "var(--sp-8) var(--sp-4)",
        textAlign: "center",
        color: "var(--text2)",
        border: "1px dashed var(--border-strong)",
        borderRadius: "var(--radius-lg)",
      }}
    >
      <Icon size={32} style={{ color: "var(--text3)" }} aria-hidden />
      <div style={{ fontWeight: 700, color: "var(--text)" }}>{title}</div>
      {children}
    </div>
  );
}
