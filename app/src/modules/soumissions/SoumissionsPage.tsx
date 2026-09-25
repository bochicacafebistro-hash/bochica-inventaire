import { useMemo, useState } from "react";
import { CalendarDays, CircleAlert, Copy, FileDown, MapPin, Pencil, Plus, Receipt, Send, Settings2, ThumbsDown, ThumbsUp, Trash2, Users, Utensils } from "lucide-react";
import { useSessionUser } from "@/core/auth/AuthContext";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { ActionMenu } from "@/ui/ActionMenu";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { fmtMoney } from "@/ui/format";
import { PageHeader } from "@/ui/PageHeader";
import { SearchInput } from "@/ui/SearchInput";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import {
  DEFAULT_TEMPLATES,
  describeOptions,
  filterQuotes,
  getOptions,
  getRooms,
  headlineRange,
  isPastDue,
  nextQuoteNumber,
  QUOTE_STATUSES,
  shortDate,
  statusLabel,
  templateOf,
  venueLabel,
  type toFields,
} from "./soumissions.logic";
import type { Quote, QuoteTemplate } from "./soumissions.types";
import { QuoteModal } from "./components/QuoteModal";
import { TemplatesModal, type TemplateFields } from "./components/TemplatesModal";
import styles from "./Soumissions.module.css";

const COL = "quotes";
const TPL = "quoteTemplates";

export default function SoumissionsPage() {
  const user = useSessionUser();
  const quotesQ = useCollection<Quote>(COL);
  const tplQ = useCollection<QuoteTemplate>(TPL);
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [status, setStatus] = useState("all");
  const [query, setQuery] = useState("");
  const [editing, setEditing] = useState<{ quote: Quote | null } | null>(null);
  const [managing, setManaging] = useState(false);

  const templates = useMemo(() => [...tplQ.data].sort((a, b) => (a.sortOrder ?? 999) - (b.sortOrder ?? 999)), [tplQ.data]);
  const shown = useMemo(() => filterQuotes(quotesQ.data, status, query), [quotesQ.data, status, query]);
  const fail = (what: string) => (err: unknown) => toast(`${what} impossible : ${(err as Error).message}`, "error");

  async function pdf(q: Quote) {
    try {
      const { downloadQuotePdf } = await import("./quotePdf");
      const name = await downloadQuotePdf(q, templates);
      toast(`PDF téléchargé : ${name}`, "success");
    } catch (err) {
      fail("Génération du PDF")(err);
    }
  }

  async function save(f: ReturnType<typeof toFields>) {
    const target = editing?.quote;
    try {
      if (target) {
        await actions.update(COL, target.id, f);
        await actions.log(target.quoteNumber ?? target.id, "Soumission — modifiée", `${f.clientName} · ${describeOptions(f)}`);
        toast("Soumission enregistrée.", "success");
      } else {
        const quoteNumber = nextQuoteNumber(quotesQ.data);
        await actions.create(COL, { ...f, quoteNumber, createdBy: user.email });
        await actions.log(quoteNumber, "Soumission — créée", `${f.clientName} · ${describeOptions(f)}`);
        toast(`Soumission ${quoteNumber} créée.`, "success");
      }
      setEditing(null);
    } catch (err) {
      fail("Enregistrement")(err);
    }
  }

  async function duplicate(q: Quote) {
    try {
      const { id: _id, quoteNumber: _n, ...rest } = q;
      const quoteNumber = nextQuoteNumber(quotesQ.data);
      const id = await actions.create(COL, { ...rest, quoteNumber, status: "brouillon", createdBy: user.email });
      await actions.log(quoteNumber, "Soumission — dupliquée", `Depuis ${q.quoteNumber ?? ""}`);
      toast(`Copie ${quoteNumber} créée (brouillon).`, "success");
      setEditing({ quote: { ...q, id, quoteNumber, status: "brouillon" } });
    } catch (err) {
      fail("Duplication")(err);
    }
  }

  async function changeStatus(q: Quote, s: string) {
    try {
      await actions.update(COL, q.id, { status: s });
      await actions.log(q.quoteNumber ?? q.id, `Soumission — ${statusLabel(s)}`, q.clientName ?? "");
      toast(`Statut : ${statusLabel(s)}`, "success");
    } catch (err) {
      fail("Changement de statut")(err);
    }
  }

  async function remove(q: Quote) {
    if (!(await confirm({ title: "Supprimer la soumission", danger: true, message: `Supprimer la soumission ${q.quoteNumber} (${q.clientName}) ?` }))) return;
    try {
      await actions.remove(COL, q.id);
      await actions.log(q.quoteNumber ?? q.id, "Soumission — supprimée", q.clientName ?? "");
      toast("Soumission supprimée.", "success");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  // ── Forfaits ──
  async function seedTemplates() {
    try {
      for (const t of DEFAULT_TEMPLATES) await actions.setFixed(TPL, t.id, { ...t });
      toast("Forfaits par défaut créés.", "success");
    } catch (err) {
      fail("Création des forfaits")(err);
    }
  }
  async function saveTemplate(id: string, f: TemplateFields) {
    try {
      await actions.update(TPL, id, f);
      toast(`Forfait « ${f.name} » enregistré.`, "success");
    } catch (err) {
      fail("Enregistrement du forfait")(err);
    }
  }
  async function addTemplate() {
    try {
      await actions.create(TPL, { name: "", label: "Forfait", pricePerPerson: 0, accentColor: "yellow", entree: "", plat: "", boisson: "", beerPrice: 7, dessertPrice: 6, sortOrder: templates.length });
    } catch (err) {
      fail("Ajout du forfait")(err);
    }
  }
  async function deleteTemplate(t: QuoteTemplate) {
    const used = quotesQ.data.filter((q) => getOptions(q).some((o) => o.packageId === t.id)).length;
    const ok = await confirm({
      title: "Supprimer le forfait",
      danger: true,
      message: `Supprimer « ${t.name || t.label} » ?${used ? ` ${used} soumission(s) l'utilisent : elles garderont leur copie figée.` : ""}`,
    });
    if (!ok) return;
    try {
      await actions.remove(TPL, t.id);
      toast("Forfait supprimé.", "success");
    } catch (err) {
      fail("Suppression du forfait")(err);
    }
  }

  const loading = quotesQ.loading || tplQ.loading;
  const error = quotesQ.error ?? tplQ.error;

  return (
    <>
      <PageHeader
        eyebrow="Clients & événements"
        title="Soumissions"
        actions={
          <>
            <Button variant="secondary" onClick={() => setManaging(true)} disabled={!templates.length}>
              <Settings2 size={16} aria-hidden /> Forfaits
            </Button>
            <Button onClick={() => setEditing({ quote: null })} disabled={!templates.length}>
              <Plus size={16} aria-hidden /> Nouvelle soumission
            </Button>
          </>
        }
      />
      {loading ? (
        <Spinner />
      ) : error ? (
        <p style={{ color: "var(--status-red)" }}>Lecture impossible : {error.message}</p>
      ) : !templates.length ? (
        <EmptyState icon={Utensils} title="Aucun forfait">
          <p>Les soumissions se basent sur des forfaits (prix par personne, entrée, plat, boisson).</p>
          <Button onClick={() => void seedTemplates()}>Créer les forfaits par défaut (L'Essentiel, Le Gourmand)</Button>
        </EmptyState>
      ) : quotesQ.data.length === 0 ? (
        <EmptyState icon={Receipt} title="Aucune soumission">
          <p>Crée un devis : forfaits, suppléments, dépôt et taxes calculés automatiquement, PDF aux couleurs de Bochica.</p>
        </EmptyState>
      ) : (
        <>
          <div className={styles.chips} role="group" aria-label="Statuts">
            <button className={styles.chip} aria-pressed={status === "all"} onClick={() => setStatus("all")}>
              Toutes <span className={styles.chipCount}>{quotesQ.data.length}</span>
            </button>
            {QUOTE_STATUSES.map((s) => (
              <button key={s.key} className={styles.chip} aria-pressed={status === s.key} onClick={() => setStatus(s.key)}>
                {s.label} <span className={styles.chipCount}>{quotesQ.data.filter((q) => (q.status ?? "brouillon") === s.key).length}</span>
              </button>
            ))}
          </div>
          <div className={styles.toolbar}>
            <SearchInput value={query} onChange={setQuery} placeholder="N°, client, courriel, téléphone…" />
          </div>
          {shown.length === 0 ? (
            <EmptyState icon={Receipt} title="Aucun résultat" />
          ) : (
            <div className={styles.list}>
              {shown.map((q) => {
                const st = q.status ?? "brouillon";
                const late = isPastDue(q);
                const r = headlineRange(q, templates);
                const opts = getOptions(q);
                const rooms = getRooms(q);
                return (
                  <article key={q.id} className={styles.card}>
                    <div>
                      <div className={styles.cardHead}>
                        <span className={styles.num}>{q.quoteNumber}</span>
                        <span className={`${styles.status} ${styles[`status_${st}`] ?? ""}`}>{statusLabel(st)}</span>
                        {late && (
                          <span className={styles.pastDue}>
                            <CircleAlert size={12} aria-hidden /> Validité dépassée
                          </span>
                        )}
                      </div>
                      <div className={styles.client}>
                        {q.clientName || "Client sans nom"}
                        {q.clientCompany && <span className={styles.company}>{q.clientCompany}</span>}
                      </div>
                      <div className={styles.meta}>
                        {q.eventDate && (
                          <span className={styles.metaItem}>
                            <CalendarDays size={13} aria-hidden /> {shortDate(q.eventDate)}
                            {q.eventTime && ` · ${q.eventTime}`}
                          </span>
                        )}
                        {!!q.guestCount && (
                          <span className={styles.metaItem}>
                            <Users size={13} aria-hidden /> {q.guestCount} pers.
                          </span>
                        )}
                        {opts.length > 0 && (
                          <span className={styles.metaItem}>
                            <Utensils size={13} aria-hidden />
                            {opts.length === 1 ? templateOf(opts[0]!, templates).name : `${opts.length} options de forfait`}
                          </span>
                        )}
                        {rooms.length > 0 && (
                          <span className={styles.metaItem}>
                            <MapPin size={13} aria-hidden /> {rooms.length === 1 ? "Location de salle" : `${rooms.length} options de salle`}
                          </span>
                        )}
                        {q.eventVenue && q.eventVenue !== "bochica" && <span className={styles.metaItem}>{venueLabel(q.eventVenue)}</span>}
                      </div>
                    </div>
                    <div className={styles.side}>
                      <div className={styles.total}>{r.count > 1 && r.min !== r.max ? `${fmtMoney(r.min)} – ${fmtMoney(r.max)}` : fmtMoney(r.max)}</div>
                      {q.validUntil && (
                        <div className={`${styles.validity} ${late ? styles.validityLate : ""}`}>
                          {late ? "Expirée depuis le" : "Valide jusqu'au"} {shortDate(q.validUntil)}
                        </div>
                      )}
                      <div className={styles.sideActions}>
                        <Button variant="secondary" onClick={() => void pdf(q)} aria-label={`PDF de la soumission ${q.quoteNumber}`}>
                          <FileDown size={16} aria-hidden /> PDF
                        </Button>
                        <ActionMenu
                          label={`Actions pour la soumission ${q.quoteNumber}`}
                          items={[
                            { label: "Modifier", icon: <Pencil size={14} />, onSelect: () => setEditing({ quote: q }) },
                            { label: "Dupliquer", icon: <Copy size={14} />, onSelect: () => void duplicate(q) },
                            { label: "Marquer envoyée", icon: <Send size={14} />, onSelect: () => void changeStatus(q, "envoyee") },
                            { label: "Marquer acceptée", icon: <ThumbsUp size={14} />, onSelect: () => void changeStatus(q, "acceptee") },
                            { label: "Marquer refusée", icon: <ThumbsDown size={14} />, onSelect: () => void changeStatus(q, "refusee") },
                            { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, onSelect: () => void remove(q) },
                          ]}
                        />
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </>
      )}
      {editing && (
        <QuoteModal
          quote={editing.quote}
          templates={templates}
          onClose={() => setEditing(null)}
          onSave={save}
          onPdf={editing.quote ? () => void pdf(editing.quote!) : undefined}
        />
      )}
      {managing && (
        <TemplatesModal templates={templates} onClose={() => setManaging(false)} onSave={saveTemplate} onAdd={addTemplate} onDelete={deleteTemplate} />
      )}
    </>
  );
}
