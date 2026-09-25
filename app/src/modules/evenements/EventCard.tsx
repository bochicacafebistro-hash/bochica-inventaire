import { Clock, Copy, Mail, Pencil, Phone, Trash2, User, Users } from "lucide-react";
import { isoToDate, monthShortName, relativeDate, todayISO } from "@/core/dates";
import { telHref } from "@/core/text";
import { ActionMenu } from "@/ui/ActionMenu";
import { statusLabel, typeShort, type BEvent } from "./evenements.logic";
import { TypeIcon } from "./typeMeta";
import styles from "./Evenements.module.css";

export function EventCard({
  ev,
  color,
  canEdit,
  onEdit,
  onDuplicate,
  onDelete,
}: {
  ev: BEvent;
  color: string;
  canEdit: boolean;
  onEdit: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const d = isoToDate(ev.date);
  const status = ev.status || "confirme";
  const past = !!ev.date && ev.date < todayISO();
  const tel = ev.contactPhone ? telHref(ev.contactPhone) : null;
  return (
    <article
      className={`${styles.card} ${past ? styles.past : ""} ${status === "annule" ? styles.cancelledCard : ""}`}
      style={{ ["--c" as string]: color }}
    >
      <div className={styles.date}>
        <div className={styles.dateDay}>{d?.getDate() ?? "?"}</div>
        <div className={styles.dateMon}>{d ? monthShortName(d.getMonth()) : ""}</div>
        <div className={styles.dateRel}>{ev.date ? relativeDate(ev.date) : ""}</div>
      </div>
      <div>
        <div className={styles.cardHead}>
          <h3 className={styles.cardName}>{ev.name}</h3>
          <span className={styles.tag}>
            <span className={styles.swatch} style={{ background: color }} aria-hidden />
            <TypeIcon type={ev.type} /> {typeShort(ev.type)}
          </span>
          {status !== "confirme" && <span className={`${styles.tag} ${styles[`status_${status}`]}`}>{statusLabel(status)}</span>}
        </div>
        <div className={styles.meta}>
          {ev.time && (
            <span className={styles.metaItem}>
              <Clock size={13} aria-hidden /> {ev.time}
            </span>
          )}
          {ev.capacity != null && ev.capacity > 0 && (
            <span className={styles.metaItem}>
              <Users size={13} aria-hidden /> {ev.capacity} pers.
            </span>
          )}
          {ev.contactName && (
            <span className={styles.metaItem}>
              <User size={13} aria-hidden /> {ev.contactName}
            </span>
          )}
          {ev.contactPhone && (
            <span className={styles.metaItem}>
              <Phone size={13} aria-hidden /> {tel ? <a href={tel}>{ev.contactPhone}</a> : ev.contactPhone}
            </span>
          )}
          {ev.contactEmail && (
            <span className={styles.metaItem}>
              <Mail size={13} aria-hidden /> <a href={`mailto:${ev.contactEmail}`}>{ev.contactEmail}</a>
            </span>
          )}
        </div>
        {ev.notes && <div className={styles.notes}>{ev.notes}</div>}
      </div>
      {canEdit ? (
        <ActionMenu
          label={`Actions pour ${ev.name}`}
          items={[
            { label: "Modifier", icon: <Pencil size={14} />, onSelect: onEdit },
            { label: "Dupliquer", icon: <Copy size={14} />, onSelect: onDuplicate },
            { label: "Supprimer", icon: <Trash2 size={14} />, danger: true, onSelect: onDelete },
          ]}
        />
      ) : (
        <span />
      )}
    </article>
  );
}
