import { Text, View } from "react-native";

const COLOR_MAP = {
  CONFIRMED: "#2f855a",
  PENDING: "#d69e2e",
  COLLECTED: "#2f855a",
  NOT_COLLECTED: "#c53030",
  DEACTIVATED: "#4a5568",
};

export default function StatusPill({ label }) {
  const tone = COLOR_MAP[label] || "#4a5568";
  return (
    <View
      style={{
        backgroundColor: `${tone}20`,
        borderColor: tone,
        borderWidth: 1,
        borderRadius: 999,
        paddingHorizontal: 10,
        paddingVertical: 4,
      }}
    >
      <Text style={{ color: tone, fontWeight: "700", fontSize: 12 }}>{label}</Text>
    </View>
  );
}
