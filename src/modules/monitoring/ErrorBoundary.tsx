import { Component, type ErrorInfo, type ReactNode } from "react";
import { reportError } from "./reportError";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

// Globalny Error Boundary -- lapie bledy renderowania calego drzewa
// Reacta (App.tsx owija nim AppShell). Musi byc klasa -- to jedyny
// sposob w Reakcie na zaimplementowanie boundary. Uzytkownik widzi
// wylacznie czytelny komunikat PL, NIGDY stack trace (ten trafia tylko
// do Sentry przez reportError).
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: ErrorInfo): void {
    reportError(error, { module: "react", stage: "render" });
    void info;
  }

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <div className="app">
          <div className="card">
            <h1>Coś poszło nie tak</h1>
            <p className="hint">
              Wystąpił nieoczekiwany błąd aplikacji. Spróbuj odświeżyć stronę. Jeśli problem się
              powtarza, skontaktuj się z administratorem.
            </p>
            <button onClick={() => window.location.reload()}>Odśwież stronę</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
