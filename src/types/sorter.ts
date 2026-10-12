export interface Sorter {
  id: number;
  name: string;
  // Imie i nazwisko (opcjonalne, tylko ekran "Sortujacy"); null = nie wpisano.
  // "name" zostaje nazwa robocza widoczna wszedzie indziej.
  fullName: string | null;
  // Loop: zwykle litera loopa kuriera (A, B, ...) albo np. "zastępca";
  // null = nie ustawiono. Docelowo kurier_appp pokaze sortujacego w tym loopie.
  loop: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SorterWithRoutes extends Sorter {
  routes: string[];
}
