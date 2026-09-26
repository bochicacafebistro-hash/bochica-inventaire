import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
import styles from "../Horaire.module.css";

const NAMES = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi", "Samedi", "Dimanche"];

export function OpenDaysModal({ open, onClose, onToggle }: { open: number[]; onClose: () => void; onToggle: (day: number, on: boolean) => void }) {
  return (
    <Modal open title="Jours d'ouverture" onClose={onClose} width={380} footer={<Button onClick={onClose}>Fermer</Button>}>
      <p className={styles.hint} style={{ marginBottom: 12 }}>
        Les jours décochés sont cachés de l'horaire (et de « Mon horaire » des employés). Au moins un jour doit rester ouvert.
      </p>
      <div className={styles.daysGrid}>
        {NAMES.map((n, i) => (
          <label key={n} className={styles.checkLine}>
            <input type="checkbox" checked={open.includes(i)} disabled={open.length === 1 && open.includes(i)} onChange={(e) => onToggle(i, e.target.checked)} /> {n}
          </label>
        ))}
      </div>
    </Modal>
  );
}
