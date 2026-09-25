import { useState } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
import { checkSectionName, DEFAULT_SECTIONS, fallbackSection, moveItem } from "../inventaire.logic";
import type { Product } from "../inventaire.types";
import styles from "../Inventaire.module.css";

interface Props {
  sections: string[];
  products: Product[];
  onClose: () => void;
  onSaveList: (list: string[]) => Promise<void>;
  onRename: (index: number, newName: string) => Promise<void>;
  onDelete: (name: string, fallback: string) => Promise<void>;
}

export function CategoriesModal({ sections, products, onClose, onSaveList, onRename, onDelete }: Props) {
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const count = (s: string) => products.filter((p) => !p.archived && p.section === s).length;

  async function run(fn: () => Promise<void>) {
    setBusy(true);
    try {
      await fn();
    } finally {
      setBusy(false);
    }
  }

  async function add() {
    const err = checkSectionName(newName, sections);
    setAddError(err);
    if (err) return;
    await run(() => onSaveList([...sections, newName.trim()]));
    setNewName("");
  }

  return (
    <Modal open title="Gérer les catégories" onClose={onClose} width={520}>
      <p style={{ color: "var(--text2)", fontSize: "var(--fs-sm)" }}>
        Renommer une catégorie met à jour ses produits. La supprimer déplace ses produits vers « Autre ».
      </p>

      <form
        className={styles.catAdd}
        onSubmit={(e) => {
          e.preventDefault();
          void add();
        }}
      >
        <input
          value={newName}
          onChange={(e) => {
            setNewName(e.target.value);
            setAddError(null);
          }}
          placeholder="Nouvelle catégorie…"
          aria-label="Nouvelle catégorie"
          aria-invalid={!!addError}
          autoFocus
        />
        <Button type="submit" disabled={busy || !newName.trim()}>
          <Plus size={14} aria-hidden /> Ajouter
        </Button>
      </form>
      {addError && <div style={{ color: "var(--status-red)", fontSize: "var(--fs-xs)", marginTop: -8 }}>{addError}</div>}

      <ul className={styles.catList}>
        {sections.map((s, i) => (
          <CategoryRow
            key={s}
            name={s}
            count={count(s)}
            isDefault={DEFAULT_SECTIONS.includes(s)}
            disabled={busy}
            canUp={i > 0}
            canDown={i < sections.length - 1}
            onUp={() => run(() => onSaveList(moveItem(sections, i, i - 1)))}
            onDown={() => run(() => onSaveList(moveItem(sections, i, i + 1)))}
            validate={(v) => checkSectionName(v, sections, i)}
            onRename={(v) => run(() => onRename(i, v.trim()))}
            onDelete={sections.length > 1 ? () => run(() => onDelete(s, fallbackSection(sections, s))) : undefined}
          />
        ))}
      </ul>
    </Modal>
  );
}

function CategoryRow(props: {
  name: string;
  count: number;
  isDefault: boolean;
  disabled: boolean;
  canUp: boolean;
  canDown: boolean;
  onUp: () => void;
  onDown: () => void;
  validate: (v: string) => string | null;
  onRename: (v: string) => void;
  onDelete?: () => void;
}) {
  const [value, setValue] = useState(props.name);
  const [error, setError] = useState<string | null>(null);

  function commit() {
    if (value.trim() === props.name) return setError(null);
    const err = props.validate(value);
    setError(err);
    if (err) return;
    props.onRename(value);
  }

  return (
    <li className={styles.catRow}>
      <div className={styles.catMove}>
        <button onClick={props.onUp} disabled={!props.canUp || props.disabled} aria-label={`Monter ${props.name}`}>
          <ArrowUp size={14} />
        </button>
        <button onClick={props.onDown} disabled={!props.canDown || props.disabled} aria-label={`Descendre ${props.name}`}>
          <ArrowDown size={14} />
        </button>
      </div>
      <div className={styles.catName}>
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Enter") (e.target as HTMLInputElement).blur();
            if (e.key === "Escape") {
              setValue(props.name);
              setError(null);
            }
          }}
          aria-label={`Nom de la catégorie ${props.name}`}
          aria-invalid={!!error}
          disabled={props.disabled}
        />
        {error && <div className={styles.catError}>{error}</div>}
      </div>
      <span className={styles.catCount} title="Produits actifs">
        {props.count}
      </span>
      {props.isDefault && <span className={styles.catDefault}>défaut</span>}
      {props.onDelete && (
        <button className={styles.catDelete} onClick={props.onDelete} disabled={props.disabled} aria-label={`Supprimer ${props.name}`}>
          <Trash2 size={14} />
        </button>
      )}
    </li>
  );
}
