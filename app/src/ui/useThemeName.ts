import { useEffect, useState } from "react";
import type { Theme } from "./useTheme";

/** Thème actif (lu sur <html data-theme>), mis à jour quand il change. */
export function useThemeName(): Theme {
  const read = (): Theme => (document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  const [theme, setTheme] = useState<Theme>(read);
  useEffect(() => {
    const obs = new MutationObserver(() => setTheme(read()));
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => obs.disconnect();
  }, []);
  return theme;
}
