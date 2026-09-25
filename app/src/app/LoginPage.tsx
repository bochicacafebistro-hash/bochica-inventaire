import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/core/auth/AuthContext";
import { authErrorMessage } from "@/core/auth/authErrors";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import { LANGS, useLang, useMessages, useSetLang, type Messages } from "@/core/i18n/i18n";
import styles from "./LoginPage.module.css";

const fr = {
  tagline: "Gestion interne",
  title: "Connexion",
  user: "Nom d'utilisateur ou courriel",
  userPh: "ex. Bochica",
  password: "Mot de passe",
  hidePw: "Masquer le mot de passe",
  showPw: "Afficher le mot de passe",
  busy: "Connexion…",
  submit: "Se connecter",
  version: "Nouvelle version (v2) — en construction",
  language: "Langue",
};
const MESSAGES: Messages<typeof fr> = {
  fr,
  es: {
    tagline: "Gestión interna",
    title: "Iniciar sesión",
    user: "Usuario o correo",
    userPh: "ej. Bochica",
    password: "Contraseña",
    hidePw: "Ocultar la contraseña",
    showPw: "Mostrar la contraseña",
    busy: "Conectando…",
    submit: "Entrar",
    version: "Nueva versión (v2) — en construcción",
    language: "Idioma",
  },
};

export function LoginPage() {
  const { state, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const m = useMessages(MESSAGES);
  const lang = useLang();
  const setLang = useSetLang();

  const profileError = state.status === "signedOut" ? state.error : undefined;
  const shownError = error ?? profileError;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError(authErrorMessage(err, lang));
      setBusy(false);
    }
  }

  return (
    <div className={styles.bg}>
      <div className={styles.wrap}>
        <div className={styles.brand}>
          <div className={styles.logo}>
            BOCHI<span>CA</span>
          </div>
          <div className={styles.tagline}>{m.tagline}</div>
          <div className={styles.flag} aria-hidden>
            <i />
            <i />
            <i />
          </div>
        </div>

        <Card>
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <div className={styles.titleRow}>
              <h1 className={styles.title}>{m.title}</h1>
              <div className={styles.lang} role="group" aria-label={m.language}>
                {LANGS.map((l) => (
                  <button type="button" key={l.value} aria-pressed={lang === l.value} onClick={() => setLang(l.value)}>
                    {l.label}
                  </button>
                ))}
              </div>
            </div>

            <label className={styles.field}>
              {m.user}
              <input
                className={styles.input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder={m.userPh}
                required
                autoFocus
              />
            </label>

            <label className={styles.field}>
              {m.password}
              <div className={styles.pwWrap}>
                <input
                  className={styles.input}
                  type={showPw ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  className={styles.pwToggle}
                  onClick={() => setShowPw((v) => !v)}
                  aria-label={showPw ? m.hidePw : m.showPw}
                >
                  {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </label>

            {shownError && (
              <div className={styles.error} role="alert">
                {shownError}
              </div>
            )}

            <Button type="submit" block disabled={busy || !username || !password}>
              {busy ? m.busy : m.submit}
            </Button>
          </form>
        </Card>
        <p className={styles.version}>{m.version}</p>
      </div>
    </div>
  );
}
