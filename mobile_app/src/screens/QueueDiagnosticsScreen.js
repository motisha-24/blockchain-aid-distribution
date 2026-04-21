import { FlatList, StyleSheet, Text, View } from "react-native";
import { useData } from "../context/DataContext";

function ItemRow({ item }) {
  return (
    <View style={styles.itemCard}>
      <Text style={styles.itemTitle}>
        Beneficiary #{item.beneficiary_id} | {item.status}
      </Text>
      <Text style={styles.meta}>Queue ID: {item.queue_id}</Text>
      <Text style={styles.meta}>Idempotency: {item.idempotency_key}</Text>
      <Text style={styles.meta}>Retries: {item.retries || 0}</Text>
      <Text style={styles.meta}>Queued At: {item.queued_at || "-"}</Text>
      {item.last_error ? <Text style={styles.error}>Last Error: {item.last_error}</Text> : null}
    </View>
  );
}

export default function QueueDiagnosticsScreen() {
  const { queue, isSyncing, lastSyncAt } = useData();

  return (
    <View style={styles.page}>
      <View style={styles.summaryCard}>
        <Text style={styles.summaryTitle}>Queue Diagnostics</Text>
        <Text style={styles.meta}>Current queue size: {queue.length}</Text>
        <Text style={styles.meta}>Sync status: {isSyncing ? "Syncing..." : "Idle"}</Text>
        <Text style={styles.meta}>
          Last sync: {lastSyncAt ? new Date(lastSyncAt).toLocaleString() : "Not yet"}
        </Text>
      </View>

      <FlatList
        data={queue}
        keyExtractor={(item) => item.queue_id}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No queued items. Offline queue is clean.</Text>
        }
        renderItem={({ item }) => <ItemRow item={item} />}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#edf2f7", padding: 12, gap: 10 },
  summaryCard: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
  },
  summaryTitle: { fontWeight: "800", fontSize: 16, color: "#1a202c", marginBottom: 6 },
  itemCard: {
    backgroundColor: "#fff",
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    marginBottom: 8,
    gap: 2,
  },
  itemTitle: { color: "#1a202c", fontWeight: "700" },
  meta: { color: "#4a5568" },
  error: { color: "#c53030", marginTop: 4 },
  emptyText: { color: "#4a5568", textAlign: "center", marginTop: 20 },
});
