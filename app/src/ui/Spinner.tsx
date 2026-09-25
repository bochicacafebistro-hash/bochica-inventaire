import { LoaderCircle } from "lucide-react";

export function Spinner({ label = "Chargement…" }: { label?: string }) {
  return (
    <div role="status" style={{ display: "grid", placeItems: "center", padding: "var(--sp-8)", color: "var(--text3)" }}>
      <LoaderCircle size={28} style={{ animation: "spin 0.9s linear infinite" }} aria-hidden />
      <span className="visually-hidden">{label}</span>
      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
    </div>
  );
}
