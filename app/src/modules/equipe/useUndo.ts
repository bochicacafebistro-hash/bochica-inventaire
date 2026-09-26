import { useCallback, useEffect, useRef, useState } from "react";

export interface UndoEntry {
  label: string;
  restore: () => Promise<unknown>;
}

/** Pile d'annulation en mémoire (5 dernières actions), avec Ctrl/Cmd+Z. */
export function useUndo(onDone: (msg: string, ok: boolean) => void, max = 5) {
  const stack = useRef<UndoEntry[]>([]);
  const [count, setCount] = useState(0);

  const push = useCallback(
    (e: UndoEntry) => {
      stack.current.push(e);
      if (stack.current.length > max) stack.current.shift();
      setCount(stack.current.length);
    },
    [max],
  );

  const undo = useCallback(async () => {
    const e = stack.current.pop();
    setCount(stack.current.length);
    if (!e) return onDone("Rien à annuler.", true);
    try {
      await e.restore();
      onDone(`Annulé : ${e.label}`, true);
    } catch (err) {
      stack.current.push(e);
      setCount(stack.current.length);
      onDone(`Annulation impossible : ${(err as Error).message}`, false);
    }
  }, [onDone]);

  useEffect(() => {
    const onKey = (ev: KeyboardEvent) => {
      if ((ev.ctrlKey || ev.metaKey) && !ev.shiftKey && ev.key.toLowerCase() === "z") {
        const t = ev.target as HTMLElement | null;
        if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
        ev.preventDefault();
        void undo();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [undo]);

  return { push, undo, count, last: () => stack.current[stack.current.length - 1]?.label };
}
