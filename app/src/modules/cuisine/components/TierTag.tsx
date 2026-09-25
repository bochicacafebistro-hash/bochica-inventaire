import { CircleAlert, CircleCheck, CircleMinus, CircleDot } from "lucide-react";
import { TIER_LABEL, type MarginTier } from "../cuisine.logic";
import styles from "../Cuisine.module.css";

export function TierTag({ tier }: { tier: MarginTier }) {
  const Icon = tier === "good" ? CircleCheck : tier === "ok" ? CircleDot : tier === "bad" ? CircleAlert : CircleMinus;
  return (
    <span className={`${styles.tag} ${styles[`tier_${tier}`]}`}>
      <Icon size={12} aria-hidden /> {TIER_LABEL[tier]}
    </span>
  );
}
