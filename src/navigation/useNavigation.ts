import { useCallback, useEffect, useRef, useState } from "react";

const STATE_KEY = "shipmentStack";

// Ten sam wzorzec co w kurier_appp (pwa/src/useNavigation.js): caly stos
// ekranow trzymany jest w history.state, a jedyne miejsce zmiany stanu to
// listener popstate. Dzieki temu system back (Android) i przycisk "wstecz"
// w UI dziela dokladnie ta sama sciezke kodu i nigdy sie nie rozjadą.
export function useNavigation<View>(home: View) {
  const [stack, setStack] = useState<View[]>([home]);
  const stackRef = useRef(stack);
  stackRef.current = stack;

  useEffect(() => {
    window.history.replaceState({ [STATE_KEY]: [home] }, "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    function onPopState(event: PopStateEvent) {
      const nextStack = (event.state as Record<string, View[]> | null)?.[STATE_KEY];
      if (nextStack) {
        setStack(nextStack);
      }
      // Brak wpisu = wyszlismy poza nasz stos (system back z ekranu
      // startowego) -- celowo nic nie robimy, przegladarka/PWA zachowuje
      // sie standardowo.
    }
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const navigate = useCallback((view: View) => {
    const nextStack = [...stackRef.current, view];
    window.history.pushState({ [STATE_KEY]: nextStack }, "");
    setStack(nextStack);
  }, []);

  // Resetuje caly stos do jednego ekranu bez dokladania wpisu w historii --
  // uzywane np. po zapisaniu importu, zeby "wstecz" nie wracalo do
  // nieaktualnego juz ekranu podsumowania.
  const replace = useCallback((view: View) => {
    const nextStack = [view];
    window.history.replaceState({ [STATE_KEY]: nextStack }, "");
    setStack(nextStack);
  }, []);

  const goBack = useCallback(() => {
    if (stackRef.current.length > 1) {
      window.history.back();
    }
  }, []);

  return {
    current: stack[stack.length - 1],
    canGoBack: stack.length > 1,
    navigate,
    replace,
    goBack,
  };
}
