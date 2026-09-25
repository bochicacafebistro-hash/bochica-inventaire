import type { AnchorHTMLAttributes, ButtonHTMLAttributes } from "react";
import styles from "./Button.module.css";

type Variant = "primary" | "secondary" | "ghost";

interface CommonProps {
  variant?: Variant;
  block?: boolean;
}

function classes(variant: Variant, block?: boolean, extra?: string) {
  return [styles.btn, styles[variant], block && styles.block, extra].filter(Boolean).join(" ");
}

export function Button({
  variant = "primary",
  block,
  className,
  type = "button",
  ...rest
}: CommonProps & ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type={type} className={classes(variant, block, className)} {...rest} />;
}

export function LinkButton({
  variant = "primary",
  block,
  className,
  ...rest
}: CommonProps & AnchorHTMLAttributes<HTMLAnchorElement>) {
  return <a className={classes(variant, block, className)} {...rest} />;
}
