export interface Sorter {
  id: number;
  name: string;
  // Imie i nazwisko (opcjonalne, tylko ekran "Sortujacy"); null = nie wpisano.
  // "name" zostaje nazwa robocza widoczna wszedzie indziej.
  fullName: string | null;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SorterWithRoutes extends Sorter {
  routes: string[];
}
