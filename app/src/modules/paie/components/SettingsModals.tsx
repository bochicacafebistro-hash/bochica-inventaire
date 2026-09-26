import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { normalizeTime } from "@/core/time";
import { TimeField } from "@/modules/equipe/components/TimeField";
import { Button } from "@/ui/Button";
import { TextField } from "@/ui/Field";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import h from "@/modules/equipe/Horaire.module.css";
import { DEFAULT_SHARES, normalizeWindows } from "../paie.logic";
import type { PayrollSettings, ServiceWindow } from "../paie.types";
import styles from "../Paie.module.css";

const DAYS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

function Footer({ onClose, onSave, busy, label = "Enregistrer", danger, disabled }: { onClose: () => void; onSave: () => void; busy: boolean; label?: string; danger?: boolean; disabled?: boolean }) {
  return (
    <>
      <span style={{ flex: 1 }} />
      <Button variant="secondary" onClick={onClose}>
        Annuler
      </Button>
      <Button variant={danger ? "danger" : "primary"} onClick={onSave} disabled={busy || disabled}>
        {busy ? "Enregistrement…" : label}
      </Button>
    </>
  );
}

/** Heures de service par jour (une ou plusieurs plages : service coupé). */
export function ServiceHoursModal({ settings, openDays, onClose, onSave }: { settings: PayrollSettings | null; openDays: number[]; onClose: () => void; onSave: (d: Record<number, ServiceWindow[]>) => Promise<void> }) {
  const [draft, setDraft] = useState<Record<number, ServiceWindow[]>>(() => Object.fromEntries(DAYS.map((_, i) => [i, normalizeWindows(settings?.defaultServiceHours?.[i])])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (i: number, list: ServiceWindow[]) => (setDraft((d) => ({ ...d, [i]: list })), setError(null));

  async function save() {
    const clean: Record<number, ServiceWindow[]> = {};
    for (const [i, list] of Object.entries(draft)) {
      const out: ServiceWindow[] = [];
      for (const w of list) {
        if (!w.start && !w.end) continue;
        const s = normalizeTime(w.start);
        const e = normalizeTime(w.end);
        if (!s || !e) return setError(`${DAYS[Number(i)]} : plage incomplète ou heure invalide.`);
        out.push({ start: s, end: e });
      }
      clean[Number(i)] = out;
    }
    setBusy(true);
    try {
      await onSave(clean);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal open title="Heures de service" onClose={onClose} width={620} footer={<Footer onClose={onClose} onSave={() => void save()} busy={busy} />}>
      <p className={h.hint} style={{ marginTop: 0 }}>
        Seules les heures travaillées <strong>pendant ces plages</strong> donnent droit aux pourboires. Ajoute une 2ᵉ plage pour un service coupé (ex. midi et soir). Aucune plage = pas de pourboire ce jour-là.
      </p>
      <div className={styles.svcList}>
        {DAYS.map((label, i) => (
          <div key={i} className={styles.svcDay}>
            <div className={styles.svcDayHead}>
              <strong>{label}</strong>
              {!openDays.includes(i) && <span className={h.archivedTag}>fermé</span>}
              <span style={{ flex: 1 }} />
              <button className={h.pillBtn} onClick={() => set(i, [...draft[i]!, { start: "", end: "" }])}>
                <Plus size={12} aria-hidden /> Plage
              </button>
            </div>
            {draft[i]!.length === 0 && <span className={h.hint}>Aucune plage</span>}
            {draft[i]!.map((w, k) => (
              <div key={k} className={styles.svcRow}>
                <TimeField label="Début" value={w.start} onChange={(v) => set(i, draft[i]!.map((x, j) => (j === k ? { ...x, start: v } : x)))} />
                <TimeField label="Fin" value={w.end} onChange={(v) => set(i, draft[i]!.map((x, j) => (j === k ? { ...x, end: v } : x)))} />
                <button className={h.iconBtn} onClick={() => set(i, draft[i]!.filter((_, j) => j !== k))} aria-label={`Retirer la plage ${k + 1} du ${label}`}>
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
      {error && (
        <p className={h.errBox} role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}

/** Répartition des pourboires entre la cuisine et le service (somme = 100 %). */
export function TipSharesModal({ settings, onClose, onSave }: { settings: PayrollSettings | null; onClose: () => void; onSave: (cuisinePct: number) => Promise<void> }) {
  const cur = settings?.tipShares ?? DEFAULT_SHARES;
  const [k, setK] = useState(String(Math.round(Number(cur.cuisine ?? 0.25) * 100)));
  const [busy, setBusy] = useState(false);
  const n = Number(k);
  const bad = k === "" || Number.isNaN(n) || n < 0 || n > 100;
  return (
    <Modal
      open
      title="Répartition des pourboires"
      onClose={onClose}
      width={440}
      footer={
        <Footer
          onClose={onClose}
          busy={busy}
          disabled={bad}
          onSave={async () => {
            setBusy(true);
            try {
              await onSave(n);
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <p className={h.hint} style={{ marginTop: 0 }}>
        Chaque jour, les pourboires sont séparés en deux pools selon la section de l'employé. La somme fait toujours 100 %.
      </p>
      <div className={h.row2}>
        <TextField label="Pool Cuisine (%)" type="number" min={0} max={100} step={1} value={k} onChange={(e) => setK(e.target.value)} error={bad ? "Entre 0 et 100" : null} autoFocus />
        <TextField label="Pool Service + Autre (%)" type="number" min={0} max={100} step={1} value={bad ? "" : String(100 - n)} onChange={(e) => setK(String(100 - Number(e.target.value || 0)))} />
      </div>
    </Modal>
  );
}

/** Extra de la semaine (remplaçant, dépannage) : n'apparaît pas dans Employés & Horaires. */
export function ExtraModal({ onClose, onSave }: { onClose: () => void; onSave: (x: { name: string; section: string; hourlyRate: number }) => Promise<void> }) {
  const [name, setName] = useState("");
  const [section, setSection] = useState("service");
  const [rate, setRate] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  async function save() {
    const r = Number(rate.replace(",", "."));
    if (!name.trim()) return setError("Donne un nom à l'extra.");
    if (rate === "" || Number.isNaN(r) || r < 0) return setError("Le taux horaire doit être un nombre positif.");
    setBusy(true);
    try {
      await onSave({ name: name.trim(), section, hourlyRate: r });
    } finally {
      setBusy(false);
    }
  }
  return (
    <Modal open title="Ajouter un extra à la semaine" onClose={onClose} width={460} footer={<Footer onClose={onClose} onSave={() => void save()} busy={busy} label="Ajouter" />}>
      <div style={{ display: "grid", gap: "var(--sp-4)" }}>
        <p className={h.hint} style={{ margin: 0 }}>
          Pour un remplaçant ou un extra de soirée : il existe <strong>seulement pour cette semaine de paie</strong> et n'apparaît pas dans Employés & Horaires.
        </p>
        <TextField label="Nom" required value={name} onChange={(e) => (setName(e.target.value), setError(null))} placeholder="Ex. Sophie Martin" autoFocus />
        <SelectField
          label="Section"
          value={section}
          onChange={(e) => setSection(e.target.value)}
          options={[
            { value: "service", label: "Service (pool service)" },
            { value: "cuisine", label: "Cuisine (pool cuisine)" },
            { value: "other", label: "Autre / Admin (pool service)" },
          ]}
        />
        <TextField label="Taux horaire ($/h)" required inputMode="decimal" value={rate} onChange={(e) => (setRate(e.target.value), setError(null))} placeholder="ex. 17,50" />
        {error && (
          <p className={h.errBox} role="alert">
            {error}
          </p>
        )}
      </div>
    </Modal>
  );
}

/** Effacer toutes les saisies de la semaine : il faut taper EFFACER. */
export function ResetWeekModal({ weekNum, counts, onClose, onConfirm }: { weekNum: number; counts: { shifts: number; tips: number; net: number }; onClose: () => void; onConfirm: () => Promise<void> }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const parts = [counts.shifts && `${counts.shifts} saisie(s) d'heures`, counts.tips && `${counts.tips} jour(s) de pourboires`, counts.net && `${counts.net} jour(s) de ventes nettes`].filter(Boolean);
  return (
    <Modal
      open
      title={`Effacer la semaine ${weekNum} ?`}
      onClose={onClose}
      width={480}
      footer={
        <Footer
          onClose={onClose}
          busy={busy}
          danger
          label={`Effacer la semaine ${weekNum}`}
          disabled={text.trim().toUpperCase() !== "EFFACER"}
          onSave={async () => {
            setBusy(true);
            try {
              await onConfirm();
            } finally {
              setBusy(false);
            }
          }}
        />
      }
    >
      <p className={h.errBox} style={{ marginTop: 0 }}>
        Cela efface définitivement {parts.join(", ")}. Les heures pointées par les employés seront <strong>perdues</strong>.
      </p>
      <TextField label="Pour confirmer, tape EFFACER" value={text} onChange={(e) => setText(e.target.value)} autoComplete="off" autoCapitalize="characters" autoFocus className={styles.mono} />
    </Modal>
  );
}
