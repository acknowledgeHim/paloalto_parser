import { Redirect, router } from "expo-router";
import React from "react";
import { FlatList, StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { useOrganization } from "@/context/OrganizationContext";

export default function SelectOrganizationScreen() {
  const { organizations, selectedOrganizationId, isLoading, selectOrganization } =
    useOrganization();

  if (isLoading) return null;
  // Already resolved (single org, or previously chosen) — nothing to pick.
  if (selectedOrganizationId) return <Redirect href="/" />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Choose a business</Text>
      <FlatList
        data={organizations}
        keyExtractor={(item) => String(item.id)}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={async () => {
              await selectOrganization(item.id);
              router.replace("/");
            }}
          >
            <Text style={styles.rowTitle}>{item.name}</Text>
            <Text style={styles.rowSubtitle}>{item.role}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <Text style={styles.empty}>
            You aren't a member of any organization yet. Ask an admin to add you.
          </Text>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  title: { fontSize: 20, fontWeight: "600", marginBottom: 16 },
  row: { paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: "#eee" },
  rowTitle: { fontSize: 16, fontWeight: "500" },
  rowSubtitle: { color: "#666", marginTop: 2, textTransform: "capitalize" },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
});
