import { Alert, Pressable, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";

export default function UnlockScreen() {
  const { unlock } = useAuth();

  async function handleUnlock() {
    const result = await unlock();
    if (!result?.success) {
      Alert.alert("Unlock failed", "Biometric verification was not successful.");
    }
  }

  return (
    <View style={styles.page}>
      <Text style={styles.title}>Session Locked</Text>
      <Text style={styles.subtitle}>
        Verify with your device biometric to continue.
      </Text>
      <Pressable style={styles.button} onPress={handleUnlock}>
        <Text style={styles.buttonLabel}>Unlock with Biometrics</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    flex: 1,
    backgroundColor: "#f7fafc",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
    gap: 10,
  },
  title: { fontSize: 24, fontWeight: "800", color: "#1a202c" },
  subtitle: { color: "#4a5568", textAlign: "center" },
  button: {
    marginTop: 8,
    backgroundColor: "#1a365d",
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  buttonLabel: { color: "#fff", fontWeight: "700" },
});
