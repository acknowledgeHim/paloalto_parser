import { Slot } from "expo-router";
import React from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AuthProvider } from "@/context/AuthContext";
import { OrganizationProvider } from "@/context/OrganizationContext";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <OrganizationProvider>
          <Slot />
        </OrganizationProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
