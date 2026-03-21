// ================================================================
//  AdminDashboard.js — System Administrator View
//  Full user management — add, deactivate, reactivate users
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import {
  getStats, advanceCycle,
  getPending, syncCache
} from '../services/api';
import axios from 'axios';

const BASE_URL = 'http://127.0.0.1:5000';

const ROLES = ['NGO', 'DONOR', 'AUDITOR', 'ADMIN'];

const roleBadgeColor = {
  ADMIN  : { bg: '#e9d8fd', color: '#553c9a' },
  NGO    : { bg: '#c6f6d5', color: '#276749' },
  DONOR  : { bg: '#fefcbf', color: '#744210' },
  AUDITOR: { bg: '#fed7d7', color: '#9b2c2c' },
};

export default function AdminDashboard() {
  const [stats,   setStats]   = useState({});
  const [pending, setPending] = useState([]);
  const [users,   setUsers]   = useState([]);
  const [alert,   setAlert]   = useState(null);
  const [loading, setLoading] = useState(false);

  // ── New user form ──────────────────────────────────────────
  const [newUser, setNewUser] = useState({
    username: '', password: '', role: 'NGO',
    name: '', email: ''
  });
  const [newUserErrors, setNewUserErrors] = useState({});
  const [showForm, setShowForm] = useState(false);

  const name     = localStorage.getItem('name');
  const token    = localStorage.getItem('token');
  const authHeader = { Authorization: `Bearer ${token}` };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchData = async () => {
    try {
      const [s, p, u] = await Promise.all([
        getStats(),
        getPending(),
        axios.get(`${BASE_URL}/api/auth/users`, { headers: authHeader })
      ]);
      setStats(s.data);
      setPending(p.data.pending || []);
      setUsers(u.data.users || []);
    } catch {}
  };

  const showAlert = (msg, type = 'success') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 5000);
  };

  // ================================================================
  //  VALIDATE NEW USER FORM
  // ================================================================
  const validateNewUser = () => {
    const errs = {};
    if (!newUser.username.trim() || newUser.username.trim().length < 3)
      errs.username = "Username must be at least 3 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(newUser.username.trim()))
      errs.username = "Username can only contain letters, numbers and underscores";
    if (!newUser.password || newUser.password.length < 8)
      errs.password = "Password must be at least 8 characters";
    if (!newUser.name.trim() || newUser.name.trim().length < 2)
      errs.name = "Full name must be at least 2 characters";
    if (newUser.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email))
      errs.email = "Enter a valid email address";
    return errs;
  };

  // ================================================================
  //  CREATE NEW USER
  // ================================================================
  const handleCreateUser = async () => {
    const errs = validateNewUser();
    setNewUserErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await axios.post(
        `${BASE_URL}/api/auth/users/create`,
        { ...newUser, username: newUser.username.trim(),
          name: newUser.name.trim() },
        { headers: authHeader }
      );
      showAlert(`✓ User "${newUser.username}" created as ${newUser.role}`);
      setNewUser({ username:'', password:'', role:'NGO', name:'', email:'' });
      setNewUserErrors({});
      setShowForm(false);
      fetchData();
    } catch (e) {
      showAlert(e.response?.data?.error || 'Failed to create user', 'error');
    }
    setLoading(false);
  };

  // ================================================================
  //  DEACTIVATE USER
  // ================================================================
  const handleDeactivate = async (username) => {
    if (!window.confirm(
      `Deactivate user "${username}"?\n\nThey will not be able to log in.`
    )) return;
    try {
      await axios.post(
        `${BASE_URL}/api/auth/users/${username}/deactivate`,
        {},
        { headers: authHeader }
      );
      showAlert(`✓ User "${username}" deactivated`);
      fetchData();
    } catch (e) {
      showAlert(e.response?.data?.error || 'Failed to deactivate', 'error');
    }
  };

  // ================================================================
  //  REACTIVATE USER
  // ================================================================
  const handleReactivate = async (username) => {
    try {
      await axios.post(
        `${BASE_URL}/api/auth/users/${username}/reactivate`,
        {},
        { headers: authHeader }
      );
      showAlert(`✓ User "${username}" reactivated`);
      fetchData();
    } catch (e) {
      showAlert(e.response?.data?.error || 'Failed to reactivate', 'error');
    }
  };

  // ── Advance cycle ──────────────────────────────────────────
  const handleAdvanceCycle = async () => {
    if (!window.confirm('Advance to next distribution cycle?')) return;
    try {
      const res = await advanceCycle();
      showAlert(`✓ Advanced to Cycle ${res.data.new_cycle}`);
      fetchData();
    } catch {
      showAlert('Failed to advance cycle', 'error');
    }
  };

  // ── Sync cache ─────────────────────────────────────────────
  const handleSync = async () => {
    try {
      const res = await syncCache();
      showAlert(`✓ Synced ${res.data.synced} transactions`);
      fetchData();
    } catch {
      showAlert('Sync failed', 'error');
    }
  };

  // ── Input style ────────────────────────────────────────────
  const inputStyle = (hasError) => ({
    width: '100%', padding: '9px 12px',
    border: `1px solid ${hasError ? '#e53e3e' : '#e2e8f0'}`,
    borderRadius: '6px', fontSize: '13px',
    background: hasError ? '#fff5f5' : '#f7fafc',
    outline: 'none', color: '#2d3748'
  });

  const errStyle = {
    fontSize: '11px', color: '#e53e3e',
    marginTop: '3px', fontWeight: 500
  };

  return (
    <div className="page">

      {/* Header */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: '4px'
      }}>
        <div>
          <div className="page-title">Admin Dashboard</div>
          <div className="page-subtitle">
            Welcome, {name} — Full system control
          </div>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button className="btn btn-orange btn-sm"
            onClick={handleAdvanceCycle}>
            ↻ Advance Cycle
          </button>
          <button className="btn btn-green btn-sm"
            onClick={handleSync}>
            🔄 Sync Cache
          </button>
        </div>
      </div>

      {/* Alert */}
      {alert && (
        <div className={`alert alert-${alert.type}`}
          style={{ marginTop: '16px' }}>
          {alert.msg}
        </div>
      )}

      {/* Stats */}
      <div className="stats-grid" style={{ marginTop: '20px' }}>
        <StatCard label="Total Beneficiaries"
          value={stats.total_beneficiaries}
          color="#1a2d5a" icon="👥" sub="Registered"/>
        <StatCard label="Total Distributions"
          value={stats.total_transactions}
          color="#38a169" icon="📦" sub="All aid types"/>
        <StatCard label="Current Cycle"
          value={stats.current_cycle}
          color="#d69e2e" icon="🔄" sub="Active round"/>
        <StatCard label="Pending Cache"
          value={stats.pending_cache}
          color="#e53e3e" icon="⏳" sub="Awaiting sync"/>
        <StatCard label="Blockchain"
          value={stats.blockchain_online ? 'Online' : 'Offline'}
          color={stats.blockchain_online ? '#38a169' : '#e53e3e'}
          icon="⛓️" sub="Node status"/>
        <StatCard label="System Users"
          value={users.length}
          color="#805ad5" icon="👤" sub="All accounts"/>
      </div>

      {/* ── USER MANAGEMENT ──────────────────────────────────── */}
      <div className="card">
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '16px'
        }}>
          <h3 style={{ margin: 0, borderBottom: 'none',
            padding: 0 }}>
            👤 User Management
          </h3>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setShowForm(!showForm);
              setNewUserErrors({});
            }}
          >
            {showForm ? '✕ Cancel' : '+ Add New User'}
          </button>
        </div>

        {/* New user form */}
        {showForm && (
          <div style={{
            background: '#f7fafc', border: '1px solid #e2e8f0',
            borderRadius: '8px', padding: '20px', marginBottom: '20px'
          }}>
            <div style={{
              fontSize: '12px', fontWeight: 700, color: '#1a2d5a',
              marginBottom: '14px', textTransform: 'uppercase',
              letterSpacing: '0.06em'
            }}>
              New User Details
            </div>
            <div className="form-grid">

              {/* Username */}
              <div className="form-group">
                <label>Username *</label>
                <input
                  placeholder="e.g. ngo_officer2"
                  value={newUser.username}
                  style={inputStyle(newUserErrors.username)}
                  onChange={e => {
                    setNewUser({ ...newUser,
                      username: e.target.value.toLowerCase() });
                    setNewUserErrors({ ...newUserErrors, username: '' });
                  }}
                />
                {newUserErrors.username &&
                  <div style={errStyle}>⚠ {newUserErrors.username}</div>}
              </div>

              {/* Full name */}
              <div className="form-group">
                <label>Full Name *</label>
                <input
                  placeholder="e.g. John Doe"
                  value={newUser.name}
                  style={inputStyle(newUserErrors.name)}
                  onChange={e => {
                    setNewUser({ ...newUser, name: e.target.value });
                    setNewUserErrors({ ...newUserErrors, name: '' });
                  }}
                />
                {newUserErrors.name &&
                  <div style={errStyle}>⚠ {newUserErrors.name}</div>}
              </div>

              {/* Role */}
              <div className="form-group">
                <label>Role *</label>
                <select
                  value={newUser.role}
                  style={inputStyle(false)}
                  onChange={e => setNewUser({
                    ...newUser, role: e.target.value
                  })}
                >
                  {ROLES.map(r => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              {/* Password */}
              <div className="form-group">
                <label>Password * (min 8 chars)</label>
                <input
                  type="password"
                  placeholder="Minimum 8 characters"
                  value={newUser.password}
                  style={inputStyle(newUserErrors.password)}
                  onChange={e => {
                    setNewUser({ ...newUser, password: e.target.value });
                    setNewUserErrors({ ...newUserErrors, password: '' });
                  }}
                />
                {newUserErrors.password &&
                  <div style={errStyle}>⚠ {newUserErrors.password}</div>}
              </div>

              {/* Email */}
              <div className="form-group">
                <label>Email (optional)</label>
                <input
                  type="email"
                  placeholder="e.g. user@aidchain.zw"
                  value={newUser.email}
                  style={inputStyle(newUserErrors.email)}
                  onChange={e => {
                    setNewUser({ ...newUser, email: e.target.value });
                    setNewUserErrors({ ...newUserErrors, email: '' });
                  }}
                />
                {newUserErrors.email &&
                  <div style={errStyle}>⚠ {newUserErrors.email}</div>}
              </div>

            </div>

            <button
              className="btn btn-primary"
              onClick={handleCreateUser}
              disabled={loading}
              style={{ marginTop: '8px' }}
            >
              {loading ? 'Creating...' : '✓ Create User'}
            </button>
          </div>
        )}

        {/* Users table */}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Username</th>
                <th>Full Name</th>
                <th>Role</th>
                <th>Email</th>
                <th>Last Login</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length > 0 ? users.map(u => (
                <tr key={u.username}>
                  <td style={{
                    fontFamily: 'monospace', fontWeight: 700,
                    fontSize: '12px'
                  }}>
                    {u.username}
                  </td>
                  <td>{u.name}</td>
                  <td>
                    <span style={{
                      background: roleBadgeColor[u.role]?.bg || '#e2e8f0',
                      color: roleBadgeColor[u.role]?.color || '#4a5568',
                      padding: '2px 10px', borderRadius: '20px',
                      fontSize: '10px', fontWeight: 700
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px', color: '#718096' }}>
                    {u.email || '—'}
                  </td>
                  <td style={{ fontSize: '11px', color: '#718096' }}>
                    {u.last_login || 'Never'}
                  </td>
                  <td>
                    <span className={
                      `badge ${u.active ? 'badge-green' : 'badge-red'}`
                    }>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    {u.active ? (
                      <button
                        className="btn btn-red btn-sm"
                        onClick={() => handleDeactivate(u.username)}
                        disabled={u.username === localStorage.getItem('username')}
                        title={u.username === localStorage.getItem('username')
                          ? 'Cannot deactivate your own account'
                          : `Deactivate ${u.username}`}
                      >
                        Deactivate
                      </button>
                    ) : (
                      <button
                        className="btn btn-green btn-sm"
                        onClick={() => handleReactivate(u.username)}
                      >
                        Reactivate
                      </button>
                    )}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} style={{
                    textAlign: 'center', color: '#a0aec0', padding: '24px'
                  }}>
                    No users found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* System Health */}
      <div className="card">
        <h3>🔧 System Health</h3>
        {[
          ['Blockchain Node', stats.blockchain_online
            ? '✅ Online' : '❌ Offline'],
          ['Flask API',        '✅ Running'],
          ['Current Cycle',   `Cycle ${stats.current_cycle}`],
          ['Total TX',         stats.total_transactions],
          ['Pending Cache',   `${stats.pending_cache || 0} transactions`],
          ['System Users',     users.length],
        ].map(([label, value]) => (
          <div key={label} style={{
            display: 'flex', justifyContent: 'space-between',
            padding: '10px 0', borderBottom: '1px solid #f0f4f8',
            fontSize: '13px'
          }}>
            <span style={{ color: '#718096', fontWeight: 500 }}>
              {label}
            </span>
            <span style={{ fontWeight: 700, color: '#2d3748' }}>
              {value}
            </span>
          </div>
        ))}
      </div>

      {/* Pending cache */}
      {pending.length > 0 && (
        <div className="card">
          <h3>⏳ Pending Offline Transactions ({pending.length})</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Beneficiary</th><th>Aid Type</th>
                  <th>Amount</th><th>Location</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {pending.map(tx => (
                  <tr key={tx.id}>
                    <td>{tx.id}</td>
                    <td>{tx.beneficiary_id}</td>
                    <td>
                      <span className="badge badge-orange">
                        {tx.aid_type}
                      </span>
                    </td>
                    <td>{tx.amount} {tx.aid_unit}</td>
                    <td>{tx.location}</td>
                    <td>
                      <span className="badge badge-orange">PENDING</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="btn btn-green"
            style={{ marginTop: '12px' }}
            onClick={handleSync}>
            🔄 Sync All to Blockchain
          </button>
        </div>
      )}

    </div>
  );
}