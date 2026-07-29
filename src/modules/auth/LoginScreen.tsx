import { useState } from "react";
import { useAuth } from "./AuthProvider";

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setSubmitting(true);
    setError(null);
    try {
      await login(username.trim(), password);
    } catch {
      // Celowo jeden generyczny komunikat niezaleznie od przyczyny --
      // ani szczegoly techniczne, ani informacja czy login istnieje.
      setError("Nieprawidłowy login lub hasło.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="app">
      <div className="login-wrap">
        <form className="card" onSubmit={handleSubmit}>
          <h1>Shipment Analyzer</h1>
          <label className="file-field">
            <span>Login</span>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </label>
          <label className="file-field">
            <span>Hasło</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button type="submit" disabled={submitting}>
            {submitting ? "Logowanie..." : "Zaloguj"}
          </button>
        </form>
      </div>
    </div>
  );
}
