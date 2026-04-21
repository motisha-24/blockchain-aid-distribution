import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";

export default function DashboardScreen({ navigation }) {
  const { logout, user } = useAuth();
  const { cycle, progress, queue, isSyncing, lastSyncAt } = useData();

  const totals = progress || {
    total_beneficiaries: 0,
    total_distributed: 0,
    confirmed_on_blockchain: 0,
    pending_in_cache: queue.length,
    not_yet_distributed: 0,
  };

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Field Monitoring Dashboard</Text>
      <Text style={styles.subtitle}>
        Officer: {user?.username} | Cycle {cycle?.cycle || 0}
      </Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Distribution Progress</Text>
        <Text style={styles.row}>Total beneficiaries: {totals.total_beneficiaries}</Text>
        <Text style={styles.row}>Total distributed: {totals.total_distributed}</Text>
        <Text style={styles.row}>
          Confirmed on blockchain: {totals.confirmed_on_blockchain}
        </Text>
        <Text style={styles.row}>Pending in cache: {totals.pending_in_cache}</Text>
        <Text style={styles.row}>Not yet distributed: {totals.not_yet_distributed}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Sync Engine</Text>
        <Text style={styles.row}>Status: {isSyncing ? "Syncing..." : "Idle"}</Text>
        <Text style={styles.row}>Queued actions: {queue.length}</Text>
        <Text style={styles.row}>
          Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Not yet"}
        </Text>
      </View>

      <Pressable
        style={styles.primaryBtn}
        onPress={() => navigation.navigate("Beneficiaries")}
      >
        <Text style={styles.primaryBtnLabel}>Open Beneficiaries</Text>
      </Pressable>

      <Pressable
        style={styles.secondaryBtn}
        onPress={() => navigation.navigate("QueueDiagnostics")}
      >
        <Text style={styles.secondaryBtnLabel}>Open Queue Diagnostics</Text>
      </Pressable>

      <Pressable style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutLabel}>Logout</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#edf2f7" },
  content: { padding: 16, gap: 12 },
  title: { fontSize: 22, fontWeight: "800", color: "#1a202c" },
  subtitle: { color: "#4a5568", marginBottom: 4 },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    gap: 6,
  },
  cardTitle: { fontWeight: "700", color: "#1a202c", marginBottom: 4 },
  row: { color: "#2d3748" },
  primaryBtn: {
    backgroundColor: "#2b6cb0",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  primaryBtnLabel: { color: "#fff", fontWeight: "700" },
  secondaryBtn: {
    backgroundColor: "#2d3748",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
  },
  secondaryBtnLabel: { color: "#fff", fontWeight: "700" },
  logoutBtn: {
    backgroundColor: "#fff",
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fc8181",
  },
  logoutLabel: { color: "#c53030", fontWeight: "700" },
});
