import NetInfo from "@react-native-community/netinfo";
import {
  AppState,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { distribute, getHardwareEvents } from "../api/endpoints";
import { APP_SYNC } from "../config/env";
import { addToQueue, getQueue, saveQueue } from "../storage/localStore";
import {
  bootstrapOfflineData,
  canReachServer,
  flushQueuedDistributions,
  queueDistribution,
  refreshServerSnapshot,
} from "../sync/syncEngine";
import { createIdempotencyKey } from "../utils/idempotency";
import { useAuth } from "./AuthContext";

const DataContext = createContext(null);

export function DataProvider({ children }) {
  const { isLoggedIn } = useAuth();
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [cycle, setCycle] = useState({ cycle: 0 });
  const [progress, setProgress] = useState(null);
  const [queue, setQueue] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncAt, setLastSyncAt] = useState(null);
  const [hardwareEvents, setHardwareEvents] = useState([]);
  const timerRef = useRef(null);

  const hydrate = useCallback(async () => {
    const offlineData = await bootstrapOfflineData();
    setBeneficiaries(offlineData.beneficiaries || []);
    setCycle(offlineData.cycle || { cycle: 0 });
    setProgress(offlineData.progress || null);
    const localQueue = await getQueue();
    setQueue(localQueue);
  }, []);

  const syncNow = useCallback(async () => {
    if (!isLoggedIn || isSyncing) {
      return;
    }
    setIsSyncing(true);
    try {
      const online = await canReachServer();
      if (!online) {
        await hydrate();
        return;
      }
      await flushQueuedDistributions(setQueue);
      const latest = await refreshServerSnapshot();
      setBeneficiaries(latest.beneficiaries || []);
      setCycle(latest.cycle || { cycle: 0 });
      setProgress(latest.progress || null);
      setQueue(await getQueue());
      const events = await getHardwareEvents(20); // Fetch last 20 events for mobile
      setHardwareEvents(events.events || []);
      setLastSyncAt(new Date().toISOString());
    } finally {
      setIsSyncing(false);
    }
  }, [hydrate, isLoggedIn, isSyncing]);

  const distributeWithOfflineFallback = useCallback(async (payload) => {
    const normalizedPayload = {
      ...payload,
      idempotency_key: payload.idempotency_key || createIdempotencyKey(),
    };
    const online = await canReachServer();
    if (online) {
      try {
        const data = await distribute(normalizedPayload);
        await syncNow();
        return { mode: data.mode || "ONLINE", data };
      } catch {
        // Fall through to local queue when transient errors happen.
      }
    }
    const queuedItem = await queueDistribution(normalizedPayload);
    const queueResult = await addToQueue(queuedItem);
    setQueue(await getQueue());
    return { mode: "OFFLINE", data: queueResult.item, queued: queueResult.added };
  }, [syncNow]);

  useEffect(() => {
    hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!isLoggedIn) {
      return undefined;
    }

    syncNow();
    timerRef.current = setInterval(syncNow, APP_SYNC.POLL_INTERVAL_MS);

    const hasNetInfoListener = Boolean(NetInfo && typeof NetInfo.addEventListener === "function");
    const hasAppStateListener =
      Boolean(AppState) && typeof AppState.addEventListener === "function";

    const netSub = hasNetInfoListener
      ? NetInfo.addEventListener((state) => {
          if (state.isConnected && state.isInternetReachable !== false) {
            syncNow();
          }
        })
      : null;
    const appStateSub = hasAppStateListener
      ? AppState.addEventListener("change", (nextState) => {
          if (nextState === "active") {
            syncNow();
          }
        })
      : null;

    return () => {
      clearInterval(timerRef.current);
      if (typeof netSub === "function") {
        netSub();
      }
      if (appStateSub && typeof appStateSub.remove === "function") {
        appStateSub.remove();
      }
    };
  }, [isLoggedIn, syncNow]);

  const value = useMemo(
    () => ({
      beneficiaries,
      cycle,
      progress,
      queue,
      isSyncing,
      lastSyncAt,
      hardwareEvents,
      syncNow,
      distributeWithOfflineFallback,
      async markQueueAcknowledged(queueId) {
        const current = await getQueue();
        await saveQueue(current.filter((item) => item.queue_id !== queueId));
        setQueue(await getQueue());
      },
    }),
    [
      beneficiaries,
      cycle,
      progress,
      queue,
      isSyncing,
      lastSyncAt,
      hardwareEvents,
      syncNow,
      distributeWithOfflineFallback,
    ]
  );

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  const ctx = useContext(DataContext);
  if (!ctx) {
    throw new Error("useData must be used inside DataProvider");
  }
  return ctx;
}
