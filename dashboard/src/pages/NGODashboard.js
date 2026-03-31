// ================================================================
//  NGODashboard.js — NGO Orchestration View
//  Updated with distribution history table
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import {
  getStats, registerBeneficiary,
  distributeAid, advanceCycle,
  getPending, syncCache,
  getBeneficiary, deactivateBeneficiary,
  reactivateBeneficiary, getAllBeneficiaries,
  getDistributionHistory, getCampaigns
} from '../services/api';

const AID_TYPES = [
  { type: 'MAIZE',      unit: 'KG'      },
  { type: 'CASH',       unit: 'USD'     },
  { type: 'OIL',        unit: 'LITRES'  },
  { type: 'SEEDS',      unit: 'PACKETS' },
  { type: 'CLOTHES',    unit: 'UNITS'   },
  { type: 'FERTILISER', unit: 'KG'      },
  { type: 'BLANKETS',   unit: 'UNITS'   },
];

export default function NGODashboard() {
  const [stats,      setStats]      = useState({});
  const [pending,    setPending]    = useState([]);
  const [alert,      setAlert]      = useState(null);
  const [loading,    setLoading]    = useState(false);
  const [campaigns,  setCampaigns]  = useState([]);

  // ── Registration form ──────────────────────────────────────
  const [regForm, setRegForm] = useState({
    id: '', name: '', national_id: '',
    phone: '', location: ''
  });
  const [regErrors, setRegErrors] = useState({});

  // ── Distribution form ──────────────────────────────────────
  const [distForm, setDistForm] = useState({
    beneficiary_id: '', amount: '',
    aid_type: 'MAIZE', aid_unit: 'KG', location: '',
    campaign_id: ''
  });
  const [distErrors, setDistErrors] = useState({});

  // ── Beneficiary lookup ─────────────────────────────────────
  const [lookupId,     setLookupId]     = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [lookupError,  setLookupError]  = useState('');

  // ── Beneficiary list ───────────────────────────────────────
  const [beneficiaries, setBeneficiaries] = useState([]);
  const [listLoading,   setListLoading]   = useState(false);
  const [listSearch,    setListSearch]    = useState('');
  const [listFilter,    setListFilter]    = useState('ALL');

  // ── Distribution history ───────────────────────────────────
  const [history,        setHistory]        = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historySearch,  setHistorySearch]  = useState('');
  const [historyFilter,  setHistoryFilter]  = useState('ALL');

  useEffect(() => {
    const fetchInitial = async () => {
      try {
        const [s, p, c] = await Promise.all([
          getStats(), getPending(), getCampaigns()
        ]);
        setStats(s.data);
        setPending(p.data.pending || []);
        setCampaigns(c.data.campaigns || []);
      } catch {}
    };
    fetchInitial();
    const interval = setInterval(fetchInitial, 10000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const refreshData = async () => {
    try {
      const [s, p, c] = await Promise.all([
        getStats(), getPending(), getCampaigns()
      ]);
      setStats(s.data);
      setPending(p.data.pending || []);
      setCampaigns(c.data.campaigns || []);
    } catch {}
  };

  const showAlert = (msg, type = 'success') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 5000);
  };

  // ── Aid type change ────────────────────────────────────────
  const handleAidTypeChange = (e) => {
    const selected = AID_TYPES.find(a => a.type === e.target.value);
    setDistForm({ ...distForm,
      aid_type: selected.type,
      aid_unit: selected.unit,
      campaign_id: ''
    });
    setDistErrors({ ...distErrors, aid_type: '', campaign_id: '' });
  };

  // ================================================================
  //  VALIDATE REGISTRATION FORM
  // ================================================================
  const validateRegForm = () => {
    const errors = {};

    if (!regForm.id) {
      errors.id = "Fingerprint ID is required";
    } else if (parseInt(regForm.id) <= 0 || isNaN(parseInt(regForm.id))) {
      errors.id = "Fingerprint ID must be a positive number";
    }

    if (!regForm.name.trim()) {
      errors.name = "Full name is required";
    } else if (regForm.name.trim().length < 2) {
      errors.name = "Name must be at least 2 characters";
    } else if (regForm.name.trim().length > 100) {
      errors.name = "Name cannot exceed 100 characters";
    }

    if (!regForm.national_id.trim()) {
      errors.national_id = "National ID is required";
    } else if (!/^\d{2}-\d{6,7}[A-Z]\d{2}$/.test(
      regForm.national_id.trim()
    )) {
      errors.national_id = "Format must be: 63-123456A78";
    }

    if (!regForm.phone.trim()) {
      errors.phone = "Phone number is required";
    } else if (!/^\+?[0-9]{10,15}$/.test(
      regForm.phone.replace(/\s/g, "")
    )) {
      errors.phone = "Use format: +263771234001";
    }

    if (!regForm.location.trim()) {
      errors.location = "Location is required";
    } else if (regForm.location.trim().length < 3) {
      errors.location = "Location must be at least 3 characters";
    } else if (regForm.location.trim().length > 100) {
      errors.location = "Location cannot exceed 100 characters";
    }

    return errors;
  };

  // ================================================================
  //  VALIDATE DISTRIBUTION FORM
  // ================================================================
  const validateDistForm = () => {
    const errors = {};

    if (!distForm.beneficiary_id) {
      errors.beneficiary_id = "Beneficiary ID is required";
    } else if (parseInt(distForm.beneficiary_id) <= 0 ||
               isNaN(parseInt(distForm.beneficiary_id))) {
      errors.beneficiary_id = "Must be a positive number";
    }

    if (!distForm.amount) {
      errors.amount = "Amount is required";
    } else if (parseInt(distForm.amount) <= 0 ||
               isNaN(parseInt(distForm.amount))) {
      errors.amount = "Amount must be greater than zero";
    } else if (parseInt(distForm.amount) > 10000) {
      errors.amount = "Amount cannot exceed 10,000";
    }

    if (!distForm.location.trim()) {
      errors.location = "Distribution location is required";
    } else if (distForm.location.trim().length < 3) {
      errors.location = "Location must be at least 3 characters";
    } else if (distForm.location.trim().length > 100) {
      errors.location = "Location cannot exceed 100 characters";
    }

    if (distForm.campaign_id) {
      const campaign = campaigns.find(c => String(c.id) === String(distForm.campaign_id));
      if (!campaign) {
        errors.campaign_id = "Selected campaign is invalid";
      } else if (!campaign.active) {
        errors.campaign_id = "Selected campaign is not active";
      } else if (campaign.aid_type !== distForm.aid_type) {
        errors.campaign_id = "Selected campaign does not match aid type";
      } else if (parseInt(distForm.amount) > campaign.remaining) {
        errors.campaign_id = "Selected campaign does not have enough remaining budget";
      }
    }

    return errors;
  };

  // ================================================================
  //  REGISTER BENEFICIARY
  // ================================================================
  const handleRegister = async () => {
  const errors = validateRegForm();
  setRegErrors(errors);
  if (Object.keys(errors).length > 0) {
    showAlert('Please fix the errors in the registration form', 'error');
    return;
  }

  // ── Check if ID already exists before submitting ───────────
  try {
    const check = await getBeneficiary(parseInt(regForm.id));
    if (check.data.success) {
      showAlert(
        `⚠ Beneficiary ID ${regForm.id} is already registered — ` +
        `Name: ${check.data.name} | ` +
        `Location: ${check.data.location}`,
        'error'
      );
      return;
    }
  } catch {
    // ID does not exist on blockchain — safe to proceed
  }

  setLoading(true);
  try {
    await registerBeneficiary({
      id:          parseInt(regForm.id),
      name:        regForm.name.trim(),
      national_id: regForm.national_id.trim(),
      phone:       regForm.phone.trim(),
      location:    regForm.location.trim()
    });
    showAlert(`✓ ${regForm.name} registered successfully`);
    setRegForm({ id:'', name:'', national_id:'', phone:'', location:'' });
    setRegErrors({});
    refreshData();
  } catch (e) {
    showAlert(e.response?.data?.error || 'Registration failed', 'error');
  }
  setLoading(false);
};
  // ================================================================
  //  DISTRIBUTE AID
  // ================================================================
  const handleDistribute = async () => {
    const errors = validateDistForm();
    setDistErrors(errors);
    if (Object.keys(errors).length > 0) {
      showAlert('Please fix the errors in the distribution form', 'error');
      return;
    }
    setLoading(true);
    try {
      const payload = {
        beneficiary_id: parseInt(distForm.beneficiary_id),
        amount:         parseInt(distForm.amount),
        aid_type:       distForm.aid_type,
        aid_unit:       distForm.aid_unit,
        location:       distForm.location.trim()
      };
      if (distForm.campaign_id) {
        payload.campaign_id = parseInt(distForm.campaign_id);
      }
      const res = await distributeAid(payload);
      showAlert(
        `✓ ${distForm.amount} ${distForm.aid_unit} of ` +
        `${distForm.aid_type} distributed` +
        `${distForm.campaign_id ? ` via campaign #${distForm.campaign_id}` : ''}. ` +
        `TX: ${res.data.tx_hash?.slice(0, 14)}...`
      );
      setDistForm({
        beneficiary_id: '', amount: '',
        aid_type: 'MAIZE', aid_unit: 'KG', location: '',
        campaign_id: ''
      });
      setDistErrors({});
      refreshData();
    } catch (e) {
      showAlert(e.response?.data?.error || 'Distribution failed', 'error');
    }
    setLoading(false);
  };

  // ── Advance cycle ──────────────────────────────────────────
  const handleAdvanceCycle = async () => {
    if (!window.confirm(
      'Advance to next distribution cycle?\n\n' +
      'All beneficiaries will be able to collect again.'
    )) return;
    try {
      const res = await advanceCycle();
      showAlert(`✓ Advanced to Cycle ${res.data.new_cycle}`);
      refreshData();
    } catch {
      showAlert('Failed to advance cycle', 'error');
    }
  };

  // ── Sync cache ─────────────────────────────────────────────
  const handleSync = async () => {
    try {
      const res = await syncCache();
      showAlert(`✓ Synced ${res.data.synced} transactions to blockchain`);
      refreshData();
    } catch {
      showAlert('Sync failed', 'error');
    }
  };

  // ================================================================
  //  BENEFICIARY LOOKUP
  // ================================================================
  const handleLookup = async () => {
    if (!lookupId || parseInt(lookupId) <= 0 ||
        isNaN(parseInt(lookupId))) {
      setLookupError('Enter a valid positive beneficiary ID');
      return;
    }
    setLookupError('');
    setLookupResult(null);
    try {
      const res = await getBeneficiary(parseInt(lookupId));
      setLookupResult({ id: parseInt(lookupId), ...res.data });
    } catch (e) {
      setLookupError(
        e.response?.data?.error || 'Beneficiary not found'
      );
    }
  };

  const handleDeactivateBeneficiary = async (id, name) => {
    if (!window.confirm(
      `Deactivate beneficiary "${name}" (ID: ${id})?\n\n` +
      `They will no longer be able to receive aid.`
    )) return;
    try {
      await deactivateBeneficiary(id);
      showAlert(`✓ Beneficiary "${name}" deactivated`);
      setLookupResult({ ...lookupResult, active: false });
    } catch (e) {
      showAlert(
        e.response?.data?.error || 'Failed to deactivate', 'error'
      );
    }
  };

  const handleReactivateBeneficiary = async (id, name) => {
    if (!window.confirm(
      `Reactivate beneficiary "${name}" (ID: ${id})?`
    )) return;
    try {
      await reactivateBeneficiary(id);
      showAlert(`✓ Beneficiary "${name}" reactivated`);
      setLookupResult({ ...lookupResult, active: true });
    } catch (e) {
      showAlert(
        e.response?.data?.error || 'Failed to reactivate', 'error'
      );
    }
  };

  // ================================================================
  //  BENEFICIARY LIST
  // ================================================================
  const loadBeneficiaries = async () => {
    setListLoading(true);
    try {
      const res = await getAllBeneficiaries();
      setBeneficiaries(res.data.beneficiaries || []);
    } catch {
      showAlert('Failed to load beneficiary list', 'error');
    }
    setListLoading(false);
  };

  const filteredBeneficiaries = beneficiaries.filter(b => {
    const matchSearch =
      !listSearch ||
      b.name.toLowerCase().includes(listSearch.toLowerCase()) ||
      String(b.id).includes(listSearch) ||
      b.location.toLowerCase().includes(listSearch.toLowerCase()) ||
      b.national_id.toLowerCase().includes(listSearch.toLowerCase());
    const matchFilter =
      listFilter === 'ALL' ||
      (listFilter === 'ACTIVE'   && b.active) ||
      (listFilter === 'INACTIVE' && !b.active);
    return matchSearch && matchFilter;
  });

  const availableCampaigns = campaigns.filter(c =>
    c.active && c.aid_type === distForm.aid_type && c.remaining > 0
  );

  // ================================================================
  //  DISTRIBUTION HISTORY
  // ================================================================
  const loadHistory = async () => {
    setHistoryLoading(true);
    try {
      const res = await getDistributionHistory(50);
      setHistory(res.data.distributions || []);
    } catch {
      showAlert('Failed to load distribution history', 'error');
    }
    setHistoryLoading(false);
  };

  // Format unix timestamp to readable date
  const formatTime = (ts) => {
    if (!ts) return 'N/A';
    return new Date(ts * 1000).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  const filteredHistory = history.filter(tx => {
    const matchSearch =
      !historySearch ||
      tx.beneficiary_name.toLowerCase().includes(
        historySearch.toLowerCase()
      ) ||
      tx.location.toLowerCase().includes(
        historySearch.toLowerCase()
      ) ||
      tx.aid_type.toLowerCase().includes(
        historySearch.toLowerCase()
      ) ||
      String(tx.tx_id).includes(historySearch) ||
      String(tx.beneficiary_id).includes(historySearch);
    const matchFilter =
      historyFilter === 'ALL' ||
      tx.aid_type === historyFilter;
    return matchSearch && matchFilter;
  });

  // ── Input style ────────────────────────────────────────────
  const inputStyle = (hasError) => ({
    width: '100%', padding: '9px 12px',
    border: `1px solid ${hasError ? '#e53e3e' : '#e2e8f0'}`,
    borderRadius: '6px', fontSize: '13px', color: '#2d3748',
    background: hasError ? '#fff5f5' : '#f7fafc', outline: 'none'
  });

  const errStyle = {
    fontSize: '11px', color: '#e53e3e',
    marginTop: '3px', fontWeight: 500
  };

  return (
    <div className="page">

      {/* ── Header ── */}
      <div style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div>
          <div className="page-title">NGO Dashboard — Orchestration</div>
          <div className="page-subtitle">
            Register beneficiaries and manage aid distribution
          </div>
        </div>
        <button className="btn btn-orange btn-sm"
          onClick={handleAdvanceCycle}>
          ↻ Advance Cycle
        </button>
      </div>

      {/* ── Alert ── */}
      {alert && (
        <div className={`alert alert-${alert.type}`}
          style={{ marginTop: '16px' }}>
          {alert.msg}
        </div>
      )}

      {/* ── Stats ── */}
      <div className="stats-grid" style={{ marginTop: '20px' }}>
        <StatCard label="Total Beneficiaries"
          value={stats.total_beneficiaries}
          color="#1a2d5a" icon="👥"
          sub="Registered on blockchain"/>
        <StatCard label="Total Distributions"
          value={stats.total_transactions}
          color="#38a169" icon="📦"
          sub="All aid types"/>
        <StatCard label="Current Cycle"
          value={stats.current_cycle}
          color="#d69e2e" icon="🔄"
          sub="Distribution round"/>
        <StatCard label="Pending Cache"
          value={stats.pending_cache}
          color="#e53e3e" icon="⏳"
          sub="Awaiting sync"/>
        <StatCard label="Blockchain"
          value={stats.blockchain_online ? 'Online' : 'Offline'}
          color={stats.blockchain_online ? '#38a169' : '#e53e3e'}
          icon="⛓️" sub="Ganache node"/>
      </div>

      {/* ── Pending cache ── */}
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

      {/* ── REGISTRATION FORM ── */}
      <div className="card">
        <h3>👤 Register New Beneficiary</h3>
        <div className="form-grid">

          <div className="form-group">
            <label>Fingerprint ID *</label>
            <input type="number" placeholder="e.g. 1"
              value={regForm.id}
              style={inputStyle(regErrors.id)}
              onChange={e => {
                setRegForm({ ...regForm, id: e.target.value });
                setRegErrors({ ...regErrors, id: '' });
              }}/>
            {regErrors.id &&
              <div style={errStyle}>⚠ {regErrors.id}</div>}
          </div>

          <div className="form-group">
            <label>Full Name *</label>
            <input placeholder="e.g. Alice Moyo"
              value={regForm.name}
              style={inputStyle(regErrors.name)}
              onChange={e => {
                setRegForm({ ...regForm, name: e.target.value });
                setRegErrors({ ...regErrors, name: '' });
              }}/>
            {regErrors.name &&
              <div style={errStyle}>⚠ {regErrors.name}</div>}
          </div>

          <div className="form-group">
            <label>National ID * (63-123456A78)</label>
            <input placeholder="e.g. 63-123456A78"
              value={regForm.national_id}
              style={inputStyle(regErrors.national_id)}
              onChange={e => {
                setRegForm({ ...regForm,
                  national_id: e.target.value.toUpperCase() });
                setRegErrors({ ...regErrors, national_id: '' });
              }}/>
            {regErrors.national_id &&
              <div style={errStyle}>⚠ {regErrors.national_id}</div>}
          </div>

          <div className="form-group">
            <label>Phone Number * (+263...)</label>
            <input placeholder="e.g. +263771234001"
              value={regForm.phone}
              style={inputStyle(regErrors.phone)}
              onChange={e => {
                setRegForm({ ...regForm, phone: e.target.value });
                setRegErrors({ ...regErrors, phone: '' });
              }}/>
            {regErrors.phone &&
              <div style={errStyle}>⚠ {regErrors.phone}</div>}
          </div>

          <div className="form-group">
            <label>Location / Ward *</label>
            <input placeholder="e.g. Gweru Ward 5"
              value={regForm.location}
              style={inputStyle(regErrors.location)}
              onChange={e => {
                setRegForm({ ...regForm, location: e.target.value });
                setRegErrors({ ...regErrors, location: '' });
              }}/>
            {regErrors.location &&
              <div style={errStyle}>⚠ {regErrors.location}</div>}
          </div>

        </div>
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: '12px', marginTop: '4px'
        }}>
          <button className="btn btn-primary"
            onClick={handleRegister} disabled={loading}>
            {loading ? 'Registering...' : '+ Register Beneficiary'}
          </button>
          <span style={{ fontSize: '11px', color: '#a0aec0' }}>
            * All fields are required
          </span>
        </div>
      </div>

      {/* ── DISTRIBUTION FORM ── */}
      <div className="card">
        <h3>📦 Distribute Aid</h3>
        <div className="form-grid">

          <div className="form-group">
            <label>Beneficiary ID *</label>
            <input type="number"
              placeholder="Fingerprint ID e.g. 1"
              value={distForm.beneficiary_id}
              style={inputStyle(distErrors.beneficiary_id)}
              onChange={e => {
                setDistForm({ ...distForm,
                  beneficiary_id: e.target.value });
                setDistErrors({ ...distErrors, beneficiary_id: '' });
              }}/>
            {distErrors.beneficiary_id &&
              <div style={errStyle}>⚠ {distErrors.beneficiary_id}</div>}
          </div>

          <div className="form-group">
            <label>Aid Type *</label>
            <select value={distForm.aid_type}
              onChange={handleAidTypeChange}
              style={inputStyle(false)}>
              {AID_TYPES.map(a => (
                <option key={a.type} value={a.type}>
                  {a.type} ({a.unit})
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>Campaign (optional)</label>
            <select value={distForm.campaign_id}
              onChange={e => setDistForm({ ...distForm, campaign_id: e.target.value })}
              style={inputStyle(distErrors.campaign_id)}>
              <option value="">No campaign</option>
              {availableCampaigns.map(c => (
                <option key={c.id} value={c.id}>
                  #{c.id} {c.name} — remaining {c.remaining}
                </option>
              ))}
            </select>
            {distErrors.campaign_id &&
              <div style={errStyle}>⚠ {distErrors.campaign_id}</div>}
            {availableCampaigns.length === 0 && (
              <div style={{ fontSize: '11px', color: '#718096', marginTop: '6px' }}>
                No active campaigns matching the selected aid type.
              </div>
            )}
          </div>

          <div className="form-group">
            <label>Amount ({distForm.aid_unit}) *</label>
            <input type="number" placeholder="e.g. 50"
              value={distForm.amount}
              style={inputStyle(distErrors.amount)}
              onChange={e => {
                setDistForm({ ...distForm, amount: e.target.value });
                setDistErrors({ ...distErrors, amount: '' });
              }}/>
            {distErrors.amount &&
              <div style={errStyle}>⚠ {distErrors.amount}</div>}
          </div>

          <div className="form-group">
            <label>Distribution Location *</label>
            <input placeholder="e.g. Gweru Ward 5"
              value={distForm.location}
              style={inputStyle(distErrors.location)}
              onChange={e => {
                setDistForm({ ...distForm, location: e.target.value });
                setDistErrors({ ...distErrors, location: '' });
              }}/>
            {distErrors.location &&
              <div style={errStyle}>⚠ {distErrors.location}</div>}
          </div>

        </div>
        <div style={{
          display: 'flex', alignItems: 'center',
          gap: '12px', marginTop: '4px'
        }}>
          <button className="btn btn-green"
            onClick={handleDistribute} disabled={loading}>
            {loading ? 'Processing...' : '✓ Distribute Aid'}
          </button>
          <span style={{ fontSize: '11px', color: '#a0aec0' }}>
            * All fields are required
          </span>
        </div>
      </div>

      {/* ── BENEFICIARY LOOKUP ── */}
      <div className="card">
        <h3>🔎 Beneficiary Lookup &amp; Management</h3>
        <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
          <input
            type="number"
            placeholder="Enter beneficiary fingerprint ID e.g. 1"
            value={lookupId}
            onChange={e => {
              setLookupId(e.target.value);
              setLookupError('');
              setLookupResult(null);
            }}
            onKeyDown={e => e.key === 'Enter' && handleLookup()}
            style={{
              flex: 1, padding: '9px 12px',
              border: `1px solid ${lookupError ? '#e53e3e' : '#e2e8f0'}`,
              borderRadius: '6px', fontSize: '13px',
              background: lookupError ? '#fff5f5' : '#f7fafc',
              outline: 'none', color: '#2d3748'
            }}
          />
          <button className="btn btn-blue" onClick={handleLookup}>
            🔍 Search
          </button>
        </div>

        {lookupError && (
          <div style={{
            background: '#fed7d7', color: '#9b2c2c',
            padding: '10px 14px', borderRadius: '7px',
            fontSize: '13px', marginBottom: '12px'
          }}>
            ⚠️ {lookupError}
          </div>
        )}

        {lookupResult && (
          <div style={{
            background: '#f7fafc', border: '1px solid #e2e8f0',
            borderRadius: '8px', padding: '16px'
          }}>
            <div style={{
              display: 'flex', justifyContent: 'space-between',
              alignItems: 'center', marginBottom: '14px'
            }}>
              <span style={{
                fontWeight: 700, fontSize: '14px', color: '#1a2d5a'
              }}>
                Beneficiary #{lookupResult.id}
              </span>
              <span className={
                `badge ${lookupResult.active
                  ? 'badge-green' : 'badge-red'}`
              }>
                {lookupResult.active ? '✓ Active' : '✕ Deactivated'}
              </span>
            </div>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              gap: '10px', marginBottom: '16px'
            }}>
              {[
                ['Full Name',   lookupResult.name],
                ['National ID', lookupResult.national_id],
                ['Phone',       lookupResult.phone],
                ['Location',    lookupResult.location],
              ].map(([label, value]) => (
                <div key={label} style={{
                  background: '#fff', padding: '10px 12px',
                  borderRadius: '6px', border: '1px solid #e2e8f0'
                }}>
                  <div style={{
                    fontSize: '10px', fontWeight: 700,
                    textTransform: 'uppercase', color: '#718096',
                    letterSpacing: '0.06em', marginBottom: '3px'
                  }}>{label}</div>
                  <div style={{
                    fontWeight: 600, color: '#2d3748', fontSize: '13px'
                  }}>{value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              {lookupResult.active ? (
                <button className="btn btn-red btn-sm"
                  onClick={() => handleDeactivateBeneficiary(
                    lookupResult.id, lookupResult.name
                  )}>
                  ✕ Deactivate Beneficiary
                </button>
              ) : (
                <button className="btn btn-green btn-sm"
                  onClick={() => handleReactivateBeneficiary(
                    lookupResult.id, lookupResult.name
                  )}>
                  ✓ Reactivate Beneficiary
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* ── ALL BENEFICIARIES LIST ── */}
      <div className="card">
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '16px'
        }}>
          <h3 style={{ margin:0, padding:0, borderBottom:'none' }}>
            📋 All Registered Beneficiaries
          </h3>
          <button className="btn btn-blue btn-sm"
            onClick={loadBeneficiaries} disabled={listLoading}>
            {listLoading ? '⏳ Loading...' : '↻ Load List'}
          </button>
        </div>

        {beneficiaries.length > 0 && (
          <div style={{ display:'flex', gap:'10px', marginBottom:'14px' }}>
            <input
              placeholder="Search by name, ID, national ID or location..."
              value={listSearch}
              onChange={e => setListSearch(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px',
                border: '1px solid #e2e8f0', borderRadius: '6px',
                fontSize: '13px', background: '#f7fafc', outline: 'none'
              }}
            />
            <select value={listFilter}
              onChange={e => setListFilter(e.target.value)}
              style={{
                padding: '8px 12px', border: '1px solid #e2e8f0',
                borderRadius: '6px', fontSize: '13px',
                background: '#f7fafc', outline: 'none'
              }}>
              <option value="ALL">All Status</option>
              <option value="ACTIVE">Active Only</option>
              <option value="INACTIVE">Deactivated Only</option>
            </select>
          </div>
        )}

        {beneficiaries.length === 0 && !listLoading && (
          <div style={{
            textAlign: 'center', padding: '32px',
            color: '#a0aec0', fontSize: '13px'
          }}>
            Click <strong>Load List</strong> to fetch all registered
            beneficiaries from the blockchain.
          </div>
        )}

        {listLoading && (
          <div style={{
            textAlign: 'center', padding: '32px',
            color: '#4a90d9', fontSize: '13px'
          }}>
            ⏳ Fetching beneficiaries from blockchain...
          </div>
        )}

        {beneficiaries.length > 0 && (
          <>
            <div style={{
              fontSize: '11px', color: '#718096', marginBottom: '8px'
            }}>
              Showing {filteredBeneficiaries.length} of{' '}
              {beneficiaries.length} beneficiaries
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID</th><th>Full Name</th><th>National ID</th>
                    <th>Phone</th><th>Location</th>
                    <th>Status</th><th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredBeneficiaries.length > 0
                    ? filteredBeneficiaries.map(b => (
                    <tr key={b.id}>
                      <td style={{
                        fontWeight: 700, fontFamily: 'monospace'
                      }}>
                        #{b.id}
                      </td>
                      <td>{b.name}</td>
                      <td style={{
                        fontFamily: 'monospace', fontSize: '12px'
                      }}>
                        {b.national_id}
                      </td>
                      <td style={{ fontSize: '12px' }}>{b.phone}</td>
                      <td>{b.location}</td>
                      <td>
                        <span className={
                          `badge ${b.active
                            ? 'badge-green' : 'badge-red'}`
                        }>
                          {b.active ? '✓ Active' : '✕ Inactive'}
                        </span>
                      </td>
                      <td>
                        {b.active ? (
                          <button className="btn btn-red btn-sm"
                            onClick={async () => {
                              if (!window.confirm(
                                `Deactivate "${b.name}"?\n\n` +
                                `They will no longer receive aid.`
                              )) return;
                              try {
                                await deactivateBeneficiary(b.id);
                                showAlert(`✓ "${b.name}" deactivated`);
                                loadBeneficiaries();
                              } catch (e) {
                                showAlert(
                                  e.response?.data?.error ||
                                  'Failed', 'error'
                                );
                              }
                            }}>
                            Deactivate
                          </button>
                        ) : (
                          <button className="btn btn-green btn-sm"
                            onClick={async () => {
                              if (!window.confirm(
                                `Reactivate "${b.name}"?`
                              )) return;
                              try {
                                await reactivateBeneficiary(b.id);
                                showAlert(`✓ "${b.name}" reactivated`);
                                loadBeneficiaries();
                              } catch (e) {
                                showAlert(
                                  e.response?.data?.error ||
                                  'Failed', 'error'
                                );
                              }
                            }}>
                            Reactivate
                          </button>
                        )}
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={7} style={{
                        textAlign: 'center',
                        color: '#a0aec0', padding: '20px'
                      }}>
                        No beneficiaries match your search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* ── DISTRIBUTION HISTORY ─────────────────────────────── */}
      <div className="card">
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '16px'
        }}>
          <h3 style={{ margin:0, padding:0, borderBottom:'none' }}>
            📜 Distribution History
          </h3>
          <button className="btn btn-blue btn-sm"
            onClick={loadHistory} disabled={historyLoading}>
            {historyLoading ? '⏳ Loading...' : '↻ Load History'}
          </button>
        </div>

        {/* Search and filter */}
        {history.length > 0 && (
          <div style={{
            display: 'flex', gap: '10px', marginBottom: '14px'
          }}>
            <input
              placeholder="Search by name, location or aid type..."
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              style={{
                flex: 1, padding: '8px 12px',
                border: '1px solid #e2e8f0', borderRadius: '6px',
                fontSize: '13px', background: '#f7fafc', outline: 'none'
              }}
            />
            <select value={historyFilter}
              onChange={e => setHistoryFilter(e.target.value)}
              style={{
                padding: '8px 12px', border: '1px solid #e2e8f0',
                borderRadius: '6px', fontSize: '13px',
                background: '#f7fafc', outline: 'none'
              }}>
              <option value="ALL">All Aid Types</option>
              {AID_TYPES.map(a => (
                <option key={a.type} value={a.type}>{a.type}</option>
              ))}
            </select>
          </div>
        )}

        {/* Empty state */}
        {history.length === 0 && !historyLoading && (
          <div style={{
            textAlign: 'center', padding: '32px',
            color: '#a0aec0', fontSize: '13px'
          }}>
            Click <strong>Load History</strong> to fetch
            distribution records from the blockchain.
          </div>
        )}

        {/* Loading */}
        {historyLoading && (
          <div style={{
            textAlign: 'center', padding: '32px',
            color: '#4a90d9', fontSize: '13px'
          }}>
            ⏳ Fetching from blockchain...
          </div>
        )}

        {/* Table */}
        {history.length > 0 && (
          <>
            {/* Summary bar */}
            <div style={{
              display: 'flex', gap: '16px',
              marginBottom: '12px', flexWrap: 'wrap',
              alignItems: 'flex-end'
            }}>
              {[
                ['Records',      filteredHistory.length,        '#1a2d5a'],
                ['Total Amount', filteredHistory.reduce(
                  (s, t) => s + t.amount, 0),                   '#38a169'],
                ['Cycles',       [...new Set(filteredHistory.map(
                  t => t.cycle))].length,                        '#d69e2e'],
              ].map(([label, value, color]) => (
                <div key={label} style={{
                  background: '#f7fafc',
                  border: '1px solid #e2e8f0',
                  borderLeft: `3px solid ${color}`,
                  borderRadius: '6px',
                  padding: '8px 14px'
                }}>
                  <div style={{
                    color: '#718096', fontSize: '10px', fontWeight: 700,
                    textTransform: 'uppercase', letterSpacing: '0.06em'
                  }}>
                    {label}
                  </div>
                  <div style={{
                    color, fontWeight: 800, fontSize: '18px'
                  }}>
                    {value}
                  </div>
                </div>
              ))}
              <div style={{
                marginLeft: 'auto', fontSize: '11px', color: '#a0aec0'
              }}>
                Showing {filteredHistory.length} of {history.length}
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>TX #</th>
                    <th>Beneficiary</th>
                    <th>Aid Type</th>
                    <th>Amount</th>
                    <th>Location</th>
                    <th>Cycle</th>
                    <th>Date &amp; Time</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredHistory.length > 0
                    ? filteredHistory.map(tx => (
                    <tr key={tx.tx_id}>
                      <td style={{
                        fontFamily: 'monospace',
                        fontWeight: 700, color: '#4a90d9'
                      }}>
                        #{tx.tx_id}
                      </td>
                      <td>
                        <div style={{
                          fontWeight: 600, color: '#2d3748'
                        }}>
                          {tx.beneficiary_name}
                        </div>
                        <div style={{
                          fontSize: '11px', color: '#a0aec0'
                        }}>
                          ID: {tx.beneficiary_id}
                        </div>
                      </td>
                      <td>
                        <span className="badge badge-blue">
                          {tx.aid_type}
                        </span>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {tx.amount}
                        <span style={{
                          fontSize: '11px', color: '#718096',
                          marginLeft: '4px'
                        }}>
                          {tx.aid_unit}
                        </span>
                      </td>
                      <td style={{ fontSize: '12px' }}>
                        {tx.location}
                      </td>
                      <td>
                        <span className="badge badge-gray">
                          Cycle {tx.cycle}
                        </span>
                      </td>
                      <td style={{
                        fontSize: '11px', color: '#718096'
                      }}>
                        {formatTime(tx.timestamp)}
                      </td>
                      <td>
                        <span className="badge badge-green">
                          {tx.status}
                        </span>
                      </td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={8} style={{
                        textAlign: 'center',
                        color: '#a0aec0', padding: '20px'
                      }}>
                        No records match your search
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

    </div>
  );
}