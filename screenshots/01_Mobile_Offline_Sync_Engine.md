# Mobile Application - Offline Synchronisation Engine

## Overview
The Offline Synchronisation Engine (`syncEngine.js`) manages bidirectional data sync between the mobile app and Flask API, supporting offline-first functionality with automatic retry logic.

## Key Components

### 1. Bootstrap Offline Data
Loads initial data from local storage upon app startup:
```javascript
export async function bootstrapOfflineData() {
  const [beneficiaries, cycle, progress] = await Promise.all([
    getBeneficiaries(),
    getCycle(),
    getProgress(),
  ]);
  return { beneficiaries, cycle, progress };
}
```
**Purpose:** Ensures app is immediately usable even without network connection

---

### 2. Refresh Server Snapshot
Fetches latest data from Flask API with fallback error handling:
```javascript
export async function refreshServerSnapshot() {
  const [{ beneficiaries }, cycle, { events }] = await Promise.all([
    fetchBeneficiaries(),
    fetchCurrentCycle(),
    fetchHardwareEvents(150)
  ]);

  let progress;
  try {
    const cycleNum = cycle?.cycle ?? 0;
    progress = await fetchCycleProgress(cycleNum);
  } catch {
    const [stats, pending] = await Promise.all([
      fetchSystemStats(),
      fetchPendingCache(),
    ]);
    // Build progress from cached data if API fails
    progress = { ... };
  }

  await Promise.all([
    saveBeneficiaries(beneficiaries || []),
    saveCycle(cycle),
    saveProgress(progress),
  ]);

  return { beneficiaries: beneficiaries || [], cycle, progress, events: events || [] };
}
```
**Features:**
- Parallel API calls for efficiency
- Graceful degradation when network fails
- Falls back to system stats and pending cache
- Persistent local storage of all data

---

### 3. Queue Distribution Transaction
Prepares distribution payload with retry tracking:
```javascript
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
```
**Purpose:** Ensures idempotent transactions with unique queue IDs

---

### 4. Flush Queued Distributions (Sync to Server)
Attempts to sync all pending transactions when connectivity resumes:
```javascript
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
        last_error: error?.response?.data?.error || error?.message || "Unknown sync error",
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
```
**Features:**
- Automatic retry with configurable max attempts
- Tracks failed transactions with error messages
- Updates queue state after sync attempt
- Idempotency ensures no duplicate distribution even if retried

---

### 5. Network Detection
```javascript
export async function canReachServer() {
  const net = await NetInfo.fetch();
  return isConnected(net);
}

function isConnected(state) {
  return Boolean(state?.isConnected && state?.isInternetReachable !== false);
}
```

## Data Flow

```
Offline                              Online
┌─────────────────┐                ┌──────────────────┐
│ Local Storage   │◄──Write cache──│  Flask API       │
│ -Beneficiaries  │                │  -GET endpoints  │
│ -Cycle Data     │─Read cache────►│  -POST distribute│
│ -Queue Storage  │                │                  │
└─────────────────┘                └──────────────────┘
        ▲                                    ▲
        │ bootstrapOfflineData()             │
        │                                    │
    App                          flushQueuedDistributions()
    Startup                      When online
```

## Error Handling

- **Offline Operation:** App queues transactions locally
- **Network Resume:** Automatic retry with exponential backoff
- **Max Retries Exceeded:** Transaction marked as FAILED for manual review
- **API Errors:** Captured in `last_error` field for debugging

## Idempotency Protection

Each transaction includes:
- `idempotency_key`: Unique UUID prevents duplicate distribution
- `queue_id`: Unique identifier for tracking retry attempts
- `retries`: Count of sync attempts

If API receives same `idempotency_key`, it returns 409 (Conflict) instead of duplicate distribution.
