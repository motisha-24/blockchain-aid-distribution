// Shared limits aligned with flask_api/app.py validate()

export const LIMITS = {
  username: { min: 3, max: 50 },
  password: { min: 8, max: 100 },
  name: { min: 2, max: 100 },
  email: { max: 120 },
  location: { min: 3, max: 100 },
  campaignName: { min: 3, max: 100 },
  donorLabel: { min: 2, max: 100 },
  aidType: { max: 50 },
  nationalId: { max: 15 },
  phone: { max: 16 },
  deviceId: { min: 3, max: 100 },
  officerId: { min: 3, max: 50 },
  beneficiaryId: { min: 1001, max: 1127 },
  distAmount: { min: 1, max: 10000 },
  packageAmount: { min: 1, max: 100000 },
  budgetMax: 999999999,
  txIdMax: 999999999,
  searchMax: 100,
};

export const ZW_NATIONAL_ID = /^\d{2}-\d{6,7}[A-Z]\d{2}$/;
export const PHONE_REGEX = /^\+?[0-9]{10,15}$/;
export const USERNAME_REGEX = /^[a-zA-Z0-9_]+$/;
export const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const PASSWORD_COMPLEXITY =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;
export const TX_HASH_REGEX = /^0x[a-fA-F0-9]{64}$/;

export const getLocalDateString = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

/** Normalize API hardware profile to flat NGO dashboard state */
export const normalizeHardwareProfile = (profile, defaults = {}) => {
  if (!profile || typeof profile !== 'object') return defaults;
  const first = Array.isArray(profile.items) && profile.items.length > 0
    ? profile.items[0]
    : {};
  return {
    aid_type: first.aid_type || profile.aid_type || defaults.aid_type || 'MAIZE',
    aid_unit: first.aid_unit || profile.aid_unit || defaults.aid_unit || 'KG',
    amount: first.amount ?? profile.amount ?? defaults.amount ?? 50,
    location: profile.location || defaults.location || '',
    officer_id: profile.officer_id || defaults.officer_id || 'ngo_officer',
    device_id: profile.device_id || defaults.device_id || 'aidchain-field-01',
  };
};

export const apiErrorMessage = (err, fallback = 'Request failed') => {
  const data = err?.response?.data;
  if (!data) {
    return typeof err?.message === 'string' ? err.message : fallback;
  }
  if (typeof data === 'string') return data;
  return (
    data.error ||
    data.message ||
    (Array.isArray(data.errors) ? data.errors.join(' | ') : null) ||
    fallback
  );
};
