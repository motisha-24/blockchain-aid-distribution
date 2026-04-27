import React, { useState, useEffect } from "react";
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  Pressable, ActivityIndicator, Alert, RefreshControl
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

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [sessionRes, pkgRes] = await Promise.all([
        getActiveSession().catch(() => ({ success: false })),
        getActivePackages()
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

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#3182ce" />
        <Text style={styles.loadingText}>Loading packages...</Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.page}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#3182ce" />}
    >
      <Text style={styles.title}>Configure Session</Text>
      <Text style={styles.subtitle}>
        Select a centrally-defined Aid Package to activate for this distribution session.
      </Text>

      {/* Active session banner */}
      {activeSession && (
        <View style={styles.activeBanner}>
          <Text style={styles.activeBannerIcon}>🟢</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.activeBannerTitle}>Session Active</Text>
            <Text style={styles.activeBannerSub}>Location: {activeSession.location}</Text>
            <Text style={styles.activeBannerSub}>Expires: End of day</Text>
          </View>
        </View>
      )}

      {/* Location input */}
      <View style={styles.card}>
        <Text style={styles.label}>📍 Distribution Location *</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Gweru Ward 5"
          placeholderTextColor="#a0aec0"
          value={location}
          onChangeText={setLocation}
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
            <Text style={styles.refreshBtnLabel}>↻ Refresh</Text>
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
              <View style={styles.pkgHeader}>
                <View>
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
                {pkg.items && pkg.items.map((it, idx) => (
                  <View key={idx} style={[styles.itemPill, isSelected && styles.itemPillSelected]}>
                    <Text style={[styles.itemPillText, isSelected && styles.itemPillTextSelected]}>
                      {it.amount} {it.unit || it.aid_unit} {it.aid_type || it.type}
                    </Text>
                  </View>
                ))}
              </View>
            </Pressable>
          );
        })
      )}

      {/* Activate button */}
      <Pressable
        style={[
          styles.activateBtn,
          (!location.trim() || !selectedPackageId) && styles.activateBtnDisabled
        ]}
        onPress={handleActivate}
        disabled={saving || !location.trim() || !selectedPackageId}
      >
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.activateBtnLabel}>
            {activeSession ? "🔄 Update Session" : "▶ Activate Session"}
          </Text>
        )}
      </Pressable>

      <Text style={styles.hint}>
        Pull down to refresh the package list. Sessions automatically close at end of day.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: "#f0f4f8" },
  content: { padding: 16, gap: 12, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  loadingText: { color: "#718096", fontSize: 14 },

  title: { fontSize: 22, fontWeight: "800", color: "#1a202c" },
  subtitle: { color: "#4a5568", fontSize: 13, lineHeight: 20 },

  activeBanner: {
    flexDirection: "row", alignItems: "center", gap: 12,
    backgroundColor: "#c6f6d5", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#9ae6b4"
  },
  activeBannerIcon: { fontSize: 22 },
  activeBannerTitle: { fontWeight: "800", color: "#22543d", fontSize: 15 },
  activeBannerSub: { color: "#276749", fontSize: 12, marginTop: 2 },

  card: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 1, borderColor: "#e2e8f0"
  },
  label: { fontWeight: "700", color: "#2d3748", marginBottom: 8, fontSize: 13 },
  input: {
    borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 8,
    padding: 10, color: "#1a202c", fontSize: 14, backgroundColor: "#f7fafc"
  },

  sectionTitle: { fontSize: 14, fontWeight: "700", color: "#4a5568", marginTop: 4 },

  emptyCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 28, alignItems: "center",
    borderWidth: 1, borderColor: "#e2e8f0", gap: 8
  },
  emptyIcon: { fontSize: 36 },
  emptyTitle: { fontWeight: "800", color: "#1a202c", fontSize: 16 },
  emptySubtitle: { color: "#718096", textAlign: "center", fontSize: 13, lineHeight: 20 },
  refreshBtn: {
    marginTop: 8, backgroundColor: "#ebf8ff", borderRadius: 8,
    paddingVertical: 8, paddingHorizontal: 20, borderWidth: 1, borderColor: "#90cdf4"
  },
  refreshBtnLabel: { color: "#3182ce", fontWeight: "700" },

  pkgCard: {
    backgroundColor: "#fff", borderRadius: 12, padding: 14,
    borderWidth: 2, borderColor: "#e2e8f0", gap: 10
  },
  pkgCardSelected: { borderColor: "#3182ce", backgroundColor: "#ebf8ff" },
  pkgHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  pkgTitle: { fontSize: 15, fontWeight: "800", color: "#2d3748" },
  pkgTitleSelected: { color: "#2b6cb0" },
  pkgMeta: { fontSize: 12, color: "#718096", marginTop: 2 },
  selectedBadge: {
    backgroundColor: "#3182ce", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 3
  },
  selectedBadgeText: { color: "#fff", fontWeight: "700", fontSize: 11 },

  itemsRow: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  itemPill: {
    backgroundColor: "#edf2f7", borderRadius: 20,
    paddingHorizontal: 10, paddingVertical: 4
  },
  itemPillSelected: { backgroundColor: "#bee3f8" },
  itemPillText: { fontSize: 12, fontWeight: "600", color: "#4a5568" },
  itemPillTextSelected: { color: "#2b6cb0" },

  activateBtn: {
    backgroundColor: "#2b6cb0", borderRadius: 12, paddingVertical: 14,
    alignItems: "center", marginTop: 8
  },
  activateBtnDisabled: { backgroundColor: "#a0aec0" },
  activateBtnLabel: { color: "#fff", fontWeight: "800", fontSize: 16 },

  hint: { textAlign: "center", color: "#a0aec0", fontSize: 12, lineHeight: 18 },
});
