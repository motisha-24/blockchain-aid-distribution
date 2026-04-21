import { useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import StatusPill from "../components/StatusPill";
import { useData } from "../context/DataContext";

function resolveStatus(beneficiary, detailMap) {
  if (beneficiary.active === false) {
    return "DEACTIVATED";
  }
  return detailMap.get(beneficiary.id)?.status || "NOT_COLLECTED";
}

export default function BeneficiariesScreen({ navigation }) {
  const { beneficiaries, progress } = useData();
  const [query, setQuery] = useState("");

  const detailMap = useMemo(() => {
    const map = new Map();
    const list = progress?.beneficiaries_detail || [];
    list.forEach((item) => {
      map.set(item.id, item);
    });
    return map;
  }, [progress]);

  const filtered = useMemo(() => {
    if (!query.trim()) {
      return beneficiaries;
    }
    const q = query.trim().toLowerCase();
    return beneficiaries.filter(
      (b) =>
        b.name?.toLowerCase().includes(q) ||
        String(b.id).includes(q) ||
        b.location?.toLowerCase().includes(q)
    );
  }, [beneficiaries, query]);

  return (
    <View style={styles.page}>
      <TextInput
        style={styles.search}
        placeholder="Search by ID, name, or location"
        value={query}
        onChangeText={setQuery}
      />

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingBottom: 20 }}
        renderItem={({ item }) => {
          const status = resolveStatus(item, detailMap);
          return (
            <Pressable
              style={styles.card}
              onPress={() =>
                navigation.navigate("BeneficiaryDetail", {
                  beneficiary: item,
                  status,
                })
              }
            >
              <View style={styles.topRow}>
                <Text style={styles.name}>
                  #{item.id} {item.name}
                </Text>
                <StatusPill label={status} />
              </View>
              <Text style={styles.meta}>Location: {item.location}</Text>
              <Text style={styles.meta}>Phone: {item.phone}</Text>
            </Pressable>
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#edf2f7", padding: 12 },
  search: {
    backgroundColor: "#fff",
    borderColor: "#cbd5e0",
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  card: {
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    marginBottom: 10,
    gap: 4,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  name: { fontWeight: "700", color: "#1a202c", flexShrink: 1 },
  meta: { color: "#4a5568" },
});
