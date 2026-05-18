// ================================================================
//  AdminDashboard.js — System Administrator View
//  Updated: clickable stat cards + delete user functionality
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState, useEffect } from 'react';
import DashboardHero from '../components/DashboardHero';
import StatCard from '../components/StatCard';
import {
  getStats, advanceCycle,
  getPending, syncCache,
  getAllBeneficiaries, getDistributionHistory,
  getCampaigns, createCampaign,
  getActivePackages, createAidPackage, deleteAidPackage,
  getHardwareEvents
} from '../services/api';
import axios from 'axios';

const API_BASE_URL = process.env.REACT_APP_API_URL || '';

const roleBadgeColor = {
  ADMIN  : { bg: '#e9d8fd', color: '#553c9a' },
  NGO    : { bg: '#c6f6d5', color: '#276749' },
  DONOR  : { bg: '#fefcbf', color: '#744210' },
  AUDITOR: { bg: '#fed7d7', color: '#9b2c2c' },
};

const ROLES = ['NGO', 'DONOR', 'AUDITOR', 'ADMIN'];

export default function AdminDashboard() {
  const [stats,      setStats]      = useState({});
  const [pending,    setPending]    = useState([]);
  const [users,      setUsers]      = useState([]);
  const [campaigns,  setCampaigns]  = useState([]);
  const [alert,      setAlert]      = useState(null);
  const [loading,    setLoading]    = useState(false);

  // ── New user form ──────────────────────────────────────────
  const [newUser,         setNewUser]         = useState({ username:'', password:'', role:'NGO', name:'', email:'' });
  const [newUserErrors,   setNewUserErrors]   = useState({});
  const [showForm,        setShowForm]        = useState(false);
  const [showPassword,    setShowPassword]    = useState(false);
  const [newCampaign,     setNewCampaign]     = useState({ name:'', donor_label:'', aid_type:'MAIZE', budget_total:'' });
  const [newCampaignErrors,setNewCampaignErrors]= useState({});

  // ── Aid Packages ───────────────────────────────────────────
  const [activePackages,  setActivePackages]  = useState([]);
  const [newPackage,      setNewPackage]      = useState({ location:'', items: [{ aid_type: 'MAIZE', unit: 'KG', amount: '' }] });
  const [packageLoading,  setPackageLoading]  = useState(false);

  // ── Stat card modal ────────────────────────────────────────
  const [modal, setModal] = useState(null);
  // modal = { type: 'beneficiaries'|'distributions'|'users'|'pending', data: [] }

  const [modalLoading, setModalLoading] = useState(false);

  // ── Events Log ──────────────────────────────────────────────
  const [events, setEvents] = useState([]);

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
      const [s, p, u, c, pkgRes, evRes] = await Promise.all([
        getStats(),
        getPending(),
        axios.get(`${API_BASE_URL}/api/auth/users`, { headers: authHeader }),
        getCampaigns(),
        getActivePackages(),
        getHardwareEvents(30)
      ]);
      setStats(s.data);
      setPending(p.data.pending || []);
      setUsers(u.data.users || []);
      setCampaigns(c.data.campaigns || []);
      setActivePackages(pkgRes.data.packages || []);
      setEvents(evRes.data.events || []);
    } catch {}
  };

  const showAlert = (msg, type = 'success') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 5000);
  };

  // ── Package Handlers ───────────────────────────────────────
  const handleAddPackageItem = () => {
    setNewPackage(prev => ({
      ...prev,
      items: [...prev.items, { aid_type: 'MAIZE', unit: 'KG', amount: '' }]
    }));
  };

  const handleRemovePackageItem = (index) => {
    setNewPackage(prev => {
      const updated = [...prev.items];
      updated.splice(index, 1);
      return { ...prev, items: updated };
    });
  };

  const handlePackageItemChange = (index, field, value) => {
    setNewPackage(prev => {
      const updated = [...prev.items];
      updated[index][field] = value;
      return { ...prev, items: updated };
    });
  };

  const handleCreatePackage = async () => {
    if (!newPackage.location.trim()) {
      showAlert('Location is required', 'error');
      return;
    }
    if (newPackage.items.length === 0) {
      showAlert('At least one item is required', 'error');
      return;
    }
    for (let i = 0; i < newPackage.items.length; i++) {
      const item = newPackage.items[i];
      if (!item.aid_type || !item.unit || !item.amount || Number(item.amount) <= 0) {
        showAlert(`Invalid item details at row ${i + 1}`, 'error');
        return;
      }
    }
    setPackageLoading(true);
    try {
      const payload = {
        cycle_id: stats.current_cycle ? String(stats.current_cycle) : "1",
        location: newPackage.location.trim(),
        items: newPackage.items.map(item => ({
          aid_type: item.aid_type.trim().toUpperCase(),
          unit: item.unit.trim().toUpperCase(),
          amount: Number(item.amount)
        })),
        officer_id: name || "admin"
      };
      await createAidPackage(payload);
      showAlert(`✓ Aid Package created for ${payload.location}`);
      setNewPackage({ location:'', items: [{ aid_type: 'MAIZE', unit: 'KG', amount: '' }] });
      fetchData();
    } catch (e) {
      showAlert(e.response?.data?.error || 'Failed to create package', 'error');
    }
    setPackageLoading(false);
  };

  const handleDeletePackage = async (pkg) => {
    if (!window.confirm(`Delete package for "${pkg.location || 'All Locations'}"?\n\nThis will deactivate the package and prevent NGO officers from selecting it for new sessions.`)) return;
    try {
      await deleteAidPackage(pkg.id);
      showAlert(`✓ Package deleted`);
      fetchData();
    } catch (e) {
      showAlert(e.response?.data?.error || 'Failed to delete package', 'error');
    }
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
    if (!newUser.password) {
      errs.password = "Password is required";
    } else if (newUser.password.length < 8) {
      errs.password = "Password must be at least 8 characters";
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/.test(newUser.password)) {
      errs.password = "Must include uppercase, lowercase, number, and special character";
    }
    
    if (!newUser.name.trim() || newUser.name.trim().length < 2)
      errs.name = "Full name must be at least 2 characters";
      
    if (newUser.email) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newUser.email)) {
        errs.email = "Enter a valid email address";
      }
    }
    return errs;
  };

  const validateNewCampaign = () => {
    const errs = {};
    if (!newCampaign.name.trim() || newCampaign.name.trim().length < 3)
      errs.name = "Campaign name must be at least 3 characters";
    if (!newCampaign.donor_label.trim() || newCampaign.donor_label.trim().length < 2)
      errs.donor_label = "Donor label must be at least 2 characters";
    if (!newCampaign.aid_type.trim())
      errs.aid_type = "Aid type is required";
    if (!newCampaign.budget_total || Number(newCampaign.budget_total) <= 0)
      errs.budget_total = "Budget must be a positive number";
    return errs;
  };

  const handleCreateCampaign = async () => {
    const errs = validateNewCampaign();
    setNewCampaignErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      await createCampaign({
        name: newCampaign.name.trim(),
        donor_label: newCampaign.donor_label.trim(),
        aid_type: newCampaign.aid_type.trim().toUpperCase(),
        budget_total: Number(newCampaign.budget_total)
      });
      showAlert(`✓ Campaign "${newCampaign.name.trim()}" created`);
      setNewCampaign({ name:'', donor_label:'', aid_type:'MAIZE', budget_total:'' });
      setNewCampaignErrors({});
      fetchData();
    } catch (e) {
      showAlert(e.response?.data?.error || 'Failed to create campaign', 'error');
    }
    setLoading(false);
  };

  const handleCreateUser = async () => {
    const errs = validateNewUser();
    setNewUserErrors(errs);
    if (Object.keys(errs).length > 0) return;
    setLoading(true);
    try {
      await axios.post(
        `${API_BASE_URL}/api/auth/users/create`,
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
        `${API_BASE_URL}/api/auth/users/${username}/deactivate`,
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
        `${API_BASE_URL}/api/auth/users/${username}/reactivate`,
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
        `${API_BASE_URL}/api/auth/users/${username}`,
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
      <DashboardHero
        eyebrow="System Administration"
        title={`Command centre for ${name || 'platform control'}`}
        subtitle="Manage users, supervise campaign funding, review synchronization health, and oversee the full operational state of the aid platform from one place."
        badges={[
          `${users.length} user records`,
          `${campaigns.length} campaigns tracked`,
          stats.blockchain_online ? 'Blockchain available' : 'Blockchain unavailable'
        ]}
      />

      {/* ── Header ── */}
      <div className="legacy-dashboard-header" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
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

      {/* ── Alert (Toast) ── */}
      {alert && (
        <div className={`alert alert-${alert.type}`}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>{alert.msg}</span>
            <button 
              onClick={() => setAlert(null)}
              style={{ background:'none', border:'none', color:'inherit', cursor:'pointer', marginLeft:'12px', fontWeight:700 }}
            >
              ✕
            </button>
          </div>
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
                <div style={{ position: 'relative' }}>
                  <input type={showPassword ? "text" : "password"} placeholder="Minimum 8 characters"
                    value={newUser.password}
                    style={{ ...inputStyle(newUserErrors.password), width: '100%', paddingRight: '44px' }}
                    onChange={e => { setNewUser({...newUser, password: e.target.value});
                      setNewUserErrors({...newUserErrors, password:''}); }}/>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                      background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#475569'
                    }}
                  >
                    {showPassword ? 'Hide' : 'Show'}
                  </button>
                </div>
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

      {/* Campaign Management */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <h3 style={{ margin:0, padding:0, borderBottom:'none' }}>🎯 Campaign Management</h3>
          <button className="btn btn-primary btn-sm"
            onClick={() => {
              setNewCampaignErrors({});
              setNewCampaign({ name:'', donor_label:'', aid_type:'MAIZE', budget_total:'' });
            }}>
            + New Campaign
          </button>
        </div>

        <div style={{ display:'grid', gap:'16px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
            <div className="form-group">
              <label>Campaign Name</label>
              <input placeholder="e.g. Winter Food Aid"
                value={newCampaign.name}
                style={inputStyle(newCampaignErrors.name)}
                onChange={e => {
                  setNewCampaign({...newCampaign, name: e.target.value});
                  setNewCampaignErrors({...newCampaignErrors, name:''});
                }}/>
              {newCampaignErrors.name && <div style={errStyle}>⚠ {newCampaignErrors.name}</div>}
            </div>
            <div className="form-group">
              <label>Donor Label</label>
              <input placeholder="e.g. Acme Foundation"
                value={newCampaign.donor_label}
                style={inputStyle(newCampaignErrors.donor_label)}
                onChange={e => {
                  setNewCampaign({...newCampaign, donor_label: e.target.value});
                  setNewCampaignErrors({...newCampaignErrors, donor_label:''});
                }}/>
              {newCampaignErrors.donor_label && <div style={errStyle}>⚠ {newCampaignErrors.donor_label}</div>}
            </div>
            <div className="form-group">
              <label>Aid Type</label>
              <select value={newCampaign.aid_type}
                style={inputStyle(newCampaignErrors.aid_type)}
                onChange={e => {
                  setNewCampaign({...newCampaign, aid_type: e.target.value});
                  setNewCampaignErrors({...newCampaignErrors, aid_type:''});
                }}>
                {['MAIZE','CASH','OIL','SEEDS','CLOTHES','FERTILISER','BLANKETS'].map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              {newCampaignErrors.aid_type && <div style={errStyle}>⚠ {newCampaignErrors.aid_type}</div>}
            </div>
            <div className="form-group">
              <label>Budget Total</label>
              <input type="number" placeholder="e.g. 1000"
                value={newCampaign.budget_total}
                style={inputStyle(newCampaignErrors.budget_total)}
                onChange={e => {
                  setNewCampaign({...newCampaign, budget_total: e.target.value});
                  setNewCampaignErrors({...newCampaignErrors, budget_total:''});
                }}/>
              {newCampaignErrors.budget_total && <div style={errStyle}>⚠ {newCampaignErrors.budget_total}</div>}
            </div>
          </div>

          <button className="btn btn-primary" onClick={handleCreateCampaign} disabled={loading}>
            {loading ? 'Creating campaign...' : '✓ Create Campaign'}
          </button>
        </div>

        <div style={{ marginTop:'24px' }}>
          <div style={{ fontSize:'14px', fontWeight:700, marginBottom:'12px' }}>
            Active Campaigns ({campaigns.length})
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>ID</th><th>Name</th><th>Donor</th><th>Aid Type</th>
                  <th>Budget Total</th><th>Budget Used</th><th>Remaining</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.length > 0 ? campaigns.map(c => (
                  <tr key={c.id}>
                    <td>#{c.id}</td>
                    <td>{c.name}</td>
                    <td>{c.donor_label}</td>
                    <td><span className="badge badge-blue">{c.aid_type}</span></td>
                    <td>{c.budget_total}</td>
                    <td>{c.budget_used}</td>
                    <td>{c.remaining}</td>
                    <td>
                      <span className={`badge ${c.active ? 'badge-green' : 'badge-red'}`}>
                        {c.active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={8} style={{ textAlign:'center', color:'#a0aec0', padding:'24px' }}>
                      No campaigns available yet
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Aid Package Management */}
      <div className="card">
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'16px' }}>
          <h3 style={{ margin:0, padding:0, borderBottom:'none' }}>📦 Aid Package Management</h3>
        </div>
        
        <div style={{ display:'grid', gap:'16px', background:'#f7fafc', padding:'16px', borderRadius:'8px', border:'1px solid #e2e8f0' }}>
          <div className="form-group" style={{ maxWidth: '300px' }}>
            <label style={{ fontWeight: 700 }}>Target Location (e.g. Ward 5)</label>
            <input 
              placeholder="Leave empty for all locations"
              value={newPackage.location}
              style={inputStyle(false)}
              onChange={e => setNewPackage({...newPackage, location: e.target.value})}
            />
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', paddingTop: '12px' }}>
            <label style={{ fontWeight: 700, marginBottom: '8px', display: 'block' }}>Package Items</label>
            {newPackage.items.map((item, index) => (
              <div key={index} style={{ display:'flex', gap:'12px', alignItems:'center', marginBottom:'12px' }}>
                <span style={{ fontWeight: 700, color: '#718096', width: '20px' }}>#{index + 1}</span>
                <select 
                  value={item.aid_type}
                  style={inputStyle(false)}
                  onChange={e => handlePackageItemChange(index, 'aid_type', e.target.value)}
                >
                  {['MAIZE','CASH','OIL','SEEDS','CLOTHES','FERTILISER','BLANKETS'].map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <select 
                  value={item.unit}
                  style={inputStyle(false)}
                  onChange={e => handlePackageItemChange(index, 'unit', e.target.value)}
                >
                  {['KG','LITERS','USD','PACKS','ITEMS'].map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
                <input 
                  type="number"
                  placeholder="Amount"
                  value={item.amount}
                  style={inputStyle(false)}
                  onChange={e => handlePackageItemChange(index, 'amount', e.target.value)}
                />
                {newPackage.items.length > 1 && (
                  <button 
                    onClick={() => handleRemovePackageItem(index)}
                    style={{ background: '#fed7d7', color: '#c53030', border: 'none', borderRadius: '4px', padding: '8px', cursor: 'pointer', fontWeight: 700 }}
                  >
                    ✕
                  </button>
                )}
              </div>
            ))}
            <button 
              onClick={handleAddPackageItem}
              style={{ background: '#ebf8ff', color: '#3182ce', border: '1px solid #90cdf4', borderRadius: '4px', padding: '6px 12px', cursor: 'pointer', fontWeight: 700, fontSize: '12px' }}
            >
              + Add Another Item
            </button>
          </div>

          <button className="btn btn-primary" onClick={handleCreatePackage} disabled={packageLoading} style={{ marginTop: '8px' }}>
            {packageLoading ? 'Creating package...' : '✓ Create Aid Package'}
          </button>
        </div>

        <div style={{ marginTop:'24px' }}>
          <div style={{ fontSize:'14px', fontWeight:700, marginBottom:'12px' }}>
            Active Packages ({activePackages.length})
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Package ID</th>
                  <th>Location</th>
                  <th>Created</th>
                  <th>Items Included</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {activePackages.length > 0 ? activePackages.map(pkg => (
                  <tr key={pkg.id}>
                    <td style={{ fontFamily:'monospace', fontWeight:700, color:'#4a90d9' }}>
                      #{pkg.id.substring(0, 8)}...
                    </td>
                    <td>{pkg.location || 'All Locations'}</td>
                    <td style={{ fontSize:'12px', color:'#718096' }}>{pkg.created_at}</td>
                    <td>
                      <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                        {pkg.items && pkg.items.map((it, idx) => (
                          <span key={idx} style={{ background: '#edf2f7', padding: '2px 8px', borderRadius: '12px', fontSize: '11px', fontWeight: 600, color: '#4a5568' }}>
                            {it.amount} {it.unit} {it.type || it.aid_type}
                          </span>
                        ))}
                      </div>
                    </td>
                    <td>
                      <button
                        className="btn btn-red btn-sm"
                        onClick={() => handleDeletePackage(pkg)}
                        title={`Delete package for ${pkg.location || 'All Locations'}`}
                      >
                        🗑 Delete
                      </button>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={5} style={{ textAlign:'center', color:'#a0aec0', padding:'24px' }}>
                      No active packages available
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
          ['Active Campaigns', stats.total_campaigns || 0],
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

      {/* Security Operations Summary Panel */}
      <div className="card" style={{ gridColumn: 'span 2', background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.95) 0%, rgba(20, 30, 55, 0.95) 100%)', color: '#f8fafc', border: '1px solid rgba(255,255,255,0.08)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px' }}>
          <div>
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px' }}>
              🛡️ Security & Threat Intelligence Desk
            </h3>
            <p style={{ margin: '6px 0 0 0', fontSize: '13px', color: '#94a3b8', maxWidth: '650px' }}>
              Automated rule-based security scanners inspect physical terminal handshake handshakes, fingerprint bypass triggers, and ledger blocks.
            </p>
          </div>
          <a
            href="/security"
            style={{
              padding: '10px 18px',
              borderRadius: '999px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#f8fafc',
              fontSize: '12px',
              fontWeight: 800,
              textDecoration: 'none',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.2s ease-in-out'
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.transform = 'translateY(-1px)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.transform = 'none';
            }}
          >
            Open Threat Panel ↗
          </a>
        </div>

        <div style={{
          marginTop: '20px',
          background: 'rgba(9, 13, 22, 0.5)',
          borderRadius: '10px',
          border: '1px solid rgba(255,255,255,0.06)',
          padding: '16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '15px'
        }}>
          <div style={{ display: 'flex', gap: '20px', flexWrap: 'wrap' }}>
            <div>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Monitored Logs
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#f8fafc', marginTop: '2px' }}>
                {events.length} Events
              </div>
            </div>
            <div style={{ borderLeft: '1px solid rgba(255,255,255,0.1)', paddingLeft: '20px' }}>
              <div style={{ fontSize: '10px', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Rule Threat Scans
              </div>
              <div style={{ fontSize: '20px', fontWeight: 900, color: '#10b981', marginTop: '2px' }}>
                4 Active Rules
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {events.some(ev => ev.event_type.includes('FAIL') || ev.event_type.includes('ERROR') || ev.event_type.includes('MISMATCH')) ? (
              <div style={{
                background: 'rgba(249, 115, 22, 0.12)',
                border: '1px solid rgba(249, 115, 22, 0.25)',
                color: '#ff9800',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span className="pulse-orange" style={{ width: '8px', height: '8px', background: '#ff9800', borderRadius: '50%' }} />
                ⚠️ Suspicious Testing Anomalies Logged
              </div>
            ) : (
              <div style={{
                background: 'rgba(16, 185, 129, 0.12)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
                color: '#34d399',
                padding: '6px 14px',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <span style={{ width: '8px', height: '8px', background: '#34d399', borderRadius: '50%' }} />
                🟢 Zero Active Intrusion Alerts
              </div>
            )}
          </div>
        </div>
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
