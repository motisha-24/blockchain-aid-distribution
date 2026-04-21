import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../config/env";

async function setJSON(key, value) {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

async function getJSON(key, fallback) {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) {
    return fallback;
  }
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export async function saveUser(user) {
  await setJSON(STORAGE_KEYS.USER, user);
}

export async function getUser() {
  return getJSON(STORAGE_KEYS.USER, null);
}

export async function clearUser() {
  await AsyncStorage.removeItem(STORAGE_KEYS.USER);
}

export async function saveApiBaseUrl(url) {
  await setJSON(STORAGE_KEYS.API_BASE_URL, (url || "").trim());
}

export async function getApiBaseUrl() {
  return getJSON(STORAGE_KEYS.API_BASE_URL, "");
}

export async function saveBiometricEnabled(enabled) {
  await setJSON(STORAGE_KEYS.BIOMETRIC_ENABLED, Boolean(enabled));
}

export async function getBiometricEnabled() {
  return getJSON(STORAGE_KEYS.BIOMETRIC_ENABLED, true);
}

export async function saveBeneficiaries(beneficiaries) {
  await setJSON(STORAGE_KEYS.BENEFICIARIES, beneficiaries);
}

export async function getBeneficiaries() {
  return getJSON(STORAGE_KEYS.BENEFICIARIES, []);
}

export async function saveCycle(cyclePayload) {
  await setJSON(STORAGE_KEYS.CYCLE, cyclePayload);
}

export async function getCycle() {
  return getJSON(STORAGE_KEYS.CYCLE, { cycle: 0 });
}

export async function saveProgress(progressPayload) {
  await setJSON(STORAGE_KEYS.PROGRESS, progressPayload);
}

export async function getProgress() {
  return getJSON(STORAGE_KEYS.PROGRESS, {
    total_beneficiaries: 0,
    confirmed_on_blockchain: 0,
    pending_in_cache: 0,
    total_distributed: 0,
    not_yet_distributed: 0,
    beneficiaries_detail: [],
  });
}

export async function getQueue() {
  return getJSON(STORAGE_KEYS.PENDING_QUEUE, []);
}

export async function saveQueue(queue) {
  await setJSON(STORAGE_KEYS.PENDING_QUEUE, queue);
}

export async function addToQueue(item) {
  const queue = await getQueue();
  const existingKey = queue.find((q) => q.idempotency_key === item.idempotency_key);
  if (existingKey) {
    return { added: false, reason: "Duplicate idempotency key", item: existingKey };
  }
  const existingBeneficiaryPending = queue.find(
    (q) =>
      q.beneficiary_id === item.beneficiary_id &&
      (q.status === "PENDING" || q.status === "RETRYING")
  );
  if (existingBeneficiaryPending) {
    return {
      added: false,
      reason: "Beneficiary already has a pending queued action",
      item: existingBeneficiaryPending,
    };
  }
  queue.push(item);
  await saveQueue(queue);
  return { added: true, item };
}

export async function removeQueueItem(queueItemId) {
  const queue = await getQueue();
  await saveQueue(queue.filter((item) => item.queue_id !== queueItemId));
}
