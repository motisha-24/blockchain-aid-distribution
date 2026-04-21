export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL || "http://10.0.2.2:5000";

export const APP_SYNC = {
  POLL_INTERVAL_MS: 15000,
  RETRY_BASE_DELAY_MS: 2500,
  MAX_RETRIES: 5,
};

export const STORAGE_KEYS = {
  TOKEN: "aidchain_token",
  USER: "aidchain_user",
  API_BASE_URL: "aidchain_api_base_url",
  BIOMETRIC_ENABLED: "aidchain_biometric_enabled",
  BENEFICIARIES: "aidchain_beneficiaries",
  CYCLE: "aidchain_cycle",
  PROGRESS: "aidchain_progress",
  PENDING_QUEUE: "aidchain_pending_queue",
};
