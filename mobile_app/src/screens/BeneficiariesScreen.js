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
  return detailMap.get(String(beneficiary.id))?.status || "NOT_COLLECTED";
}

export default function BeneficiariesScreen({ navigation }) {
  const { beneficiaries, progress, hardwareEvents } = useData();
  const [query, setQuery] = useState("");
  const [isSearchFocused, setIsSearchFocused] = useState(false);

  const detailMap = useMemo(() => {
    const map = new Map();
    
    (hardwareEvents || []).forEach(evt => {
      const type = evt.event_type || evt.type;
      if (type === "AID_DISTRIBUTED") {
        const match = evt.message.match(/beneficiary\s+(\d+)/i);
        if (match) {
          const bId = match[1];
          map.set(String(bId), { status: "COLLECTED" });
        }
      }
    });

    const list = progress?.beneficiaries_detail || [];
    list.forEach((item) => {
      map.set(String(item.id), item);
    });
    
    return map;
  }, [progress, hardwareEvents]);

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

  // Helper to extract initials for custom profile avatar
  const getInitials = (name) => {
    if (!name) return "B";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  // Helper to resolve status colors for card left-borders
  const getStatusBorderColor = (status) => {
    switch (status) {
      case "COLLECTED":
      case "CONFIRMED":
        return "#10b981"; // Emerald
      case "PENDING":
        return "#f59e0b"; // Amber
      case "DEACTIVATED":
        return "#64748b"; // Slate
      case "NOT_COLLECTED":
      default:
        return "#ef4444"; // Red
    }
  };

  return (
    <View style={styles.page}>
      <View style={styles.searchContainer}>
        <TextInput
          style={[styles.search, isSearchFocused && styles.searchFocused]}
          placeholder="🔍 Search by ID, name, or location..."
          placeholderTextColor="#94a3b8"
          value={query}
          onChangeText={setQuery}
          onFocus={() => setIsSearchFocused(true)}
          onBlur={() => setIsSearchFocused(false)}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24, gap: 12 }}
        renderItem={({ item }) => {
          const status = resolveStatus(item, detailMap);
          const leftBorderColor = getStatusBorderColor(status);
          const initials = getInitials(item.name);

          return (
            <Pressable
              style={[styles.card, { borderLeftColor: leftBorderColor }]}
              onPress={() =>
                navigation.navigate("BeneficiaryDetail", {
                  beneficiary: item,
                  status,
                })
              }
            >
              <View style={styles.row}>
                {/* Initial circle avatar on the left */}
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{initials}</Text>
                </View>

                {/* Info block */}
                <View style={styles.infoBlock}>
                  <View style={styles.topRow}>
                    <Text style={styles.name} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <StatusPill label={status} />
                  </View>
                  
                  <View style={styles.metaRow}>
                    <Text style={styles.idBadge}>ID #{item.id}</Text>
                    <Text style={styles.metaDivider}>•</Text>
                    <Text style={styles.metaText} numberOfLines={1}>
                      📍 {item.location}
                    </Text>
                  </View>

                  <Text style={styles.phoneText}>📞 {item.phone}</Text>
                </View>
              </View>
            </Pressable>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyIcon}>👥</Text>
            <Text style={styles.emptyTitle}>No Beneficiaries Found</Text>
            <Text style={styles.emptySubtitle}>
              Try refining your search keyword or check if database is populated.
            </Text>
          </View>
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { 
    flex: 1, 
    backgroundColor: "#f8fafc" 
  },
  searchContainer: {
    padding: 16,
    backgroundColor: "#ffffff",
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  search: {
    backgroundColor: "#f1f5f9",
    borderColor: "#e2e8f0",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0f172a",
  },
  searchFocused: {
    borderColor: "#4f46e5",
    backgroundColor: "#ffffff",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderLeftWidth: 5,
    padding: 14,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.03,
    shadowRadius: 8,
    elevation: 2,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#e0e7ff",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#4f46e5",
    fontWeight: "700",
    fontSize: 14,
  },
  infoBlock: {
    flex: 1,
    gap: 4,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  name: { 
    fontSize: 15,
    fontWeight: "700", 
    color: "#0f172a", 
    flex: 1 
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  idBadge: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "700",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  metaDivider: {
    fontSize: 11,
    color: "#cbd5e1",
  },
  metaText: { 
    fontSize: 12,
    color: "#475569",
    fontWeight: "500",
    flex: 1,
  },
  phoneText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    gap: 8,
  },
  emptyIcon: {
    fontSize: 48,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: "#0f172a",
  },
  emptySubtitle: {
    fontSize: 13,
    color: "#64748b",
    textAlign: "center",
    lineHeight: 18,
  },
});
