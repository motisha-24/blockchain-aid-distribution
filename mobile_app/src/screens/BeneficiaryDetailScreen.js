import { useMemo, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import StatusPill from "../components/StatusPill";
import { AID_TYPES, AID_TYPE_UNIT_MAP } from "../constants/aidTypes";
import { useData } from "../context/DataContext";

export default function BeneficiaryDetailScreen({ route }) {
  const { beneficiary, status } = route.params;
  const { cycle, distributeWithOfflineFallback } = useData();
  const [amountsByType, setAmountsByType] = useState({ MAIZE: "50" });
  const [selectedAidTypes, setSelectedAidTypes] = useState(["MAIZE"]);
  const [submitting, setSubmitting] = useState(false);
  const selectedSummary = useMemo(
    () => selectedAidTypes.map((type) => `${type} (${AID_TYPE_UNIT_MAP[type] || "UNITS"})`),
    [selectedAidTypes]
  );

  function toggleAidType(type) {
    setSelectedAidTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) {
          return prev;
        }
        setAmountsByType((current) => {
          const next = { ...current };
          delete next[type];
          return next;
        });
        return prev.filter((item) => item !== type);
      }
      setAmountsByType((current) => ({
        ...current,
        [type]: current[type] || "",
      }));
      return [...prev, type];
    });
  }

  function setAidTypeAmount(type, value) {
    setAmountsByType((prev) => ({
      ...prev,
      [type]: value,
    }));
  }

  async function handleManualFallback() {
    if (!selectedAidTypes.length) {
      Alert.alert("Select aid type", "Choose at least one aid type to distribute.");
      return;
    }
    const invalidType = selectedAidTypes.find((type) => {
      const amountNum = Number(amountsByType[type]);
      return !amountNum || amountNum <= 0;
    });
    if (invalidType) {
      Alert.alert(
        "Invalid amount",
        `Enter a valid amount greater than zero for ${invalidType}.`
      );
      return;
    }
    setSubmitting(true);
    try {
      const outcomes = [];
      for (const aidType of selectedAidTypes) {
        // One blockchain/cache record per aid type keeps immutable records atomic.
        const result = await distributeWithOfflineFallback({
          beneficiary_id: beneficiary.id,
          amount: Number(amountsByType[aidType]),
          aid_type: aidType.toUpperCase(),
          aid_unit: (AID_TYPE_UNIT_MAP[aidType] || "UNITS").toUpperCase(),
          location: beneficiary.location,
          officer_id: "mobile_field_officer",
          verification_mode: "MANUAL",
          note: `Manual fallback from mobile app for cycle ${cycle?.cycle || 0}`,
        });
        outcomes.push(result);
      }
      const offlineCount = outcomes.filter((o) => o.mode === "OFFLINE" && o.queued).length;
      const duplicateCount = outcomes.filter((o) => o.mode === "OFFLINE" && o.queued === false)
        .length;
      const onlineCount = outcomes.filter((o) => o.mode === "ONLINE").length;
      Alert.alert(
        "Distribution completed",
        [
          onlineCount ? `${onlineCount} aid type(s) recorded online.` : null,
          offlineCount
            ? `${offlineCount} aid type(s) saved offline and will auto-sync.`
            : null,
          duplicateCount ? `${duplicateCount} duplicate queued action(s) skipped.` : null,
        ]
          .filter(Boolean)
          .join("\n")
      );
    } catch (error) {
      Alert.alert(
        "Distribution failed",
        error?.response?.data?.error || error?.message || "Unexpected error"
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.name}>
        #{beneficiary.id} {beneficiary.name}
      </Text>
      <StatusPill label={status} />
      <Text style={styles.meta}>National ID: {beneficiary.national_id}</Text>
      <Text style={styles.meta}>Phone: {beneficiary.phone}</Text>
      <Text style={styles.meta}>Location: {beneficiary.location}</Text>

      <View style={styles.form}>
        <Text style={styles.formTitle}>Manual Distribution</Text>
        <Text style={styles.formLabel}>Select aid type(s)</Text>
        <View style={styles.chipsWrap}>
          {AID_TYPES.map((item) => {
            const selected = selectedAidTypes.includes(item.type);
            return (
              <Pressable
                key={item.type}
                style={[styles.chip, selected && styles.chipSelected]}
                onPress={() => toggleAidType(item.type)}
              >
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>
                  {item.type}
                </Text>
                <Text style={[styles.chipUnit, selected && styles.chipTextSelected]}>
                  {item.unit}
                </Text>
              </Pressable>
            );
          })}
        </View>
        <Text style={styles.selectedSummary}>
          Selected: {selectedSummary.length ? selectedSummary.join(", ") : "None"}
        </Text>
        {selectedAidTypes.map((type) => (
          <View key={type} style={styles.amountRow}>
            <View style={styles.amountRowLabelWrap}>
              <Text style={styles.amountTypeLabel}>{type}</Text>
              <Text style={styles.amountUnitLabel}>{AID_TYPE_UNIT_MAP[type] || "UNITS"}</Text>
            </View>
            <TextInput
              style={styles.amountInput}
              value={amountsByType[type] || ""}
              keyboardType="numeric"
              onChangeText={(value) => setAidTypeAmount(type, value)}
              placeholder={`Amount (${AID_TYPE_UNIT_MAP[type] || "UNITS"})`}
            />
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.actionBtn, submitting && { opacity: 0.6 }]}
        onPress={handleManualFallback}
        disabled={submitting}
      >
        <Text style={styles.actionLabel}>
          {submitting ? "Submitting..." : "Manual Distribution Fallback"}
        </Text>
      </Pressable>
      <Text style={styles.hint}>
        Works online and offline. Pending manual distributions auto-sync in background.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#edf2f7" },
  content: { padding: 16, gap: 8, paddingBottom: 24 },
  name: { fontSize: 22, fontWeight: "800", color: "#1a202c" },
  meta: { color: "#4a5568" },
  form: {
    marginTop: 12,
    backgroundColor: "#fff",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    padding: 12,
    gap: 6,
  },
  formTitle: { color: "#1a202c", fontWeight: "800", fontSize: 16, marginBottom: 4 },
  formLabel: { color: "#2d3748", fontWeight: "600" },
  chipsWrap: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  chip: {
    borderWidth: 1,
    borderColor: "#cbd5e0",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
    minWidth: 95,
  },
  chipSelected: {
    borderColor: "#2b6cb0",
    backgroundColor: "#ebf8ff",
  },
  chipText: { color: "#1a202c", fontWeight: "700" },
  chipUnit: { color: "#4a5568", fontSize: 12 },
  chipTextSelected: { color: "#2b6cb0" },
  selectedSummary: { color: "#4a5568", marginTop: 4 },
  amountRow: {
    marginTop: 6,
    padding: 8,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 8,
    backgroundColor: "#f7fafc",
    gap: 6,
  },
  amountRowLabelWrap: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountTypeLabel: { color: "#1a202c", fontWeight: "700" },
  amountUnitLabel: { color: "#4a5568", fontSize: 12 },
  amountInput: {
    borderWidth: 1,
    borderColor: "#cbd5e0",
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  actionBtn: {
    marginTop: 14,
    backgroundColor: "#2b6cb0",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  actionLabel: { color: "#fff", fontWeight: "700" },
  hint: { marginTop: 6, color: "#4a5568" },
});
