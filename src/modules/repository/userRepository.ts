import { getSession } from "../auth/authService";
import { reportError } from "../monitoring/reportError";

// Operacje administracyjne na kontach (tworzenie, zmiana hasla,
// usuwanie) wymagaja klucza service_role, ktorego apka kliencka nigdy
// nie moze poznac. Ten modul woła zamiast tego waskie endpointy
// serwerowe (api/admin-*.ts), ktore trzymaja ten klucz wylacznie po
// swojej stronie i same weryfikuja, ze wywolujacy jest adminem.

class UserRepositoryError extends Error {}

async function callAdminEndpoint(path: string, body: unknown): Promise<void> {
  const session = await getSession();
  if (!session) throw new UserRepositoryError("Brak aktywnej sesji.");

  let response: Response;
  try {
    response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify(body),
    });
  } catch (err) {
    // Blad komunikacji (offline, DNS, CORS) -- request nigdy nie dotarl do
    // serwera, wiec api/admin-*.ts nie mial szansy zaraportowac tego sam.
    // Zwykle bledy walidacji (400) NIE sa tu raportowane -- to oczekiwane
    // wyniki (np. "login zajety"), nie incydenty.
    reportError(err, { module: "userRepository", stage: path });
    throw new UserRepositoryError("Nie udało się połączyć z serwerem.");
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new UserRepositoryError(payload?.error ?? "Operacja się nie powiodła.");
  }
}

export async function createUser(username: string, password: string): Promise<void> {
  await callAdminEndpoint("/api/admin-create-user", { username, password });
}

export async function changePassword(userId: string, newPassword: string): Promise<void> {
  await callAdminEndpoint("/api/admin-change-password", { userId, newPassword });
}

export async function deleteUser(userId: string): Promise<void> {
  await callAdminEndpoint("/api/admin-delete-user", { userId });
}
