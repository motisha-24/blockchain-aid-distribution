import React, { useState, useEffect } from "react";
import { 
  View, Text, StyleSheet, ScrollView, TextInput, 
  Pressable, ActivityIndicator, Alert 
} from "react-native";
import { getHardwareProfile, updateHardwareProfile } from "../api/endpoints";
import { useAuth } from "../context/AuthContext";

export default function SessionSetupScreen({ navigation }) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [location, setLocation] = useState("");
  const [items, setItems] = useState([]);

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      const res = await getHardwareProfile();
      if (res.success && res.profile) {
        setLocation(res.profile.location || "");
        setItems(res.profile.items || []);
      }
    } catch (error) {
      console.log("Failed to load profile", error);
    } finally {
      setLoading(false);
    }
  };

  const addItem = () => {
    setItems([...items, { aid_type: "", aid_unit: "", amount: "" }]);
  };

  const removeItem = (index) => {
    const newItems = [...items];
    newItems.splice(index, 1);
    setItems(newItems);
  };

  const updateItem = (index, field, value) => {
    const newItems = [...items];
    newItems[index][field] = value;
    setItems(newItems);
  };

  const handleSave = async () => {
    if (!location) {
      Alert.alert("Error", "Location is required");
      return;
    }
    if (items.length === 0) {
      Alert.alert("Error", "Please add at least one aid item");
      return;
    }

    // Validate items
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      if (!item.aid_type || !item.aid_unit || !item.amount) {
        Alert.alert("Error", `Item #${i + 1} is missing fields`);
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        location: location,
        items: items.map(item => ({
          ...item,
          amount: parseInt(item.amount)
        })),
        officer_id: user?.username || "ngo_officer",
        device_id: "aidchain-field-01" // Standard fallback for field device
      };
      
      const res = await updateHardwareProfile(payload);
      if (res.success) {
        Alert.alert("Success", "Distribution Session active! Hardware is synced.", [
          { text: "OK", onPress: () => navigation.goBack() }
        ]);
      } else {
        Alert.alert("Error", res.error || "Failed to update session");
      }
    } catch (error) {
      const msg = error.response?.data?.error || error.response?.data?.message || error.message;
      Alert.alert("Error", "Failed to start session: " + msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#2b6cb0" />
        <Text style={{ marginTop: 10 }}>Loading Session...</Text>
      </View>
    );
  }

  return (
    <ScrollView style={styles.page} contentContainerStyle={styles.content}>
      <Text style={styles.title}>Distribution Session setup</Text>
      <Text style={styles.subtitle}>
        Define the multi-aid package to be distributed for each fingerprint scan.
      </Text>

      <View style={styles.card}>
        <Text style={styles.label}>Distribution Location</Text>
        <TextInput
          style={styles.input}
          placeholder="e.g. Gweru Ward 5"
          value={location}
          onChangeText={setLocation}
        />
      </View>

      <Text style={styles.sectionTitle}>Aid Package</Text>
      
      {items.map((item, index) => (
        <View key={index} style={styles.itemCard}>
          <View style={styles.itemHeader}>
            <Text style={styles.itemTitle}>Item #{index + 1}</Text>
            <Pressable onPress={() => removeItem(index)} style={styles.removeBtn}>
              <Text style={styles.removeBtnText}>Remove</Text>
            </Pressable>
          </View>
          
          <Text style={styles.label}>Aid Type (e.g. MAIZE, CASH, BLANKETS)</Text>
          <TextInput
            style={styles.input}
            placeholder="Type"
            value={item.aid_type}
            onChangeText={(v) => updateItem(index, "aid_type", v)}
            autoCapitalize="characters"
          />

          <View style={styles.row}>
            <View style={{ flex: 1, marginRight: 8 }}>
              <Text style={styles.label}>Unit (KG, USD)</Text>
              <TextInput
                style={styles.input}
                placeholder="Unit"
                value={item.aid_unit}
                onChangeText={(v) => updateItem(index, "aid_unit", v)}
                autoCapitalize="characters"
              />
            </View>
            <View style={{ flex: 1, marginLeft: 8 }}>
              <Text style={styles.label}>Amount</Text>
              <TextInput
                style={styles.input}
                placeholder="e.g. 50"
                value={item.amount ? String(item.amount) : ""}
                onChangeText={(v) => updateItem(index, "amount", v)}
                keyboardType="numeric"
              />
            </View>
          </View>
        </View>
      ))}

      <Pressable style={styles.addBtn} onPress={addItem}>
        <Text style={styles.addBtnLabel}>+ Add Aid Type</Text>
      </Pressable>

      <Pressable style={styles.saveBtn} onPress={handleSave} disabled={saving}>
        {saving ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.saveBtnLabel}>Start Distribution Session</Text>
        )}
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  page: { flex: 1, backgroundColor: "#f7fafc" },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 24, fontWeight: "800", color: "#2d3748", marginBottom: 4 },
  subtitle: { fontSize: 14, color: "#718096", marginBottom: 20 },
  sectionTitle: { fontSize: 18, fontWeight: "700", color: "#2d3748", marginTop: 10, marginBottom: 10 },
  card: {
    backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 16,
    shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 2, elevation: 2
  },
  itemCard: {
    backgroundColor: "#fff", padding: 16, borderRadius: 12, marginBottom: 12,
    borderWidth: 1, borderColor: "#e2e8f0"
  },
  itemHeader: { flexDirection: "row", justifyContent: "space-between", marginBottom: 12 },
  itemTitle: { fontWeight: "700", color: "#4a5568", fontSize: 16 },
  removeBtn: { backgroundColor: "#fed7d7", paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6 },
  removeBtnText: { color: "#c53030", fontSize: 12, fontWeight: "700" },
  label: { fontSize: 13, fontWeight: "600", color: "#4a5568", marginBottom: 6 },
  input: {
    backgroundColor: "#edf2f7", borderRadius: 8, padding: 12, fontSize: 15,
    color: "#2d3748", marginBottom: 12, borderWidth: 1, borderColor: "#e2e8f0"
  },
  row: { flexDirection: "row" },
  addBtn: {
    backgroundColor: "#ebf8ff", borderRadius: 10, padding: 14, alignItems: "center",
    marginBottom: 24, borderWidth: 1, borderColor: "#90cdf4"
  },
  addBtnLabel: { color: "#3182ce", fontWeight: "700", fontSize: 16 },
  saveBtn: {
    backgroundColor: "#38a169", borderRadius: 10, padding: 16, alignItems: "center",
    shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3
  },
  saveBtnLabel: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
