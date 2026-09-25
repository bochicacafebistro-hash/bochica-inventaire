/**
 * Markdown léger (même syntaxe que la v1) : **gras**, *italique*, ~~barré~~,
 * listes « - » et « 1. », paragraphes. Produit une structure de données
 * (aucun HTML brut → aucune injection possible).
 */
export type Inline = { t: "text" | "b" | "i" | "s"; v: string };
export type Block = { kind: "p"; lines: Inline[][] } | { kind: "ul" | "ol"; items: Inline[][] };

const INLINE = /\*\*([^*\n]+?)\*\*|~~([^~\n]+?)~~|\*([^*\n]+?)\*/g;

export function parseInline(s: string): Inline[] {
  const out: Inline[] = [];
  let last = 0;
  for (const m of s.matchAll(INLINE)) {
    if (m.index! > last) out.push({ t: "text", v: s.slice(last, m.index) });
    if (m[1] !== undefined) out.push({ t: "b", v: m[1] });
    else if (m[2] !== undefined) out.push({ t: "s", v: m[2] });
    else out.push({ t: "i", v: m[3]! });
    last = m.index! + m[0].length;
  }
  if (last < s.length) out.push({ t: "text", v: s.slice(last) });
  return out;
}

export function parseMarkdown(text: string): Block[] {
  const blocks: Block[] = [];
  let para: Inline[][] = [];
  const st: { list: { kind: "ul" | "ol"; items: Inline[][] } | null } = { list: null };
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", lines: para });
    para = [];
  };
  const closeList = () => {
    if (st.list) blocks.push(st.list);
    st.list = null;
  };
  for (const raw of text.split("\n")) {
    const line = raw.replace(/\s+$/, "");
    const ul = line.match(/^\s*[-*•]\s+(.*)$/);
    const ol = line.match(/^\s*\d+[.)]\s+(.*)$/);
    if (ul || ol) {
      flush();
      const kind = ul ? "ul" : "ol";
      if (st.list?.kind !== kind) {
        closeList();
        st.list = { kind, items: [] };
      }
      st.list!.items.push(parseInline((ul ?? ol)![1]!));
    } else if (!line.trim()) {
      flush();
      closeList();
    } else {
      closeList();
      para.push(parseInline(line));
    }
  }
  flush();
  closeList();
  return blocks;
}

/** Texte ancien sans aucune marque : chaque ligne devient un élément de liste (comme la v1). */
export function autoList(text: string, kind: "bullet" | "numbered"): string {
  const lines = text.split("\n").filter((l) => l.trim());
  if (!lines.length) return "";
  const hasMarks = lines.some((l) => /^\s*([-*•]|\d+\.)\s+/.test(l) || /\*\*|~~|(^|\s)\*[^*]/.test(l));
  if (hasMarks) return text;
  return lines.map((l) => (kind === "numbered" ? "1. " : "- ") + l).join("\n");
}
