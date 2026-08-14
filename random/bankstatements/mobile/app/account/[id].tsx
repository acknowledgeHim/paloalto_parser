import { useLocalSearchParams, router, useFocusEffect } from "expo-router";
import React, { useCallback, useState } from "react";
import { Button, SectionList, StyleSheet, Text, View } from "react-native";

import {
  CheckImageUpload,
  Statement,
  fetchCheckImages,
  fetchStatements,
} from "@/api/banking";
import { API_BASE_URL } from "@/api/client";

export default function AccountDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);

  const [statements, setStatements] = useState<Statement[]>([]);
  const [checkImages, setCheckImages] = useState<CheckImageUpload[]>([]);

  const load = useCallback(async () => {
    const [s, c] = await Promise.all([
      fetchStatements(accountId),
      fetchCheckImages(accountId),
    ]);
    setStatements(s);
    setCheckImages(c);
  }, [accountId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const sections = [
    {
      title: "Statements (synced automatically)",
      data: statements,
      renderItem: (item: Statement) => `${item.period_start} – ${item.period_end}`,
    },
    {
      title: "Check images (manually uploaded)",
      data: checkImages,
      renderItem: (item: CheckImageUpload) =>
        item.check_date ? `Check dated ${item.check_date}` : `Uploaded ${item.uploaded_at}`,
    },
  ];

  return (
    <View style={styles.container}>
      <SectionList
        sections={sections as any}
        keyExtractor={(item: any) => String(item.id)}
        renderSectionHeader={({ section }) => (
          <Text style={styles.sectionHeader}>{section.title}</Text>
        )}
        renderItem={({ item, section }) => (
          <View style={styles.row}>
            <Text>{(section as any).renderItem(item)}</Text>
            <Text
              style={styles.link}
              onPress={() => {
                /* file is served from Django MEDIA/S3 — open API_BASE_URL + item.file
                   in a browser/WebBrowser.openBrowserAsync in a full implementation */
              }}
            >
              {API_BASE_URL.replace("/api", "")}{item.file}
            </Text>
          </View>
        )}
        ListEmptyComponent={<Text style={styles.empty}>Nothing here yet.</Text>}
      />

      <Button
        title="Upload a check image"
        onPress={() => router.push(`/account/${accountId}/upload`)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16, gap: 12 },
  sectionHeader: { fontWeight: "600", marginTop: 16, marginBottom: 4, color: "#333" },
  row: { paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: "#eee" },
  link: { color: "#2563eb", fontSize: 12, marginTop: 2 },
  empty: { textAlign: "center", color: "#888", marginTop: 40 },
});
