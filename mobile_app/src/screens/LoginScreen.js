import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useAuth } from "../context/AuthContext";
import { healthCheck } from "../api/endpoints";
import { API_BASE_URL } from "../config/env";
import { getApiBaseUrl, saveApiBaseUrl } from "../storage/localStore";

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState(API_BASE_URL);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    async function loadServerUrl() {
      const stored = await getApiBaseUrl();
      if (stored) {
        setServerUrl(stored);
      }
    }
    loadServerUrl();
  }, []);

  async function handleSubmit() {
    if (!serverUrl?.trim()) {
      Alert.alert("Server required", "Enter your Flask API URL.");
      return;
    }
    if (!username || !password) {
      Alert.alert("Missing credentials", "Enter username and password.");
      return;
    }
    setSubmitting(true);
    try {
      await saveApiBaseUrl(serverUrl.trim());
      await login(username.trim(), password);
    } catch (error) {
      const status = error?.response?.status;
      const backendMessage = error?.response?.data?.error;
      const isNetwork = error?.message?.toLowerCase().includes("network");
      Alert.alert(
        "Login failed",
        [
          backendMessage || (isNetwork ? "Cannot reach server." : null) || error?.message,
          status ? `HTTP status: ${status}` : null,
          `Server URL: ${serverUrl.trim()}`,
          "Tip: ensure Flask API is running and phone+PC are on same network.",
        ]
          .filter(Boolean)
          .join("\n")
      );
    } finally {
      setSubmitting(false);
    }
  }

  async function handleTestServer() {
    if (!serverUrl?.trim()) {
      Alert.alert("Server required", "Enter your Flask API URL.");
      return;
    }
    try {
      await saveApiBaseUrl(serverUrl.trim());
      const info = await healthCheck();
      Alert.alert(
        "Server reachable",
        `Connected to API.\nStatus: ${info?.status || "ok"}\nVersion: ${
          info?.version || "unknown"
        }`
      );
    } catch (error) {
      Alert.alert(
        "Server unreachable",
        [
          error?.response?.data?.error || error?.message || "Request failed",
          `Server URL: ${serverUrl.trim()}`,
          "Start Flask API and verify same Wi-Fi network.",
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>AidChain Field Officer</Text>
      <Text style={styles.subtitle}>
        Offline-first distribution monitoring with automatic sync.
      </Text>
      <TextInput
        style={styles.input}
        placeholder="Flask API URL e.g. http://192.168.1.25:5000"
        autoCapitalize="none"
        autoCorrect={false}
        value={serverUrl}
        onChangeText={setServerUrl}
      />
      <TextInput
        style={styles.input}
        placeholder="Username"
        autoCapitalize="none"
        value={username}
        onChangeText={setUsername}
      />
      <TextInput
        style={styles.input}
        placeholder="Password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
      />
      <Pressable style={styles.button} onPress={handleSubmit} disabled={submitting}>
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.buttonLabel}>Sign in</Text>
        )}
      </Pressable>
      <Pressable style={styles.secondaryButton} onPress={handleTestServer}>
        <Text style={styles.secondaryLabel}>Test Server Connection</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 20,
    backgroundColor: "#f7fafc",
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: "800",
    color: "#1a202c",
  },
  subtitle: {
    color: "#4a5568",
    marginBottom: 8,
  },
  input: {
    backgroundColor: "#fff",
    borderColor: "#cbd5e0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  button: {
    backgroundColor: "#1a365d",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
    marginTop: 4,
  },
  buttonLabel: {
    color: "#fff",
    fontWeight: "700",
  },
  secondaryButton: {
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: "center",
    borderColor: "#2b6cb0",
    borderWidth: 1,
    backgroundColor: "#fff",
  },
  secondaryLabel: {
    color: "#2b6cb0",
    fontWeight: "700",
  },
});
