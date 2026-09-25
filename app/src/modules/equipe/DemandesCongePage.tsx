import { useMemo, useState } from "react";
import { Check, CircleAlert, Clock, FileText, Sun, Trash2, User, X } from "lucide-react";
import { useSessionUser } from "@/core/auth/AuthContext";
import { displayName } from "@/core/auth/roles";
import { isoToDate } from "@/core/dates";
import { useCollection } from "@/core/data/useCollection";
import { useDataActions } from "@/core/data/useDataActions";
import { useToday } from "@/core/useToday";
import { Button } from "@/ui/Button";
import { useConfirm } from "@/ui/Confirm";
import { EmptyState } from "@/ui/EmptyState";
import { PageHeader } from "@/ui/PageHeader";
import { Spinner } from "@/ui/Spinner";
import { useToast } from "@/ui/Toast";
import { byRequestedDesc, hasShift, isPast, leaveMeta } from "./equipe.logic";
import type { Employee, LeaveRequest } from "./equipe.types";
import styles from "./Equipe.module.css";

const COL = "leaveRequests";
const FILTERS = [
  { key: "pending", label: "En attente" },
  { key: "approved", label: "Approuvées" },
  { key: "rejected", label: "Refusées" },
  { key: "all", label: "Toutes" },
] as const;
type Filter = (typeof FILTERS)[number]["key"];

const short = (dk: string) => isoToDate(dk)?.toLocaleDateString("fr-CA", { weekday: "short", day: "numeric", month: "short" }) ?? dk;

export function datesLabel(r: LeaveRequest): string {
  if (r.kind === "partial" && r.partial) return `${short(r.partial.dk)} · ${r.partial.mode === "late" ? "entre à" : "finit à"} ${r.partial.time}`;
  const ds = [...(r.dates ?? [])].sort();
  if (!ds.length) return "—";
  return ds.length === 1 ? short(ds[0]!) : `${ds.length} jours : ${ds.map(short).join(" · ")}`;
}

/** Admin : approuver / refuser les demandes de congé. */
export default function DemandesCongePage() {
  const user = useSessionUser();
  const q = useCollection<LeaveRequest>(COL);
  const empQ = useCollection<Employee>("employees");
  const actions = useDataActions();
  const confirm = useConfirm();
  const toast = useToast();
  const today = useToday();
  const [filter, setFilter] = useState<Filter>("pending");

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: q.data.length, pending: 0, approved: 0, rejected: 0 };
    for (const r of q.data) c[r.status ?? "pending"] = (c[r.status ?? "pending"] ?? 0) + 1;
    return c;
  }, [q.data]);
  const list = useMemo(() => (filter === "all" ? q.data : q.data.filter((r) => (r.status ?? "pending") === filter)).slice().sort(byRequestedDesc), [q.data, filter]);
  const fail = (what: string) => (err: unknown) => toast(`${what} impossible : ${(err as Error).message}`, "error");

  /** Quarts déjà prévus sur les jours demandés (utile avant d'approuver). */
  const conflicts = (r: LeaveRequest) => {
    const emp = empQ.data.find((e) => e.id === r.empId);
    if (!emp || r.kind === "partial") return [];
    return (r.dates ?? []).filter((dk) => hasShift(emp.shifts?.[dk]));
  };

  async function decide(r: LeaveRequest, status: "approved" | "rejected") {
    try {
      await actions.update(COL, r.id, { status, ...(status === "approved" ? { autoApproved: false } : {}), decidedAt: Date.now(), decidedBy: displayName(user.email) });
      await actions.log(r.empName ?? "", status === "approved" ? "Congé — approuvé" : "Congé — refusé", datesLabel(r));
      toast(status === "approved" ? "Demande approuvée — le congé apparaît dans les horaires." : "Demande refusée.", "success");
    } catch (err) {
      fail("Décision")(err);
    }
  }

  async function remove(r: LeaveRequest) {
    const ok = await confirm({
      title: "Retirer la demande ?",
      message: `Retirer la demande de congé de « ${r.empName} » ?${r.status === "approved" ? " Le congé disparaîtra des horaires." : ""}`,
      danger: true,
      confirmLabel: "Retirer",
    });
    if (!ok) return;
    try {
      await actions.remove(COL, r.id);
      await actions.log(r.empName ?? "", "Congé — demande retirée", datesLabel(r));
      toast("Demande retirée.", "success");
    } catch (err) {
      fail("Suppression")(err);
    }
  }

  return (
    <div className="page">
      <PageHeader eyebrow="RH & Horaires" title="Demandes de congé" />
      <p className={styles.pinSub} style={{ textAlign: "left", marginBottom: 16 }}>
        Les demandes à plus de 2 semaines sont approuvées automatiquement. Celles à 2 semaines ou moins attendent ta décision.
      </p>
      <div className={styles.chips} role="group" aria-label="Filtrer">
        {FILTERS.map((f) => (
          <button key={f.key} className={styles.chip} aria-pressed={filter === f.key} onClick={() => setFilter(f.key)}>
            {f.label} <span className={styles.chipCount}>{counts[f.key] ?? 0}</span>
          </button>
        ))}
      </div>
      {q.error ? (
        <EmptyState icon={Sun} title="Impossible de charger les demandes">
          {q.error.message}
        </EmptyState>
      ) : q.loading ? (
        <Spinner />
      ) : list.length === 0 ? (
        <EmptyState icon={Sun} title={filter === "pending" ? "Aucune demande en attente" : "Aucune demande"} />
      ) : (
        <div className={styles.cards}>
          {list.map((r) => {
            const meta = leaveMeta(r.type);
            const st = r.status ?? "pending";
            const clash = st === "pending" ? conflicts(r) : [];
            const past = (r.dates ?? []).length > 0 && (r.dates ?? []).every((dk) => isPast(dk, today));
            const when = r.requestedAt ? new Date(Number(r.requestedAt)).toLocaleString("fr-CA", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "";
            return (
              <article key={r.id} className={styles.reqCard} style={{ "--leave-color": meta.color } as React.CSSProperties}>
                <div className={styles.reqTop}>
                  <span className={styles.reqEmp}>
                    <User size={15} aria-hidden /> {r.empName}
                  </span>
                  <span className={`${styles.status} ${styles[`st_${st}`] ?? ""}`}>
                    {st === "approved" ? <Check size={12} aria-hidden /> : st === "rejected" ? <X size={12} aria-hidden /> : <Clock size={12} aria-hidden />}
                    {st === "approved" ? `Approuvé${r.autoApproved ? " (auto)" : ""}` : st === "rejected" ? "Refusé" : "En attente"}
                  </span>
                </div>
                <div className={styles.reqMeta}>
                  <span className={styles.reqType}>{meta.label}</span>
                  <span>{r.kind === "partial" ? "Congé partiel" : `${(r.dates ?? []).length} jour(s)`}</span>
                  {when && (
                    <span>
                      <Clock size={11} aria-hidden /> demandé le {when}
                    </span>
                  )}
                  {past && <span>(passé)</span>}
                </div>
                <div className={styles.reqDates}>{datesLabel(r)}</div>
                {r.reason && (
                  <div className={styles.reqReason}>
                    <FileText size={12} aria-hidden /> {r.reason}
                  </div>
                )}
                {clash.length > 0 && (
                  <div className={styles.warn}>
                    <CircleAlert size={12} aria-hidden /> Déjà à l'horaire : {clash.map(short).join(", ")} (le quart reste, à retirer dans l'horaire)
                  </div>
                )}
                {st !== "pending" && r.decidedBy && (
                  <div className={styles.reqDecided}>
                    {st === "approved" ? "Approuvé" : "Refusé"} {r.decidedBy === "auto" ? "automatiquement" : `par ${r.decidedBy}`}
                  </div>
                )}
                <div className={styles.reqActions}>
                  {st === "pending" ? (
                    <>
                      <Button onClick={() => void decide(r, "approved")}>
                        <Check size={16} aria-hidden /> Approuver
                      </Button>
                      <Button variant="secondary" onClick={() => void decide(r, "rejected")}>
                        <X size={16} aria-hidden /> Refuser
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" onClick={() => void remove(r)}>
                      <Trash2 size={16} aria-hidden /> Retirer
                    </Button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
