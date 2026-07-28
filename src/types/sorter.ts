export interface Sorter {
  id: number;
  name: string;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SorterWithRoutes extends Sorter {
  routes: string[];
}
