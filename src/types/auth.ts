export type Role = "admin" | "user";

export interface Profile {
  id: string;
  username: string;
  role: Role;
  createdAt: string;
  updatedAt: string;
}
