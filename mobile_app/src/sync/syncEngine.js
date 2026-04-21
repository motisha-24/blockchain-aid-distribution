import NetInfo from "@react-native-community/netinfo";
import {
  distribute,
  fetchBeneficiaries,
  fetchCurrentCycle,
  fetchCycleProgress,
  fetchPendingCache,
  fetchSystemStats,
} from "../api/endpoints";
import { APP_SYNC } from "../config/env";
import { createIdempotencyKey } from "../utils/idempotency";
import {
  getBeneficiaries,
  getCycle,
  getProgress,
  getQueue,
  saveQueue,
  saveBeneficiaries,
  saveCycle,
  saveProgress,
} from "../storage/localStore";

function isConnected(state) {
  return Boolean(state?.isConnected && state?.isInternetReachable !== false);
}

export async function bootstrapOfflineData() {
  const [beneficiaries, cycle, progress] = await Promise.all([
    getBeneficiaries(),
    getCycle(),
    getProgress(),
  ]);
  return { beneficiaries, cycle, progress };
}

export async function refreshServerSnapshot() {
  const [{ beneficiaries }, cycle] = await Promise.all([
    fetchBeneficiaries(),
    fetchCurrentCycle(),
  ]);

  let progress;
  try {
    progress = await fetchCycleProgress();
  } catch {
    const [stats, pending] = await Promise.all([
      fetchSystemStats(),
      fetchPendingCache(),
    ]);
    const pendingCount = pending?.pending?.length || 0;
    const totalTx = stats?.total_transactions || 0;
    progress = {
      cycle: stats?.current_cycle || cycle?.cycle || 0,
      total_beneficiaries: stats?.total_beneficiaries || beneficiaries.length,
      confirmed_on_blockchain: totalTx,
      pending_in_cache: pendingCount,
      total_distributed: totalTx + pendingCount,
      not_yet_distributed: Math.max(
        0,
        (stats?.total_beneficiaries || beneficiaries.length) - (totalTx + pendingCount)
      ),
      beneficiaries_detail: [],
    };
  }

  await Promise.all([
    saveBeneficiaries(beneficiaries || []),
    saveCycle(cycle),
    saveProgress(progress),
  ]);

  return { beneficiaries: beneficiaries || [], cycle, progress };
}

export async function queueDistribution(payload) {
  const idempotencyKey = payload.idempotency_key || createIdempotencyKey();
  return {
    ...payload,
    idempotency_key: idempotencyKey,
    queue_id: `${payload.beneficiary_id}-${Date.now()}`,
    retries: 0,
    status: "PENDING",
    queued_at: new Date().toISOString(),
  };
}

export async function flushQueuedDistributions(updateQueue) {
  const queue = await getQueue();
  if (!queue.length) {
    return { synced: 0, failed: 0 };
  }

  let synced = 0;
  let failed = 0;
  const nextQueue = [];

  for (const entry of queue) {
    try {
      await distribute({
        beneficiary_id: entry.beneficiary_id,
        amount: entry.amount,
        aid_type: entry.aid_type,
        aid_unit: entry.aid_unit,
        location: entry.location,
        officer_id: entry.officer_id,
        campaign_id: entry.campaign_id,
        verification_mode: entry.verification_mode,
        note: entry.note,
        idempotency_key: entry.idempotency_key,
      });
      synced += 1;
    } catch (error) {
      const retries = (entry.retries || 0) + 1;
      nextQueue.push({
        ...entry,
        retries,
        status: retries >= APP_SYNC.MAX_RETRIES ? "FAILED" : "PENDING",
        last_error:
          error?.response?.data?.error || error?.message || "Unknown sync error",
      });
      failed += 1;
    }
  }

  await saveQueue(nextQueue);
  if (updateQueue) {
    updateQueue(await getQueue());
  }

  return { synced, failed };
}

export async function canReachServer() {
  const net = await NetInfo.fetch();
  return isConnected(net);
}
