import { api } from "./client";

export interface Organization {
  id: number;
  name: string;
  role: "owner" | "bookkeeper" | "viewer";
}

export async function fetchOrganizations(): Promise<Organization[]> {
  const { data } = await api.get("/organizations/");
  return data.results ?? data;
}
