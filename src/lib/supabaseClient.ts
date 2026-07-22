import { createClient } from "@supabase/supabase-js";

// Ten plik jest importowany WYLACZNIE przez modul repository/*.
// UI (komponenty, hooki ekranowe) nigdy nie importuje tego pliku
// bezposrednio -- to wymuszenie zasady "UI nie komunikuje sie
// bezposrednio z Supabase".

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Brak VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. Skopiuj .env.example do .env i uzupelnij dane projektu Supabase."
  );
}

export const supabase = createClient(url, anonKey);
