import { Redirect, router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Button, FlatList, RefreshControl, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { BankAccount, fetchAccounts } from "@/api/banking";
import { useAuth } from "@/context/AuthContext";
import { useOrganization } from "@/context/OrganizationContext";

export default function AccountsHome() {
  const { isAuthenticated, isLoading: authLoading, logout } = useAuth();
  const { selectedOrganizationId, isLoading: orgLoading, organizations } = useOrganization();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    if (!selectedOrganizationId) return;
    setRefreshing(true);
    try {
      setAccounts(await fetchAccounts(selectedOrganizationId));
    } finally {
      setRefreshing(false);
    }
  }, [selectedOrganizationId]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && selectedOrganizationId) load();
    }, [isAuthenticated, selectedOrganizationId, load])
  );

  if (authLoading || orgLoading) return null;
  if (!isAuthenticated) return <Redirect href="/login" />;
  // More than one org and none chosen yet (or zero orgs) — send to the picker.
  if (!selectedOrganizationId) return <Redirect href="/select-organization" />;

  const currentOrg = organizations.find((o) => o.id === selectedOrganizationId);

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Linked Accounts</Text>
          {currentOrg && <Text style={styles.subtitle}>{currentOrg.name}</Text>}
        </View>
        <Button title="Sign out" onPress={logout} />
      </View>

      {organizations.length > 1 && (
        <Button
          title="Switch business"
          onPress={() => router.push("/select-organization")}
        />
      )}

      <FlatList
        data={accounts}
        keyExtractor={(item) => String(item.id)}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={load} />}
        ListEmptyComponent={
          <Text style={styles.empty}>No banks linked yet. Add one below.</Text>
        }
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => router.push(`/account/${item.id}`)}
          >
            <Text style={styles.rowTitle}>{item.institution?.name}</Text>
            <Text style={styles.rowSubtitle}>
              {item.name} •••• {item.mask}
            </Text>
          </TouchableOpacity>
        )}
      />

      <Button title="+ Link a bank" onPress={() => router.push("/link-bank")} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  title: { fontSize: 20, fontWeight: "600" },
  subtitle: { color: "#666", marginTop: 2 },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowTitle: { fontSize: 16, fontWeight: "500" },
  rowSubtitle: { color: "#666", marginTop: 2 },
});
