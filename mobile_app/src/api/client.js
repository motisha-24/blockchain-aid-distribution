import axios from "axios";
import { API_BASE_URL } from "../config/env";
import { getApiBaseUrl } from "../storage/localStore";
import { getToken } from "../storage/secure";

const client = axios.create({
  baseURL: API_BASE_URL,
  headers: { "Content-Type": "application/json" },
  timeout: 12000,
});

client.interceptors.request.use(async (config) => {
  const runtimeBaseUrl = await getApiBaseUrl();
  config.baseURL = runtimeBaseUrl || API_BASE_URL;
  const token = await getToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default client;
