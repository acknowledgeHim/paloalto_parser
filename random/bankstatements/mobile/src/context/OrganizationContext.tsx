import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import * as SecureStore from "expo-secure-store";

import { Organization, fetchOrganizations } from "@/api/organizations";
import { useAuth } from "./AuthContext";

const SELECTED_ORG_KEY = "selected_organization_id";

interface OrganizationContextValue {
  organizations: Organization[];
  selectedOrganizationId: number | null;
  isLoading: boolean;
  selectOrganization: (id: number) => Promise<void>;
  refresh: () => Promise<void>;
}

const OrganizationContext = createContext<OrganizationContextValue | undefined>(undefined);

export function OrganizationProvider({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuth();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [selectedOrganizationId, setSelectedOrganizationId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const orgs = await fetchOrganizations();
      setOrganizations(orgs);

      const storedId = await SecureStore.getItemAsync(SELECTED_ORG_KEY);
      const stored = storedId ? orgs.find((o) => o.id === Number(storedId)) : undefined;

      if (stored) {
        setSelectedOrganizationId(stored.id);
      } else if (orgs.length === 1) {
        // Only one org to belong to — skip the picker entirely.
        await SecureStore.setItemAsync(SELECTED_ORG_KEY, String(orgs[0].id));
        setSelectedOrganizationId(orgs[0].id);
      } else {
        setSelectedOrganizationId(null);
      }
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      refresh();
    } else {
      setOrganizations([]);
      setSelectedOrganizationId(null);
      setIsLoading(false);
    }
  }, [isAuthenticated, refresh]);

  const selectOrganization = async (id: number) => {
    await SecureStore.setItemAsync(SELECTED_ORG_KEY, String(id));
    setSelectedOrganizationId(id);
  };

  return (
    <OrganizationContext.Provider
      value={{ organizations, selectedOrganizationId, isLoading, selectOrganization, refresh }}
    >
      {children}
    </OrganizationContext.Provider>
  );
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error("useOrganization must be used within OrganizationProvider");
  return ctx;
}
