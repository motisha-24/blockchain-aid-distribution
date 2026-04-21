export const AID_TYPES = [
  { type: "MAIZE", unit: "KG" },
  { type: "CASH", unit: "USD" },
  { type: "OIL", unit: "LITRES" },
  { type: "SEEDS", unit: "PACKETS" },
  { type: "CLOTHES", unit: "UNITS" },
  { type: "FERTILISER", unit: "KG" },
  { type: "BLANKETS", unit: "UNITS" },
];

export const AID_TYPE_UNIT_MAP = AID_TYPES.reduce((acc, item) => {
  acc[item.type] = item.unit;
  return acc;
}, {});
