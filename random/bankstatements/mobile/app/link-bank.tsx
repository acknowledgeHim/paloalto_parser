import { router } from "expo-router";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Button, StyleSheet, Text, View } from "react-native";
import { create, open, LinkExit, LinkSuccess } from "react-native-plaid-link-sdk";

import { exchangePublicToken, fetchLinkToken } from "@/api/banking";
import { useOrganization } from "@/context/OrganizationContext";

// Bank authentication happens entirely inside Plaid Link's own webview below —
// this app and its backend never see a bank username/password, only the
// short-lived link_token/public_token Plaid issues.
export default function LinkBankScreen() {
  const { selectedOrganizationId } = useOrganization();
  const [status, setStatus] = useState<"loading" | "ready" | "linking" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedOrganizationId) return;
    fetchLinkToken(selectedOrganizationId)
      .then((token) => {
        create({ token });
        setStatus("ready");
      })
      .catch(() => {
        setError("Couldn't start bank linking. Try again in a moment.");
        setStatus("error");
      });
  }, [selectedOrganizationId]);

  const startLink = () => {
    if (!selectedOrganizationId) return;
    setStatus("linking");
    open({
      onSuccess: async (success: LinkSuccess) => {
        try {
          await exchangePublicToken({
            organizationId: selectedOrganizationId,
            publicToken: success.publicToken,
            institutionId: success.metadata.institution?.id ?? "",
            institutionName: success.metadata.institution?.name ?? "Unknown institution",
          });
          router.replace("/");
        } catch {
          setError("Linked with the bank, but saving it failed. Try again.");
          setStatus("error");
        }
      },
      onExit: (exit: LinkExit) => {
        if (exit.error) {
          setError(exit.error.errorMessage ?? "Linking was cancelled.");
        }
        setStatus("ready");
      },
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Link a bank or credit union</Text>
      <Text style={styles.body}>
        You'll be taken to your bank's own login screen inside a secure Plaid window.
        Your bank password is never seen by this app.
      </Text>

      {status === "loading" && <ActivityIndicator />}
      {error && <Text style={styles.error}>{error}</Text>}
      {(status === "ready" || status === "error") && (
        <Button title="Continue to your bank" onPress={startLink} />
      )}
      {status === "linking" && <ActivityIndicator />}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", padding: 24, gap: 16 },
  title: { fontSize: 20, fontWeight: "600", textAlign: "center" },
  body: { color: "#555", textAlign: "center" },
  error: { color: "red", textAlign: "center" },
});
