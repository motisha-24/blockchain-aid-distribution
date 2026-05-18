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
  getTotalTransactions, getDistributionHistory,
  getHardwareEvents
} from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  // ── Events Log ──────────────────────────────────────────────
  const [events, setEvents] = useState([]);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchStats = async () => {
    try {
      const [statsRes, evRes] = await Promise.all([
        getStats(),
        getHardwareEvents(30)
      ]);
      setStats(statsRes.data);
      setEvents(evRes.data.events || []);
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

  // ── Export all distributions as PDF ────────────────────────
  const handleExportDistributionsPDF = async () => {
    setExportLoading(true);
    showAlert('Preparing PDF report...', 'info');
    try {
      const res   = await getDistributionHistory(100);
      const data  = res.data.distributions || [];

      if (data.length === 0) {
        showAlert('No distribution records to export', 'error');
        setExportLoading(false);
        return;
      }

      const doc = new jsPDF();
      const today = new Date().toLocaleDateString('en-GB');

      // Title
      doc.setFontSize(20);
      doc.setTextColor(26, 45, 90);
      doc.text('AidChain Zimbabwe', 14, 22);

      // Subtitle
      doc.setFontSize(12);
      doc.setTextColor(100);
      doc.text(`Official Distribution Audit Report`, 14, 30);
      doc.setFontSize(10);
      doc.text(`Generated on: ${today}`, 14, 36);

      const tableColumn = ["Tx ID", "Beneficiary", "Aid", "Amount", "Location", "Cycle", "Date"];
      const tableRows = [];

      data.forEach(tx => {
        const rowData = [
          `#${tx.tx_id}`,
          `${tx.beneficiary_id} (${tx.beneficiary_name})`,
          tx.aid_type,
          `${tx.amount} ${tx.aid_unit}`,
          tx.location,
          `Cycle ${tx.cycle}`,
          formatTime(tx.timestamp)
        ];
        tableRows.push(rowData);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 42,
        theme: 'grid',
        headStyles: { fillColor: [26, 45, 90] },
        styles: { fontSize: 8 },
        alternateRowStyles: { fillColor: [247, 250, 252] }
      });

      const fileName = `AidChain_Audit_Report_${new Date().toISOString().slice(0, 10)}.pdf`;
      doc.save(fileName);
      
      showAlert(`✓ Exported ${data.length} records as PDF`, 'success');
    } catch (error) {
      console.error("PDF Generation Error:", error);
      showAlert(`PDF Export failed: ${error.message}`, 'error');
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
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              style={{ background: '#fff', color: '#1a2d5a' }}
              onClick={handleExportDistributions}
              disabled={exportLoading}
            >
              ⬇ CSV
            </button>
            <button
              className="btn btn-primary"
              onClick={handleExportDistributionsPDF}
              disabled={exportLoading}
            >
              {exportLoading ? 'Exporting...' : '⬇ Export PDF Report'}
            </button>
          </div>
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
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            className="btn btn-secondary"
            onClick={handleExportDistributions}
            disabled={exportLoading}
          >
            ⬇ CSV
          </button>
          <button
            className="btn btn-primary"
            onClick={handleExportDistributionsPDF}
            disabled={exportLoading}
          >
            {exportLoading
              ? '⏳ Exporting...'
              : '⬇ Export Official PDF'}
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
        <div className="card glass-card">
          <h3>🔍 Search Transaction by ID</h3>
          <div style={{ display:'flex', gap:'10px', marginBottom:'16px' }}>
            <input
              type="number"
              placeholder="Enter transaction ID e.g. 1"
              value={txId}
              onChange={e => setTxId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleTxSearch()}
              style={{
                flex: 1, padding: '12px 16px',
                border: '1px solid #d9e3ee', borderRadius: '10px',
                fontSize: '14px', outline: 'none', background: 'rgba(255,255,255,0.8)',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(79, 70, 229, 0.7)';
                e.target.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.15)';
                e.target.style.background = '#ffffff';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d9e3ee';
                e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)';
                e.target.style.background = 'rgba(255,255,255,0.8)';
              }}
            />
            <button className="btn btn-primary"
              onClick={handleTxSearch} disabled={loading}
              style={{ padding: '0 24px', fontSize: '14px' }}>
              Search
            </button>
          </div>

          {txResult && (
            <div style={{
              background: 'rgba(255,255,255,0.95)', borderRadius: '12px',
              padding: '16px', fontSize: '12px',
              boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
              border: '1px solid #e2e8f0'
            }}>
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr',
                gap: '12px', marginBottom: '14px'
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
                      fontSize: '10px', fontWeight: 800,
                      textTransform: 'uppercase', color: '#64748b',
                      marginBottom: '4px', letterSpacing: '0.05em'
                    }}>{k}</div>
                    <div style={{ fontWeight: 700, color: '#1e293b', fontSize: '13px' }}>
                      {k === 'Aid Type' ? (
                        <span className="badge badge-blue">{v}</span>
                      ) : k === 'Status' ? (
                        <span className="badge badge-green">{v}</span>
                      ) : k === 'TX ID' ? (
                        <span style={{ color: '#4f46e5' }}>#{v}</span>
                      ) : v}
                    </div>
                  </div>
                ))}
              </div>

              {/* Blockchain verification note */}
              <div style={{
                background: '#ecfdf5', color: '#065f46',
                padding: '10px 14px', borderRadius: '8px',
                fontSize: '12px', border: '1px solid #a7f3d0',
                display: 'flex', alignItems: 'center', gap: '8px'
              }}>
                <span style={{ fontSize: '16px' }}>🔒</span>
                <div>
                  <strong>Blockchain Verified:</strong> This record is permanently stored on the Ethereum blockchain and cannot be altered.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Beneficiary search ── */}
        <div className="card glass-card">
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
                flex: 1, padding: '12px 16px',
                border: '1px solid #d9e3ee', borderRadius: '10px',
                fontSize: '14px', outline: 'none', background: 'rgba(255,255,255,0.8)',
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
                transition: 'all 0.3s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = 'rgba(79, 70, 229, 0.7)';
                e.target.style.boxShadow = '0 0 0 4px rgba(79, 70, 229, 0.15)';
                e.target.style.background = '#ffffff';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = '#d9e3ee';
                e.target.style.boxShadow = 'inset 0 2px 4px rgba(0,0,0,0.02)';
                e.target.style.background = 'rgba(255,255,255,0.8)';
              }}
            />
            <button className="btn btn-primary"
              onClick={handleBeneficiarySearch} disabled={loading}
              style={{ padding: '0 24px', fontSize: '14px' }}>
              Search
            </button>
          </div>

          {bResult && (
            <div style={{ fontSize: '12px' }}>
              <div style={{
                background: 'rgba(255,255,255,0.95)', borderRadius: '12px',
                padding: '0 16px', marginBottom: '16px',
                boxShadow: '0 4px 15px rgba(0,0,0,0.04)',
                border: '1px solid #e2e8f0'
              }}>
                {[
                  ['Name',        bResult.name],
                  ['National ID', bResult.national_id],
                  ['Phone',       bResult.phone],
                  ['Location',    bResult.location],
                  ['Status',      bResult.active
                    ? 'Active' : 'Deactivated'],
                ].map(([k, v], i) => (
                  <div key={k} style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: i === 4 ? 'none' : '1px solid #f1f5f9'
                  }}>
                    <span style={{
                      fontWeight: 800, color: '#64748b',
                      textTransform: 'uppercase', fontSize: '10px',
                      letterSpacing: '0.05em'
                    }}>{k}</span>
                    <span style={{
                      fontWeight: 700, color: '#1e293b', fontSize: '13px'
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
                fontWeight: 800, fontSize: '11px', color: '#64748b',
                marginBottom: '10px', textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}>
                Collection Status — Current Cycle
              </div>
              <div style={{
                display: 'flex', flexWrap: 'wrap', gap: '8px',
                marginBottom: '16px'
              }}>
                {Object.entries(bResult.collection || {}).map(
                  ([type, collected]) => (
                  <span key={type} className={
                    `badge ${collected ? 'badge-green' : 'badge-gray'}`
                  } style={{ padding: '6px 12px', fontSize: '11px' }}>
                    {collected ? '✓' : '○'} {type}
                  </span>
                ))}
              </div>

              {/* Export beneficiary button */}
              <button
                className="btn btn-blue btn-sm"
                onClick={handleExportBeneficiary}
                style={{ width: '100%' }}
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
          alignItems: 'center', marginBottom: '20px'
        }}>
          <h3 style={{ margin:0, padding:0, borderBottom:'none', fontSize: '20px' }}>
            📋 Recent Blockchain Transactions
          </h3>
          <div style={{ display: 'flex', gap: '10px' }}>
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

        <div className="table-wrap" style={{ border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.05)' }}>
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

      {/* Audit Log Viewer */}
      <div className="card" style={{ marginTop: '24px', marginBottom: '24px' }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'15px' }}>
          <h3 style={{ margin:0, display:'flex', alignItems:'center', gap:'8px', fontSize: '20px' }}>📜 Live System Audit Trail & Logs</h3>
          <button 
            onClick={fetchStats} 
            className="btn btn-blue btn-sm"
            style={{ padding:'4px 10px', fontSize:'11px' }}
          >
            🔄 Live Refresh
          </button>
        </div>
        
        <div style={{
          background: '#0f172a',
          borderRadius: '12px',
          padding: '20px',
          maxHeight: '380px',
          overflowY: 'auto',
          boxShadow: 'inset 0 4px 12px rgba(0,0,0,0.5)',
          border: '1px solid #1e293b'
        }}>
          {events.length > 0 ? (
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {events.map((ev, index) => {
                let badgeColor = { bg: 'rgba(59, 130, 246, 0.2)', text: '#60a5fa', border: 'rgba(59, 130, 246, 0.4)' };
                
                if (ev.event_type.includes('SUCCESS') || ev.event_type.includes('REGISTERED') || ev.event_type.includes('OK')) {
                  badgeColor = { bg: 'rgba(16, 185, 129, 0.2)', text: '#34d399', border: 'rgba(16, 185, 129, 0.4)' };
                } else if (ev.event_type.includes('FAILED') || ev.event_type.includes('ERROR') || ev.event_type.includes('MISMATCH')) {
                  badgeColor = { bg: 'rgba(239, 68, 68, 0.2)', text: '#f87171', border: 'rgba(239, 68, 68, 0.4)' };
                } else if (ev.event_type.includes('WAITING') || ev.event_type.includes('PENDING') || ev.event_type.includes('START')) {
                  badgeColor = { bg: 'rgba(245, 158, 11, 0.2)', text: '#fbbf24', border: 'rgba(245, 158, 11, 0.4)' };
                } else if (ev.event_type.includes('SMS') || ev.event_type.includes('PHONE')) {
                  badgeColor = { bg: 'rgba(139, 92, 246, 0.2)', text: '#a78bfa', border: 'rgba(139, 92, 246, 0.4)' };
                }
                
                return (
                  <div key={ev.id || index} style={{ 
                    fontFamily: 'Consolas, Monaco, monospace',
                    fontSize: '12px',
                    lineHeight: '1.6',
                    borderBottom: '1px solid #1e293b',
                    paddingBottom: '10px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px'
                  }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '8px' }}>
                      {/* Timestamp */}
                      <span style={{ color: '#64748b' }}>
                        [{ev.timestamp}]
                      </span>
                      
                      {/* Event Type Badge */}
                      <span style={{
                        background: badgeColor.bg,
                        color: badgeColor.text,
                        border: `1px solid ${badgeColor.border}`,
                        padding: '1px 8px',
                        borderRadius: '4px',
                        fontSize: '10px',
                        fontWeight: 'bold',
                        letterSpacing: '0.05em'
                      }}>
                        {ev.event_type}
                      </span>
                      
                      {/* Device ID / Officer */}
                      <span style={{ color: '#475569' }}>
                        device={ev.device_id || 'sys'} officer={ev.officer_id || 'system'}
                      </span>
                    </div>
                    
                    {/* Log Message */}
                    <div style={{ color: '#e2e8f0', fontWeight: '500' }}>
                      {ev.message}
                    </div>
                    
                    {/* Expanded details if any */}
                    {ev.details && ev.details !== '{}' && (
                      <div style={{ 
                        color: '#94a3b8', 
                        background: '#090d16', 
                        padding: '6px 10px', 
                        borderRadius: '6px', 
                        marginTop: '4px',
                        fontSize: '11px',
                        borderLeft: '3px solid #3b82f6',
                        whiteSpace: 'pre-wrap'
                      }}>
                        {ev.details}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 20px', fontFamily: 'monospace', fontSize: '13px' }}>
              📡 Listening for system & hardware events...
            </div>
          )}
        </div>
        
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '11px', color: '#718096' }}>
          <span>Showing latest 30 audit trails</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span className="pulse-green" style={{ width: '8px', height: '8px', background: '#48bb78', borderRadius: '50%', display: 'inline-block' }}></span>
            Live connection active
          </span>
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
