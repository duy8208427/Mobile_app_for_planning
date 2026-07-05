import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { AuthProvider } from "../src/auth";

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthProvider>
          <StatusBar style="dark" />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="index" />
            <Stack.Screen name="login" />
            <Stack.Screen name="register" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="compare" options={{ presentation: "card" }} />
            <Stack.Screen name="report" options={{ presentation: "card" }} />
            <Stack.Screen name="legal" options={{ presentation: "card" }} />
            <Stack.Screen name="legal-detail" options={{ presentation: "card" }} />
            <Stack.Screen name="administrative-procedures" options={{ presentation: "card" }} />
            <Stack.Screen name="administrative-procedure-detail" options={{ presentation: "card" }} />
            <Stack.Screen name="building-permits" options={{ presentation: "card" }} />
            <Stack.Screen name="building-permit-detail" options={{ presentation: "card" }} />
            <Stack.Screen name="social-housing" options={{ presentation: "card" }} />
            <Stack.Screen name="admin" options={{ presentation: "card" }} />
            <Stack.Screen name="admin-report" options={{ presentation: "card" }} />
            <Stack.Screen name="report-detail" options={{ presentation: "card" }} />
            <Stack.Screen name="change-password" options={{ presentation: "card" }} />
          </Stack>
        </AuthProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
