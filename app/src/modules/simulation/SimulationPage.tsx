import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router";
import {
  ArrowDown,
  ArrowUp,
  CalendarDays,
  ChevronLeft,
  Clock,
  Copy,
  Download,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingUp,
  UserPlus,
} from "lucide-react";
import { useSessionUser } from "@/core/auth/AuthContext";
import { addDays, todayISO } from "@/core/dates";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { useDocument } from "@/core/data/useDocument";
import { CoverageGrid } from "@/modules/equipe/components/CoverageHeatmap";
import { OpenDaysModal } from "@/modules/equipe/components/OpenDaysModal";
import { isoWeek, weekStart } from "@/modules/equipe/equipe.logic";
import type { Employee, EmployeeComp, ScheduleSettings } from "@/modules/equipe/equipe.types";
import { fmtHours, hoursFromShift, mergeComp } from "@/modules/equipe/horaire.logic";
import { SECTION_COLOR, sectionKey } from "@/modules/equipe/sections";
import { ServiceHoursModal } from "@/modules/paie/components/SettingsModals";
import { normalizeWindows, windowsLabel } from "@/modules/paie/paie.logic";
import type { PayrollSettings, PayrollWeekDoc } from "@/modules/paie/paie.types";
import { payrollWeekId } from "@/modules/pointage/punch.logic";
import { ActionMenu } from "@/ui/ActionMenu";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { fmtMoney } from "@/ui/format";
import { PageHeader } from "@/ui/PageHeader";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import h from "@/modules/equipe/Horaire.module.css";
import { FictionalModal, SimMetaModal, SimShiftModal, type SimMetaSave } from "./components/SimModals";
import {
  addFictional,
  compareRows,
  computeScenario,
  dayShifts,
  deleteShift,
  effectiveOpenDays,
  gap,
  moveEmp,
  moveShift,
  newScenarioCopy,
  removeEmp,
  resetToBaseline,
  setShift,
  simCoverageAt,
  simCoverageRange,
  snapshotEmployees,
  snapshotServiceHours,
  sortSims,
  toggleDay,
  updateEmp,
  withServiceHours,
  type SimResult,
} from "./sim.logic";
import type { PayrollSimulation, SimScenario } from "./sim.types";
import styles from "./Simulation.module.css";

const DAYS = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
const hrs = (n: number) => `${fmtHours(n) || "0"} h`;
const ALL = [0, 1, 2, 3, 4, 5, 6];

/** Écart coloré : une hausse de coût est « mauvaise » (rouge), une baisse « bonne » (vert). */
function Gap({ sim, base, hours, positiveIsBad = true }: { sim: number; base: number; hours?: boolean; positiveIsBad?: boolean }) {
  const { diff, pct } = gap(sim, base);
  const zero = Math.abs(diff) < 0.005;
  const bad = diff > 0 === positiveIsBad;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  return (
    <span className={`${styles.gap} ${zero ? styles.gapZero : bad ? styles.gapBad : styles.gapGood}`}>
      {zero ? "—" : diff > 0 ? "▲" : "▼"} {sign}
      {hours ? `${fmtHours(Math.abs(diff)) || "0"} h` : fmtMoney(Math.abs(diff))} <small>({sign}{Math.abs(pct).toFixed(1).replace(".", ",")} %)</small>
    </span>
  );
}

/** Champ texte enregistré en quittant le champ (ou Entrée), seulement s'il a changé. */
function CommitInput({ value, onCommit, className, label, ...rest }: { value: string; onCommit: (v: string) => void; className?: string; label: string } & Omit<React.InputHTMLAttributes<HTMLInputElement>, "value" | "onChange">) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <input
      {...rest}
      className={className}
      aria-label={label}
      value={text}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => text.trim() !== value && onCommit(text.trim())}
      onKeyDown={(e) => e.key === "Enter" && (e.target as HTMLInputElement).blur()}
    />
  );
}

/** Admin : Simulation paie — scénarios « et si » comparés au réel, sans toucher aux vraies données. */
export default function SimulationPage() {
  const [params, setParams] = useSearchParams();
  const openId = params.get("sim");
  const simsQ = useCollection<PayrollSimulation>("payrollSimulations");
  const empQ = useCollection<Employee>("employees");
  const compQ = useCollection<EmployeeComp>("employeesComp");
  const schedQ = useDocument<ScheduleSettings>("settings", "schedule");
  const paySetQ = useDocument<PayrollSettings>("settings", "payroll");
  const actions = useDataActions();
  const user = useSessionUser();
  const confirm = useConfirm();
  const toast = useToast();
  const today = todayISO();
  const [creating, setCreating] = useState(false);
  const fail = (what: string) => (err: unknown) => toast(`${what} impossible : ${(err as Error).message}`, "error");
  const open = (id: string | null) => setParams(id ? { sim: id } : {});

  const sims = useMemo(() => sortSims(simsQ.data), [simsQ.data]);
  const current = openId ? sims.find((s) => s.id === openId) : undefined;

  // Photo pour une nouvelle simulation : semaine choisie (payroll de cette semaine pour les pourboires)
  const [weekOffset, setWeekOffset] = useState(0);
  const snapMonday = weekStart(today, weekOffset);
  const snapWeekQ = useDocument<PayrollWeekDoc>("payroll", payrollWeekId(snapMonday));
  const weekOptions = [-1, 0, 1, 2].map((o) => {
    const m = weekStart(today, o);
    return { value: o, label: `Semaine ${isoWeek(addDays(m, 3))}${o === 0 ? " (cette semaine)" : o === 1 ? " (prochaine)" : o === -1 ? " (dernière)" : ""}` };
  });

  function baselineFor(monday: string): SimScenario {
    const paid = mergeComp(empQ.data, compQ.data, today);
    const wk = snapWeekQ.data;
    const tips = wk?.tipsByDay ? Object.values(wk.tipsByDay).reduce((s, v) => s + (Number(v) || 0), 0) : Number(wk?.totalTips) || 0;
    return {
      employees: snapshotEmployees(paid, monday),
      serviceHours: snapshotServiceHours(paySetQ.data?.defaultServiceHours),
      tipShares: { cuisine: Number(paySetQ.data?.tipShares?.cuisine ?? 0.25), service: Number(paySetQ.data?.tipShares?.service ?? 0.75) },
      totalTips: tips,
      openDays: Array.isArray(schedQ.data?.openDays) ? [...schedQ.data!.openDays!] : ALL,
      salesRatio: Number(schedQ.data?.salesRatio) || 0.32,
    };
  }

  async function create(s: SimMetaSave) {
    const monday = weekStart(today, s.weekOffset);
    if (!empQ.data.some((e) => !e.archived)) return toast("Ajoute d'abord au moins un employé dans Employés & Horaires.", "error");
    const baseline = baselineFor(monday);
    const baseWeekRef = payrollWeekId(monday);
    try {
      const id = await actions.create("payrollSimulations", { name: s.name, description: s.description, baseWeekRef, baseline, simulation: newScenarioCopy(baseline), createdBy: user.email ?? "—" });
      await actions.log("—", "Simulation créée", `${s.name} (base : ${baseWeekRef}, ${baseline.employees!.length} employés)`);
      toast(`Simulation « ${s.name} » créée.`, "success");
      setCreating(false);
      open(id);
    } catch (err) {
      fail("Création")(err);
    }
  }
  async function duplicate(sim: PayrollSimulation) {
    try {
      const id = await actions.create("payrollSimulations", { name: `${sim.name || "Sans nom"} (Copie)`, description: sim.description ?? "", baseWeekRef: sim.baseWeekRef ?? "—", baseline: sim.baseline ?? {}, simulation: sim.simulation ?? sim.baseline ?? {}, createdBy: user.email ?? "—" });
      toast("Simulation dupliquée.", "success");
      return id;
    } catch (err) {
      fail("Duplication")(err);
    }
  }
  async function remove(sim: PayrollSimulation) {
    const ok = await confirm({ title: "Supprimer cette simulation ?", message: `« ${sim.name || "Sans nom"} » sera supprimée définitivement.`, danger: true, confirmLabel: "Supprimer" });
    if (!ok) return;
    try {
      await actions.remove("payrollSimulations", sim.id);
      await actions.log("—", "Simulation supprimée", sim.name || sim.id);
      if (openId === sim.id) open(null);
      toast("Simulation supprimée.", "success");
    } catch (err) {
      fail("Suppression")(err);
    }
  }
  async function reset(sim: PayrollSimulation) {
    const ok = await confirm({ title: "Réinitialiser la simulation ?", message: `Toutes les modifications de « ${sim.name || "Sans nom"} » seront remplacées par le réel (la photo d'origine).`, danger: true, confirmLabel: "Réinitialiser" });
    if (ok) await actions.update("payrollSimulations", sim.id, { simulation: resetToBaseline(sim) }).then(() => toast("Simulation réinitialisée.", "success"), fail("Réinitialisation"));
  }

  const loading = simsQ.loading || empQ.loading;
  const error = simsQ.error || empQ.error;

  if (openId && current)
    return (
      <Editor
        sim={current}
        onBack={() => open(null)}
        onDuplicate={async () => {
          const id = await duplicate(current);
          if (id) open(id);
        }}
        onRemove={() => void remove(current)}
        onReset={() => void reset(current)}
        copyWeek={() => snapshotEmployees(mergeComp(empQ.data, compQ.data, today), weekStart(today, 0))}
      />
    );

  return (
    <div className="page">
      <PageHeader
        eyebrow="RH & Horaires"
        title="Simulation paie"
        actions={
          <Button onClick={() => setCreating(true)} disabled={loading}>
            <Plus size={16} aria-hidden /> Nouvelle simulation
          </Button>
        }
      />
      <p className={styles.intro}>
        Planifie des scénarios RH <strong>sans toucher à tes vraies données</strong> : une simulation est une copie de l'horaire prévu que tu modifies librement (taux, embauche, départ, heures, pourboires), puis tu compares avec le réel en $ et en %.
      </p>
      {error ? (
        <EmptyState icon={TrendingUp} title="Impossible de charger les simulations">
          {error.message}
        </EmptyState>
      ) : loading ? (
        <Spinner />
      ) : openId && !current ? (
        <EmptyState icon={TrendingUp} title="Simulation introuvable">
          Elle a peut-être été supprimée. <button className={h.pillBtn} onClick={() => open(null)}>Retour à la liste</button>
        </EmptyState>
      ) : sims.length === 0 ? (
        <EmptyState icon={TrendingUp} title="Aucune simulation pour l'instant">
          Crée un scénario à partir de l'horaire prévu : changer un taux, ajouter une future embauche, retirer un employé… puis compare avec le réel.
        </EmptyState>
      ) : (
        <div className={styles.cards}>
          {sims.map((s) => (
            <SimCard key={s.id} sim={s} onOpen={() => open(s.id)} onDuplicate={() => void duplicate(s)} onReset={() => void reset(s)} onRemove={() => void remove(s)} />
          ))}
        </div>
      )}
      {creating && (
        <SimMetaModal
          create
          weekOptions={weekOptions}
          initial={{ name: `Simulation du ${new Date().toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" })}` }}
          onClose={() => setCreating(false)}
          onSave={async (s) => {
            if (s.weekOffset !== weekOffset) setWeekOffset(s.weekOffset); // pourboires : lus pour la semaine choisie
            await create(s);
          }}
        />
      )}
    </div>
  );
}

function SimCard({ sim, onOpen, onDuplicate, onReset, onRemove }: { sim: PayrollSimulation; onOpen: () => void; onDuplicate: () => void; onReset: () => void; onRemove: () => void }) {
  const base = computeScenario(sim.baseline);
  const cur = computeScenario(sim.simulation);
  const n = sim.simulation?.employees?.length ?? 0;
  const nb = sim.baseline?.employees?.length ?? 0;
  const created = typeof sim.createdAt === "object" && sim.createdAt?.toDate ? sim.createdAt.toDate().toLocaleDateString("fr-CA", { day: "numeric", month: "short", year: "numeric" }) : "";
  return (
    <article className={styles.card}>
      <div className={styles.cardHead}>
        <div style={{ minWidth: 0 }}>
          <button className={styles.cardName} onClick={onOpen}>
            {sim.name || "Sans nom"}
          </button>
          {sim.description && <div className={styles.desc}>{sim.description}</div>}
          <div className={styles.meta}>
            Base : {sim.baseWeekRef || "—"}
            {created ? ` · ${created}` : ""} · {n} emp.{n !== nb ? ` (base : ${nb})` : ""}
          </div>
        </div>
        <ActionMenu
          label={`Actions pour ${sim.name}`}
          items={[
            { label: "Ouvrir / modifier", icon: <Pencil size={16} />, onSelect: onOpen },
            { label: "Dupliquer", icon: <Copy size={16} />, onSelect: onDuplicate },
            { label: "Réinitialiser au réel", icon: <RefreshCw size={16} />, onSelect: onReset },
            { label: "Supprimer", icon: <Trash2 size={16} />, onSelect: onRemove, danger: true },
          ]}
        />
      </div>
      <div className={styles.compare}>
        <div>
          <div className={styles.cmpLabel}>Réel (base)</div>
          <div className={styles.cmpValue}>{fmtMoney(base.totals.total)}</div>
          <div className={styles.meta}>
            {hrs(base.totals.hours)} · Salaires {fmtMoney(base.totals.gross)}
          </div>
        </div>
        <div>
          <div className={`${styles.cmpLabel} ${styles.cmpSim}`}>Simulation</div>
          <div className={styles.cmpValue}>{fmtMoney(cur.totals.total)}</div>
          <div className={styles.meta}>
            {hrs(cur.totals.hours)} · Salaires {fmtMoney(cur.totals.gross)}
          </div>
        </div>
      </div>
      <div className={styles.cardGap}>
        <Gap sim={cur.totals.total} base={base.totals.total} /> vs réel
      </div>
    </article>
  );
}

type Modal =
  | { kind: "shift"; empId: string; dow: number; index: number }
  | { kind: "meta" }
  | { kind: "fictional" }
  | { kind: "service" }
  | { kind: "days" }
  | null;

function Editor({ sim, onBack, onDuplicate, onRemove, onReset, copyWeek }: { sim: PayrollSimulation; onBack: () => void; onDuplicate: () => void; onRemove: () => void; onReset: () => void; copyWeek: () => SimScenario["employees"] }) {
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const [modal, setModal] = useState<Modal>(null);
  const sc = sim.simulation ?? {};
  const base = useMemo(() => computeScenario(sim.baseline), [sim.baseline]);
  const cur = useMemo(() => computeScenario(sim.simulation), [sim.simulation]);
  const openDays = effectiveOpenDays(sc);
  const ratio = Number(sc.salesRatio) || 0.32;
  const baseRatio = Number(sim.baseline?.salesRatio) || 0.32;
  const shares = sc.tipShares ?? { cuisine: 0.25, service: 0.75 };
  const persist = (next: SimScenario, ok = "") =>
    actions.update("payrollSimulations", sim.id, { simulation: next }).then(
      () => ok && toast(ok, "success"),
      (err: unknown) => toast(`Sauvegarde impossible : ${(err as Error).message}`, "error"),
    );

  async function png(kind: "team" | "admin") {
    try {
      const mod = await import("./simPng");
      const name = kind === "team" ? await mod.exportSimTeamPng(sim) : await mod.exportSimAdminPng(sim);
      if (!name) toast("Aucun employé n'a de quart dans cette simulation — rien à exporter.", "error");
      else toast(kind === "team" ? "Image téléchargée — prête à partager avec l'équipe." : "Rapport admin téléchargé — usage interne seulement.", "success");
    } catch (err) {
      toast(`Export PNG impossible : ${(err as Error).message}`, "error");
    }
  }
  async function copyCurrentWeek() {
    const ok = await confirm({
      title: "Copier l'horaire de la semaine en cours ?",
      message: "Les employés et les quarts de cette simulation seront remplacés par l'horaire prévu de cette semaine (noms, taux, sections, quarts). Les pourboires, le ratio et les jours d'ouverture de la simulation sont gardés.",
      confirmLabel: "Copier",
    });
    if (!ok) return;
    const emps = copyWeek();
    if (!emps?.length) return toast("Aucun employé actif à copier.", "error");
    await persist({ ...sc, employees: emps }, "Horaire de la semaine en cours copié dans la simulation.");
  }
  async function removeEmployee(id: string, name?: string) {
    const ok = await confirm({ title: `Retirer ${name || "cet employé"} ?`, message: "Il est retiré seulement de cette simulation. Son employé réel n'est pas touché.", danger: true, confirmLabel: "Retirer" });
    if (ok) await persist(removeEmp(sc, id), "Employé retiré de la simulation.");
  }

  const dayCount = (d: number) => cur.rows.filter((r) => (r.daily[d]?.shifts.length ?? 0) > 0).length;
  const weekCost = openDays.reduce((s, d) => s + (cur.dayCost[d] ?? 0), 0);
  const cmp = compareRows(base.rows, cur.rows);
  const modalEmp = modal?.kind === "shift" ? sc.employees?.find((e) => e.id === modal.empId) : undefined;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Simulation paie"
        title={sim.name || "Sans nom"}
        actions={
          <>
            <Button variant="secondary" onClick={onBack}>
              <ChevronLeft size={16} aria-hidden /> Retour
            </Button>
            <ActionMenu
              label="Actions sur la simulation"
              items={[
                { label: "Renommer", icon: <Pencil size={16} />, onSelect: () => setModal({ kind: "meta" }) },
                { label: "Copier l'horaire de cette semaine", icon: <Download size={16} />, onSelect: () => void copyCurrentWeek() },
                { label: "Image pour l'équipe (sans $)", icon: <Download size={16} />, onSelect: () => void png("team") },
                { label: "Image admin (interne)", icon: <Download size={16} />, onSelect: () => void png("admin") },
                { label: "Dupliquer", icon: <Copy size={16} />, onSelect: onDuplicate },
                { label: "Réinitialiser au réel", icon: <RefreshCw size={16} />, onSelect: onReset },
                { label: "Supprimer", icon: <Trash2 size={16} />, onSelect: onRemove, danger: true },
              ]}
            />
          </>
        }
      />
      {sim.description && <p className={styles.intro}>{sim.description}</p>}

      <div className={styles.kpis}>
        <Kpi label="Heures totales" sim={hrs(cur.totals.hours)} base={hrs(base.totals.hours)} gap={<Gap sim={cur.totals.hours} base={base.totals.hours} hours positiveIsBad={false} />} />
        <Kpi label="Masse salariale" sim={fmtMoney(cur.totals.gross)} base={fmtMoney(base.totals.gross)} gap={<Gap sim={cur.totals.gross} base={base.totals.gross} />} />
        <Kpi label="Pourboires distribués" sim={fmtMoney(cur.totals.tips)} base={fmtMoney(base.totals.tips)} gap={<Gap sim={cur.totals.tips} base={base.totals.tips} positiveIsBad={false} />} />
        <Kpi label="Total à payer" sim={fmtMoney(cur.totals.total)} base={fmtMoney(base.totals.total)} gap={<Gap sim={cur.totals.total} base={base.totals.total} />} />
      </div>

      <section className={h.card} aria-labelledby="sim-params">
        <h2 id="sim-params" className={h.cardTitle} style={{ marginBottom: 12 }}>
          Paramètres de la simulation
        </h2>
        <div className={styles.params}>
          <label className={styles.param}>
            Pourboires de la semaine ($)
            <CommitInput label="Pourboires de la semaine" inputMode="decimal" value={sc.totalTips ? String(sc.totalTips) : ""} placeholder="0" onCommit={(v) => void persist({ ...sc, totalTips: Number(v.replace(",", ".")) || 0 })} />
            <span className={h.hint}>Réel : {fmtMoney(Number(sim.baseline?.totalTips) || 0)}</span>
          </label>
          <label className={styles.param}>
            Part cuisine (%)
            <CommitInput
              label="Part cuisine en pour cent"
              inputMode="numeric"
              value={String(Math.round(Number(shares.cuisine ?? 0.25) * 100))}
              onCommit={(v) => {
                const p = Math.max(0, Math.min(100, Number(v) || 0)) / 100;
                void persist({ ...sc, tipShares: { cuisine: p, service: 1 - p } });
              }}
            />
            <span className={h.hint}>Service + Autre : {100 - Math.round(Number(shares.cuisine ?? 0.25) * 100)} %</span>
          </label>
          <label className={styles.param}>
            Ratio salaires / ventes
            <select value={String(Math.round(ratio * 1000) / 10)} onChange={(e) => void persist({ ...sc, salesRatio: Number(e.target.value) / 100 })}>
              {[...new Set([...Array.from({ length: 11 }, (_, i) => 30 + i), Math.round(ratio * 1000) / 10])]
                .sort((a, b) => a - b)
                .map((p) => (
                  <option key={p} value={p}>
                    {String(p).replace(".", ",")} %
                  </option>
                ))}
            </select>
            <span className={h.hint}>Réel : {(baseRatio * 100).toFixed(1).replace(".", ",")} %</span>
          </label>
          <div className={styles.param}>
            Pool cuisine
            <strong>{fmtMoney(cur.pools.cuisine)}</strong>
            <span className={h.hint}>{hrs(cur.totalsHours.cuisine)} en service</span>
          </div>
          <div className={styles.param}>
            Pool service
            <strong>{fmtMoney(cur.pools.service)}</strong>
            <span className={h.hint}>{hrs(cur.totalsHours.service)} en service</span>
          </div>
        </div>
      </section>

      <div className={h.toolbar}>
        <Button onClick={() => setModal({ kind: "fictional" })}>
          <UserPlus size={16} aria-hidden /> Employé fictif
        </Button>
        <Button variant="secondary" onClick={() => setModal({ kind: "service" })}>
          <Clock size={16} aria-hidden /> Heures de service
        </Button>
        <Button variant="secondary" onClick={() => setModal({ kind: "days" })}>
          <CalendarDays size={16} aria-hidden /> Jours ouverts ({openDays.length}/7)
        </Button>
      </div>

      <Grid sim={sim} cur={cur} openDays={openDays} ratio={ratio} weekCost={weekCost} dayCount={dayCount} persist={persist} onShift={(empId, dow, index) => setModal({ kind: "shift", empId, dow, index })} onRemove={(id, name) => void removeEmployee(id, name)} />

      <CoverageGrid
        rows={openDays.map((d) => ({ key: d, label: DAYS[d]! }))}
        range={simCoverageRange(sc.employees ?? [], openDays)}
        count={(d, hour, sec) => simCoverageAt(sc.employees ?? [], d, hour, sec)}
        subtitle="Nombre d'employés présents à chaque heure, selon la simulation"
      />

      <section className={h.card} aria-labelledby="sim-cmp">
        <h2 id="sim-cmp" className={h.cardTitle} style={{ marginBottom: 12 }}>
          Comparaison réel ↔ simulation
        </h2>
        <div style={{ overflowX: "auto" }}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th scope="col">Employé</th>
                <th scope="col">Heures (réel)</th>
                <th scope="col">Heures (sim.)</th>
                <th scope="col">Salaire (réel)</th>
                <th scope="col">Salaire (sim.)</th>
                <th scope="col">Total (réel)</th>
                <th scope="col">Total (sim.)</th>
                <th scope="col">Écart total</th>
              </tr>
            </thead>
            <tbody>
              {cmp.map((c) => (
                <tr key={c.id}>
                  <th scope="row">
                    {c.name}
                    {c.sim?.emp.isFictional && <span className={styles.badge}>fictif</span>}
                    {c.sim && !c.base && <span className={`${styles.badge} ${styles.badgeAdd}`}>ajouté</span>}
                    {!c.sim && c.base && <span className={`${styles.badge} ${styles.badgeDel}`}>retiré</span>}
                  </th>
                  <td>{c.base ? hrs(c.base.totalHours) : "—"}</td>
                  <td className={styles.simCol}>{c.sim ? hrs(c.sim.totalHours) : "—"}</td>
                  <td>{c.base ? fmtMoney(c.base.grossWage) : "—"}</td>
                  <td className={styles.simCol}>{c.sim ? fmtMoney(c.sim.grossWage) : "—"}</td>
                  <td>{c.base ? fmtMoney(c.base.totalPay) : "—"}</td>
                  <td className={styles.simCol}>{c.sim ? fmtMoney(c.sim.totalPay) : "—"}</td>
                  <td>
                    <Gap sim={c.sim?.totalPay ?? 0} base={c.base?.totalPay ?? 0} />
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr>
                <th scope="row">Total</th>
                <td>{hrs(base.totals.hours)}</td>
                <td className={styles.simCol}>{hrs(cur.totals.hours)}</td>
                <td>{fmtMoney(base.totals.gross)}</td>
                <td className={styles.simCol}>{fmtMoney(cur.totals.gross)}</td>
                <td>{fmtMoney(base.totals.total)}</td>
                <td className={styles.simCol}>{fmtMoney(cur.totals.total)}</td>
                <td>
                  <Gap sim={cur.totals.total} base={base.totals.total} />
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      {modal?.kind === "shift" && modalEmp && (
        <SimShiftModal
          name={modalEmp.name ?? ""}
          dow={modal.dow}
          index={modal.index}
          existing={dayShifts(modalEmp.shifts?.[modal.dow])[modal.index] ?? null}
          count={dayShifts(modalEmp.shifts?.[modal.dow]).length}
          openDays={openDays}
          onClose={() => setModal(null)}
          onSave={async ({ toDow, shift }) => {
            await persist(toDow !== modal.dow && modal.index >= 0 ? moveShift(sc, modal.empId, modal.dow, modal.index, toDow, shift) : setShift(sc, modal.empId, modal.dow, modal.index, shift), toDow !== modal.dow ? `Quart déplacé ${DAYS[modal.dow]} → ${DAYS[toDow]}.` : "Quart enregistré.");
            setModal(null);
          }}
          onDelete={async () => {
            await persist(deleteShift(sc, modal.empId, modal.dow, modal.index), "Quart supprimé.");
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "meta" && (
        <SimMetaModal
          create={false}
          initial={sim}
          onClose={() => setModal(null)}
          onSave={async (s) => {
            await actions.update("payrollSimulations", sim.id, { name: s.name, description: s.description }).then(() => toast("Simulation mise à jour.", "success"), (err: unknown) => toast(`Erreur : ${(err as Error).message}`, "error"));
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "fictional" && (
        <FictionalModal
          onClose={() => setModal(null)}
          onSave={async (x) => {
            await persist(addFictional(sc, x, `sim_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`), `« ${x.name} » ajouté à la simulation.`);
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "service" && (
        <ServiceHoursModal
          settings={{ defaultServiceHours: sc.serviceHours }}
          openDays={openDays}
          onClose={() => setModal(null)}
          onSave={async (d) => {
            await persist(withServiceHours(sc, d), "Heures de service de la simulation enregistrées.");
            setModal(null);
          }}
        />
      )}
      {modal?.kind === "days" && (
        <OpenDaysModal
          open={openDays}
          hint="Jours où le resto est ouvert dans ce scénario. Décocher un jour retire aussi ses heures de service."
          onClose={() => setModal(null)}
          onToggle={(d, on) => {
            const next = toggleDay(sc, d, on);
            if (!next) toast("Au moins un jour doit rester ouvert.", "error");
            else void persist(next);
          }}
        />
      )}
    </div>
  );
}

function Kpi({ label, sim, base, gap }: { label: string; sim: string; base: string; gap: React.ReactNode }) {
  return (
    <div className={styles.kpi}>
      <div className={styles.kpiLabel}>{label}</div>
      <div className={styles.kpiNum}>{sim}</div>
      <div className={h.hint}>
        Réel : <strong>{base}</strong>
      </div>
      <div>{gap}</div>
    </div>
  );
}

function Grid({
  sim,
  cur,
  openDays,
  ratio,
  weekCost,
  dayCount,
  persist,
  onShift,
  onRemove,
}: {
  sim: PayrollSimulation;
  cur: SimResult;
  openDays: number[];
  ratio: number;
  weekCost: number;
  dayCount: (d: number) => number;
  persist: (next: SimScenario, ok?: string) => Promise<unknown>;
  onShift: (empId: string, dow: number, index: number) => void;
  onRemove: (id: string, name?: string) => void;
}) {
  const sc = sim.simulation ?? {};
  const isOpen = (d: number) => openDays.includes(d);
  return (
    <div className={h.gridWrap}>
      <table className={`${h.grid} ${styles.grid}`}>
        <thead>
          <tr>
            <th className={h.nameCol} scope="col">
              Employé · taux · section
            </th>
            {ALL.map((d) => (
              <th key={d} scope="col" className={isOpen(d) ? undefined : styles.closedCol}>
                <div className={h.dayName}>{DAYS[d]}</div>
                {isOpen(d) ? (
                  <>
                    {normalizeWindows(sc.serviceHours?.[d]).length > 0 && <div className={h.dayMeta}>{windowsLabel(sc.serviceHours?.[d])}</div>}
                    <div className={h.dayMeta}>
                      {dayCount(d)} pers. · {hrs(cur.dayHours[d] ?? 0)}
                    </div>
                  </>
                ) : (
                  <div className={h.dayMeta}>Fermé</div>
                )}
              </th>
            ))}
            <th scope="col" className={h.totalCol}>
              Total
            </th>
          </tr>
        </thead>
        <tbody>
          {cur.rows.map((row, idx) => {
            const e = row.emp;
            const k = sectionKey(e);
            return (
              <tr key={e.id}>
                <th scope="row" className={h.nameCol} style={{ "--sec": SECTION_COLOR[k] } as React.CSSProperties}>
                  <div className={h.nameRow}>
                    <CommitInput className={styles.nameInput} label={`Nom de ${e.name}`} value={e.name ?? ""} placeholder="Nom" onCommit={(v) => void persist(updateEmp(sc, e.id, { name: v }))} />
                    <ActionMenu
                      label={`Actions pour ${e.name}`}
                      items={[
                        ...(idx > 0 ? [{ label: "Monter", icon: <ArrowUp size={16} />, onSelect: () => void persist(moveEmp(sc, e.id, -1)) }] : []),
                        ...(idx < cur.rows.length - 1 ? [{ label: "Descendre", icon: <ArrowDown size={16} />, onSelect: () => void persist(moveEmp(sc, e.id, 1)) }] : []),
                        { label: "Retirer de la simulation", icon: <Trash2 size={16} />, onSelect: () => onRemove(e.id, e.name), danger: true },
                      ]}
                    />
                  </div>
                  <div className={styles.empFields}>
                    <CommitInput className={styles.rateInput} label={`Taux horaire de ${e.name}`} inputMode="decimal" value={e.hourlyRate ? String(e.hourlyRate) : ""} placeholder="Taux" onCommit={(v) => void persist(updateEmp(sc, e.id, { hourlyRate: Number(v.replace(",", ".")) || 0 }))} />
                    <span className={h.hint}>$/h</span>
                    <select value={e.section ?? "service"} onChange={(ev) => void persist(updateEmp(sc, e.id, { section: ev.target.value }))} aria-label={`Section de ${e.name}`}>
                      <option value="service">Service</option>
                      <option value="cuisine">Cuisine</option>
                      <option value="other">Autre</option>
                    </select>
                  </div>
                  <div className={h.meta}>
                    {e.isFictional && <span className={h.archivedTag}>fictif</span>}
                    {row.isSal && <span>fixe {row.fixedHours} h</span>}
                  </div>
                </th>
                {ALL.map((d) => {
                  const day = row.daily[d];
                  if (!day)
                    return (
                      <td key={d} className={styles.closedCol}>
                        <span className={h.hint}>Fermé</span>
                      </td>
                    );
                  return (
                    <td key={d}>
                      <div className={styles.cellStack}>
                        {day.shifts.map((s, i) => {
                          const hh = hoursFromShift(s);
                          return (
                            <button key={i} className={h.shiftCard} style={{ "--sec": SECTION_COLOR[k] } as React.CSSProperties} onClick={() => onShift(e.id, d, i)} aria-label={`${e.name} ${DAYS[d]} ${s.start} à ${s.end} — modifier`}>
                              <span className={h.shiftTime}>
                                {s.start}–{s.end}
                              </span>
                              <span className={h.shiftMeta}>
                                {fmtHours(hh)} h{row.isSal ? "" : ` · ${fmtMoney(hh * row.rate)}`}
                              </span>
                            </button>
                          );
                        })}
                        <button className={day.shifts.length ? styles.addMore : h.emptyCell} onClick={() => onShift(e.id, d, -1)} aria-label={`Ajouter un quart à ${e.name}, ${DAYS[d]}`}>
                          <Plus size={day.shifts.length ? 11 : 14} aria-hidden />
                          {day.shifts.length ? " Quart" : ""}
                        </button>
                      </div>
                    </td>
                  );
                })}
                <td className={`${h.totalCol} ${styles.totalCell}`}>
                  <div className={styles.line}>
                    <span>Heures</span> {row.totalHours ? hrs(row.totalHours) : "—"}
                  </div>
                  <div className={styles.line}>
                    <span>Salaire</span> {row.grossWage ? fmtMoney(row.grossWage) : "—"}
                  </div>
                  <div className={styles.line}>
                    <span>Pourb.</span> {row.tipShare > 0.005 ? fmtMoney(row.tipShare) : "—"}
                  </div>
                  <div className={`${styles.line} ${styles.lineTotal}`}>
                    <span>Total</span> {row.totalPay ? fmtMoney(row.totalPay) : "—"}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
        <tfoot>
          <tr>
            <th scope="row" className={h.nameCol}>
              Heures
            </th>
            {ALL.map((d) => (
              <td key={d}>{isOpen(d) && cur.dayHours[d] ? hrs(cur.dayHours[d]!) : "—"}</td>
            ))}
            <td className={`${h.totalCol} ${h.strong}`}>{hrs(openDays.reduce((s, d) => s + (cur.dayHours[d] ?? 0), 0))}</td>
          </tr>
          <tr>
            <th scope="row" className={h.nameCol}>
              Coût
            </th>
            {ALL.map((d) => (
              <td key={d}>{isOpen(d) && cur.dayCost[d] ? fmtMoney(cur.dayCost[d]!) : "—"}</td>
            ))}
            <td className={`${h.totalCol} ${h.strong}`}>{fmtMoney(weekCost)}</td>
          </tr>
          <tr className={h.predicted}>
            <th scope="row" className={h.nameCol}>
              Ventes prévues
            </th>
            {ALL.map((d) => (
              <td key={d}>{isOpen(d) && cur.dayCost[d] && ratio > 0 ? fmtMoney(cur.dayCost[d]! / ratio) : "—"}</td>
            ))}
            <td className={`${h.totalCol} ${h.strong}`}>{fmtMoney(ratio > 0 ? weekCost / ratio : 0)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
