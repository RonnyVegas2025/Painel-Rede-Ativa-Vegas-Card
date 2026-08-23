import type { Role } from "@/constants/roles";

export interface Profile {
  id: string;
  fullName: string;
  email: string;
  role: Role;
  teamId: string | null;
  phone: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Team {
  id: string;
  name: string;
  supervisorId: string | null;
  isActive: boolean;
}
