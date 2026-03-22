// ================================================================
//  api.js — Flask API Service Layer
//  Updated with auth token interceptors and auth endpoints
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import axios from 'axios';

const BASE_URL = 'http://127.0.0.1:5000';

const api = axios.create({
  baseURL: BASE_URL,
  headers: { 'Content-Type': 'application/json' }
});

// ── Automatically attach token to every request ───────────────
api.interceptors.request.use(config => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Automatically redirect to login on 401 ────────────────────
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.clear();
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);


// ── Auth ─────────────────────────────────────────────────────

export const changePassword = (data) =>
  api.post('/api/auth/users/password', data);

export const getDistributionHistory = (limit = 50) =>
  api.get(`/api/distributions/history?limit=${limit}`);

export const loginUser   = (data) =>
  api.post('/api/auth/login', data);

export const logoutUser  = () =>
  api.post('/api/auth/logout');

export const verifyToken = () =>
  api.get('/api/auth/verify');

export const getUsers    = () =>
  api.get('/api/auth/users');

export const getAllBeneficiaries = () =>
  api.get('/api/beneficiaries');

// ── System ───────────────────────────────────────────────────
export const getStats       = () => api.get('/api/stats');
export const getSystemInfo  = () => api.get('/');
export const getCurrentCycle = () => api.get('/api/cycle');
export const advanceCycle   = () => api.post('/api/cycle/advance');


// ── Beneficiary ──────────────────────────────────────────────
export const registerBeneficiary = (data) =>
  api.post('/api/beneficiary/register', data);

export const getBeneficiary = (id) =>
  api.get(`/api/beneficiary/${id}`);

export const getCollectionStatus = (id, types) =>
  api.get(`/api/beneficiary/${id}/status?types=${types}`);

export const deactivateBeneficiary = (id) =>
  api.post(`/api/beneficiary/${id}/deactivate`);

export const reactivateBeneficiary = (id) =>
  api.post(`/api/beneficiary/${id}/reactivate`);


// ── Distribution ─────────────────────────────────────────────
export const distributeAid = (data) =>
  api.post('/api/distribute', data);

export const distributeOffline = (data) =>
  api.post('/api/distribute/offline', data);

export const syncCache  = () => api.post('/api/sync');
export const getPending = () => api.get('/api/cache/pending');


// ── Transactions ─────────────────────────────────────────────
export const getTransaction       = (id) =>
  api.get(`/api/transaction/${id}`);

export const getTotalTransactions = () =>
  api.get('/api/transactions/total');


// ── SMS ──────────────────────────────────────────────────────
export const getSMSLog = () => api.get('/api/sms/log');