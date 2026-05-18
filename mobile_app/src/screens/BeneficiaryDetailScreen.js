import { useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  ActivityIndicator,
} from "react-native";
import StatusPill from "../components/StatusPill";
import { AID_TYPES, AID_TYPE_UNIT_MAP } from "../constants/aidTypes";
import { useData } from "../context/DataContext";
import { getActiveSession, distributeBatch, fetchBeneficiaryStatus } from "../api/endpoints";

export default function BeneficiaryDetailScreen({ route }) {
  const { beneficiary, status } = route.params;
  const { cycle } = useData();
  const [session, setSession] = useState(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [realStatus, setRealStatus] = useState(status || "NOT_COLLECTED");
  const [submitting, setSubmitting] = useState(false);

  // Toggle for showing manual fallback when session is active
  const [showManual, setShowManual] = useState(false);

  // Manual fallback state
  const [amountsByType, setAmountsByType] = useState({ MAIZE: "50" });
  const [selectedAidTypes, setSelectedAidTypes] = useState(["MAIZE"]);
  const [focusedField, setFocusedField] = useState(null);

  useEffect(() => {
    loadSession();
    loadRealStatus();
  }, []);

  async function loadRealStatus() {
    try {
      const res = await fetchBeneficiaryStatus(beneficiary.id);
      if (res.success) {
        // If they collected ANY aid type, mark as COLLECTED for the UI
        const hasCollectedAnything = res.status && Object.values(res.status).some(s => s === true);
        if (hasCollectedAnything) {
          setRealStatus("COLLECTED");
        } else {
          setRealStatus("NOT_COLLECTED");
        }
      }
    } catch (e) {
      console.log("Failed to fetch real status", e);
    }
  }

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
    // Strip non-numeric inputs immediately for robust positive integer sanitization
    const cleaned = (value || "").replace(/[^0-9]/g, "");
    setAmountsByType((prev) => ({ ...prev, [type]: cleaned }));
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
        // Strict boundary and integer enforcement
        return !amountNum || amountNum <= 0 || amountNum > 10000 || !Number.isInteger(amountNum);
      });
      if (invalidType) {
        Alert.alert("Invalid amount", `Enter a valid whole number (1 - 10,000) for ${invalidType}.`);
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
          : `Manual fallback — Cycle ${cycle?.cycle || 0}`,
        notify_via_gateway: true // Use server-side cloud SMS since mobile has no GSM hardware
      };

      const res = await distributeBatch(payload);
      if (res.success) {
        const results = res.results || [];
        const onlineCount = results.filter(r => r.success && r.action === "DISTRIBUTED").length;
        const cacheCount = results.filter(r => r.success && r.action === "CACHED_FOR_SYNC").length;
        if (onlineCount > 0 || cacheCount > 0) {
          setRealStatus("COLLECTED");
        }
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

  // Helper to extract initials for custom profile avatar
  const getInitials = (name) => {
    if (!name) return "B";
    const parts = name.trim().split(" ");
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return parts[0].substring(0, 2).toUpperCase();
  };

  const renderSessionMode = () => {
    const pkg = session?.package;
    const items = pkg?.items || [];
    return (
      <View style={styles.form}>
        <View style={styles.sessionBadge}>
          <Text style={styles.sessionBadgeText}>🟢 Active Session Package</Text>
          <Text style={styles.sessionBadgeSub}>📍 Live at: {session.location}</Text>
        </View>

        <Text style={styles.formTitle}>Items to be Distributed</Text>
        <Text style={styles.formLabel}>The following pre-configured package items will be authorized for this beneficiary:</Text>

        <View style={styles.sessionItemsContainer}>
          {items.map((item, idx) => (
            <View key={idx} style={styles.sessionItemRow}>
              <View style={styles.sessionItemLeft}>
                <View style={styles.itemIconContainer}>
                  <Text style={styles.itemIconText}>📦</Text>
                </View>
                <View>
                  <Text style={styles.sessionItemType}>{item.aid_type || item.type}</Text>
                  <Text style={styles.sessionItemUnit}>{item.unit || item.aid_unit}</Text>
                </View>
              </View>
              <View style={styles.sessionItemAmountBadge}>
                <Text style={styles.sessionItemAmount}>{item.amount}</Text>
              </View>
            </View>
          ))}
        </View>

        <Pressable style={styles.fallbackToggle} onPress={() => setShowManual(true)}>
          <Text style={styles.fallbackToggleText}>⚠ Use Custom Manual Entry</Text>
        </Pressable>
      </View>
    );
  };

  const renderManualForm = () => {
    const selectedSummary = selectedAidTypes.map((t) => `${t} (${AID_TYPE_UNIT_MAP[t] || "UNITS"})`);
    return (
      <View style={styles.form}>
        <View style={styles.manualHeader}>
          <Text style={styles.formTitle}>Manual Fallback Entry</Text>
          {session && (
            <Pressable onPress={() => setShowManual(false)}>
              <Text style={styles.backToSessionText}>← Back to Session</Text>
            </Pressable>
          )}
        </View>

        {session && (
          <View style={styles.warningBanner}>
            <Text style={styles.warningText}>
              ⚠ Warning: You are overriding an active distribution session. Please proceed with caution.
            </Text>
          </View>
        )}

        <Text style={styles.formLabel}>Select one or more custom aid categories:</Text>
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
                  {selected ? "✓ " : ""}{item.type}
                </Text>
                <Text style={[styles.chipUnit, selected && styles.chipTextSelected]}>{item.unit}</Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.selectedSummary}>
          Selected: <Text style={{ fontWeight: "700", color: "#4f46e5" }}>{selectedSummary.length ? selectedSummary.join(", ") : "None"}</Text>
        </Text>

        <View style={{ gap: 10, marginTop: 4 }}>
          {selectedAidTypes.map((type) => (
            <View key={type} style={styles.amountRow}>
              <View style={styles.amountRowLabelWrap}>
                <Text style={styles.amountTypeLabel}>{type}</Text>
                <Text style={styles.amountUnitLabel}>{AID_TYPE_UNIT_MAP[type] || "UNITS"}</Text>
              </View>
              <TextInput
                style={[
                  styles.amountInput,
                  focusedField === type && styles.amountInputFocused,
                ]}
                value={amountsByType[type] || ""}
                keyboardType="numeric"
                onChangeText={(value) => setAidTypeAmount(type, value)}
                placeholder="0"
                placeholderTextColor="#94a3b8"
                onFocus={() => setFocusedField(type)}
                onBlur={() => setFocusedField(null)}
              />
            </View>
          ))}
        </View>
      </View>
    );
  };

  const activeSessionMode = session && !showManual;
  const initials = getInitials(beneficiary.name);

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {/* Beneficiary Header profile card */}
      <View style={styles.headerCard}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{initials}</Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.name}>{beneficiary.name}</Text>
            <View style={styles.badgeRow}>
              <Text style={styles.idBadge}>ID #{beneficiary.id}</Text>
              <StatusPill label={realStatus} />
            </View>
          </View>
        </View>

        <View style={styles.divider} />

        <View style={styles.metaGrid}>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>National ID Badge</Text>
            <Text style={styles.metaValue}>🪪 {beneficiary.national_id}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Phone Registry</Text>
            <Text style={styles.metaValue}>📞 {beneficiary.phone}</Text>
          </View>
          <View style={styles.metaItem}>
            <Text style={styles.metaLabel}>Assigned Region</Text>
            <Text style={styles.metaValue}>📍 {beneficiary.location}</Text>
          </View>
        </View>
      </View>

      {loadingSession ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator size="small" color="#4f46e5" />
          <Text style={styles.loadingText}>Checking for active session...</Text>
        </View>
      ) : (
        activeSessionMode ? renderSessionMode() : renderManualForm()
      )}

      {/* Distribute primary button */}
      <Pressable
        style={[styles.actionBtn, submitting && { opacity: 0.6 }]}
        onPress={handleDistribute}
        disabled={submitting || loadingSession}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.actionLabel}>
            {activeSessionMode ? "📦 Confirm & Record Package" : "✓ Authorize Custom Distribution"}
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
  page: { 
    flex: 1, 
    backgroundColor: "#f8fafc" 
  },
  content: { 
    padding: 16, 
    gap: 14, 
    paddingBottom: 32 
  },

  // Hero Card Profile Layout
  headerCard: {
    backgroundColor: "#ffffff", 
    borderRadius: 16, 
    padding: 16,
    borderWidth: 1, 
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: "#4f46e5",
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16,
  },
  profileText: {
    flex: 1,
    gap: 4,
  },
  name: { 
    fontSize: 18, 
    fontWeight: "900", 
    color: "#0f172a",
    letterSpacing: -0.3 
  },
  badgeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  idBadge: {
    fontSize: 11,
    color: "#475569",
    fontWeight: "700",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  divider: {
    height: 1,
    backgroundColor: "#e2e8f0",
    marginVertical: 14,
  },
  metaGrid: { 
    gap: 10 
  },
  metaItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  metaLabel: { 
    fontSize: 11, 
    color: "#64748b",
    fontWeight: "600",
  },
  metaValue: { 
    color: "#1e293b", 
    fontSize: 13,
    fontWeight: "700" 
  },

  loadingBox: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 10, 
    padding: 16,
    justifyContent: "center", 
  },
  loadingText: { 
    color: "#64748b", 
    fontSize: 13,
    fontWeight: "500" 
  },

  // Main Forms layout
  form: {
    backgroundColor: "#ffffff", 
    borderRadius: 16, 
    borderWidth: 1,
    borderColor: "#e2e8f0", 
    padding: 16, 
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 10,
    elevation: 2,
  },
  formTitle: { 
    color: "#0f172a", 
    fontWeight: "800", 
    fontSize: 16,
    letterSpacing: -0.2 
  },
  formLabel: { 
    color: "#64748b", 
    fontSize: 13,
    lineHeight: 18,
    fontWeight: "500" 
  },
  manualHeader: { 
    flexDirection: "row", 
    justifyContent: "space-between", 
    alignItems: "center" 
  },
  backToSessionText: { 
    color: "#4f46e5", 
    fontWeight: "700", 
    fontSize: 13 
  },

  warningBanner: {
    backgroundColor: "#fffbeb", 
    borderRadius: 10, 
    padding: 10,
    borderWidth: 1, 
    borderColor: "#fef3c7"
  },
  warningText: { 
    color: "#92400e", 
    fontSize: 12, 
    lineHeight: 18,
    fontWeight: "500" 
  },

  sessionBadge: {
    backgroundColor: "#f0fdf4", 
    borderRadius: 12, 
    padding: 12,
    borderWidth: 1, 
    borderColor: "#bbf7d0", 
    gap: 2
  },
  sessionBadgeText: { 
    fontWeight: "800", 
    color: "#166534", 
    fontSize: 14 
  },
  sessionBadgeSub: { 
    color: "#15803d", 
    fontSize: 12,
    fontWeight: "500" 
  },

  sessionItemsContainer: {
    gap: 8,
  },
  sessionItemRow: {
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    backgroundColor: "#f8fafc", 
    borderRadius: 12, 
    padding: 12,
    borderWidth: 1, 
    borderColor: "#f1f5f9"
  },
  sessionItemLeft: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 10 
  },
  itemIconContainer: {
    width: 32,
    height: 32,
    borderRadius: 8,
    backgroundColor: "#e0e7ff",
    justifyContent: "center",
    alignItems: "center",
  },
  itemIconText: {
    fontSize: 16,
  },
  sessionItemType: { 
    fontWeight: "800", 
    color: "#1e293b", 
    fontSize: 14 
  },
  sessionItemUnit: { 
    fontSize: 10, 
    color: "#64748b", 
    backgroundColor: "#f1f5f9", 
    paddingHorizontal: 6, 
    paddingVertical: 2, 
    borderRadius: 6,
    alignSelf: "flex-start",
    marginTop: 2,
    fontWeight: "700" 
  },
  sessionItemAmountBadge: {
    backgroundColor: "#4f46e5", 
    borderRadius: 10, 
    paddingHorizontal: 12, 
    paddingVertical: 6
  },
  sessionItemAmount: { 
    color: "#ffffff", 
    fontWeight: "800", 
    fontSize: 14 
  },

  fallbackToggle: {
    alignSelf: "center", 
    marginTop: 4,
    paddingVertical: 8, 
    paddingHorizontal: 16,
    borderWidth: 1, 
    borderColor: "#cbd5e1", 
    borderRadius: 10
  },
  fallbackToggleText: { 
    color: "#475569", 
    fontSize: 12, 
    fontWeight: "700" 
  },

  chipsWrap: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 8 
  },
  chip: {
    borderWidth: 1, 
    borderColor: "#cbd5e1", 
    borderRadius: 12,
    paddingHorizontal: 12, 
    paddingVertical: 10,
    backgroundColor: "#ffffff", 
    minWidth: 90,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.02,
    shadowRadius: 4,
  },
  chipSelected: { 
    borderColor: "#4f46e5", 
    backgroundColor: "#f5f3ff" 
  },
  chipText: { 
    color: "#1e293b", 
    fontWeight: "700",
    fontSize: 13 
  },
  chipUnit: { 
    color: "#64748b", 
    fontSize: 11,
    marginTop: 2 
  },
  chipTextSelected: { 
    color: "#4f46e5" 
  },
  selectedSummary: { 
    color: "#64748b", 
    fontSize: 12,
    fontWeight: "500" 
  },

  amountRow: {
    flexDirection: "row", 
    alignItems: "center", 
    justifyContent: "space-between",
    padding: 10, 
    borderWidth: 1, 
    borderColor: "#e2e8f0",
    borderRadius: 12, 
    backgroundColor: "#f8fafc"
  },
  amountRowLabelWrap: { 
    flexDirection: "row", 
    alignItems: "center", 
    gap: 8 
  },
  amountTypeLabel: { 
    color: "#0f172a", 
    fontWeight: "800",
    fontSize: 14 
  },
  amountUnitLabel: { 
    color: "#64748b", 
    fontSize: 12,
    fontWeight: "600" 
  },
  amountInput: {
    borderWidth: 1, 
    borderColor: "#cbd5e1", 
    borderRadius: 8,
    paddingHorizontal: 12, 
    paddingVertical: 8,
    backgroundColor: "#ffffff", 
    minWidth: 80, 
    textAlign: "right",
    fontSize: 14,
    color: "#0f172a",
    fontWeight: "700",
  },
  amountInputFocused: {
    borderColor: "#4f46e5",
  },

  actionBtn: {
    backgroundColor: "#4f46e5", 
    borderRadius: 16,
    paddingVertical: 14, 
    alignItems: "center", 
    marginTop: 4,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  actionLabel: { 
    color: "#ffffff", 
    fontWeight: "800", 
    fontSize: 15 
  },
  hint: { 
    textAlign: "center", 
    color: "#94a3b8", 
    fontSize: 12, 
    lineHeight: 18,
    marginTop: 4 
  },
});
