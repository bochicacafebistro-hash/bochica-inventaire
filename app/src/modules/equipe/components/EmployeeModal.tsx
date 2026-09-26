import { useState, type FormEvent } from "react";
import { Trash2 } from "lucide-react";
import { isoToDate, todayISO } from "@/core/dates";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { fmtMoney } from "@/ui/format";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import type { Employee, PaidEmployee, RateStep } from "../equipe.types";
import { normalizeRateHistory, pinError } from "../horaire.logic";
import styles from "../Horaire.module.css";

export interface EmployeeSave {
  pub: { name: string; role: string; section: string; phone: string; email: string; pin: string; noTips: boolean; notes: string };
  rate: number;
  rateFrom: string;
  isSalaried: boolean;
  fixedWeeklyHours: number;
}

const longDate = (iso: string) => isoToDate(iso)?.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" }) ?? iso;

/** Fiche employé. La rémunération est enregistrée à part (/employeesComp, admin seulement). */
export function EmployeeModal({
  emp,
  all,
  onClose,
  onSave,
  onRemoveRate,
}: {
  emp: PaidEmployee | null;
  all: Employee[];
  onClose: () => void;
  onSave: (s: EmployeeSave) => Promise<void>;
  onRemoveRate: (emp: PaidEmployee, from: string) => Promise<void>;
}) {
  const [f, setF] = useState({
    name: emp?.name ?? "",
    role: emp?.role ?? "",
    section: emp?.section === "cuisine" ? "cuisine" : emp?.section && emp.section !== "service" ? "other" : "service",
    phone: emp?.phone ?? "",
    email: emp?.email ?? "",
    pin: emp?.pin != null ? String(emp.pin) : "",
    noTips: !!emp?.noTips,
    notes: emp?.notes ?? "",
    rate: emp?.hourlyRate ? String(emp.hourlyRate) : "",
    rateFrom: todayISO(),
    isSalaried: !!emp?.isSalaried,
    fixedWeeklyHours: emp?.fixedWeeklyHours ? String(emp.fixedWeeklyHours) : "",
  });
  const [errors, setErrors] = useState<{ name?: string; pin?: string }>({});
  const [saving, setSaving] = useState(false);
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }));
  const history: RateStep[] = normalizeRateHistory(emp?.rateHistory);
  const today = todayISO();

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = { name: f.name.trim() ? undefined : "Le nom est obligatoire.", pin: pinError(f.pin.trim(), all, emp?.id) ?? undefined };
    setErrors(errs);
    if (errs.name || errs.pin) return;
    setSaving(true);
    try {
      await onSave({
        pub: { name: f.name.trim(), role: f.role.trim(), section: f.section, phone: f.phone.trim(), email: f.email.trim(), pin: f.pin.trim(), noTips: f.noTips, notes: f.notes },
        rate: Math.max(0, Number(f.rate) || 0),
        rateFrom: f.rateFrom || today,
        isSalaried: f.isSalaried,
        fixedWeeklyHours: Number(f.fixedWeeklyHours) || 0,
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={emp ? `Modifier — ${emp.name}` : "Nouvel employé"}
      onClose={onClose}
      width={600}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button type="submit" form="emp-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="emp-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        <div className={styles.row2}>
          <TextField label="Nom" required value={f.name} onChange={(e) => set({ name: e.target.value })} error={errors.name} autoFocus />
          <TextField label="Poste" value={f.role} onChange={(e) => set({ role: e.target.value })} placeholder="Serveuse, cuisinier, gérant…" />
        </div>
        <div className={styles.row2}>
          <SelectField
            label="Section"
            value={f.section}
            onChange={(e) => set({ section: e.target.value })}
            options={[
              { value: "service", label: "Service" },
              { value: "cuisine", label: "Cuisine" },
              { value: "other", label: "Autre" },
            ]}
          />
          <TextField label="NIP (4 chiffres)" inputMode="numeric" maxLength={4} value={f.pin} onChange={(e) => set({ pin: e.target.value.replace(/\D/g, "") })} error={errors.pin} hint="Pour le pointage et les demandes de congé. Unique." />
        </div>
        <label className={styles.checkLine}>
          <input type="checkbox" checked={f.noTips} onChange={(e) => set({ noTips: e.target.checked })} /> Sans pourboire (exclu du partage — ex. gérant, propriétaire)
        </label>
        <div className={styles.row2}>
          <TextField label="Téléphone" type="tel" value={f.phone} onChange={(e) => set({ phone: e.target.value })} />
          <TextField label="Courriel" type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} />
        </div>

        <fieldset className={styles.payBox}>
          <legend>Rémunération (visible par l'admin seulement)</legend>
          <div className={styles.row2}>
            <TextField label="Taux horaire ($/h)" type="number" min={0} step="0.25" inputMode="decimal" value={f.rate} onChange={(e) => set({ rate: e.target.value })} placeholder="ex. 17,50" />
            <TextField label="En vigueur à partir du" type="date" value={f.rateFrom} onChange={(e) => set({ rateFrom: e.target.value })} />
          </div>
          <p className={styles.hint}>Un nouveau taux s'applique aux semaines à partir de cette date ; les semaines d'avant gardent l'ancien taux.</p>
          {history.length > 1 && (
            <div className={styles.rateHist}>
              <div className={styles.hintStrong}>Historique des taux</div>
              {[...history].reverse().map((h) => (
                <div key={h.from} className={styles.rateRow}>
                  <span className={styles.strong}>{fmtMoney(h.rate)}/h</span>
                  <span className={styles.hint}>
                    à partir du {longDate(h.from)}
                    {h.from > today ? " · à venir" : ""}
                  </span>
                  <button type="button" className={styles.iconBtn} onClick={() => emp && void onRemoveRate(emp, h.from)} aria-label={`Retirer le palier du ${longDate(h.from)}`}>
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <label className={styles.checkLine}>
            <input type="checkbox" checked={f.isSalaried} onChange={(e) => set({ isSalaried: e.target.checked })} /> Salarié (montant fixe par semaine)
          </label>
          {f.isSalaried && (
            <TextField
              label="Heures fixes par semaine"
              type="number"
              min={0}
              step="0.5"
              value={f.fixedWeeklyHours}
              onChange={(e) => set({ fixedWeeklyHours: e.target.value })}
              hint={`Salaire hebdo = heures fixes × taux${Number(f.fixedWeeklyHours) && Number(f.rate) ? ` = ${fmtMoney(Number(f.fixedWeeklyHours) * Number(f.rate))}` : ""}, réparti sur les jours d'ouverture.`}
            />
          )}
        </fieldset>
        <TextArea label="Notes" rows={2} value={f.notes} onChange={(e) => set({ notes: e.target.value })} />
      </form>
    </Modal>
  );
}
