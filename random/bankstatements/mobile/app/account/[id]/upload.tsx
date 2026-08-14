import * as DocumentPicker from "expo-document-picker";
import { router, useLocalSearchParams } from "expo-router";
import React, { useState } from "react";
import { Button, StyleSheet, Text, TextInput, View } from "react-native";

import { uploadCheckImage } from "@/api/banking";

// The human picking a file here has already logged into their own bank/credit
// union portal, in their own browser, and downloaded the check image/PDF
// themselves. This screen only handles sending that file along — it never
// logs into a bank on the user's behalf.
export default function UploadCheckImageScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const accountId = Number(id);

  const [picked, setPicked] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: ["image/*", "application/pdf"],
      copyToCacheDirectory: true,
    });
    if (!result.canceled) {
      setPicked(result.assets[0]);
    }
  };

  const submit = async () => {
    if (!picked) return;
    setSubmitting(true);
    setError(null);
    try {
      await uploadCheckImage({
        accountId,
        fileUri: picked.uri,
        fileName: picked.name,
        mimeType: picked.mimeType ?? "application/octet-stream",
        note,
      });
      router.back();
    } catch {
      setError("Upload failed. Check your connection and try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload check image</Text>
      <Text style={styles.body}>
        Download the check image or PDF from your bank's portal first, then attach it here.
      </Text>

      <Button title={picked ? `Selected: ${picked.name}` : "Choose file"} onPress={pickFile} />

      <TextInput
        style={styles.input}
        placeholder="Note (optional)"
        value={note}
        onChangeText={setNote}
      />

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button
        title={submitting ? "Uploading…" : "Upload"}
        onPress={submit}
        disabled={!picked || submitting}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: "600" },
  body: { color: "#555" },
  input: { borderWidth: 1, borderColor: "#ccc", borderRadius: 8, padding: 12 },
  error: { color: "red" },
});
