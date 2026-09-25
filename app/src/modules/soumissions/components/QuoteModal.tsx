import { useMemo, useState, type FormEvent } from "react";
import { FileDown, Plus, Trash2 } from "lucide-react";
import { Button } from "@/ui/Button";
import { TextArea, TextField } from "@/ui/Field";
import { fmtMoney } from "@/ui/format";
import { Modal } from "@/ui/Modal";
import { SelectField } from "@/ui/Select";
import {
  accentHex,
  draftToOption,
  newKey,
  newOptionDraft,
  newRoomDraft,
  optionLetter,
  optionTotals,
  QUOTE_STATUSES,
  QUOTE_VENUES,
  roomTotals,
  toDraft,
  toFields,
  validateQuote,
  type OptionDraft,
  type QuoteDraft,
  type QuoteErrors,
  type RoomDraft,
} from "../soumissions.logic";
import type { Quote, QuoteTemplate } from "../soumissions.types";
import styles from "../Soumissions.module.css";

interface Props {
  quote: Quote | null;
  templates: QuoteTemplate[];
  onClose: () => void;
  onSave: (fields: ReturnType<typeof toFields>) => Promise<void>;
  onPdf?: () => void;
}

export function QuoteModal({ quote, templates, onClose, onSave, onPdf }: Props) {
  const [d, setD] = useState<QuoteDraft>(() => toDraft(quote, templates));
  const [errors, setErrors] = useState<QuoteErrors>({});
  const [saving, setSaving] = useState(false);
  const set = (k: keyof QuoteDraft) => (e: { target: { value: string } }) => setD((x) => ({ ...x, [k]: e.target.value }));
  const setOpt = (key: string, patch: Partial<OptionDraft>) =>
    setD((x) => ({ ...x, options: x.options.map((o) => (o.key === key ? { ...o, ...patch } : o)) }));
  const setRoom = (key: string, patch: Partial<RoomDraft>) =>
    setD((x) => ({ ...x, rooms: x.rooms.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
  const guests = Math.max(0, Math.floor(Number(d.guestCount) || 0));

  async function submit(e: FormEvent) {
    e.preventDefault();
    const errs = validateQuote(d, templates);
    setErrors(errs);
    if (Object.keys(errs).length) return;
    setSaving(true);
    try {
      await onSave(toFields(d, templates));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open
      title={quote ? `Soumission ${quote.quoteNumber ?? ""}` : "Nouvelle soumission"}
      onClose={onClose}
      width={820}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          {onPdf && (
            <Button variant="secondary" onClick={onPdf}>
              <FileDown size={16} aria-hidden /> PDF
            </Button>
          )}
          <Button type="submit" form="quote-form" disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <form id="quote-form" onSubmit={submit} noValidate style={{ display: "grid", gap: "var(--sp-4)" }}>
        <h3 className={styles.section}>Client</h3>
        <div className={styles.row}>
          <TextField label="Nom du client" required value={d.clientName} onChange={set("clientName")} error={errors.clientName} autoFocus />
          <TextField label="Entreprise" value={d.clientCompany} onChange={set("clientCompany")} />
        </div>
        <div className={styles.row}>
          <TextField label="Téléphone" type="tel" value={d.clientPhone} onChange={set("clientPhone")} />
          <TextField label="Courriel" type="email" value={d.clientEmail} onChange={set("clientEmail")} error={errors.clientEmail} />
        </div>

        <h3 className={styles.section}>Événement</h3>
        <div className={styles.row}>
          <TextField label="Date" type="date" value={d.eventDate} onChange={set("eventDate")} />
          <TextField label="Heure" type="time" value={d.eventTime} onChange={set("eventTime")} />
          <TextField label="Nombre de personnes" required type="number" min={1} step={1} value={d.guestCount} onChange={set("guestCount")} error={errors.guestCount} />
        </div>
        <div className={styles.row}>
          <SelectField label="Lieu" value={d.eventVenue} onChange={set("eventVenue")} options={QUOTE_VENUES.map((v) => ({ value: v.key, label: v.label }))} />
          <TextField label="Adresse / précisions" value={d.eventAddress} onChange={set("eventAddress")} />
        </div>

        <h3 className={styles.section}>
          Options de forfait <span className={styles.sectionHint}>le client choisit celle qui lui convient</span>
        </h3>
        {d.options.map((o, idx) => (
          <OptionEditor
            key={o.key}
            o={o}
            idx={idx}
            templates={templates}
            guests={guests}
            canRemove={d.options.length > 1 || d.rooms.length > 0}
            onChange={(p) => setOpt(o.key, p)}
            onRemove={() => setD((x) => ({ ...x, options: x.options.filter((y) => y.key !== o.key) }))}
          />
        ))}
        <div>
          <Button variant="secondary" onClick={() => setD((x) => ({ ...x, options: [...x.options, newOptionDraft(templates[0])] }))} disabled={!templates.length}>
            <Plus size={14} aria-hidden /> Ajouter une option de forfait
          </Button>
        </div>

        <h3 className={styles.section}>
          Location de salle <span className={styles.sectionHint}>optionnel · prix avant taxes</span>
        </h3>
        {d.rooms.map((r) => {
          const t = roomTotals({ ...r, id: r.key, price: Number(r.price) || 0 });
          return (
            <div key={r.key} className={styles.roomRow}>
              <input type="date" value={r.date} onChange={(e) => setRoom(r.key, { date: e.target.value })} aria-label="Date de location" />
              <input type="time" value={r.startTime} onChange={(e) => setRoom(r.key, { startTime: e.target.value })} aria-label="Début" />
              <input type="time" value={r.endTime} onChange={(e) => setRoom(r.key, { endTime: e.target.value })} aria-label="Fin" />
              <input value={r.description} onChange={(e) => setRoom(r.key, { description: e.target.value })} placeholder="Description" aria-label="Description" />
              <input
                type="number"
                min={0}
                step="0.01"
                value={r.price}
                onChange={(e) => setRoom(r.key, { price: e.target.value })}
                placeholder="Prix ($)"
                aria-label="Prix avant taxes"
                title={`Total taxes incluses : ${fmtMoney(t.total)}`}
              />
              <button type="button" className={styles.iconBtn} onClick={() => setD((x) => ({ ...x, rooms: x.rooms.filter((y) => y.key !== r.key) }))} aria-label="Retirer cette salle">
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
        <div>
          <Button variant="secondary" onClick={() => setD((x) => ({ ...x, rooms: [...x.rooms, newRoomDraft()] }))}>
            <Plus size={14} aria-hidden /> Ajouter une option de salle
          </Button>
        </div>

        <h3 className={styles.section}>Validité et notes</h3>
        <div className={styles.row}>
          <TextField label="Valide jusqu'au" type="date" value={d.validUntil} onChange={set("validUntil")} />
          <SelectField label="Statut" value={d.status} onChange={set("status")} options={QUOTE_STATUSES.map((s) => ({ value: s.key, label: s.label }))} />
        </div>
        <TextArea label="Notes / conditions" value={d.notes} onChange={set("notes")} placeholder="Allergies, demandes particulières, conditions de paiement…" />
        {errors.options && (
          <div className={styles.formError} role="alert">
            {errors.options}
          </div>
        )}
      </form>
    </Modal>
  );
}

function OptionEditor({
  o,
  idx,
  templates,
  guests,
  canRemove,
  onChange,
  onRemove,
}: {
  o: OptionDraft;
  idx: number;
  templates: QuoteTemplate[];
  guests: number;
  canRemove: boolean;
  onChange: (p: Partial<OptionDraft>) => void;
  onRemove: () => void;
}) {
  const [touched, setTouched] = useState({ beer: false, dessert: false });
  const opt = useMemo(() => draftToOption(o, templates), [o, templates]);
  const totals = opt ? optionTotals(opt, guests, opt.packageSnapshot!) : null;

  function pickTemplate(t: QuoteTemplate) {
    onChange({
      packageId: t.id,
      ...(touched.beer ? {} : { beerPrice: String(t.beerPrice ?? 7) }),
      ...(touched.dessert ? {} : { dessertPrice: String(t.dessertPrice ?? 6) }),
    });
  }

  return (
    <div className={styles.optBlock}>
      <div className={styles.optHead}>
        <span className={styles.optBadge}>Option {optionLetter(idx)}</span>
        {canRemove && (
          <button type="button" className={styles.iconBtn} onClick={onRemove} aria-label={`Retirer l'option ${optionLetter(idx)}`}>
            <Trash2 size={16} />
          </button>
        )}
      </div>
      <div className={styles.packages} role="radiogroup" aria-label={`Forfait de l'option ${optionLetter(idx)}`}>
        {templates.map((t) => (
          <label key={t.id} className={styles.package} style={{ ["--c" as string]: accentHex(t.accentColor) }}>
            <input type="radio" name={`pkg-${o.key}`} checked={o.packageId === t.id} onChange={() => pickTemplate(t)} />
            <span className={styles.pkgLabel}>{t.label}</span>
            <span className={styles.pkgName}>{t.name || "(sans nom)"}</span>
            <span className={styles.pkgPrice}>{fmtMoney(t.pricePerPerson ?? 0)} / pers.</span>
            <span className={styles.pkgDetails}>
              <span>Entrée : {t.entree || "—"}</span>
              <span>Plat : {t.plat || "—"}</span>
              <span>Boisson : {t.boisson || "—"}</span>
            </span>
          </label>
        ))}
      </div>

      <div className={styles.addon}>
        <label className={styles.check}>
          <input type="checkbox" checked={o.beerAddon} onChange={(e) => onChange({ beerAddon: e.target.checked })} />
          Remplacer la boisson par une bière (supplément / pers.)
        </label>
        <TextField
          label="Prix bière ($)"
          type="number"
          min={0}
          step="0.01"
          value={o.beerPrice}
          onChange={(e) => {
            setTouched((t) => ({ ...t, beer: true }));
            onChange({ beerPrice: e.target.value });
          }}
        />
      </div>
      <div className={styles.addon}>
        <label className={styles.check}>
          <input type="checkbox" checked={o.dessertAddon} onChange={(e) => onChange({ dessertAddon: e.target.checked })} />
          Ajouter café ou thé + dessert (supplément / pers.)
        </label>
        <TextField
          label="Prix café + dessert ($)"
          type="number"
          min={0}
          step="0.01"
          value={o.dessertPrice}
          onChange={(e) => {
            setTouched((t) => ({ ...t, dessert: true }));
            onChange({ dessertPrice: e.target.value });
          }}
        />
      </div>

      <div className={styles.lines}>
        <span className={styles.subLabel}>Suppléments / rabais (montant négatif = rabais)</span>
        {o.customLines.map((l) => (
          <div key={l.key} className={styles.line}>
            <input
              value={l.description}
              onChange={(e) => onChange({ customLines: o.customLines.map((x) => (x.key === l.key ? { ...x, description: e.target.value } : x)) })}
              placeholder="ex. DJ, décoration, rabais fidélité"
              aria-label="Description"
            />
            <input
              type="number"
              step="0.01"
              value={l.amount}
              onChange={(e) => onChange({ customLines: o.customLines.map((x) => (x.key === l.key ? { ...x, amount: e.target.value } : x)) })}
              placeholder="Montant $"
              aria-label="Montant"
            />
            <button type="button" className={styles.iconBtn} onClick={() => onChange({ customLines: o.customLines.filter((x) => x.key !== l.key) })} aria-label="Retirer la ligne">
              <Trash2 size={16} />
            </button>
          </div>
        ))}
        <div>
          <Button variant="ghost" onClick={() => onChange({ customLines: [...o.customLines, { key: newKey("line"), description: "", amount: "" }] })}>
            <Plus size={14} aria-hidden /> Ajouter une ligne
          </Button>
        </div>
      </div>

      <div className={styles.addon}>
        <TextField label="Dépôt exigé ($)" type="number" min={0} step="0.01" value={o.depositAmount} onChange={(e) => onChange({ depositAmount: e.target.value })} />
        <label className={styles.check}>
          <input type="checkbox" checked={o.depositPaid} onChange={(e) => onChange({ depositPaid: e.target.checked })} />
          Dépôt déjà versé
        </label>
      </div>

      {totals && (
        <div className={styles.totals} aria-live="polite">
          <div className={styles.totalLine}>
            <span>
              Forfait ({guests} × {fmtMoney(opt!.packageSnapshot!.pricePerPerson ?? 0)})
            </span>
            <strong>{fmtMoney(totals.subtotal)}</strong>
          </div>
          {totals.beerSubtotal > 0 && (
            <div className={styles.totalLine}>
              <span>Bière</span>
              <strong>{fmtMoney(totals.beerSubtotal)}</strong>
            </div>
          )}
          {totals.dessertSubtotal > 0 && (
            <div className={styles.totalLine}>
              <span>Café/thé + dessert</span>
              <strong>{fmtMoney(totals.dessertSubtotal)}</strong>
            </div>
          )}
          {totals.customSubtotal !== 0 && (
            <div className={styles.totalLine}>
              <span>Suppléments</span>
              <strong>{fmtMoney(totals.customSubtotal)}</strong>
            </div>
          )}
          <div className={styles.totalLine}>
            <span>TPS + TVQ</span>
            <strong>{fmtMoney(totals.tps + totals.tvq)}</strong>
          </div>
          <div className={`${styles.totalLine} ${styles.grand}`}>
            <span>Total option {optionLetter(idx)}</span>
            <strong>{fmtMoney(totals.total)}</strong>
          </div>
          {totals.deposit > 0 && (
            <div className={styles.totalLine}>
              <span>Solde {o.depositPaid ? "après dépôt versé" : "(dépôt non versé)"}</span>
              <strong>{fmtMoney(totals.balance)}</strong>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
