import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  Pressable,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from "react-native";
import { getActivePackages, activateSession, getActiveSession } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";

export default function SessionSetupScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  const [location, setLocation] = useState("");
  const [packages, setPackages] = useState([]);
  const [selectedPackageId, setSelectedPackageId] = useState("");
  const [activeSession, setActiveSession] = useState(null);
  const [isFocused, setIsFocused] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sessionRes, pkgRes] = await Promise.all([
        getActiveSession().catch(() => ({ success: false })),
        getActivePackages(),
      ]);

      if (sessionRes.success && sessionRes.session) {
        setActiveSession(sessionRes.session);
        setLocation(sessionRes.session.location || "");
        setSelectedPackageId(sessionRes.session.active_package_id || "");
      } else {
        setActiveSession(null);
      }

      if (pkgRes.success) {
        setPackages(pkgRes.packages || []);
      }
    } catch (error) {
      console.log("Failed to load session data", error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadData(true);
  };

  const handleActivate = async () => {
    if (!location.trim()) {
      Alert.alert("Required", "Please enter the distribution location.");
      return;
    }
    if (location.trim().length < 3) {
      Alert.alert("Invalid Location", "Location must be at least 3 characters.");
      return;
    }
    if (location.trim().length > 100) {
      Alert.alert("Invalid Location", "Location cannot exceed 100 characters.");
      return;
    }
    if (!selectedPackageId) {
      Alert.alert("Required", "Please select an Aid Package before activating.");
      return;
    }
    setSaving(true);
    try {
      const res = await activateSession({ location: location.trim(), package_id: selectedPackageId });
      if (res.success) {
        Alert.alert(
          "✅ Session Activated",
          "Distribution session is now live. Hardware and mobile distribution will use this package.",
          [{ text: "Go to Dashboard", onPress: () => navigation.goBack() }]
        );
      } else {
        Alert.alert("Error", res.error || "Failed to start session");
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.message;
      Alert.alert("Error", "Failed to start session: " + msg);
    } finally {
      setSaving(false);
    }
  };

  // Helper to color-code aid type pills for immediate cognitive cues
  const getAidPillStyles = (type, isSelected) => {
    const norm = (type || "").toUpperCase();
    if (norm.includes("MAIZE")) {
      return {
        bg: isSelected ? "#fef3c7" : "#fffbeb",
        border: isSelected ? "#f59e0b" : "#fde68a",
        text: "#92400e",
      };
    }
    if (norm.includes("OIL")) {
      return {
        bg: isSelected ? "#ffe4e6" : "#fff1f2",
        border: isSelected ? "#f43f5e" : "#fecdd3",
        text: "#9f1239",
      };
    }
    if (norm.includes("RICE")) {
      return {
        bg: isSelected ? "#e0f2fe" : "#f0f9ff",
        border: isSelected ? "#0ea5e9" : "#bae6fd",
        text: "#0369a1",
      };
    }
    return {
      bg: isSelected ? "#e0e7ff" : "#f1f5f9",
      border: isSelected ? "#6366f1" : "#cbd5e1",
      text: isSelected ? "#4338ca" : "#475569",
    };
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#4f46e5" />
        <Text style={styles.loadingText}>Loading packages...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#4f46e5" />}
    >
      <Text style={styles.title}>Configure Session</Text>
      <Text style={styles.subtitle}>
        Select a centrally-defined Aid Package to activate for this distribution session.
      </Text>

      {/* Active session banner */}
      {activeSession && (
        <View style={styles.activeBanner}>
          <View style={styles.activeBannerIndicator}>
            <View style={styles.breathingDot} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.activeBannerTitle}>Distribution Session Active</Text>
            <Text style={styles.activeBannerSub}>📍 Location: {activeSession.location}</Text>
            <Text style={styles.activeBannerSub}>⏰ Expires: End of day</Text>
          </View>
        </View>
      )}

      {/* Location input */}
      <View style={styles.card}>
        <Text style={styles.label}>📍 Distribution Location *</Text>
        <TextInput
          style={[styles.input, isFocused && styles.inputFocused]}
          placeholder="e.g. Gweru Ward 5"
          placeholderTextColor="#94a3b8"
          value={location}
          onChangeText={setLocation}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
        />
      </View>

      {/* Package selection */}
      <Text style={styles.sectionTitle}>
        Available Aid Packages ({packages.length})
      </Text>

      {packages.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>📦</Text>
          <Text style={styles.emptyTitle}>No Packages Available</Text>
          <Text style={styles.emptySubtitle}>
            An administrator must create Aid Packages from the web dashboard before you can start a session.
          </Text>
          <Pressable style={styles.refreshBtn} onPress={onRefresh}>
            <Text style={styles.refreshBtnLabel}>↻ Refresh Packages</Text>
          </Pressable>
        </View>
      ) : (
        packages.map((pkg) => {
          const isSelected = selectedPackageId === pkg.id;
          return (
            <Pressable
              key={pkg.id}
              style={[styles.pkgCard, isSelected && styles.pkgCardSelected]}
              onPress={() => setSelectedPackageId(pkg.id)}
            >
              <View style={pkgHeaderStyle(isSelected)}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.pkgTitle, isSelected && styles.pkgTitleSelected]}>
                    📍 {pkg.location || "All Locations"}
                  </Text>
                  <Text style={styles.pkgMeta}>
                    {pkg.items?.length || 0} item{(pkg.items?.length || 0) !== 1 ? "s" : ""} • Created {pkg.created_at?.split(" ")[0]}
                  </Text>
                </View>
                {isSelected && (
                  <View style={styles.selectedBadge}>
                    <Text style={styles.selectedBadgeText}>✓ Selected</Text>
                  </View>
                )}
              </View>

              <View style={styles.itemsRow}>
                {pkg.items &&
                  pkg.items.map((it, idx) => {
                    const pillColor = getAidPillStyles(it.aid_type || it.type, isSelected);
                    return (
                      <View
                        key={idx}
                        style={[
                          styles.itemPill,
                          {
                            backgroundColor: pillColor.bg,
                            borderColor: pillColor.border,
                          },
                        ]}
                      >
                        <Text style={[styles.itemPillText, { color: pillColor.text }]}>
                          {it.amount} {it.unit || it.aid_unit} {it.aid_type || it.type}
                        </Text>
                      </View>
                    );
                  })}
              </View>
            </Pressable>
          );
        })
      )}

      {/* Activate button */}
      <Pressable
        style={[
          styles.activateBtn,
          (!location.trim() || !selectedPackageId) && styles.activateBtnDisabled,
        ]}
        onPress={handleActivate}
        disabled={saving || !location.trim() || !selectedPackageId}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.activateBtnLabel}>
            {activeSession ? "🔄 Update Active Session" : "▶ Activate Session Now"}
          </Text>
        )}
      </Pressable>

      <Text style={styles.hint}>
        Pull down to refresh the package list. Sessions automatically close at end of day.
      </Text>
    </ScrollView>
  );
}

// Simple helper to avoid nested style declarations inside render map
const pkgHeaderStyle = (isSelected) => ({
  flexDirection: "row",
  justifyContent: "space-between",
  alignItems: "flex-start",
  marginBottom: 8,
});

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
  center: { 
    flex: 1, 
    alignItems: "center", 
    justifyContent: "center", 
    gap: 12,
    backgroundColor: "#f8fafc"
  },
  loadingText: { 
    color: "#64748b", 
    fontSize: 14,
    fontWeight: "500" 
  },

  title: { 
    fontSize: 22, 
    fontWeight: "800", 
    color: "#0f172a" 
  },
  subtitle: { 
    color: "#64748b", 
    fontSize: 13, 
    lineHeight: 18 
  },

  activeBanner: {
    flexDirection: "row", 
    alignItems: "center", 
    gap: 12,
    backgroundColor: "#f0fdf4", 
    borderRadius: 16, 
    padding: 14,
    borderWidth: 1, 
    borderColor: "#bbf7d0",
    shadowColor: "#10b981",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 6,
    elevation: 1,
  },
  activeBannerIndicator: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: "#dcfce7",
    justifyContent: "center",
    alignItems: "center",
  },
  breathingDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#10b981",
  },
  activeBannerTitle: { 
    fontWeight: "800", 
    color: "#166534", 
    fontSize: 14 
  },
  activeBannerSub: { 
    color: "#15803d", 
    fontSize: 12, 
    marginTop: 2,
    fontWeight: "500" 
  },

  card: {
    backgroundColor: "#ffffff", 
    borderRadius: 16, 
    padding: 16,
    borderWidth: 1, 
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  label: { 
    fontWeight: "700", 
    color: "#334155", 
    marginBottom: 8, 
    fontSize: 13 
  },
  input: {
    borderWidth: 1, 
    borderColor: "#cbd5e1", 
    borderRadius: 12,
    padding: 12, 
    color: "#0f172a", 
    fontSize: 14, 
    backgroundColor: "#f8fafc"
  },
  inputFocused: {
    borderColor: "#4f46e5",
    backgroundColor: "#ffffff",
  },

  sectionTitle: { 
    fontSize: 14, 
    fontWeight: "700", 
    color: "#475569", 
    marginTop: 4 
  },

  emptyCard: {
    backgroundColor: "#ffffff", 
    borderRadius: 16, 
    padding: 32, 
    alignItems: "center",
    borderWidth: 1, 
    borderColor: "#e2e8f0", 
    gap: 10,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  emptyIcon: { 
    fontSize: 40 
  },
  emptyTitle: { 
    fontWeight: "800", 
    color: "#0f172a", 
    fontSize: 16 
  },
  emptySubtitle: { 
    color: "#64748b", 
    textAlign: "center", 
    fontSize: 13, 
    lineHeight: 18 
  },
  refreshBtn: {
    marginTop: 8, 
    backgroundColor: "#f5f3ff", 
    borderRadius: 10,
    paddingVertical: 10, 
    paddingHorizontal: 20, 
    borderWidth: 1, 
    borderColor: "#ddd6fe"
  },
  refreshBtnLabel: { 
    color: "#4f46e5", 
    fontWeight: "700",
    fontSize: 13 
  },

  pkgCard: {
    backgroundColor: "#ffffff", 
    borderRadius: 16, 
    padding: 16,
    borderWidth: 1.5, 
    borderColor: "#e2e8f0", 
    gap: 12,
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  pkgCardSelected: { 
    borderColor: "#4f46e5", 
    backgroundColor: "#f5f3ff",
  },
  pkgTitle: { 
    fontSize: 15, 
    fontWeight: "800", 
    color: "#1e293b" 
  },
  pkgTitleSelected: { 
    color: "#4f46e5" 
  },
  pkgMeta: { 
    fontSize: 12, 
    color: "#64748b", 
    marginTop: 2,
    fontWeight: "500" 
  },
  selectedBadge: {
    backgroundColor: "#4f46e5", 
    borderRadius: 20,
    paddingHorizontal: 10, 
    paddingVertical: 4
  },
  selectedBadgeText: { 
    color: "#ffffff", 
    fontWeight: "700", 
    fontSize: 11 
  },

  itemsRow: { 
    flexDirection: "row", 
    flexWrap: "wrap", 
    gap: 8 
  },
  itemPill: {
    borderRadius: 20,
    paddingHorizontal: 10, 
    paddingVertical: 5,
    borderWidth: 1,
  },
  itemPillText: { 
    fontSize: 12, 
    fontWeight: "700" 
  },

  activateBtn: {
    backgroundColor: "#4f46e5", 
    borderRadius: 16, 
    paddingVertical: 14,
    alignItems: "center", 
    marginTop: 8,
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 3,
  },
  activateBtnDisabled: { 
    backgroundColor: "#cbd5e1" 
  },
  activateBtnLabel: { 
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
