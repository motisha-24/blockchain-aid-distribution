// ================================================================
//  AuditorDashboard.js — Auditor Forensics View
//  Updated with CSV export and distribution history
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState, useEffect } from 'react';
import DashboardHero from '../components/DashboardHero';
import StatCard from '../components/StatCard';
import {
  getStats, getTransaction,
  getBeneficiary, getCollectionStatus,
  getTotalTransactions, getDistributionHistory
} from '../services/api';

export default function AuditorDashboard() {
  const [stats,    setStats]    = useState({});
  const [txResult, setTxResult] = useState(null);
  const [bResult,  setBResult]  = useState(null);
  const [txId,     setTxId]     = useState('');
  const [bId,      setBId]      = useState('');
  const [alert,    setAlert]    = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [txHistory, setTxHistory] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── Export state ───────────────────────────────────────────
  const [exportLoading, setExportLoading] = useState(false);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStats = async () => {
    try {
      const res = await getStats();
      setStats(res.data);
    } catch {}
  };

  const fetchTxHistory = async () => {
    setHistoryLoading(true);
    try {
      const totalRes = await getTotalTransactions();
      const total    = totalRes.data.total || 0;
      const txs      = [];

      for (let i = total; i >= Math.max(1, total - 19); i--) {
        try {
          const res = await getTransaction(i);
          if (res.data.success) txs.push({ id: i, ...res.data });
        } catch {}
      }
      setTxHistory(txs);
    } catch {}
    setHistoryLoading(false);
  };

  const showAlert = (msg, type = 'info') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 5000);
  };

  // ── Format timestamp ───────────────────────────────────────
  const formatTime = (ts) => {
    if (!ts) return 'N/A';
    return new Date(ts * 1000).toLocaleString('en-GB', {
      day: '2-digit', month: 'short', year: 'numeric',
      hour: '2-digit', minute: '2-digit'
    });
  };

  // ── Search transaction by ID ───────────────────────────────
  const handleTxSearch = async () => {
    if (!txId || parseInt(txId) <= 0 || isNaN(parseInt(txId))) {
      showAlert('Enter a valid transaction ID', 'error');
      return;
    }
    setLoading(true);
    setTxResult(null);
    try {
      const res = await getTransaction(parseInt(txId));
      setTxResult({ id: txId, ...res.data });
    } catch (e) {
      showAlert(
        e.response?.data?.error || 'Transaction not found', 'error'
      );
    }
    setLoading(false);
  };

  // ── Search beneficiary by ID ───────────────────────────────
  const handleBeneficiarySearch = async () => {
    if (!bId || parseInt(bId) <= 0 || isNaN(parseInt(bId))) {
      showAlert('Enter a valid beneficiary ID', 'error');
      return;
    }
    setLoading(true);
    setBResult(null);
    try {
      const [bRes, sRes] = await Promise.all([
        getBeneficiary(parseInt(bId)),
        getCollectionStatus(
          parseInt(bId),
          'MAIZE,CASH,OIL,SEEDS,CLOTHES,FERTILISER,BLANKETS'
        )
      ]);
      setBResult({ ...bRes.data, collection: sRes.data.status });
    } catch (e) {
      showAlert(
        e.response?.data?.error || 'Beneficiary not found', 'error'
      );
    }
    setLoading(false);
  };

  // ================================================================
  //  CSV EXPORT FUNCTIONS
  // ================================================================

  // ── Convert array of objects to CSV string ─────────────────
  const toCSV = (headers, rows) => {
    const escape = (val) => {
      const str = String(val ?? '');
      // Wrap in quotes if contains comma, quote or newline
      return str.includes(',') || str.includes('"') ||
             str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };
    const headerRow = headers.map(h => escape(h.label)).join(',');
    const dataRows  = rows.map(row =>
      headers.map(h => escape(row[h.key])).join(',')
    );
    return [headerRow, ...dataRows].join('\n');
  };

  // ── Trigger browser download of a CSV file ─────────────────
  const downloadCSV = (csvString, filename) => {
    const blob = new Blob(
      [csvString],
      { type: 'text/csv;charset=utf-8;' }
    );
    const url  = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href     = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // ── Export all distributions as CSV ───────────────────────
  const handleExportDistributions = async () => {
    setExportLoading(true);
    showAlert('Preparing distributions export...', 'info');
    try {
      const res   = await getDistributionHistory(100);
      const data  = res.data.distributions || [];

      if (data.length === 0) {
        showAlert('No distribution records to export', 'error');
        setExportLoading(false);
        return;
      }

      const headers = [
        { key: 'tx_id',            label: 'Transaction ID'   },
        { key: 'beneficiary_id',   label: 'Beneficiary ID'   },
        { key: 'beneficiary_name', label: 'Beneficiary Name' },
        { key: 'aid_type',         label: 'Aid Type'         },
        { key: 'amount',           label: 'Amount'           },
        { key: 'aid_unit',         label: 'Unit'             },
        { key: 'location',         label: 'Location'         },
        { key: 'cycle',            label: 'Cycle'            },
        { key: 'officer',          label: 'Officer Address'  },
        { key: 'timestamp_fmt',    label: 'Date & Time'      },
        { key: 'status',           label: 'Status'           },
      ];

      // Add formatted timestamp to each row
      const rows = data.map(tx => ({
        ...tx,
        timestamp_fmt: formatTime(tx.timestamp)
      }));

      const csv      = toCSV(headers, rows);
      const today    = new Date().toISOString().slice(0, 10);
      const filename = `AidChain_Distributions_${today}.csv`;
      downloadCSV(csv, filename);

      showAlert(
        `✓ Exported ${data.length} distribution records as CSV`,
        'success'
      );
    } catch {
      showAlert('Export failed — please try again', 'error');
    }
    setExportLoading(false);
  };

  // ── Export transaction history table as CSV ────────────────
  const handleExportTxHistory = () => {
    if (txHistory.length === 0) {
      showAlert('Load transaction history first', 'error');
      return;
    }

    const headers = [
      { key: 'id',             label: 'TX ID'           },
      { key: 'beneficiary_id', label: 'Beneficiary ID'  },
      { key: 'aid_type',       label: 'Aid Type'        },
      { key: 'amount',         label: 'Amount'          },
      { key: 'aid_unit',       label: 'Unit'            },
      { key: 'location',       label: 'Location'        },
      { key: 'cycle',          label: 'Cycle'           },
      { key: 'officer',        label: 'Officer Address' },
      { key: 'timestamp_fmt',  label: 'Date & Time'     },
      { key: 'status',         label: 'Status'          },
    ];

    const rows = txHistory.map(tx => ({
      ...tx,
      timestamp_fmt: formatTime(tx.timestamp)
    }));

    const csv      = toCSV(headers, rows);
    const today    = new Date().toISOString().slice(0, 10);
    const filename = `AidChain_TxHistory_${today}.csv`;
    downloadCSV(csv, filename);
    showAlert(
      `✓ Exported ${txHistory.length} transactions as CSV`,
      'success'
    );
  };

  // ── Export beneficiary search result as CSV ────────────────
  const handleExportBeneficiary = () => {
    if (!bResult) {
      showAlert('Search for a beneficiary first', 'error');
      return;
    }

    const headers = [
      { key: 'id',          label: 'Beneficiary ID' },
      { key: 'name',        label: 'Full Name'      },
      { key: 'national_id', label: 'National ID'    },
      { key: 'phone',       label: 'Phone'          },
      { key: 'location',    label: 'Location'       },
      { key: 'status',      label: 'Status'         },
    ];

    const rows = [{
      id:          bId,
      name:        bResult.name,
      national_id: bResult.national_id,
      phone:       bResult.phone,
      location:    bResult.location,
      status:      bResult.active ? 'Active' : 'Deactivated'
    }];

    const csv      = toCSV(headers, rows);
    const filename = `AidChain_Beneficiary_${bId}.csv`;
    downloadCSV(csv, filename);
    showAlert('✓ Beneficiary record exported as CSV', 'success');
  };

  return (
    <div className="page">
      <DashboardHero
        eyebrow="Audit and Forensics"
        title="Investigate transactions with export-ready evidence trails"
        subtitle="Search beneficiary records, inspect transaction history, and export evidence-backed reports from a cleaner audit workspace built for accountability."
        badges={[
          `${stats.total_transactions || 0} transactions on record`,
          `${stats.total_beneficiaries || 0} registered beneficiaries`,
          stats.blockchain_online ? 'Blockchain available' : 'Blockchain unavailable'
        ]}
        actions={(
          <button
            className="btn btn-primary"
            onClick={handleExportDistributions}
            disabled={exportLoading}
          >
            {exportLoading ? 'Exporting...' : 'Export All Distributions'}
          </button>
        )}
      />

      {/* ── Header ── */}
      <div className="legacy-dashboard-header" style={{
        display: 'flex', justifyContent: 'space-between',
        alignItems: 'flex-start'
      }}>
        <div>
          <div className="page-title">
            Auditor Dashboard — Forensics
          </div>
          <div className="page-subtitle">
            Search, verify and export blockchain transactions
          </div>
        </div>

        {/* Export all button */}
        <button
          className="btn btn-primary"
          onClick={handleExportDistributions}
          disabled={exportLoading}
        >
          {exportLoading
            ? '⏳ Exporting...'
            : '⬇ Export All Distributions (CSV)'}
        </button>
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
        <StatCard label="Total Transactions"
          value={stats.total_transactions}
          color="#1a2d5a" icon="📋" sub="On blockchain"/>
        <StatCard label="Beneficiaries"
          value={stats.total_beneficiaries}
          color="#38a169" icon="👥" sub="Registered"/>
        <StatCard label="Current Cycle"
          value={stats.current_cycle}
          color="#d69e2e" icon="🔄" sub="Active round"/>
        <StatCard label="Pending Offline"
          value={stats.pending_cache}
          color="#e53e3e" icon="⏳" sub="Cached transactions"/>
      </div>

      {/* Search tools */}
      <div style={{
        display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px'
      }}>

        {/* ── Transaction search ── */}
        <div className="card">
          <h3>🔍 Search Transaction by ID</h3>
          <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
            <input
              type="number"
              placeholder="Enter transaction ID e.g. 1"
              value={txId}
              onChange={e => setTxId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTxSearch()}
              style={{
                flex: 1, padding: '9px 12px',
                border: '1px solid #e2e8f0', borderRadius: '6px',
                fontSize: '13px', outline: 'none', background: '#f7fafc'
              }}
            />
            <button className="btn btn-primary"
              onClick={handleTxSearch} disabled={loading}>
              Search
            </button>
          </div>

          {txResult && (
            <div style={{
              background: '#f7fafc', borderRadius: '8px',
              padding: '14px', fontSize: '12px'
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '8px', marginBottom: '12px'
              }}>
                {[
                  ['TX ID',         txResult.id],
                  ['Beneficiary',   txResult.beneficiary_id],
                  ['Aid Type',      txResult.aid_type],
                  ['Unit',          txResult.aid_unit],
                  ['Amount',        txResult.amount],
                  ['Location',      txResult.location],
                  ['Cycle',         txResult.cycle],
                  ['Status',        txResult.status],
                  ['Officer',       txResult.officer?.slice(0,16) + '...'],
                  ['Timestamp',     formatTime(txResult.timestamp)],
                ].map(([k, v]) => (
                  <div key={k}>
                    <div style={{
                      fontSize: '10px', fontWeight: 700,
                      textTransform: 'uppercase', color: '#718096',
                      marginBottom: '2px'
                    }}>{k}</div>
                    <div style={{ fontWeight: 600, color: '#2d3748' }}>
                      {k === 'Aid Type' ? (
                        <span className="badge badge-blue">{v}</span>
                      ) : k === 'Status' ? (
                        <span className="badge badge-green">{v}</span>
                      ) : v}
                    </div>
                  </div>
                ))}
              </div>

              {/* Blockchain verification note */}
              <div style={{
                background: '#c6f6d5', color: '#276749',
                padding: '8px 12px', borderRadius: '6px',
                fontSize: '11px'
              }}>
                🔒 This record is permanently stored on the
                Ethereum blockchain and cannot be altered.
              </div>
            </div>
          )}
        </div>

        {/* ── Beneficiary search ── */}
        <div className="card">
          <h3>👤 Search Beneficiary by ID</h3>
          <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
            <input
              type="number"
              placeholder="Enter beneficiary ID e.g. 1"
              value={bId}
              onChange={e => setBId(e.target.value)}
              onKeyDown={e =>
                e.key === 'Enter' && handleBeneficiarySearch()
              }
              style={{
                flex: 1, padding: '9px 12px',
                border: '1px solid #e2e8f0', borderRadius: '6px',
                fontSize: '13px', outline: 'none', background: '#f7fafc'
              }}
            />
            <button className="btn btn-primary"
              onClick={handleBeneficiarySearch} disabled={loading}>
              Search
            </button>
          </div>

          {bResult && (
            <div style={{ fontSize: '12px' }}>
              <div style={{
                background: '#f7fafc', borderRadius: '8px',
                padding: '14px', marginBottom: '12px'
              }}>
                {[
                  ['Name',        bResult.name],
                  ['National ID', bResult.national_id],
                  ['Phone',       bResult.phone],
                  ['Location',    bResult.location],
                  ['Status',      bResult.active
                    ? 'Active' : 'Deactivated'],
                ].map(([k, v]) => (
                  <div key={k} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    padding: '5px 0',
                    borderBottom: '1px solid #e2e8f0'
                  }}>
                    <span style={{
                      fontWeight: 700, color: '#718096',
                      textTransform: 'uppercase', fontSize: '10px'
                    }}>{k}</span>
                    <span style={{
                      fontWeight: 600, color: '#2d3748'
                    }}>
                      {k === 'Status' ? (
                        <span className={
                          `badge ${v === 'Active'
                            ? 'badge-green' : 'badge-red'}`
                        }>{v}</span>
                      ) : v}
                    </span>
                  </div>
                ))}
              </div>

              {/* Collection status */}
              <div style={{
                fontWeight: 700, fontSize: '11px', color: '#4a5568',
                marginBottom: '8px', textTransform: 'uppercase'
              }}>
                Collection Status — Current Cycle
              </div>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '6px',
                marginBottom: '12px'
              }}>
                {Object.entries(bResult.collection || {}).map(
                  ([type, collected]) => (
                  <span key={type} className={
                    `badge ${collected ? 'badge-green' : 'badge-gray'}`
                  }>
                    {collected ? '✓' : '○'} {type}
                  </span>
                ))}
              </div>

              {/* Export beneficiary button */}
              <button
                className="btn btn-blue btn-sm"
                onClick={handleExportBeneficiary}
              >
                ⬇ Export Beneficiary Record (CSV)
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Transaction history table ── */}
      <div className="card">
        <div style={{
          display: 'flex', justifyContent: 'space-between',
          alignItems: 'center', marginBottom: '16px'
        }}>
          <h3 style={{ margin:0, padding:0, borderBottom:'none' }}>
            📋 Recent Blockchain Transactions
          </h3>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-blue btn-sm"
              onClick={fetchTxHistory}
              disabled={historyLoading}
            >
              {historyLoading ? '⏳ Loading...' : '↻ Refresh'}
            </button>
            <button
              className="btn btn-green btn-sm"
              onClick={handleExportTxHistory}
              disabled={txHistory.length === 0}
            >
              ⬇ Export CSV
            </button>
          </div>
        </div>

        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>TX ID</th>
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
              {txHistory.length > 0 ? txHistory.map(tx => (
                <tr key={tx.id}>
                  <td style={{
                    fontFamily: 'monospace', fontWeight: 700,
                    color: '#4a90d9'
                  }}>
                    #{tx.id}
                  </td>
                  <td>{tx.beneficiary_id}</td>
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
                  <td style={{ fontSize: '12px' }}>{tx.location}</td>
                  <td>
                    <span className="badge badge-gray">
                      Cycle {tx.cycle}
                    </span>
                  </td>
                  <td style={{ fontSize: '11px', color: '#718096' }}>
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
                    color: '#a0aec0', padding: '24px'
                  }}>
                    Click <strong>Refresh</strong> to load
                    recent transactions
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Transparency guarantee */}
      <div style={{
        background: '#ebf8ff', border: '1px solid #bee3f8',
        borderRadius: '8px', padding: '16px',
        fontSize: '12px', color: '#2a69ac'
      }}>
        <strong>🔒 Blockchain Audit Guarantee:</strong> Every
        transaction on this dashboard is permanently and immutably
        recorded on the Ethereum blockchain. All exported CSV files
        reflect the true on-chain state and can be independently
        verified using any Ethereum block explorer.
      </div>

    </div>
  );
}
