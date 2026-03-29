// ================================================================
//  AdminDashboard.js — System Administrator View
//  Updated: clickable stat cards + delete user functionality
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import {
  getStats, advanceCycle,
  getPending, syncCache,
  getAllBeneficiaries, getDistributionHistory
} from '../services/api';
import axios from 'axios';

const BASE_URL = 'http://127.0.0.1:5000';

const roleBadgeColor = {
  ADMIN  : { bg: '#e9d8fd', color: '#553c9a' },
  NGO    : { bg: '#c6f6d5', color: '#276749' },
  DONOR  : { bg: '#fefcbf', color: '#744210' },
  AUDITOR: { bg: '#fed7d7', color: '#9b2c2c' },
};

const ROLES = ['NGO', 'DONOR', 'AUDITOR', 'ADMIN'];

export default function AdminDashboard() {
  const [stats,   setStats]   = useState({});
  const [pending, setPending] = useState([]);
  const [users,   setUsers]   = useState([]);
  const [alert,   setAlert]   = useState(null);
  const [loading, setLoading] = useState(false);

  // ── New user form ──────────────────────────────────────────
  const [newUser,      setNewUser]      = useState({ username:'', password:'', role:'NGO', name:'', email:'' });
  const [newUserErrors,setNewUserErrors]= useState({});
  const [showForm,     setShowForm]     = useState(false);

  // ── Stat card modal ────────────────────────────────────────
  const [modal, setModal] = useState(null);
  // modal = { type: 'beneficiaries'|'distributions'|'users'|'pending', data: [] }

  const [modalLoading, setModalLoading] = useState(false);

  const token      = localStorage.getItem('token');
  const name       = localStorage.getItem('name');
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

  // ── Format timestamp ───────────────────────────────────────
  const formatTime = (ts) => {
    if (!ts) return 'N/A';
    return new Date(ts * 1000).toLocaleString('en-GB', {
      day:'2-digit', month:'short', year:'numeric',
      hour:'2-digit', minute:'2-digit'
    });
  };

  // ================================================================
  //  STAT CARD CLICK HANDLERS — open modal with details
  // ================================================================
  const handleCardClick = async (type) => {
    setModal({ type, data: [], title: '' });
    setModalLoading(true);

    try {
      if (type === 'beneficiaries') {
        const res = await getAllBeneficiaries();
        setModal({
          type,
          title: `All Registered Beneficiaries (${res.data.total})`,
          data: res.data.beneficiaries || []
        });

      } else if (type === 'distributions') {
        const res = await getDistributionHistory(100);
        setModal({
          type,
          title: `All Distributions (${res.data.total})`,
          data: res.data.distributions || []
        });

      } else if (type === 'users') {
        setModal({
          type,
          title: `System Users (${users.length})`,
          data: users
        });

      } else if (type === 'pending') {
        setModal({
          type,
          title: `Pending Offline Transactions (${pending.length})`,
          data: pending
        });

      } else if (type === 'cycle') {
        setModal({
          type,
          title: `Current Distribution Cycle`,
          data: [{ cycle: stats.current_cycle }]
        });

      } else if (type === 'blockchain') {
        setModal({
          type,
          title: 'Blockchain Status',
          data: [{
            status : stats.blockchain_online ? 'Online' : 'Offline',
            network: 'Ethereum Sepolia',
            total_tx: stats.total_transactions
          }]
        });
      }
    } catch {
      showAlert('Failed to load details', 'error');
      setModal(null);
    }
    setModalLoading(false);
  };

  // ================================================================
  //  USER MANAGEMENT
  // ================================================================
  const validateNewUser = () => {
    const errs = {};
    if (!newUser.username.trim() || newUser.username.trim().length < 3)
      errs.username = "Username must be at least 3 characters";
    if (!/^[a-zA-Z0-9_]+$/.test(newUser.username.trim()))
      errs.username = "Letters, numbers and underscores only";
    if (!newUser.password || newUser.password.length < 8)
      errs.password = "Password must be at least 8 characters";
    if (!newUser.name.trim() || newUser.name.trim().length < 2)
      errs.name = "Full name must be at least 2 characters";
    if (newUser.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email))
      errs.email = "Enter a valid email address";
    return errs;
  };

  const handleCreateUser = async () => {
    const errs = validateNewUser();
    setNewUserErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      await axios.post(
        `${BASE_URL}/api/auth/users/create`,
        { ...newUser, username: newUser.username.trim(), name: newUser.name.trim() },
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

  const handleDeactivate = async (username) => {
    if (!window.confirm(`Deactivate "${username}"?\nThey will not be able to log in.`)) return;
    try {
      await axios.post(
        `${BASE_URL}/api/auth/users/${username}/deactivate`,
        {}, { headers: authHeader }
      );
      showAlert(`✓ "${username}" deactivated`);
      fetchData();
    } catch (e) {
      showAlert(e.response?.data?.error || 'Failed', 'error');
    }
  };

  const handleReactivate = async (username) => {
    try {
      await axios.post(
        `${BASE_URL}/api/auth/users/${username}/reactivate`,
        {}, { headers: authHeader }
      );
      showAlert(`✓ "${username}" reactivated`);
      fetchData();
    } catch (e) {
      showAlert(e.response?.data?.error || 'Failed', 'error');
    }
  };

  // ── DELETE USER ────────────────────────────────────────────
  const handleDelete = async (username) => {
    if (!window.confirm(
      `PERMANENTLY DELETE user "${username}"?\n\n` +
      `This action cannot be undone.\n` +
      `The user will be removed from the system entirely.`
    )) return;
    try {
      await axios.delete(
        `${BASE_URL}/api/auth/users/${username}`,
        { headers: authHeader }
      );
      showAlert(`✓ User "${username}" permanently deleted`);
      fetchData();
    } catch (e) {
      showAlert(e.response?.data?.error || 'Failed to delete user', 'error');
    }
  };

  const handleAdvanceCycle = async () => {
    if (!window.confirm('Advance to next distribution cycle?')) return;
    try {
      const res = await advanceCycle();
      showAlert(`✓ Advanced to Cycle ${res.data.new_cycle}`);
      fetchData();
    } catch { showAlert('Failed to advance cycle', 'error'); }
  };

  const handleSync = async () => {
    try {
      const res = await syncCache();
      showAlert(`✓ Synced ${res.data.synced} transactions`);
      fetchData();
    } catch { showAlert('Sync failed', 'error'); }
  };

  const inputStyle = (hasError) => ({
    width:'100%', padding:'9px 12px',
    border:`1px solid ${hasError ? '#e53e3e' : '#e2e8f0'}`,
    borderRadius:'6px', fontSize:'13px',
    background: hasError ? '#fff5f5' : '#f7fafc',
    outline:'none', color:'#2d3748'
  });

  const errStyle = { fontSize:'11px', color:'#e53e3e', marginTop:'3px', fontWeight:500 };

  // ── Clickable stat card style ──────────────────────────────
  const clickableCard = {
    cursor: 'pointer',
    transition: 'transform 0.15s, box-shadow 0.15s',
  };

  return (
    <div className="page">

      {/* ── Header ── */}
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
        <div>
          <div className="page-title">Admin Dashboard</div>
          <div className="page-subtitle">
            Welcome, {name} — Full system control
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          <button className="btn btn-orange btn-sm" onClick={handleAdvanceCycle}>
            ↻ Advance Cycle
          </button>
          <button className="btn btn-green btn-sm" onClick={handleSync}>
            🔄 Sync Cache
          </button>
        </div>
      </div>

      {/* ── Alert ── */}
      {alert && (
        <div className={`alert alert-${alert.type}`} style={{ marginTop:'16px' }}>
          {alert.msg}
        </div>
      )}

      {/* ── Hint ── */}
      <div style={{
        marginTop:'16px', fontSize:'11px', color:'#a0aec0',
        textAlign:'right'
      }}>
        💡 Click any card to view details
      </div>

      {/* ── Stat Cards (clickable) ── */}
      <div className="stats-grid" style={{ marginTop:'8px' }}>

        <div style={clickableCard}
          onClick={() => handleCardClick('beneficiaries')}
          onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
          <StatCard label="Total Beneficiaries"
            value={stats.total_beneficiaries}
            color="#1a2d5a" icon="👥" sub="Click to view all"/>
        </div>

        <div style={clickableCard}
          onClick={() => handleCardClick('distributions')}
          onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
          <StatCard label="Total Distributions"
            value={stats.total_transactions}
            color="#38a169" icon="📦" sub="Click to view all"/>
        </div>

        <div style={clickableCard}
          onClick={() => handleCardClick('cycle')}
          onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
          <StatCard label="Current Cycle"
            value={stats.current_cycle}
            color="#d69e2e" icon="🔄" sub="Click for details"/>
        </div>

        <div style={clickableCard}
          onClick={() => handleCardClick('pending')}
          onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
          <StatCard label="Pending Cache"
            value={stats.pending_cache}
            color="#e53e3e" icon="⏳" sub="Click to view"/>
        </div>

        <div style={clickableCard}
          onClick={() => handleCardClick('blockchain')}
          onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
          <StatCard label="Blockchain"
            value={stats.blockchain_online ? 'Online' : 'Offline'}
            color={stats.blockchain_online ? '#38a169' : '#e53e3e'}
            icon="⛓️" sub="Click for details"/>
        </div>

        <div style={clickableCard}
          onClick={() => handleCardClick('users')}
          onMouseEnter={e => e.currentTarget.style.transform='scale(1.03)'}
          onMouseLeave={e => e.currentTarget.style.transform='scale(1)'}>
          <StatCard label="System Users"
            value={users.length}
            color="#805ad5" icon="👤" sub="Click to view all"/>
        </div>

      </div>

      {/* ── User Management ── */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between',
          alignItems:'center', marginBottom:'16px' }}>
          <h3 style={{ margin:0, padding:0, borderBottom:'none' }}>
            👤 User Management
          </h3>
          <button className="btn btn-primary btn-sm"
            onClick={() => { setShowForm(!showForm); setNewUserErrors({}); }}>
            {showForm ? '✕ Cancel' : '+ Add New User'}
          </button>
        </div>

        {/* New user form */}
        {showForm && (
          <div style={{
            background:'#f7fafc', border:'1px solid #e2e8f0',
            borderRadius:'8px', padding:'20px', marginBottom:'20px'
          }}>
            <div style={{ fontSize:'12px', fontWeight:700, color:'#1a2d5a',
              marginBottom:'14px', textTransform:'uppercase', letterSpacing:'0.06em' }}>
              New User Details
            </div>
            <div className="form-grid">
              <div className="form-group">
                <label>Username *</label>
                <input placeholder="e.g. ngo_officer2"
                  value={newUser.username}
                  style={inputStyle(newUserErrors.username)}
                  onChange={e => { setNewUser({...newUser, username: e.target.value.toLowerCase()});
                    setNewUserErrors({...newUserErrors, username:''}); }}/>
                {newUserErrors.username && <div style={errStyle}>⚠ {newUserErrors.username}</div>}
              </div>
              <div className="form-group">
                <label>Full Name *</label>
                <input placeholder="e.g. John Doe"
                  value={newUser.name}
                  style={inputStyle(newUserErrors.name)}
                  onChange={e => { setNewUser({...newUser, name: e.target.value});
                    setNewUserErrors({...newUserErrors, name:''}); }}/>
                {newUserErrors.name && <div style={errStyle}>⚠ {newUserErrors.name}</div>}
              </div>
              <div className="form-group">
                <label>Role *</label>
                <select value={newUser.role}
                  style={inputStyle(false)}
                  onChange={e => setNewUser({...newUser, role: e.target.value})}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label>Password * (min 8 chars)</label>
                <input type="password" placeholder="Minimum 8 characters"
                  value={newUser.password}
                  style={inputStyle(newUserErrors.password)}
                  onChange={e => { setNewUser({...newUser, password: e.target.value});
                    setNewUserErrors({...newUserErrors, password:''}); }}/>
                {newUserErrors.password && <div style={errStyle}>⚠ {newUserErrors.password}</div>}
              </div>
              <div className="form-group">
                <label>Email (optional)</label>
                <input type="email" placeholder="e.g. user@aidchain.zw"
                  value={newUser.email}
                  style={inputStyle(newUserErrors.email)}
                  onChange={e => { setNewUser({...newUser, email: e.target.value});
                    setNewUserErrors({...newUserErrors, email:''}); }}/>
                {newUserErrors.email && <div style={errStyle}>⚠ {newUserErrors.email}</div>}
              </div>
            </div>
            <button className="btn btn-primary"
              onClick={handleCreateUser} disabled={loading}
              style={{ marginTop:'8px' }}>
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
                  <td style={{ fontFamily:'monospace', fontWeight:700, fontSize:'12px' }}>
                    {u.username}
                  </td>
                  <td>{u.name}</td>
                  <td>
                    <span style={{
                      background: roleBadgeColor[u.role]?.bg || '#e2e8f0',
                      color: roleBadgeColor[u.role]?.color || '#4a5568',
                      padding:'2px 10px', borderRadius:'20px',
                      fontSize:'10px', fontWeight:700
                    }}>
                      {u.role}
                    </span>
                  </td>
                  <td style={{ fontSize:'12px', color:'#718096' }}>
                    {u.email || '—'}
                  </td>
                  <td style={{ fontSize:'11px', color:'#718096' }}>
                    {u.last_login || 'Never'}
                  </td>
                  <td>
                    <span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>
                      {u.active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div style={{ display:'flex', gap:'6px' }}>
                      {/* Deactivate / Reactivate */}
                      {u.active ? (
                        <button className="btn btn-orange btn-sm"
                          onClick={() => handleDeactivate(u.username)}
                          disabled={u.username === localStorage.getItem('username')}
                          title={u.username === localStorage.getItem('username')
                            ? 'Cannot deactivate your own account' : ''}>
                          Deactivate
                        </button>
                      ) : (
                        <button className="btn btn-green btn-sm"
                          onClick={() => handleReactivate(u.username)}>
                          Reactivate
                        </button>
                      )}

                      {/* Delete button */}
                      <button
                        className="btn btn-red btn-sm"
                        onClick={() => handleDelete(u.username)}
                        disabled={u.username === localStorage.getItem('username')}
                        title={u.username === localStorage.getItem('username')
                          ? 'Cannot delete your own account'
                          : `Permanently delete ${u.username}`}
                        style={{ opacity: u.username === localStorage.getItem('username') ? 0.4 : 1 }}
                      >
                        🗑 Delete
                      </button>
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} style={{ textAlign:'center', color:'#a0aec0', padding:'24px' }}>
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
          ['Blockchain Node',  stats.blockchain_online ? '✅ Online' : '❌ Offline'],
          ['Flask API',        '✅ Running'],
          ['Current Cycle',   `Cycle ${stats.current_cycle}`],
          ['Total TX',         stats.total_transactions],
          ['Pending Cache',   `${stats.pending_cache || 0} transactions`],
          ['System Users',     users.length],
        ].map(([label, value]) => (
          <div key={label} style={{
            display:'flex', justifyContent:'space-between',
            padding:'10px 0', borderBottom:'1px solid #f0f4f8', fontSize:'13px'
          }}>
            <span style={{ color:'#718096', fontWeight:500 }}>{label}</span>
            <span style={{ fontWeight:700, color:'#2d3748' }}>{value}</span>
          </div>
        ))}
      </div>

      {/* ── STAT CARD MODAL ───────────────────────────────────── */}
      {modal && (
        <>
          {/* Backdrop */}
          <div onClick={() => setModal(null)} style={{
            position:'fixed', top:0, left:0,
            width:'100vw', height:'100vh',
            background:'rgba(0,0,0,0.5)', zIndex:200
          }}/>

          {/* Modal box */}
          <div style={{
            position:'fixed', top:'50%', left:'50%',
            transform:'translate(-50%, -50%)',
            background:'#fff', borderRadius:'14px',
            padding:'28px', width:'90%', maxWidth:'900px',
            maxHeight:'80vh', overflowY:'auto',
            zIndex:201, boxShadow:'0 24px 80px rgba(0,0,0,0.25)'
          }}>

            {/* Modal header */}
            <div style={{ display:'flex', justifyContent:'space-between',
              alignItems:'center', marginBottom:'20px' }}>
              <h2 style={{ fontSize:'16px', fontWeight:800, color:'#1a2d5a', margin:0 }}>
                {modal.title}
              </h2>
              <button onClick={() => setModal(null)} style={{
                background:'#f7fafc', border:'1px solid #e2e8f0',
                borderRadius:'6px', padding:'4px 12px',
                cursor:'pointer', fontSize:'14px', color:'#718096'
              }}>✕</button>
            </div>

            {/* Loading */}
            {modalLoading && (
              <div style={{ textAlign:'center', padding:'40px', color:'#4a90d9' }}>
                ⏳ Loading from blockchain...
              </div>
            )}

            {/* ── Beneficiaries table ── */}
            {!modalLoading && modal.type === 'beneficiaries' && (
              modal.data.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th><th>Full Name</th><th>National ID</th>
                        <th>Phone</th><th>Location</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modal.data.map(b => (
                        <tr key={b.id}>
                          <td style={{ fontFamily:'monospace', fontWeight:700 }}>#{b.id}</td>
                          <td>{b.name}</td>
                          <td style={{ fontFamily:'monospace', fontSize:'12px' }}>{b.national_id}</td>
                          <td style={{ fontSize:'12px' }}>{b.phone}</td>
                          <td>{b.location}</td>
                          <td>
                            <span className={`badge ${b.active ? 'badge-green' : 'badge-red'}`}>
                              {b.active ? '✓ Active' : '✕ Inactive'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign:'center', color:'#a0aec0', padding:'40px' }}>
                  No beneficiaries registered yet
                </div>
              )
            )}

            {/* ── Distributions table ── */}
            {!modalLoading && modal.type === 'distributions' && (
              modal.data.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>TX #</th><th>Beneficiary</th><th>Aid Type</th>
                        <th>Amount</th><th>Location</th><th>Cycle</th>
                        <th>Date</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modal.data.map(tx => (
                        <tr key={tx.tx_id}>
                          <td style={{ fontFamily:'monospace', fontWeight:700, color:'#4a90d9' }}>
                            #{tx.tx_id}
                          </td>
                          <td>
                            <div style={{ fontWeight:600 }}>{tx.beneficiary_name}</div>
                            <div style={{ fontSize:'11px', color:'#a0aec0' }}>ID: {tx.beneficiary_id}</div>
                          </td>
                          <td><span className="badge badge-blue">{tx.aid_type}</span></td>
                          <td style={{ fontWeight:600 }}>
                            {tx.amount}
                            <span style={{ fontSize:'11px', color:'#718096', marginLeft:'4px' }}>
                              {tx.aid_unit}
                            </span>
                          </td>
                          <td style={{ fontSize:'12px' }}>{tx.location}</td>
                          <td><span className="badge badge-gray">Cycle {tx.cycle}</span></td>
                          <td style={{ fontSize:'11px', color:'#718096' }}>
                            {formatTime(tx.timestamp)}
                          </td>
                          <td><span className="badge badge-green">{tx.status}</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign:'center', color:'#a0aec0', padding:'40px' }}>
                  No distributions recorded yet
                </div>
              )
            )}

            {/* ── Users table ── */}
            {!modalLoading && modal.type === 'users' && (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Username</th><th>Full Name</th><th>Role</th>
                      <th>Email</th><th>Last Login</th><th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {modal.data.map(u => (
                      <tr key={u.username}>
                        <td style={{ fontFamily:'monospace', fontWeight:700 }}>{u.username}</td>
                        <td>{u.name}</td>
                        <td>
                          <span style={{
                            background: roleBadgeColor[u.role]?.bg || '#e2e8f0',
                            color: roleBadgeColor[u.role]?.color || '#4a5568',
                            padding:'2px 10px', borderRadius:'20px',
                            fontSize:'10px', fontWeight:700
                          }}>
                            {u.role}
                          </span>
                        </td>
                        <td style={{ fontSize:'12px', color:'#718096' }}>{u.email || '—'}</td>
                        <td style={{ fontSize:'11px', color:'#718096' }}>{u.last_login || 'Never'}</td>
                        <td>
                          <span className={`badge ${u.active ? 'badge-green' : 'badge-red'}`}>
                            {u.active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── Pending cache ── */}
            {!modalLoading && modal.type === 'pending' && (
              modal.data.length > 0 ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>ID</th><th>Beneficiary</th><th>Aid Type</th>
                        <th>Amount</th><th>Location</th><th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {modal.data.map(tx => (
                        <tr key={tx.id}>
                          <td>{tx.id}</td>
                          <td>{tx.beneficiary_id}</td>
                          <td><span className="badge badge-orange">{tx.aid_type}</span></td>
                          <td>{tx.amount} {tx.aid_unit}</td>
                          <td>{tx.location}</td>
                          <td><span className="badge badge-orange">PENDING</span></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div style={{ textAlign:'center', color:'#a0aec0', padding:'40px' }}>
                  No pending transactions — all synced
                </div>
              )
            )}

            {/* ── Cycle info ── */}
            {!modalLoading && modal.type === 'cycle' && (
              <div style={{ textAlign:'center', padding:'30px' }}>
                <div style={{ fontSize:'72px', fontWeight:900, color:'#d69e2e' }}>
                  {stats.current_cycle}
                </div>
                <div style={{ fontSize:'14px', color:'#718096', marginTop:'8px' }}>
                  Current Distribution Round
                </div>
                <div style={{ marginTop:'20px', fontSize:'13px', color:'#4a5568' }}>
                  Each cycle represents one distribution round.
                  Advance the cycle to allow beneficiaries to collect again.
                </div>
              </div>
            )}

            {/* ── Blockchain info ── */}
            {!modalLoading && modal.type === 'blockchain' && (
              <div style={{ padding:'10px' }}>
                {[
                  ['Status',         stats.blockchain_online ? '✅ Online' : '❌ Offline'],
                  ['Network',        'Ethereum Sepolia Testnet'],
                  ['Total TX',       stats.total_transactions || 0],
                  ['Beneficiaries',  stats.total_beneficiaries || 0],
                  ['Current Cycle',  stats.current_cycle || 1],
                  ['Pending Cache',  stats.pending_cache || 0],
                ].map(([label, value]) => (
                  <div key={label} style={{
                    display:'flex', justifyContent:'space-between',
                    padding:'12px 0', borderBottom:'1px solid #f0f4f8', fontSize:'14px'
                  }}>
                    <span style={{ color:'#718096', fontWeight:500 }}>{label}</span>
                    <span style={{ fontWeight:700, color:'#2d3748' }}>{value}</span>
                  </div>
                ))}
              </div>
            )}

          </div>
        </>
      )}

    </div>
  );
}