import { useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useDataActions } from "@/core/data/useDataActions";
import { newId } from "@/core/data/ids";
import { Button } from "@/ui/Button";
import { Modal } from "@/ui/Modal";
import { useToast } from "@/ui/Toast";
import { buildSection, sectionText } from "../ops.logic";
import type { ChecklistItem } from "../ops.types";
import styles from "../Ops.module.css";

const PH = {
  "opening-cuisine": "Allumer la friteuse\nMonter la plancha en température\nSortir les bacs de prep",
  "opening-service": "Vérifier la caisse\nDescendre les chaises\nMettre les tables",
  "closing-cuisine": "Nettoyer la plancha\nÉteindre les équipements\nRanger les bacs au frigo",
  "closing-service": "Fermer la caisse\nSortir les poubelles\nLaver les tables",
} as const;
type Zone = keyof typeof PH;

/** Éditeur admin : 4 zones (ouverture/fermeture × cuisine/service), une ligne = un élément. */
export function OpenCloseEditor({ opening, closing, onClose }: { opening: ChecklistItem[]; closing: ChecklistItem[]; onClose: () => void }) {
  const actions = useDataActions();
  const toast = useToast();
  const [text, setText] = useState<Record<Zone, string>>({
    "opening-cuisine": sectionText(opening, "cuisine"),
    "opening-service": sectionText(opening, "service"),
    "closing-cuisine": sectionText(closing, "cuisine"),
    "closing-service": sectionText(closing, "service"),
  });
  const [saving, setSaving] = useState(false);

  async function save() {
    const usedO = new Set<string>();
    const usedC = new Set<string>();
    const id = () => newId();
    const nextOpening = [...buildSection(text["opening-cuisine"], "cuisine", opening, usedO, id), ...buildSection(text["opening-service"], "service", opening, usedO, id)];
    const nextClosing = [...buildSection(text["closing-cuisine"], "cuisine", closing, usedC, id), ...buildSection(text["closing-service"], "service", closing, usedC, id)];
    setSaving(true);
    try {
      await actions.setFixed("settings", "openClose", { opening: nextOpening, closing: nextClosing, updatedAt: Date.now() });
      await actions.log("Ouverture / Fermeture", "Listes modifiées", `${nextOpening.length} ouverture · ${nextClosing.length} fermeture`);
      toast("Listes enregistrées.", "success");
      onClose();
    } catch (err) {
      toast(`Enregistrement impossible : ${(err as Error).message}`, "error");
    } finally {
      setSaving(false);
    }
  }

  const zone = (z: Zone, Icon: typeof Sun, label: string) => (
    <label>
      <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}>
        <Icon size={14} aria-hidden /> {label}
      </span>
      <textarea value={text[z]} onChange={(e) => setText((t) => ({ ...t, [z]: e.target.value }))} placeholder={PH[z]} />
    </label>
  );

  return (
    <Modal
      open
      title="Modifier les listes d'ouverture / fermeture"
      onClose={onClose}
      width={820}
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Annuler
          </Button>
          <Button onClick={() => void save()} disabled={saving}>
            {saving ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </>
      }
    >
      <p className={styles.hint} style={{ marginBottom: 12 }}>
        Une ligne = un élément. Les lignes vides sont ignorées. Un élément dont le texte ne change pas reste coché aujourd'hui.
      </p>
      <div className={styles.grid4}>
        {zone("opening-cuisine", Sun, "Ouverture · Cuisine")}
        {zone("opening-service", Sun, "Ouverture · Service")}
        {zone("closing-cuisine", Moon, "Fermeture · Cuisine")}
        {zone("closing-service", Moon, "Fermeture · Service")}
      </div>
    </Modal>
  );
}
