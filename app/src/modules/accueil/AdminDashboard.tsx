import { useMemo } from "react";
import { Link } from "react-router";
import { Area, AreaChart, ResponsiveContainer } from "recharts";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  DollarSign,
  Package,
  Receipt,
  ShieldCheck,
  Sun,
  TrendingDown,
  TrendingUp,
  Users,
  UtensilsCrossed,
  Wallet,
} from "lucide-react";
import { displayName } from "@/core/auth/roles";
import { useSessionUser } from "@/core/auth/AuthContext";
import { addDays, daysBetween, isoToDate } from "@/core/dates";
import { useCollection } from "@/core/data/useCollection";
import { useDocument } from "@/core/data/useDocument";
import { useToday } from "@/core/useToday";
import type { Ingredient, MenuItem } from "@/modules/cuisine/cuisine.types";
import { openDayIndexes, timeOffFor, weekDays, weekStart } from "@/modules/equipe/equipe.logic";
import type { Employee, EmployeeComp, LeaveRequest, ScheduleSettings } from "@/modules/equipe/equipe.types";
import { SECTION_COLOR } from "@/modules/equipe/sections";
import { typeShort, type BEvent } from "@/modules/evenements/evenements.logic";
import { currentQuarter, pendingFixedExpenses, taxesForPeriod } from "@/modules/finances/finances.logic";
import type { Expense, FixedTemplate, Revenue } from "@/modules/finances/finances.types";
import { stockOf, minimumOf } from "@/modules/inventaire/inventaire.logic";
import type { Product } from "@/modules/inventaire/inventaire.types";
import type { KanbanTask } from "@/modules/operations/ops.types";
import { computePayroll, detectAlerts, payrollPeople } from "@/modules/paie/paie.logic";
import type { PayrollSettings, PayrollWeekDoc } from "@/modules/paie/paie.types";
import { payrollWeekId } from "@/modules/pointage/punch.logic";
import { useChartTheme } from "@/ui/chartTheme";
import { fmtDec1, fmtMoney } from "@/ui/format";
import { PageHeader } from "@/ui/PageHeader";
import { relativeDate } from "@/core/dates";
import {
  avgMenuMargin,
  criticalStock,
  dayTag,
  eventsBetween,
  monthSummary,
  overdueTasks,
  pendingLeaves,
  shiftsToday,
  spark30,
  taxUrgency,
  tasksDueToday,
  topExpenses,
} from "./dashboard.logic";
import styles from "./Dashboard.module.css";

const SEC_LABEL = { cuisine: "Cuisine", service: "Service", other: "Autre" } as const;
const LEVEL = { good: "var(--status-green, #3f8f3a)", warn: "#b45309", bad: "var(--status-red, #c0392b)" } as const;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Admin : tableau de bord exécutif (la journée, le mois, les alertes). */
export function AdminDashboard() {
  const user = useSessionUser();
  const today = useToday();
  const now = useMemo(() => isoToDate(today)!, [today]);
  const revQ = useCollection<Revenue>("revenues");
  const expQ = useCollection<Expense>("expenses");
  const tplQ = useCollection<FixedTemplate>("fixedExpenseTemplates");
  const prodQ = useCollection<Product>("products");
  const taskQ = useCollection<KanbanTask>("tasks");
  const evQ = useCollection<BEvent>("events");
  const menuQ = useCollection<MenuItem>("menu");
  const ingQ = useCollection<Ingredient>("ingredients");
  const empQ = useCollection<Employee>("employees");
  const compQ = useCollection<EmployeeComp>("employeesComp");
  const leaveQ = useCollection<LeaveRequest>("leaveRequests");
  const remQ = useCollection<{ id: string; period?: string }>("taxRemittances");
  const schedQ = useDocument<ScheduleSettings>("settings", "schedule");
  const paySetQ = useDocument<PayrollSettings>("settings", "payroll");
  const monday = weekStart(today);
  const weekQ = useDocument<PayrollWeekDoc>("payroll", payrollWeekId(monday));
  const theme = useChartTheme();

  const month = useMemo(() => monthSummary(revQ.data, expQ.data, now), [revQ.data, expQ.data, now]);
  const sparkRev = useMemo(() => spark30(revQ.data, today), [revQ.data, today]);
  const sparkExp = useMemo(() => spark30(expQ.data, today), [expQ.data, today]);
  const margin = useMemo(() => avgMenuMargin(menuQ.data, ingQ.data), [menuQ.data, ingQ.data]);
  const q = currentQuarter(today);
  const taxes = taxesForPeriod(revQ.data, expQ.data, q.start, q.end);
  const toRemit = taxes.tpsToRemit + taxes.tvqToRemit;
  const daysLeft = daysBetween(today, q.due) ?? 0;
  const remitted = !remQ.error && remQ.data.some((r) => r.period === q.key);
  const fixed = pendingFixedExpenses(tplQ.data, expQ.data, today);
  const leaves = pendingLeaves(leaveQ.data);
  const team = shiftsToday(empQ.data, today);
  const weekEvents = eventsBetween(evQ.data, monday, addDays(monday, 6));
  const upcoming = eventsBetween(evQ.data, today, addDays(today, 60)).slice(0, 5);
  const dueToday = tasksDueToday(taskQ.data, today);
  const overdue = overdueTasks(taskQ.data, today);
  const critical = criticalStock(prodQ.data);
  const top = topExpenses(expQ.data, month.cur.start, month.cur.end);

  // Ratio salaires / ventes de la semaine = même calcul que Salaires & Pourboires (heures réelles ÷ ventes nettes saisies)
  const pay = useMemo(() => {
    const sched = schedQ.data ?? {};
    const dows = openDayIndexes(sched);
    const all = weekDays(monday);
    const days = dows.map((i) => all[i]!);
    const people = payrollPeople(empQ.data, compQ.data, weekQ.data, sched, monday, today);
    const res = computePayroll({ people, week: weekQ.data, settings: paySetQ.data, monday, days, dows, targetRatio: Number(sched.salesRatio) || 0.32 });
    const onLeave = (id: string, dk: string) => {
      const e = empQ.data.find((x) => x.id === id);
      return !!e && !!timeOffFor(e, dk, leaveQ.data);
    };
    return { res, alerts: detectAlerts(res.rows, !!weekQ.data?.locked, today, onLeave), target: Number(sched.salesRatio) || 0.32 };
  }, [schedQ.data, monday, empQ.data, compQ.data, weekQ.data, paySetQ.data, today, leaveQ.data]);
  const payWarn = pay.alerts.filter((a) => a.severity === "warning").length;

  const profit = month.cur.profit;
  return (
    <div className="page">
      <PageHeader eyebrow="Tableau de bord" title={`Bonjour, ${displayName(user.email)}`} />

      {(leaves.count > 0 || fixed.entries.length > 0 || payWarn > 0) && (
        <div className={styles.banners}>
          {leaves.count > 0 && (
            <Link to="/demandes-conge" className={`${styles.banner} ${styles.bannerWarn}`}>
              <Sun size={20} aria-hidden />
              <span>
                <strong>
                  {leaves.count} demande{leaves.count > 1 ? "s" : ""} de congé en attente
                </strong>
                <small>{leaves.names} — approuver ou refuser</small>
              </span>
              <ArrowRight size={18} aria-hidden />
            </Link>
          )}
          {payWarn > 0 && (
            <Link to="/salaires" className={`${styles.banner} ${styles.bannerWarn}`}>
              <AlertTriangle size={20} aria-hidden />
              <span>
                <strong>
                  {payWarn} pointage{payWarn > 1 ? "s" : ""} à vérifier cette semaine
                </strong>
                <small>Sorties manquantes ou remplies automatiquement — Salaires & Pourboires</small>
              </span>
              <ArrowRight size={18} aria-hidden />
            </Link>
          )}
          {fixed.entries.length > 0 && (
            <Link to="/depenses" className={styles.banner}>
              <Receipt size={20} aria-hidden />
              <span>
                <strong>Frais fixes à créer ({fixed.entries.length})</strong>
                <small>{fixed.months.join(", ")} — bouton « Créer maintenant » dans Dépenses & Revenus</small>
              </span>
              <ArrowRight size={18} aria-hidden />
            </Link>
          )}
        </div>
      )}

      {/* ── Aujourd'hui ── */}
      <section className={styles.today} aria-labelledby="dash-today">
        <div className={styles.todayHead}>
          <h2 id="dash-today" className={styles.todayDate}>
            {cap(now.toLocaleDateString("fr-CA", { weekday: "long" }))}
            <small>{now.toLocaleDateString("fr-CA", { day: "numeric", month: "long", year: "numeric" })}</small>
          </h2>
          <Link to="/salaires" className={styles.ratio} title="Salaires réels de la semaine ÷ ventes nettes saisies dans Salaires & Pourboires">
            <span className={styles.ratioNum} style={{ color: pay.res.ratioLevel === "empty" ? undefined : LEVEL[pay.res.ratioLevel] }}>
              {pay.res.totalNet > 0 ? `${fmtDec1(pay.res.salesRatio * 100)} %` : "—"}
            </span>
            <span className={styles.ratioLabel}>
              Ratio salaires / ventes (sem.)
              <br />
              {pay.res.totalNet > 0 ? `cible ${Math.round(pay.target * 100)} %` : "ventes nettes pas encore saisies"}
            </span>
          </Link>
        </div>
        <div className={styles.todayGrid}>
          <div className={styles.block}>
            <div className={styles.blockTitle}>
              <Users size={13} aria-hidden /> En quart aujourd'hui ({team.count})
            </div>
            {team.count === 0 ? (
              <div className={styles.empty}>Personne à l'horaire aujourd'hui</div>
            ) : (
              team.groups.map((g) => (
                <div key={g.key} className={styles.secGroup}>
                  <div className={styles.secHead} style={{ color: SECTION_COLOR[g.key] }}>
                    <span className={styles.dot} style={{ background: SECTION_COLOR[g.key] }} aria-hidden /> {SEC_LABEL[g.key]} · {g.list.length}
                  </div>
                  {g.list.map((s) => (
                    <div key={s.id} className={styles.item} style={{ borderLeftColor: SECTION_COLOR[g.key] }}>
                      <span className={styles.itemName}>{s.name}</span>
                      <span className={styles.time}>
                        {s.start}
                        {s.end ? `–${s.end}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
          <div className={styles.block}>
            <div className={styles.blockTitle}>
              <CalendarDays size={13} aria-hidden /> Événements cette semaine ({weekEvents.length})
            </div>
            {weekEvents.length === 0 ? (
              <div className={styles.empty}>Aucun événement cette semaine</div>
            ) : (
              <>
                {weekEvents.slice(0, 6).map((e) => (
                  <Link key={e.id} to="/evenements" className={`${styles.item} ${e.date === today ? styles.itemToday : ""}`}>
                    <span className={styles.dayTag}>{dayTag(e.date!, today)}</span>
                    <span className={styles.itemName}>{e.name || "Sans nom"}</span>
                    {e.time && <span className={styles.time}>{e.time}</span>}
                  </Link>
                ))}
                {weekEvents.length > 6 && <div className={styles.empty}>+ {weekEvents.length - 6} autres…</div>}
              </>
            )}
          </div>
          <div className={styles.block}>
            <div className={styles.blockTitle}>
              <ClipboardList size={13} aria-hidden /> Tâches dues aujourd'hui ({dueToday.length})
            </div>
            {dueToday.length === 0 ? (
              <div className={styles.empty}>Tout est à jour</div>
            ) : (
              dueToday.map((t) => (
                <Link key={t.id} to="/taches" className={styles.item}>
                  <span className={styles.itemName}>{t.title || "Sans titre"}</span>
                  {t.priority === "haute" && <span className={styles.urgent}>Urgent</span>}
                </Link>
              ))
            )}
          </div>
        </div>
      </section>

      {/* ── Le mois ── */}
      <div className={styles.stats}>
        <Stat icon={Wallet} label="Revenus du mois" value={fmtMoney(month.cur.revenue)} delta={month.revChange} good="up" color={theme.series[3]!} spark={sparkRev} />
        <Stat icon={TrendingDown} label="Dépenses du mois" value={fmtMoney(month.cur.expenses)} delta={month.expChange} good="down" color={theme.series[2]!} spark={sparkExp} />
        <Stat icon={profit >= 0 ? TrendingUp : TrendingDown} label="Profit du mois" value={`${fmtMoney(Math.abs(profit))}${profit < 0 ? " (déficit)" : ""}`} delta={month.profitChange} good="up" color={profit >= 0 ? theme.series[0]! : theme.series[2]!} spark={sparkRev.map((r, i) => r - sparkExp[i]!)} />
        {margin.count > 0 && (
          <Stat
            icon={UtensilsCrossed}
            label="Marge moyenne du menu"
            value={`${fmtDec1(margin.pct)} %`}
            note={`${margin.count} plat${margin.count > 1 ? "s" : ""} avec recette`}
            color={margin.pct >= 70 ? LEVEL.good : margin.pct >= 50 ? LEVEL.warn : LEVEL.bad}
          />
        )}
      </div>
      <p className={styles.hint}>Montants avant taxes · variation par rapport au mois précédent · courbe : 30 derniers jours.</p>

      <div className={styles.grid}>
        {/* Taxes */}
        <Card
          tone={remitted ? "ok" : taxUrgency(daysLeft) === "late" ? "danger" : taxUrgency(daysLeft) === "soon" ? "warn" : "ok"}
          icon={remitted ? ShieldCheck : taxUrgency(daysLeft) === "ok" ? ShieldCheck : AlertTriangle}
          title="TPS / TVQ à remettre"
          to="/taxes"
        >
          <div className={styles.tax}>
            <div>
              Trimestre {q.quarter} · {q.year}
              <br />
              <small className={styles.muted}>Échéance {q.due}</small>
              <br />
              {remitted ? (
                <strong style={{ color: LEVEL.good }}>Remis ✓</strong>
              ) : daysLeft < 0 ? (
                <strong style={{ color: LEVEL.bad }}>En retard ({-daysLeft} j)</strong>
              ) : (
                <strong style={{ color: daysLeft <= 15 ? LEVEL.warn : undefined }}>Dans {daysLeft} jours</strong>
              )}
            </div>
            <div className={styles.taxAmount}>
              <small className={styles.muted}>{toRemit < 0 ? "Crédit à récupérer" : "À remettre"}</small>
              <strong style={{ color: toRemit > 0 ? undefined : LEVEL.good }}>{fmtMoney(Math.abs(toRemit))}</strong>
            </div>
          </div>
          <div className={styles.taxSplit}>
            <span>TPS : {fmtMoney(taxes.tpsToRemit)}</span>
            <span>TVQ : {fmtMoney(taxes.tvqToRemit)}</span>
          </div>
        </Card>

        <Card tone="plain" icon={CalendarDays} title="Prochains événements" to="/evenements">
          {upcoming.length === 0 ? (
            <div className={styles.empty}>Aucun événement dans les 60 prochains jours.</div>
          ) : (
            <ul className={styles.list}>
              {upcoming.map((e) => (
                <li key={e.id}>
                  <span className={styles.itemName}>
                    <span className={styles.pill}>{typeShort(e.type)}</span> {e.name || "?"}
                    <small>
                      {relativeDate(e.date!, today)}
                      {e.time ? ` · ${e.time}` : ""}
                      {e.capacity ? ` · ${e.capacity} pers.` : ""}
                      {e.status === "attente" ? " · en attente" : ""}
                    </small>
                  </span>
                  <span className={styles.muted}>{e.date}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card tone={critical.length ? "danger" : "ok"} icon={critical.length ? AlertTriangle : Package} title="Stock critique" to="/a-commander">
          {critical.length === 0 ? (
            <div className={styles.empty}>Aucun produit sous le minimum.</div>
          ) : (
            <ul className={styles.list}>
              {critical.map((p) => (
                <li key={p.id}>
                  <span className={styles.itemName}>{p.name || "?"}</span>
                  <strong style={{ color: LEVEL.bad }}>
                    {stockOf(p)} / {minimumOf(p)}
                  </strong>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card tone={overdue.length ? "warn" : "ok"} icon={overdue.length ? AlertTriangle : ClipboardList} title="Tâches en retard" to="/taches">
          {overdue.length === 0 ? (
            <div className={styles.empty}>Aucune tâche en retard.</div>
          ) : (
            <ul className={styles.list}>
              {overdue.map((t) => (
                <li key={t.id}>
                  <span className={styles.itemName}>{t.title || "?"}</span>
                  <small style={{ color: LEVEL.bad }}>{t.dueDate}</small>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card tone="plain" icon={DollarSign} title="Plus grosses dépenses du mois" to="/depenses">
          {top.length === 0 ? (
            <div className={styles.empty}>Aucune dépense ce mois-ci.</div>
          ) : (
            <ul className={styles.list}>
              {top.map((e) => (
                <li key={e.id}>
                  <span className={styles.itemName}>
                    {e.description || "?"}
                    <small>
                      {e.supplier ? `${e.supplier} · ` : ""}
                      {e.date}
                    </small>
                  </span>
                  <strong>{fmtMoney(Number(e.amount) || 0)}</strong>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}

function Stat({ icon: Icon, label, value, delta, good, note, color, spark }: { icon: typeof Wallet; label: string; value: string; delta?: number; good?: "up" | "down"; note?: string; color: string; spark?: number[] }) {
  const show = delta !== undefined && Number.isFinite(delta) && Math.abs(delta) >= 0.1;
  const isGood = show && (delta! > 0) === (good === "up");
  return (
    <div className={styles.stat} style={{ borderLeftColor: color }}>
      {spark && spark.some((v) => v !== 0) && (
        <div className={styles.spark} aria-hidden>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={spark.map((v, i) => ({ i, v }))} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
              <Area type="monotone" dataKey="v" stroke={color} strokeWidth={2} fill={color} fillOpacity={0.12} isAnimationActive={false} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
      <div className={styles.statHead}>
        <Icon size={16} aria-hidden style={{ color }} /> {label}
      </div>
      <div className={styles.statValue}>{value}</div>
      {show ? (
        <div className={styles.delta} style={{ color: isGood ? LEVEL.good : LEVEL.bad }}>
          {delta! > 0 ? "▲ +" : "▼ "}
          {fmtDec1(delta!)} % <span className={styles.muted}>vs mois dernier</span>
        </div>
      ) : (
        <div className={`${styles.delta} ${styles.muted}`}>{note ?? "stable vs mois dernier"}</div>
      )}
    </div>
  );
}

function Card({ tone, icon: Icon, title, to, children }: { tone: "ok" | "warn" | "danger" | "plain"; icon: typeof Wallet; title: string; to: string; children: React.ReactNode }) {
  return (
    <section className={`${styles.card} ${styles[tone]}`} aria-label={title}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>
          <Icon size={16} aria-hidden /> {title}
        </h3>
        <Link to={to} className={styles.more} aria-label={`Voir : ${title}`}>
          <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
      {children}
    </section>
  );
}

