import { Fragment, useRef } from "react";
import { Bold, Italic, List, ListOrdered, Strikethrough } from "lucide-react";
import { parseMarkdown, type Inline } from "./mdParse";
import styles from "./Markdown.module.css";

function InlineNodes({ nodes }: { nodes: Inline[] }) {
  return (
    <>
      {nodes.map((n, i) =>
        n.t === "b" ? <strong key={i}>{n.v}</strong> : n.t === "i" ? <em key={i}>{n.v}</em> : n.t === "s" ? <del key={i}>{n.v}</del> : <Fragment key={i}>{n.v}</Fragment>,
      )}
    </>
  );
}

export function Markdown({ text, className }: { text: string; className?: string }) {
  return (
    <div className={[styles.md, className].filter(Boolean).join(" ")}>
      {parseMarkdown(text).map((b, i) =>
        b.kind === "p" ? (
          <p key={i}>
            {b.lines.map((l, j) => (
              <Fragment key={j}>
                {j > 0 && <br />}
                <InlineNodes nodes={l} />
              </Fragment>
            ))}
          </p>
        ) : b.kind === "ul" ? (
          <ul key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <InlineNodes nodes={it} />
              </li>
            ))}
          </ul>
        ) : (
          <ol key={i}>
            {b.items.map((it, j) => (
              <li key={j}>
                <InlineNodes nodes={it} />
              </li>
            ))}
          </ol>
        ),
      )}
    </div>
  );
}

/** Zone de texte avec barre gras / italique / barré / listes + Ctrl/Cmd+B, Ctrl/Cmd+I. */
export function MarkdownEditor({
  label,
  value,
  onChange,
  hint,
  rows = 6,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  hint?: string;
  rows?: number;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  function wrap(before: string, after = before) {
    const el = ref.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const sel = value.slice(s, e) || "texte";
    onChange(value.slice(0, s) + before + sel + after + value.slice(e));
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(s + before.length, s + before.length + sel.length);
    });
  }

  function prefix(p: string) {
    const el = ref.current;
    if (!el) return;
    const s = value.lastIndexOf("\n", el.selectionStart - 1) + 1;
    const eIdx = value.indexOf("\n", el.selectionEnd);
    const e = eIdx < 0 ? value.length : eIdx;
    const block = value
      .slice(s, e)
      .split("\n")
      .map((l, i) => (l.trim() ? (p === "1. " ? `${i + 1}. ` : p) + l.replace(/^\s*([-*•]|\d+\.)\s+/, "") : l))
      .join("\n");
    onChange(value.slice(0, s) + block + value.slice(e));
    requestAnimationFrame(() => el.focus());
  }

  return (
    <div className={styles.editor}>
      <div className={styles.editorHead}>
        <span className={styles.label}>{label}</span>
        <div className={styles.toolbar} role="toolbar" aria-label={`Mise en forme — ${label}`}>
          <button type="button" onClick={() => wrap("**")} aria-label="Gras" title="Gras (Ctrl+B)">
            <Bold size={14} />
          </button>
          <button type="button" onClick={() => wrap("*")} aria-label="Italique" title="Italique (Ctrl+I)">
            <Italic size={14} />
          </button>
          <button type="button" onClick={() => wrap("~~")} aria-label="Barré" title="Barré">
            <Strikethrough size={14} />
          </button>
          <button type="button" onClick={() => prefix("- ")} aria-label="Liste à puces" title="Liste à puces">
            <List size={14} />
          </button>
          <button type="button" onClick={() => prefix("1. ")} aria-label="Liste numérotée" title="Liste numérotée">
            <ListOrdered size={14} />
          </button>
        </div>
      </div>
      <textarea
        ref={ref}
        className={styles.textarea}
        value={value}
        rows={rows}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
            e.preventDefault();
            wrap("**");
          } else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "i") {
            e.preventDefault();
            wrap("*");
          }
        }}
      />
      {hint && <div className={styles.hint}>{hint}</div>}
    </div>
  );
}
