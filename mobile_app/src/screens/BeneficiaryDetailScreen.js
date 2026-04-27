import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator
} from "react-native";
import StatusPill from "../components/StatusPill";
import { AID_TYPES, AID_TYPE_UNIT_MAP } from "../constants/aidTypes";
import { useData } from "../context/DataContext";
import { getActiveSession, distributeBatch } from "../api/endpoints";

export default function BeneficiaryDetailScreen({ route }) {
  const { beneficiary, status } = route.params;
  const { cycle } = useData();
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Toggle for showing manual fallback when session is active
  const [showManual, setShowManual] = useState(false);

  // Manual fallback state
  const [amountsByType, setAmountsByType] = useState({ MAIZE: "50" });
  const [selectedAidTypes, setSelectedAidTypes] = useState(["MAIZE"]);

  useEffect(() => {
    loadSession();
  }, []);

  async function loadSession() {
    try {
      const res = await getActiveSession();
      if (res.success && res.session) {
        setSession(res.session);
      }
    } catch (e) {
      // No session is a normal state
    } finally {
      setLoadingSession(false);
    }
  }

  function toggleAidType(type) {
    setSelectedAidTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev;
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
    setAmountsByType((prev) => ({ ...prev, [type]: value }));
  }

  async function handleDistribute() {
    let itemsToDistribute = [];
    const usingSession = session && session.package && session.package.items?.length > 0 && !showManual;

    if (usingSession) {
      itemsToDistribute = session.package.items.map(item => ({
        aid_type: (item.aid_type || item.type || "").toUpperCase(),
        aid_unit: (item.unit || item.aid_unit || "UNITS").toUpperCase(),
        amount: Number(item.amount)
      }));
    } else {
      if (!selectedAidTypes.length) {
        Alert.alert("Select aid type", "Choose at least one aid type to distribute.");
        return;
      }
      const invalidType = selectedAidTypes.find((type) => {
        const amountNum = Number(amountsByType[type]);
        return !amountNum || amountNum <= 0;
      });
      if (invalidType) {
        Alert.alert("Invalid amount", `Enter a valid amount greater than zero for ${invalidType}.`);
        return;
      }
      itemsToDistribute = selectedAidTypes.map(type => ({
        aid_type: type.toUpperCase(),
        aid_unit: (AID_TYPE_UNIT_MAP[type] || "UNITS").toUpperCase(),
        amount: Number(amountsByType[type])
      }));
    }

    setSubmitting(true);
    try {
      const payload = {
        beneficiary_id: beneficiary.id,
        items: itemsToDistribute,
        location: beneficiary.location,
        officer_id: "mobile_field_officer",
        verification_mode: usingSession ? "SESSION" : "MANUAL",
        note: usingSession
          ? `Session package distribution — Cycle ${cycle?.cycle || 0}`
          : `Manual fallback — Cycle ${cycle?.cycle || 0}`
      };

      const res = await distributeBatch(payload);
      if (res.success) {
        const results = res.results || [];
        const onlineCount = results.filter(r => r.success && r.action === "DISTRIBUTED").length;
        const cacheCount = results.filter(r => r.success && r.action === "CACHED_FOR_SYNC").length;
        Alert.alert(
          "✅ Distribution Complete",
          [
            onlineCount ? `${onlineCount} item(s) confirmed on blockchain.` : null,
            cacheCount ? `${cacheCount} item(s) cached for sync.` : null,
            !onlineCount && !cacheCount ? "Batch processed — no new items recorded." : null
          ].filter(Boolean).join("\n")
        );
      } else {
        Alert.alert("Distribution Failed", res.message || "No items were distributed.");
      }
    } catch (error) {
      Alert.alert(
        "Error",
        error?.response?.data?.error || error?.message || "Unexpected error. Make sure you are connected to the server."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const renderSessionMode = () => {
    const pkg = session?.package;
    const items = pkg?.items || [];
    return (
      <View style={styles.form}>
        <View style={styles.sessionBadge}>
          <Text style={styles.sessionBadgeText}>🟢 Session Active</Text>
          <Text style={styles.sessionBadgeSub}>📍 {session.location}</Text>
        </View>

        <Text style={styles.formTitle}>Items to be Distributed</Text>
        <Text style={styles.formLabel}>The following aid will be recorded for this beneficiary:</Text>

        {items.map((item, idx) => (
          <View key={idx} style={styles.sessionItemRow}>
            <View style={styles.sessionItemLeft}>
              <Text style={styles.sessionItemType}>{item.aid_type || item.type}</Text>
              <Text style={styles.sessionItemUnit}>{item.unit || item.aid_unit}</Text>
            </View>
            <View style={styles.sessionItemAmountBadge}>
              <Text style={styles.sessionItemAmount}>{item.amount}</Text>
            </View>
          </View>
        ))}

        <Pressable style={styles.fallbackToggle} onPress={() => setShowManual(true)}>
          <Text style={styles.fallbackToggleText}>⚠ Use Manual Entry Instead</Text>
        </Pressable>
      </View>
    );
  };

  const renderManualForm = () => {
    const selectedSummary = selectedAidTypes.map((t) => `${t} (${AID_TYPE_UNIT_MAP[t] || "UNITS"})`);
    return (
      <View style={styles.form}>
        <View style={styles.manualHeader}>
          <Text style={styles.formTitle}>Manual Distribution</Text>
          {session && (
            <Pressable onPress={() => setShowManual(false)}>
              <Text style={styles.backToSessionText}>← Back to Session</Text>
            </Pressable>
          )}
        </View>

        {session && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠ You are overriding an active session. Use this only for exceptional cases.
            </Text>
          </View>
        )}

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
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{item.type}</Text>
                <Text style={[styles.chipUnit, selected && styles.chipTextSelected]}>{item.unit}</Text>
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
              placeholder={`Amount`}
            />
          </View>
        ))}
      </View>
    );
  };

  const activeSessionMode = session && !showManual;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {/* Beneficiary header */}
      <View style={styles.headerCard}>
        <Text style={styles.name}>#{beneficiary.id} {beneficiary.name}</Text>
        <StatusPill label={status} />
        <View style={styles.metaGrid}>
          <Text style={styles.meta}>🪪 {beneficiary.national_id}</Text>
          <Text style={styles.meta}>📞 {beneficiary.phone}</Text>
          <Text style={styles.meta}>📍 {beneficiary.location}</Text>
        </View>
      </View>

      {loadingSession ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#3182ce" />
          <Text style={styles.loadingText}>Checking active session...</Text>
        </View>
      ) : (
        activeSessionMode ? renderSessionMode() : renderManualForm()
      )}

      {/* Distribute button */}
      <Pressable
        style={[styles.actionBtn, submitting && { opacity: 0.6 }]}
        onPress={handleDistribute}
        disabled={submitting || loadingSession}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.actionLabel}>
            {activeSessionMode ? "📦 Distribute Session Package" : "✓ Confirm Manual Distribution"}
          </Text>
        )}
      </Pressable>

      {activeSessionMode && (
        <Text style={styles.hint}>
          All items in the active session package will be batch-processed simultaneously.
        </Text>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f0f4f8" },
  content: { padding: 16, gap: 10, paddingBottom: 32 },

  headerCard: {
    backgroundColor: "#fff", borderRadius: 14, padding: 16,
    borderWidth: 1, borderColor: "#e2e8f0", gap: 6
  },
  name: { fontSize: 20, fontWeight: "800", color: "#1a202c" },
  metaGrid: { gap: 4, marginTop: 4 },
  meta: { color: "#4a5568", fontSize: 13 },

  loadingBox: { flexDirection: "row", alignItems: "center", gap: 10, padding: 16 },
  loadingText: { color: "#718096", fontSize: 13 },

  form: {
    backgroundColor: "#fff", borderRadius: 14, borderWidth: 1,
    borderColor: "#e2e8f0", padding: 14, gap: 10
  },
  formTitle: { color: "#1a202c", fontWeight: "800", fontSize: 16 },
  formLabel: { color: "#4a5568", fontSize: 13 },
  manualHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  backToSessionText: { color: "#3182ce", fontWeight: "700", fontSize: 13 },

  warningBanner: {
    backgroundColor: "#fffbeb", borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: "#f6e05e"
  },
  warningText: { color: "#744210", fontSize: 12, lineHeight: 18 },

  sessionBadge: {
    backgroundColor: "#f0fff4", borderRadius: 10, padding: 10,
    borderWidth: 1, borderColor: "#9ae6b4", gap: 2
  },
  sessionBadgeText: { fontWeight: "800", color: "#22543d", fontSize: 14 },
  sessionBadgeSub: { color: "#276749", fontSize: 12 },

  sessionItemRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    backgroundColor: "#f7fafc", borderRadius: 10, padding: 12,
    borderWidth: 1, borderColor: "#e2e8f0"
  },
  sessionItemLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  sessionItemType: { fontWeight: "700", color: "#1a202c", fontSize: 14 },
  sessionItemUnit: { fontSize: 11, color: "#718096", backgroundColor: "#edf2f7", paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 },
  sessionItemAmountBadge: {
    backgroundColor: "#2b6cb0", borderRadius: 8, paddingHorizontal: 12, paddingVertical: 4
  },
  sessionItemAmount: { color: "#fff", fontWeight: "800", fontSize: 15 },

  fallbackToggle: {
    alignSelf: "center", marginTop: 4,
    paddingVertical: 6, paddingHorizontal: 14,
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8
  },
  fallbackToggleText: { color: "#718096", fontSize: 12, fontWeight: "600" },

  chipsWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  chip: {
    borderWidth: 1, borderColor: "#cbd5e0", borderRadius: 10,
    paddingHorizontal: 10, paddingVertical: 8,
    backgroundColor: "#fff", minWidth: 90
  },
  chipSelected: { borderColor: "#2b6cb0", backgroundColor: "#ebf8ff" },
  chipText: { color: "#1a202c", fontWeight: "700" },
  chipUnit: { color: "#4a5568", fontSize: 11 },
  chipTextSelected: { color: "#2b6cb0" },
  selectedSummary: { color: "#4a5568", fontSize: 12 },

  amountRow: {
    flexDirection: "row", alignItems: "center", justifyContent: "space-between",
    padding: 10, borderWidth: 1, borderColor: "#e2e8f0",
    borderRadius: 8, backgroundColor: "#f7fafc"
  },
  amountRowLabelWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  amountTypeLabel: { color: "#1a202c", fontWeight: "700" },
  amountUnitLabel: { color: "#718096", fontSize: 12 },
  amountInput: {
    borderWidth: 1, borderColor: "#cbd5e0", borderRadius: 8,
    paddingHorizontal: 10, paddingVertical: 6,
    backgroundColor: "#fff", minWidth: 80, textAlign: "right"
  },

  actionBtn: {
    backgroundColor: "#2b6cb0", borderRadius: 12,
    paddingVertical: 14, alignItems: "center", marginTop: 4
  },
  actionLabel: { color: "#fff", fontWeight: "800", fontSize: 15 },
  hint: { textAlign: "center", color: "#a0aec0", fontSize: 12, lineHeight: 18 },
});
