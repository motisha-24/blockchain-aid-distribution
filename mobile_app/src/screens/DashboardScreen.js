import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Text, View, ActivityIndicator } from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { useAuth } from "../context/AuthContext";
import { useData } from "../context/DataContext";

export default function DashboardScreen({ navigation }) {
  const { logout, user } = useAuth();
  const { cycle, progress, queue, isSyncing, lastSyncAt, hardwareEvents, syncNow } = useData();
  const [isConnected, setIsConnected] = useState(true);

  // Listen to network status change
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected && state.isInternetReachable !== false);
    });
    return () => unsubscribe();
  }, []);

  const totals = progress || {
    total_beneficiaries: 0,
    total_distributed: 0,
    confirmed_on_blockchain: 0,
    pending_in_cache: queue.length,
    not_yet_distributed: 0,
  };

  const total = totals.total_beneficiaries || 0;
  const distributed = totals.total_distributed || 0;
  const percent = total > 0 ? Math.min(100, Math.round((distributed / total) * 100)) : 0;

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      {/* Officer Header Card */}
      <View style={styles.headerCard}>
        <View style={styles.profileRow}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>
              {user?.username ? user.username.substring(0, 2).toUpperCase() : "FO"}
            </Text>
          </View>
          <View style={styles.profileText}>
            <Text style={styles.welcomeText}>Welcome back,</Text>
            <Text style={styles.officerName}>{user?.username || "Field Officer"}</Text>
          </View>
          <View style={styles.cycleBadge}>
            <Text style={styles.cycleBadgeText}>Cycle {cycle?.cycle || 0}</Text>
          </View>
        </View>
      </View>

      {/* Network & Sync Status Pill */}
      <View style={[styles.statusBanner, isConnected ? styles.bannerOnline : styles.bannerOffline]}>
        <View style={styles.statusPillGroup}>
          <View style={[styles.pulsingDot, isConnected ? styles.dotOnline : styles.dotOffline]} />
          <Text style={[styles.statusText, isConnected ? styles.textOnline : styles.textOffline]}>
            {isConnected ? "Connected & Live" : "Offline Mode"}
          </Text>
        </View>
      </View>

      {/* Distribution Progress Section */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Distribution Progress</Text>
        
        {/* Visual Progress Bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressHeaderRow}>
            <Text style={styles.progressLabel}>Completion Rate</Text>
            <Text style={styles.progressPercent}>{percent}%</Text>
          </View>
          <View style={styles.progressBarBg}>
            <View style={[styles.progressBarFill, { width: `${percent}%` }]} />
          </View>
        </View>

        {/* 2x2 Grid of Metrics */}
        <View style={styles.grid}>
          <View style={styles.gridRow}>
            <View style={styles.gridItem}>
              <Text style={styles.gridIcon}>👥</Text>
              <Text style={styles.gridVal}>{totals.total_beneficiaries}</Text>
              <Text style={styles.gridLabel}>Total Target</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridIcon}>📦</Text>
              <Text style={[styles.gridVal, { color: "#10b981" }]}>{totals.total_distributed}</Text>
              <Text style={styles.gridLabel}>Distributed</Text>
            </View>
          </View>

          <View style={styles.gridRow}>
            <View style={styles.gridItem}>
              <Text style={styles.gridIcon}>⛓️</Text>
              <Text style={[styles.gridVal, { color: "#4f46e5" }]}>{totals.confirmed_on_blockchain}</Text>
              <Text style={styles.gridLabel}>On Blockchain</Text>
            </View>
            <View style={styles.gridItem}>
              <Text style={styles.gridIcon}>⏳</Text>
              <Text style={[styles.gridVal, { color: "#f59e0b" }]}>{queue.length}</Text>
              <Text style={styles.gridLabel}>Pending Sync</Text>
            </View>
          </View>
        </View>
      </View>

      {/* Real-time Distribution Feed */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>Live Activity Feed</Text>
        <ScrollView style={styles.feedScroll} nestedScrollEnabled={true}>
          {hardwareEvents.length > 0 ? (
            hardwareEvents.map((event, index) => {
              const isFailed = event.event_type.includes("FAILED");
              const isSuccess = event.event_type.includes("SUCCESS") || event.event_type === "BENEFICIARY_REGISTERED";
              
              let leftBorderColor = "#3b82f6";
              let itemBg = "#eff6ff";
              if (isFailed) {
                leftBorderColor = "#ef4444";
                itemBg = "#fef2f2";
              } else if (isSuccess) {
                leftBorderColor = "#10b981";
                itemBg = "#f0fdf4";
              }

              return (
                <View key={index} style={[styles.feedItem, { borderLeftColor: leftBorderColor, backgroundColor: itemBg }]}>
                  <View style={styles.feedItemHeader}>
                    <Text style={styles.feedItemTimestamp}>{event.timestamp}</Text>
                    <Text style={styles.feedItemDevice}>{event.device_id}</Text>
                  </View>
                  <Text style={styles.feedItemMessage}>{event.message}</Text>
                  {event.details && (
                    <Text style={styles.feedItemDetails}>{event.details}</Text>
                  )}
                </View>
              );
            })
          ) : (
            <Text style={styles.emptyFeedText}>No distribution activity yet</Text>
          )}
        </ScrollView>
      </View>

      {/* Action Buttons Panel */}
      <View style={styles.actionPanel}>
        <Pressable
          style={styles.primaryBtn}
          onPress={() => navigation.navigate("SessionSetup")}
        >
          <Text style={styles.primaryBtnLabel}>⚙️ Configure Distribution Session</Text>
        </Pressable>

        <View style={styles.buttonRow}>
          <Pressable
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate("Beneficiaries")}
          >
            <Text style={styles.secondaryBtnLabel}>👥 Beneficiaries</Text>
          </Pressable>

          <Pressable
            style={styles.secondaryBtn}
            onPress={() => navigation.navigate("QueueDiagnostics")}
          >
            <Text style={styles.secondaryBtnLabel}>📊 Diagnostics</Text>
          </Pressable>
        </View>

        <Pressable style={styles.logoutBtn} onPress={logout}>
          <Text style={styles.logoutLabel}>Logout</Text>
        </Pressable>
      </View>
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
    gap: 16,
    paddingBottom: 32 
  },
  // Header Profile Styling
  headerCard: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  profileRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: "#4f46e5",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: {
    color: "#ffffff",
    fontWeight: "800",
    fontSize: 16,
  },
  profileText: {
    flex: 1,
  },
  welcomeText: {
    fontSize: 12,
    color: "#64748b",
    fontWeight: "500",
  },
  officerName: {
    fontSize: 18,
    fontWeight: "700",
    color: "#0f172a",
  },
  cycleBadge: {
    backgroundColor: "#e0e7ff",
    borderRadius: 99,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  cycleBadgeText: {
    color: "#4f46e5",
    fontWeight: "700",
    fontSize: 12,
  },
  // Status Pill styling
  statusBanner: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderWidth: 1,
  },
  bannerOnline: {
    backgroundColor: "#f0fdf4",
    borderColor: "#bbf7d0",
  },
  bannerOffline: {
    backgroundColor: "#fffbeb",
    borderColor: "#fef3c7",
  },
  statusPillGroup: {
    flexDirection: "row",
    alignItems: "center",
  },
  pulsingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 8,
  },
  dotOnline: {
    backgroundColor: "#10b981",
  },
  dotOffline: {
    backgroundColor: "#f59e0b",
  },
  statusText: {
    fontWeight: "600",
    fontSize: 13,
  },
  textOnline: {
    color: "#166534",
  },
  textOffline: {
    color: "#92400e",
  },
  syncBtn: {
    backgroundColor: "#ffffff",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: "#cbd5e1",
  },
  syncBtnText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#334155",
  },
  // Premium Card layout
  card: {
    backgroundColor: "#ffffff",
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: "#e2e8f0",
    shadowColor: "#0f172a",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  cardTitle: { 
    fontSize: 16,
    fontWeight: "700", 
    color: "#0f172a", 
    marginBottom: 12 
  },
  // Progress bar inside cards
  progressContainer: {
    marginBottom: 16,
  },
  progressHeaderRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  progressLabel: {
    fontSize: 12,
    fontWeight: "600",
    color: "#64748b",
  },
  progressPercent: {
    fontSize: 13,
    fontWeight: "700",
    color: "#4f46e5",
  },
  progressBarBg: {
    height: 8,
    backgroundColor: "#f1f5f9",
    borderRadius: 4,
    overflow: "hidden",
  },
  progressBarFill: {
    height: "100%",
    backgroundColor: "#4f46e5",
    borderRadius: 4,
  },
  // 2x2 Grid styling
  grid: {
    gap: 12,
  },
  gridRow: {
    flexDirection: "row",
    gap: 12,
  },
  gridItem: {
    flex: 1,
    backgroundColor: "#f8fafc",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#f1f5f9",
  },
  gridIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  gridVal: {
    fontSize: 18,
    fontWeight: "800",
    color: "#0f172a",
    marginBottom: 2,
  },
  gridLabel: {
    fontSize: 11,
    color: "#64748b",
    fontWeight: "500",
  },
  // Live Feed styling
  feedScroll: { 
    maxHeight: 180 
  },
  feedItem: {
    padding: 10,
    marginBottom: 8,
    borderRadius: 8,
    borderLeftWidth: 4,
  },
  feedItemHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  feedItemTimestamp: {
    fontSize: 10,
    color: "#64748b",
    fontWeight: "600",
  },
  feedItemDevice: {
    fontSize: 10,
    color: "#475569",
    fontWeight: "700",
  },
  feedItemMessage: {
    fontSize: 13,
    fontWeight: "600",
    color: "#1e293b",
  },
  feedItemDetails: {
    fontSize: 11,
    color: "#475569",
    marginTop: 2,
  },
  emptyFeedText: { 
    textAlign: "center", 
    color: "#94a3b8", 
    padding: 20,
    fontSize: 13 
  },
  // Button Panel styling
  actionPanel: {
    gap: 12,
  },
  primaryBtn: {
    backgroundColor: "#4f46e5",
    borderRadius: 12,
    padding: 14,
    alignItems: "center",
    shadowColor: "#4f46e5",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 3,
  },
  primaryBtnLabel: { 
    color: "#ffffff", 
    fontWeight: "700",
    fontSize: 15
  },
  buttonRow: {
    flexDirection: "row",
    gap: 12,
  },
  secondaryBtn: {
    flex: 1,
    backgroundColor: "#0f172a",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
  },
  secondaryBtnLabel: { 
    color: "#ffffff", 
    fontWeight: "600",
    fontSize: 13 
  },
  logoutBtn: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#fee2e2",
    marginTop: 4,
  },
  logoutLabel: { 
    color: "#dc2626", 
    fontWeight: "700",
    fontSize: 14 
  },
});
