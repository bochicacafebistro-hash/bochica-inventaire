import { useState, type FormEvent } from "react";
import { Eye, EyeOff } from "lucide-react";
import { useAuth } from "@/core/auth/AuthContext";
import { authErrorMessage } from "@/core/auth/authErrors";
import { Button } from "@/ui/Button";
import { Card } from "@/ui/Card";
import styles from "./LoginPage.module.css";

export function LoginPage() {
  const { state, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const profileError = state.status === "signedOut" ? state.error : undefined;
  const shownError = error ?? profileError;

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await login(username, password);
    } catch (err) {
      setError(authErrorMessage(err));
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
          <div className={styles.tagline}>Gestion interne</div>
          <div className={styles.flag} aria-hidden>
            <i />
            <i />
            <i />
          </div>
        </div>

        <Card>
          <form className={styles.form} onSubmit={onSubmit} noValidate>
            <h1 className={styles.title}>Connexion</h1>

            <label className={styles.field}>
              Nom d'utilisateur ou courriel
              <input
                className={styles.input}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoCapitalize="none"
                spellCheck={false}
                placeholder="ex. Bochica"
                required
                autoFocus
              />
            </label>

            <label className={styles.field}>
              Mot de passe
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
                  aria-label={showPw ? "Masquer le mot de passe" : "Afficher le mot de passe"}
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
              {busy ? "Connexion…" : "Se connecter"}
            </Button>
          </form>
        </Card>
        <p className={styles.version}>Nouvelle version (v2) — en construction</p>
      </div>
    </div>
  );
}
