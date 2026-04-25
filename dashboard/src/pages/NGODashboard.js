// ================================================================
//  NGODashboard.js — NGO Orchestration View
//  Updated with distribution history table
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState, useEffect, useRef } from 'react';
import DashboardHero from '../components/DashboardHero';
import StatCard from '../components/StatCard';
import {
  getStats,
  distributeAid, advanceCycle,
  getPending, syncCache,
  getBeneficiary, deactivateBeneficiary,
  reactivateBeneficiary, getAllBeneficiaries,
  getDistributionHistory, getCampaigns,
  getHardwareProfile, updateHardwareProfile,
  queueHardwareEnrollment, getEnrollmentRequests,
  getHardwareEvents, startFingerprintEnrollment,
  getFingerprintEnrollmentStatus
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
  const [enrollmentRequests, setEnrollmentRequests] = useState([]);
  const [hardwareProfile, setHardwareProfile] = useState({
    aid_type: 'MAIZE',
    aid_unit: 'KG',
    amount: 50,
    location: 'Gweru Ward 5',
    officer_id: 'ngo_officer',
    device_id: 'aidchain-field-01'
  });
  const [hardwareErrors, setHardwareErrors] = useState({});
  const [hardwareEvents, setHardwareEvents] = useState([]);
  const [fingerprintStatus, setFingerprintStatus] = useState(null); // null, 'waiting', 'success', 'failed'
  const [currentEnrollmentId, setCurrentEnrollmentId] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const fingerprintPollRef = useRef(null);
  const fingerprintTimeoutRef = useRef(null);

  // ── Registration form ──────────────────────────────────────
  const [regForm, setRegForm] = useState({
    id: '', name: '', national_id: '',
    phone: '', location: ''
  });
  const [regErrors, setRegErrors] = useState({});

  // ── Distribution form ──────────────────────────────────────
  const [distForm, setDistForm] = useState({
    beneficiary_id: '', location: '',
    items: [
      { aid_type: 'MAIZE', aid_unit: 'KG', amount: '', campaign_id: '' }
    ]
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
        const [s, p, c, h, e, he] = await Promise.allSettled([
          getStats(), getPending(), getCampaigns(), getHardwareProfile(), getEnrollmentRequests(), getHardwareEvents()
        ]);
        if (s.status === 'fulfilled') setStats(s.value.data);
        if (p.status === 'fulfilled') setPending(p.value.data.pending || []);
        if (c.status === 'fulfilled') setCampaigns(c.value.data.campaigns || []);
        if (h.status === 'fulfilled' && h.value.data.profile) {
          setHardwareProfile(h.value.data.profile);
        }
        if (e.status === 'fulfilled') {
          setEnrollmentRequests(e.value.data.requests || []);
        }
        if (he.status === 'fulfilled') {
          setHardwareEvents(he.value.data.events || []);
        }
      } catch {}
    };
    fetchInitial();
    const interval = setInterval(fetchInitial, 5000); // Poll every 5 seconds for live updates
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (fingerprintPollRef.current) {
      clearInterval(fingerprintPollRef.current);
    }
    if (fingerprintTimeoutRef.current) {
      clearTimeout(fingerprintTimeoutRef.current);
    }
  }, []);

  const refreshData = async () => {
    try {
      const [s, p, c, h, e, he] = await Promise.allSettled([
        getStats(), getPending(), getCampaigns(), getHardwareProfile(), getEnrollmentRequests(), getHardwareEvents()
      ]);
      if (s.status === 'fulfilled') setStats(s.value.data);
      if (p.status === 'fulfilled') setPending(p.value.data.pending || []);
      if (c.status === 'fulfilled') setCampaigns(c.value.data.campaigns || []);
      if (h.status === 'fulfilled' && h.value.data.profile) {
        setHardwareProfile(h.value.data.profile);
      }
      if (e.status === 'fulfilled') {
        setEnrollmentRequests(e.value.data.requests || []);
      }
      if (he.status === 'fulfilled') {
        setHardwareEvents(he.value.data.events || []);
      }
    } catch {}
  };

  const showAlert = (msg, type = 'success') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 5000);
  };

  const resetFingerprintWorkflow = (finalStatus = null) => {
    if (fingerprintPollRef.current) {
      clearInterval(fingerprintPollRef.current);
      fingerprintPollRef.current = null;
    }
    if (fingerprintTimeoutRef.current) {
      clearTimeout(fingerprintTimeoutRef.current);
      fingerprintTimeoutRef.current = null;
    }

    setFingerprintStatus(finalStatus);
    setCurrentEnrollmentId(null);
    setStatusMessage('');
  };

  // ── Aid type change ────────────────────────────────────────
  const handleAidTypeChange = (index, value) => {
    const selected = AID_TYPES.find(a => a.type === value);
    const newItems = [...distForm.items];
    newItems[index] = { ...newItems[index], aid_type: selected.type, aid_unit: selected.unit, campaign_id: '' };
    setDistForm({ ...distForm, items: newItems });
    
    if (distErrors.items && distErrors.items[index]) {
      const newItemsErrors = [...distErrors.items];
      newItemsErrors[index] = { ...newItemsErrors[index], aid_type: '', campaign_id: '' };
      setDistErrors({ ...distErrors, items: newItemsErrors });
    }
  };

  const handleAddItem = () => {
    setDistForm({
      ...distForm,
      items: [...distForm.items, { aid_type: 'MAIZE', aid_unit: 'KG', amount: '', campaign_id: '' }]
    });
  };

  const handleRemoveItem = (index) => {
    const newItems = distForm.items.filter((_, i) => i !== index);
    setDistForm({ ...distForm, items: newItems });
    
    if (distErrors.items) {
      const newItemsErrors = distErrors.items.filter((_, i) => i !== index);
      setDistErrors({ ...distErrors, items: newItemsErrors });
    }
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

    if (!distForm.location.trim()) {
      errors.location = "Distribution location is required";
    } else if (distForm.location.trim().length < 3) {
      errors.location = "Location must be at least 3 characters";
    } else if (distForm.location.trim().length > 100) {
      errors.location = "Location cannot exceed 100 characters";
    }

    errors.items = [];
    let hasItemErrors = false;
    const seenTypes = new Set();

    distForm.items.forEach((item, index) => {
      const itemErrs = {};
      
      if (!item.amount) {
        itemErrs.amount = "Amount is required";
      } else if (parseInt(item.amount) <= 0 ||
                 isNaN(parseInt(item.amount))) {
        itemErrs.amount = "Must be > 0";
      } else if (parseInt(item.amount) > 10000) {
        itemErrs.amount = "Cannot exceed 10,000";
      }

      if (seenTypes.has(item.aid_type)) {
        itemErrs.aid_type = "Duplicate aid type";
      }
      seenTypes.add(item.aid_type);

      if (item.campaign_id) {
        const campaign = campaigns.find(c => String(c.id) === String(item.campaign_id));
        if (!campaign) {
          itemErrs.campaign_id = "Invalid campaign";
        } else if (!campaign.active) {
          itemErrs.campaign_id = "Campaign not active";
        } else if (campaign.aid_type !== item.aid_type) {
          itemErrs.campaign_id = "Mismatch aid type";
        } else if (parseInt(item.amount) > campaign.remaining) {
          itemErrs.campaign_id = "Exceeds remaining budget";
        }
      }

      if (Object.keys(itemErrs).length > 0) hasItemErrors = true;
      errors.items[index] = itemErrs;
    });

    if (!hasItemErrors) delete errors.items;

    return errors;
  };

  const validateHardwareProfile = () => {
    const errors = {};

    if (!hardwareProfile.aid_type?.trim()) {
      errors.aid_type = "Aid type is required";
    }
    if (!hardwareProfile.aid_unit?.trim()) {
      errors.aid_unit = "Aid unit is required";
    }
    if (!hardwareProfile.amount || Number(hardwareProfile.amount) <= 0) {
      errors.amount = "Amount must be a positive number";
    }
    if (!hardwareProfile.location?.trim() || hardwareProfile.location.trim().length < 3) {
      errors.location = "Location must be at least 3 characters";
    }
    if (!hardwareProfile.officer_id?.trim() || hardwareProfile.officer_id.trim().length < 3) {
      errors.officer_id = "Officer ID is required";
    }
    if (!hardwareProfile.device_id?.trim() || hardwareProfile.device_id.trim().length < 3) {
      errors.device_id = "Device ID is required";
    }

    return errors;
  };

  const handleSaveHardwareProfile = async () => {
    const errors = validateHardwareProfile();
    setHardwareErrors(errors);
    if (Object.keys(errors).length > 0) {
      showAlert('Please fix the hardware profile errors', 'error');
      return;
    }

    setLoading(true);
    try {
      const res = await updateHardwareProfile({
        aid_type: hardwareProfile.aid_type.trim().toUpperCase(),
        aid_unit: hardwareProfile.aid_unit.trim().toUpperCase(),
        amount: Number(hardwareProfile.amount),
        location: hardwareProfile.location.trim(),
        officer_id: hardwareProfile.officer_id.trim(),
        device_id: hardwareProfile.device_id.trim()
      });
      if (res.data.profile) {
        setHardwareProfile(res.data.profile);
      }
      setHardwareErrors({});
      showAlert('✓ Hardware profile saved. ESP32 can now fetch the latest field settings.');
    } catch (e) {
      showAlert(e.response?.data?.message || e.response?.data?.error || 'Failed to save hardware profile', 'error');
    }
    setLoading(false);
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

  try {
    const check = await getBeneficiary(parseInt(regForm.id, 10));
    if (check.data.success) {
      showAlert(
        `Beneficiary ID ${regForm.id} is already registered on blockchain`,
        'error'
      );
      return;
    }
  } catch {
    // Safe to continue when the beneficiary does not yet exist on-chain.
  }

  resetFingerprintWorkflow(null);
  setLoading(true);
  try {
    await queueHardwareEnrollment({
      id: parseInt(regForm.id, 10),
      name: regForm.name.trim(),
      national_id: regForm.national_id.trim(),
      phone: regForm.phone.trim(),
      location: regForm.location.trim(),
      officer_id: hardwareProfile.officer_id,
      device_id: hardwareProfile.device_id
    });
    setCurrentEnrollmentId(parseInt(regForm.id, 10));
    setFingerprintStatus('ready');
    setStatusMessage('');
    showAlert(
      `Details saved. Click "Submit Fingerprint" to start enrollment on ${hardwareProfile.device_id}`
    );
  } catch (e) {
    showAlert(
      e.response?.data?.message ||
      e.response?.data?.error ||
      'Enrollment queueing failed',
      'error'
    );
  }
  setLoading(false);
};

//  SUBMIT FINGERPRINT
// ================================================================
//  SUBMIT FINGERPRINT
// ================================================================
const handleSubmitFingerprint = async () => {
  if (!currentEnrollmentId) return;

  setFingerprintStatus('waiting');
  setStatusMessage('Starting fingerprint capture...');
  setLoading(true);

  try {
    await startFingerprintEnrollment({
      beneficiary_id: currentEnrollmentId,
      device_id: hardwareProfile.device_id
    });

    showAlert('Beneficiary enter fingerprint on the ESP32 sensor (will be scanned twice for verification).');

    if (fingerprintPollRef.current) {
      clearInterval(fingerprintPollRef.current);
    }
    if (fingerprintTimeoutRef.current) {
      clearTimeout(fingerprintTimeoutRef.current);
    }

    fingerprintPollRef.current = setInterval(async () => {
      try {
        const response = await getFingerprintEnrollmentStatus(currentEnrollmentId);
        const data = response.data;

        if (data.success && data.status) {
          const nextStatus = data.status.status_code;
          const nextMessage = data.status.status_message;

          setStatusMessage(nextMessage);

          if (nextStatus === 'ACTIVE') {
            resetFingerprintWorkflow('success');
            showAlert('Fingerprint enrolled and beneficiary registered on blockchain!');
            setRegForm({ id:'', name:'', national_id:'', phone:'', location:'' });
            setRegErrors({});
            refreshData();
            return;
          }

          if (nextStatus === 'FAILED_ENROLLMENT' || nextStatus === 'FAILED_BLOCKCHAIN') {
            resetFingerprintWorkflow('failed');
            showAlert(`Enrollment failed: ${nextMessage}`, 'error');
            refreshData();
          }
        }
      } catch (e) {
        console.error('Error polling status:', e);
      }
    }, 2000); // Poll every 2 seconds

    fingerprintTimeoutRef.current = setTimeout(() => {
      if (fingerprintPollRef.current) {
        clearInterval(fingerprintPollRef.current);
        fingerprintPollRef.current = null;
      }
      setFingerprintStatus(prev => {
        if (prev === 'waiting') {
          setCurrentEnrollmentId(null);
          setStatusMessage('');
          showAlert('Fingerprint enrollment timed out', 'error');
          return 'failed';
        }
        return prev;
      });
    }, 120000);

  } catch (e) {
    resetFingerprintWorkflow('failed');
    showAlert(
      e.response?.data?.message ||
      e.response?.data?.error ||
      'Failed to start fingerprint enrollment',
      'error'
    );
  }
  setLoading(false);
};
  // ================================================================
  //  DISTRIBUTE AID
  // ================================================================
  const handleDistribute = async () => {
    const errors = validateDistForm();
    setDistErrors(errors);
    if (Object.keys(errors).length > 0 && (errors.beneficiary_id || errors.location || errors.items)) {
      showAlert('Please fix the errors in the distribution form', 'error');
      return;
    }
    setLoading(true);
    try {
      let hashes = [];
      for (const item of distForm.items) {
        const payload = {
          beneficiary_id: parseInt(distForm.beneficiary_id),
          amount:         parseInt(item.amount),
          aid_type:       item.aid_type,
          aid_unit:       item.aid_unit,
          location:       distForm.location.trim()
        };
        if (item.campaign_id) {
          payload.campaign_id = parseInt(item.campaign_id);
        }
        const res = await distributeAid(payload);
        if (res.data.tx_hash) hashes.push(res.data.tx_hash.slice(0, 6));
      }
      showAlert(`✓ Successfully distributed ${distForm.items.length} aid items. TXs: ${hashes.join(', ')}`);
      setDistForm({
        beneficiary_id: '', location: '',
        items: [
          { aid_type: 'MAIZE', aid_unit: 'KG', amount: '', campaign_id: '' }
        ]
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

  const getAvailableCampaigns = (aidType) => campaigns.filter(c =>
    c.active && c.aid_type === aidType && c.remaining > 0
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
      <DashboardHero
        eyebrow="NGO Operations"
        title="Coordinate beneficiary registration and field distribution"
        subtitle="Handle registration, disbursement, verification, and cache synchronization through a more confident operational view designed for day-to-day field use."
        badges={[
          `${stats.total_beneficiaries || 0} registered beneficiaries`,
          `${stats.total_transactions || 0} total distributions`,
          stats.blockchain_online ? 'Blockchain available' : 'Blockchain unavailable'
        ]}
      />

      {/* ── Header ── */}
      <div className="legacy-dashboard-header" style={{
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
          style={{
            position: 'fixed',
            top: '20px',
            right: '20px',
            zIndex: 1000,
            maxWidth: '400px',
            boxShadow: '0 4px 6px rgba(0, 0, 0, 0.1)'
          }}>
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


      <div className="card">
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '16px', gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div>
            <h3 style={{ margin: 0, padding: 0, borderBottom: 'none' }}>
              Fingerprint Enrollment Queue
            </h3>
            <div style={{ fontSize: '12px', color: '#718096', marginTop: '6px' }}>
              Registration completes only after the ESP32 enrolls the beneficiary fingerprint.
            </div>
          </div>
          <button className="btn btn-blue btn-sm" onClick={refreshData}>
            Refresh Queue
          </button>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Beneficiary ID</th>
                <th>Name</th>
                <th>Slot</th>
                <th>Device</th>
                <th>Status</th>
                <th>Updated</th>
                <th>Error</th>
              </tr>
            </thead>
            <tbody>
              {enrollmentRequests.length > 0 ? enrollmentRequests.map(item => (
                <tr key={item.beneficiary_id}>
                  <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>#{item.beneficiary_id}</td>
                  <td>{item.name}</td>
                  <td>{item.slot_id}</td>
                  <td>{item.device_id}</td>
                  <td>
                    <span className={`badge ${
                      item.status === 'ACTIVE' ? 'badge-green' :
                      item.status === 'FAILED_ENROLLMENT' || item.status === 'FAILED_BLOCKCHAIN'
                        ? 'badge-red' : 'badge-orange'
                    }`}>
                      {item.status}
                    </span>
                  </td>
                  <td style={{ fontSize: '12px' }}>{item.updated_at}</td>
                  <td style={{ fontSize: '12px', color: '#718096' }}>
                    {item.error_message || '-'}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={7} style={{ textAlign: 'center', color: '#a0aec0', padding: '24px' }}>
                    No enrollment jobs yet
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Hardware Activity Log ── */}
      <div className="card">
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '16px', gap: '12px',
          flexWrap: 'wrap'
        }}>
          <div>
            <h3 style={{ margin: 0, padding: 0, borderBottom: 'none' }}>
              🔄 Hardware Activity Log
            </h3>
            <div style={{ fontSize: '12px', color: '#718096', marginTop: '6px' }}>
              Live feed of ESP32 operations during enrollment and distribution.
            </div>
          </div>
          <button className="btn btn-blue btn-sm" onClick={refreshData}>
            Refresh
          </button>
        </div>

        <div style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid #e2e8f0', borderRadius: '4px', padding: '8px' }}>
          {hardwareEvents.length > 0 ? hardwareEvents.map((event, index) => (
            <div key={index} style={{
              padding: '8px',
              marginBottom: '4px',
              backgroundColor: event.event_type.includes('FAILED') ? '#fed7d7' :
                               event.event_type.includes('SUCCESS') || event.event_type === 'BENEFICIARY_REGISTERED' ? '#c6f6d5' :
                               '#e6fffa',
              borderRadius: '4px',
              fontSize: '14px'
            }}>
              <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
                {event.timestamp} - {event.device_id}
              </div>
              <div>{event.message}</div>
              {event.details && <div style={{ fontSize: '12px', color: '#718096', marginTop: '4px' }}>{event.details}</div>}
            </div>
          )) : (
            <div style={{ textAlign: 'center', color: '#a0aec0', padding: '24px' }}>
              No hardware activity yet
            </div>
          )}
        </div>
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
            <label>Beneficiary ID / Fingerprint Slot Mapping *</label>
            <input type="number" placeholder="e.g. 1001 (maps to slot 1)"
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
          gap: '12px', marginTop: '4px', flexWrap: 'wrap'
        }}>
          {!currentEnrollmentId && (
            <button className="btn btn-primary"
              onClick={handleRegister} disabled={loading}>
              {loading ? 'Saving...' : '+ Save Details & Prepare Fingerprint'}
            </button>
          )}

          {fingerprintStatus === 'ready' && (
            <button className="btn btn-success"
              onClick={handleSubmitFingerprint} disabled={loading}>
              {loading ? 'Starting...' : '🖐️ Submit Fingerprint'}
            </button>
          )}

          {fingerprintStatus === 'waiting' && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#e6fffa',
              border: '1px solid #b2f5ea',
              borderRadius: '6px',
              color: '#234e52'
            }}>
              ⏳ {statusMessage || 'ESP32 is waiting for fingerprint input... Place finger on sensor.'}
            </div>
          )}

          {fingerprintStatus === 'success' && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#c6f6d5',
              border: '1px solid #9ae6b4',
              borderRadius: '6px',
              color: '#22543d'
            }}>
              ✅ Fingerprint enrolled and beneficiary registered on blockchain!
            </div>
          )}

          {fingerprintStatus === 'failed' && (
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#fed7d7',
              border: '1px solid #feb2b2',
              borderRadius: '6px',
              color: '#742a2a'
            }}>
              ❌ Fingerprint enrollment failed. Please try again.
            </div>
          )}

          <span style={{ fontSize: '11px', color: '#a0aec0' }}>
            * Enter details first, then submit fingerprint for immediate enrollment
          </span>
        </div>
      </div>

      {/* ── DISTRIBUTION FORM ── */}
      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h3 style={{ margin: 0 }}>📦 Distribute Aid</h3>
          <button className="btn btn-blue btn-sm" onClick={handleAddItem} disabled={distForm.items.length >= AID_TYPES.length}>
            + Add Another Aid Type
          </button>
        </div>

        <div className="form-grid" style={{ marginBottom: '16px', paddingBottom: '16px', borderBottom: '1px solid #e2e8f0' }}>
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

        {distForm.items.map((item, index) => {
          const itemErrs = distErrors.items ? distErrors.items[index] || {} : {};
          const availableCamps = getAvailableCampaigns(item.aid_type);
          
          return (
            <div key={index} style={{ 
              position: 'relative', 
              background: '#f7fafc', 
              padding: '16px', 
              borderRadius: '8px', 
              marginBottom: '12px',
              border: '1px solid #e2e8f0'
            }}>
              {distForm.items.length > 1 && (
                <button 
                  onClick={() => handleRemoveItem(index)}
                  style={{
                    position: 'absolute', top: '8px', right: '8px',
                    background: 'none', border: 'none', color: '#e53e3e',
                    cursor: 'pointer', fontSize: '18px', fontWeight: 'bold'
                  }}
                  title="Remove Item"
                >×</button>
              )}
              
              <div className="form-grid" style={{ marginTop: '8px' }}>
                <div className="form-group">
                  <label>Aid Type *</label>
                  <select value={item.aid_type}
                    onChange={(e) => handleAidTypeChange(index, e.target.value)}
                    style={inputStyle(itemErrs.aid_type)}>
                    {AID_TYPES.map(a => (
                      <option key={a.type} value={a.type}>
                        {a.type} ({a.unit})
                      </option>
                    ))}
                  </select>
                  {itemErrs.aid_type &&
                    <div style={errStyle}>⚠ {itemErrs.aid_type}</div>}
                </div>

                <div className="form-group">
                  <label>Amount ({item.aid_unit}) *</label>
                  <input type="number" placeholder="e.g. 50"
                    value={item.amount}
                    style={inputStyle(itemErrs.amount)}
                    onChange={e => {
                      const newItems = [...distForm.items];
                      newItems[index].amount = e.target.value;
                      setDistForm({ ...distForm, items: newItems });
                      if (distErrors.items && distErrors.items[index]) {
                        const newErrs = [...distErrors.items];
                        newErrs[index].amount = '';
                        setDistErrors({ ...distErrors, items: newErrs });
                      }
                    }}/>
                  {itemErrs.amount &&
                    <div style={errStyle}>⚠ {itemErrs.amount}</div>}
                </div>

                <div className="form-group">
                  <label>Campaign (optional)</label>
                  <select value={item.campaign_id}
                    onChange={e => {
                      const newItems = [...distForm.items];
                      newItems[index].campaign_id = e.target.value;
                      setDistForm({ ...distForm, items: newItems });
                      if (distErrors.items && distErrors.items[index]) {
                        const newErrs = [...distErrors.items];
                        newErrs[index].campaign_id = '';
                        setDistErrors({ ...distErrors, items: newErrs });
                      }
                    }}
                    style={inputStyle(itemErrs.campaign_id)}>
                    <option value="">No campaign</option>
                    {availableCamps.map(c => (
                      <option key={c.id} value={c.id}>
                        #{c.id} {c.name} — remaining {c.remaining}
                      </option>
                    ))}
                  </select>
                  {itemErrs.campaign_id &&
                    <div style={errStyle}>⚠ {itemErrs.campaign_id}</div>}
                  {availableCamps.length === 0 && (
                    <div style={{ fontSize: '11px', color: '#718096', marginTop: '6px' }}>
                      No active campaigns matching {item.aid_type}.
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        <div style={{
          display: 'flex', alignItems: 'center',
          gap: '12px', marginTop: '16px'
        }}>
          <button className="btn btn-green"
            onClick={handleDistribute} disabled={loading}>
            {loading ? 'Processing...' : '✓ Submit Distribution'}
          </button>
          <span style={{ fontSize: '11px', color: '#a0aec0' }}>
            * Beneficiary ID, Location and Amount are required
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
