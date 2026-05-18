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
import client from "../api/client";

export default function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [serverUrl, setServerUrl] = useState(API_BASE_URL);
  const [submitting, setSubmitting] = useState(false);
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    async function loadServerUrl() {
      const stored = await getApiBaseUrl();
      if (stored) {
        setServerUrl(stored);
        client.defaults.baseURL = stored;
      }
    }
    loadServerUrl();
  }, []);

  const cleanAndValidateUrl = (url) => {
    let cleaned = (url || "").trim();
    if (!cleaned) return null;
    // If protocol is missing, auto-prefix http:// for local Flask server ease of use
    if (!/^https?:\/\//i.test(cleaned)) {
      cleaned = "http://" + cleaned;
    }
    return cleaned;
  };

  async function handleSubmit() {
    const validatedUrl = cleanAndValidateUrl(serverUrl);
    if (!validatedUrl) {
      Alert.alert("Server required", "Enter your Flask API URL.");
      return;
    }
    
    const trimmedUsername = (username || "").trim();
    if (!trimmedUsername || !password) {
      Alert.alert("Missing credentials", "Please enter username and password.");
      return;
    }

    setSubmitting(true);
    try {
      setServerUrl(validatedUrl);
      await saveApiBaseUrl(validatedUrl);
      client.defaults.baseURL = validatedUrl; // Instantly update base URL, resolving race conditions
      await login(trimmedUsername, password);
    } catch (error) {
      const status = error?.response?.status;
      const backendMessage = error?.response?.data?.error;
      const isNetwork = error?.message?.toLowerCase().includes("network");
      Alert.alert(
        "Login failed",
        [
          backendMessage || (isNetwork ? "Cannot reach server." : null) || error?.message,
          status ? `HTTP status: ${status}` : null,
          `Server URL: ${validatedUrl}`,
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
    const validatedUrl = cleanAndValidateUrl(serverUrl);
    if (!validatedUrl) {
      Alert.alert("Server required", "Enter your Flask API URL.");
      return;
    }
    try {
      setServerUrl(validatedUrl);
      await saveApiBaseUrl(validatedUrl);
      client.defaults.baseURL = validatedUrl; // Instantly update base URL, resolving race conditions
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
          `Server URL: ${validatedUrl}`,
          "Start Flask API and verify same Wi-Fi network.",
        ]
          .filter(Boolean)
          .join("\n")
      );
    }
  }

  return (
    <View style={styles.container}>
      {/* Brand Icon and Header */}
      <View style={styles.brandContainer}>
        <View style={styles.logoBadge}>
          <Text style={styles.logoBadgeText}>⛓️🛡️</Text>
        </View>
        <Text style={styles.title}>AidChain</Text>
        <Text style={styles.tagline}>FIELD OFFICER PORTAL</Text>
      </View>

      {/* Input Group */}
      <View style={styles.formContainer}>
        <Text style={styles.inputLabel}>Flask Server URL</Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "serverUrl" && styles.inputFocused,
          ]}
          placeholder="e.g. http://192.168.1.25:5000"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          autoCorrect={false}
          value={serverUrl}
          onChangeText={setServerUrl}
          onFocus={() => setFocusedField("serverUrl")}
          onBlur={() => setFocusedField(null)}
        />

        <Text style={styles.inputLabel}>Username</Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "username" && styles.inputFocused,
          ]}
          placeholder="Enter username"
          placeholderTextColor="#94a3b8"
          autoCapitalize="none"
          value={username}
          onChangeText={setUsername}
          onFocus={() => setFocusedField("username")}
          onBlur={() => setFocusedField(null)}
        />

        <Text style={styles.inputLabel}>Password</Text>
        <TextInput
          style={[
            styles.input,
            focusedField === "password" && styles.inputFocused,
          ]}
          placeholder="Enter password"
          placeholderTextColor="#94a3b8"
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          onFocus={() => setFocusedField("password")}
          onBlur={() => setFocusedField(null)}
        />

        <Pressable
          style={styles.button}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.buttonLabel}>Sign In Securely</Text>
          )}
        </Pressable>

        <Pressable style={styles.secondaryButton} onPress={handleTestServer}>
          <Text style={styles.secondaryLabel}>⚡ Test Server Connection</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#f8fafc",
  },
  brandContainer: {
    alignItems: "center",
    marginBottom: 28,
  },
  logoBadge: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e0e7ff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 16,
  },
  logoBadgeText: {
    fontSize: 28,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#0f172a",
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 10,
    fontWeight: "800",
    color: "#4f46e5",
    letterSpacing: 2,
    marginTop: 4,
    marginBottom: 8,
  },
  subtitle: {
    color: "#64748b",
    fontSize: 13,
    lineHeight: 18,
    textAlign: "center",
    paddingHorizontal: 16,
  },
  formContainer: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    gap: 12,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#475569",
    marginBottom: -4,
  },
  input: {
    backgroundColor: "#f8fafc",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
  },
  inputFocused: {
    borderColor: "#4f46e5",
    backgroundColor: "#ffffff",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  button: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 8,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  buttonLabel: {
    color: "#ffffff",
    fontWeight: "700",
    fontSize: 15,
  },
  secondaryButton: {
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: "center",
    borderColor: "#cbd5e1",
    borderWidth: 1,
    backgroundColor: "#ffffff",
  },
  secondaryLabel: {
    color: "#475569",
    fontWeight: "700",
    fontSize: 13,
  },
});
