import { useEffect, type ReactNode } from "react";
import { useAuth } from "./AuthProvider";

// Obrona w glab: nav bar w App.tsx juz nie pokazuje linkow do ekranow
// admina zwyklym userom, ale gdyby stan nawigacji jakos tam trafil
// (np. reczna manipulacja historia przegladarki), ten komponent
// przekierowuje na Dashboard zamiast wyrenderowac chroniona zawartosc.
export function AdminRoute({ children, onDenied }: { children: ReactNode; onDenied: () => void }) {
  const { isAdmin } = useAuth();

  useEffect(() => {
    if (!isAdmin) onDenied();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin]);

  if (!isAdmin) return null;
  return <>{children}</>;
}
