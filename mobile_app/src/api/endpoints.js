import client from "./client";

export async function healthCheck() {
  const { data } = await client.get("/");
  return data;
}

export async function login(payload) {
  const { data } = await client.post("/api/auth/login", payload);
  return data;
}

export async function fetchBeneficiaries() {
  const { data } = await client.get("/api/beneficiaries");
  return data;
}

export async function fetchCurrentCycle() {
  const { data } = await client.get("/api/cycle");
  return data;
}

export async function fetchSystemStats() {
  const { data } = await client.get("/api/stats");
  return data;
}

export async function fetchPendingCache() {
  const { data } = await client.get("/api/cache/pending");
  return data;
}

export async function fetchCycleProgress() {
  const { data } = await client.get("/api/cycle/progress");
  return data;
}

export async function distribute(payload) {
  const { data } = await client.post("/api/distribute", payload);
  return data;
}

export async function getHardwareProfile() {
  const { data } = await client.get("/api/hardware/profile");
  return data;
}

export async function updateHardwareProfile(payload) {
  const { data } = await client.post("/api/hardware/profile", payload);
  return data;
}

export async function getHardwareEvents(limit = 50) {
  const { data } = await client.get(`/api/hardware/events?limit=${limit}`);
  return data;
}
