// ================================================================
//  SecurityAuditPage.js — Security Log Desk & Threat Intelligence Center
//  Features: Automated rule-based threat scanning, live audit log feed,
//            anomaly detection alerts, and premium cybersecurity metrics.
// ================================================================

import React, { useState, useEffect } from 'react';
import DashboardHero from '../components/DashboardHero';
import { getHardwareEvents } from '../services/api';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function SecurityAuditPage() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(false);
  const [alert, setAlert] = useState(null);
  
  // ── Filters State ──────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [severityFilter, setSeverityFilter] = useState('ALL');
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [deviceFilter, setDeviceFilter] = useState('ALL');

  // ── Threat Detection State ─────────────────────────────────
  const [threats, setThreats] = useState([]);

  useEffect(() => {
    fetchLogs();
    const interval = setInterval(fetchLogs, 15000);
    return () => clearInterval(interval);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const evRes = await getHardwareEvents(100);
      const logEvents = evRes.data.events || [];
      setEvents(logEvents);
      runThreatScanner(logEvents);
    } catch (e) {
      setAlert({ msg: 'Failed to pull secure audit trails', type: 'error' });
    }
    setLoading(false);
  };

  // ── Rule-Based Threat Scan Engine ───────────────────────────
  const runThreatScanner = (logEvents) => {
    const foundThreats = [];
    
    // Group events by device to look for consecutive biometric failures
    const deviceGroups = {};
    
    logEvents.forEach((ev, idx) => {
      // Rule 1: Blockchain sync failures
      if (
        ev.event_type.includes('ERROR') || 
        ev.event_type.includes('FAIL') || 
        ev.message.toLowerCase().includes('fail') || 
        ev.message.toLowerCase().includes('error')
      ) {
        foundThreats.push({
          id: `T-BLOCK-${idx}`,
          severity: 'HIGH',
          category: 'INTEGRITY',
          title: 'Blockchain / API Synchronization Failure',
          description: ev.message,
          device: ev.device_id || 'system',
          officer: ev.officer_id || 'sys',
          timestamp: ev.timestamp,
          remediation: 'Verify blockchain network connectivity and Sepolia smart contract gas limits.'
        });
      }

      // Rule 2: After-Hours Administrative Actions (Local timezone night activity)
      try {
        // Expected timestamp format: "YYYY-MM-DD HH:MM:SS" or similar
        const timePart = ev.timestamp.split(' ')[1];
        if (timePart) {
          const hour = parseInt(timePart.split(':')[0], 10);
          if (
            (hour >= 22 || hour < 5) && 
            (ev.event_type.includes('CYCLE') || ev.event_type.includes('USER') || ev.event_type.includes('ADMIN'))
          ) {
            foundThreats.push({
              id: `T-TIME-${idx}`,
              severity: 'MEDIUM',
              category: 'ADMIN_ABUSE',
              title: 'After-Hours Administrative Activity',
              description: `Administrative command "${ev.event_type}" executed at night (${timePart}).`,
              device: ev.device_id || 'system',
              officer: ev.officer_id || 'admin',
              timestamp: ev.timestamp,
              remediation: 'Audit officer activity logs to verify if this night action was explicitly authorized.'
            });
          }
        }
      } catch (err) {}

      // Rule 3: Rogue/Unknown terminal check-in (Non-standard ID formats)
      if (ev.device_id && ev.device_id !== 'sys' && ev.device_id !== 'system') {
        const authorizedDevIds = ['1', '2', '3', 'ESP32-AID-01', 'ESP32-AID-02', 'ESP32_01', 'ESP32_DEV_01'];
        if (!authorizedDevIds.includes(String(ev.device_id))) {
          foundThreats.push({
            id: `T-ROGUE-${idx}`,
            severity: 'CRITICAL',
            category: 'INTRUSION',
            title: 'Rogue / Unauthorized Terminal Handshake',
            description: `Handshake attempt from unregistered device ID "${ev.device_id}".`,
            device: ev.device_id,
            officer: ev.officer_id || 'unknown',
            timestamp: ev.timestamp,
            remediation: 'Deactivate session token immediately and block traffic from this physical MAC address.'
          });
        }
      }

      // Group for biometric brute-force check
      if (ev.device_id) {
        if (!deviceGroups[ev.device_id]) deviceGroups[ev.device_id] = [];
        deviceGroups[ev.device_id].push(ev);
      }
    });

    // Rule 4: Biometric Brute-Force Scanner (3+ consecutive mismatches or fails on same device)
    Object.entries(deviceGroups).forEach(([devId, devEvents]) => {
      // Sort events by timestamp descending (they are already sorted by backend usually)
      let consecutiveFailCount = 0;
      let failedTriggers = [];

      for (let i = 0; i < devEvents.length; i++) {
        const ev = devEvents[i];
        const isMismatch = 
          ev.event_type.includes('MISMATCH') || 
          ev.event_type.includes('FAIL') || 
          ev.message.toLowerCase().includes('fail') || 
          ev.message.toLowerCase().includes('mismatch') ||
          ev.message.toLowerCase().includes('not match');
          
        if (isMismatch) {
          consecutiveFailCount++;
          failedTriggers.push(ev);
          
          if (consecutiveFailCount >= 3) {
            foundThreats.push({
              id: `T-BIOM-${devId}-${i}`,
              severity: 'HIGH',
              category: 'BIOMETRIC_SPOOF',
              title: 'Biometric Spoofing / Brute-Force Suspected',
              description: `Flagged ${consecutiveFailCount} consecutive biometric mismatches recorded on device "${devId}".`,
              device: devId,
              officer: failedTriggers[0]?.officer_id || 'field_officer',
              timestamp: ev.timestamp,
              remediation: 'Temporarily lock terminal distributions. Verify beneficiary status against biometric card.'
            });
            // Reset count after flagging to avoid duplicate alarms
            consecutiveFailCount = 0;
            failedTriggers = [];
          }
        } else {
          // Reset count if a success occurs (brute force interrupted)
          consecutiveFailCount = 0;
          failedTriggers = [];
        }
      }
    });

    // Sort threats by timestamp descending
    foundThreats.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
    setThreats(foundThreats);
  };

  // ── Metrics Calculation ───────────────────────────────────────
  const getMetrics = () => {
    const totalCount = events.length;
    const criticalCount = threats.filter(t => t.severity === 'CRITICAL').length;
    const warningCount = threats.filter(t => t.severity === 'HIGH' || t.severity === 'MEDIUM').length;
    
    // Calculate Biometric verification failure rate
    const bioEvents = events.filter(e => e.event_type.includes('FINGERPRINT') || e.event_type.includes('ENROLL'));
    const bioFails = bioEvents.filter(e => e.event_type.includes('MISMATCH') || e.event_type.includes('FAIL') || e.message.toLowerCase().includes('fail')).length;
    const failureRate = bioEvents.length > 0 ? ((bioFails / bioEvents.length) * 100).toFixed(1) : '0.0';

    // Unique active terminals
    const uniqueDevices = new Set(events.map(e => e.device_id).filter(Boolean));

    return {
      totalCount,
      criticalCount,
      warningCount,
      failureRate,
      deviceCount: uniqueDevices.size
    };
  };

  const metrics = getMetrics();

  // ── Log Export Functions ──────────────────────────────────────
  const handleExportCSV = () => {
    const headers = [
      { key: 'timestamp', label: 'Timestamp' },
      { key: 'event_type', label: 'Event Type' },
      { key: 'message', label: 'Message' },
      { key: 'device_id', label: 'Device ID' },
      { key: 'officer_id', label: 'Officer ID' },
      { key: 'cycle', label: 'Cycle' }
    ];

    const escape = (val) => {
      const str = String(val ?? '');
      return str.includes(',') || str.includes('"') || str.includes('\n')
        ? `"${str.replace(/"/g, '""')}"`
        : str;
    };

    const headerRow = headers.map(h => escape(h.label)).join(',');
    const dataRows = events.map(ev =>
      headers.map(h => escape(ev[h.key])).join(',')
    );

    const csvContent = [headerRow, ...dataRows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `AidChain_Security_Audit_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    setAlert({ msg: '✓ Audit report exported as CSV successfully', type: 'success' });
    setTimeout(() => setAlert(null), 4000);
  };

  const handleExportPDF = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString('en-GB');

    doc.setFontSize(22);
    doc.setTextColor(26, 45, 90);
    doc.text('AidChain Zimbabwe', 14, 22);

    doc.setFontSize(12);
    doc.setTextColor(100);
    doc.text(`Threat & Vulnerability Anomaly Report`, 14, 30);
    doc.setFontSize(9);
    doc.text(`Run Date: ${today} | Analyzed Logs: ${events.length}`, 14, 36);

    // Threat List summary
    doc.setFontSize(13);
    doc.setTextColor(185, 28, 28);
    doc.text(`Identified Anomalies & Threats (${threats.length})`, 14, 46);

    const tableColumn = ["Severity", "Threat Title", "Target", "Timestamp", "Remediation Advice"];
    const tableRows = [];

    threats.forEach(t => {
      const rowData = [
        t.severity,
        t.title,
        `Device ${t.device}`,
        t.timestamp,
        t.remediation
      ];
      tableRows.push(rowData);
    });

    autoTable(doc, {
      startY: 52,
      head: [tableColumn],
      body: tableRows,
      headStyles: { fillColor: [26, 45, 90] },
      styles: { fontSize: 8 },
      columnStyles: {
        0: { cellWidth: 20 },
        1: { cellWidth: 40 },
        2: { cellWidth: 25 },
        3: { cellWidth: 35 },
        4: { cellWidth: 65 }
      }
    });

    doc.save(`AidChain_Threat_Report_${new Date().toISOString().slice(0, 10)}.pdf`);
    
    setAlert({ msg: '✓ PDF Security Threat report generated successfully', type: 'success' });
    setTimeout(() => setAlert(null), 4000);
  };

  // ── Filter Events Array ───────────────────────────────────────
  const filteredEvents = events.filter(ev => {
    const matchesSearch = 
      ev.message.toLowerCase().includes(search.toLowerCase()) ||
      ev.event_type.toLowerCase().includes(search.toLowerCase()) ||
      (ev.device_id && ev.device_id.toLowerCase().includes(search.toLowerCase()));

    const matchesSeverity = 
      severityFilter === 'ALL' ||
      (severityFilter === 'CRITICAL' && (ev.event_type.includes('ERROR') || ev.event_type.includes('FAIL'))) ||
      (severityFilter === 'WARNING' && (ev.event_type.includes('WAITING') || ev.event_type.includes('PENDING'))) ||
      (severityFilter === 'SUCCESS' && (ev.event_type.includes('SUCCESS') || ev.event_type.includes('OK') || ev.event_type.includes('REGISTERED')));

    const matchesType = 
      typeFilter === 'ALL' || 
      ev.event_type.includes(typeFilter);

    const matchesDevice = 
      deviceFilter === 'ALL' ||
      String(ev.device_id) === deviceFilter;

    return matchesSearch && matchesSeverity && matchesType && matchesDevice;
  });

  // Unique active device options for filter dropdown
  const deviceOptions = Array.from(new Set(events.map(e => String(e.device_id)).filter(Boolean)));

  return (
    <div className="page" style={{ paddingBottom: '60px' }}>
      <DashboardHero
        eyebrow="Security Operations"
        title="Audit Desk & Threat Intelligence Center"
        subtitle="Automatic security scanning, biometric spoof check, blockchain sync trackers, and live forensic evidence compilation."
        badges={[
          `${metrics.totalCount} Encrypted Log Records`,
          `${metrics.warningCount + metrics.criticalCount} Anomalies matched`,
          `Biometric Fail Rate: ${metrics.failureRate}%`
        ]}
        actions={(
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" style={{ background: '#fff', color: '#111827' }} onClick={handleExportCSV}>
              ⬇ Export CSV Trail
            </button>
            <button className="btn btn-red" onClick={handleExportPDF}>
              🛡️ Export Threat Report (PDF)
            </button>
          </div>
        )}
      />

      {alert && (
        <div className={`alert alert-${alert.type}`} style={{ margin: '20px 0' }}>
          {alert.msg}
        </div>
      )}

      {/* ── SECURITY METRICS GRID ────────────────────────────────── */}
      <div className="stats-grid" style={{ marginTop: '24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px' }}>
        
        <div className="card glass-card" style={{ borderLeft: '5px solid #ef4444' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#ef4444', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🚨 Critical Intrusion Threats
          </div>
          <div style={{ fontSize: '36px', fontWeight: 900, color: '#ef4444', margin: '10px 0' }}>
            {metrics.criticalCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Requires immediate remediation
          </div>
        </div>

        <div className="card glass-card" style={{ borderLeft: '5px solid #f59e0b' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#f59e0b', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ⚠️ Suspicious Anomalies
          </div>
          <div style={{ fontSize: '36px', fontWeight: 900, color: '#f59e0b', margin: '10px 0' }}>
            {metrics.warningCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Rule-based triggers logged
          </div>
        </div>

        <div className="card glass-card" style={{ borderLeft: '5px solid #3b82f6' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#3b82f6', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            🧬 Biometric Error Rate
          </div>
          <div style={{ fontSize: '36px', fontWeight: 900, color: '#3b82f6', margin: '10px 0' }}>
            {metrics.failureRate}%
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Fingerprint verification fails
          </div>
        </div>

        <div className="card glass-card" style={{ borderLeft: '5px solid #10b981' }}>
          <div style={{ fontSize: '11px', fontWeight: 800, color: '#10b981', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            📡 Registered Terminals
          </div>
          <div style={{ fontSize: '36px', fontWeight: 900, color: '#10b981', margin: '10px 0' }}>
            {metrics.deviceCount}
          </div>
          <div style={{ fontSize: '12px', color: '#64748b' }}>
            Active syncing device nodes
          </div>
        </div>
      </div>

      {/* ── THREAT INTELLIGENCE CONSOLE ──────────────────────────── */}
      <div className="card glass-card" style={{ marginTop: '24px', background: 'rgba(15, 23, 42, 0.95)', border: '1px solid #1e293b' }}>
        <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '18px', display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid #334155', paddingBottom: '15px' }}>
          🛡️ Real-Time Threat Identification Console
        </h3>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', marginTop: '20px', maxHeight: '350px', overflowY: 'auto' }}>
          {threats.length > 0 ? threats.map((threat) => {
            const isCritical = threat.severity === 'CRITICAL';
            const isHigh = threat.severity === 'HIGH';
            
            const badgeBg = isCritical 
              ? 'rgba(239, 68, 68, 0.2)' 
              : isHigh 
                ? 'rgba(249, 115, 22, 0.2)' 
                : 'rgba(245, 158, 11, 0.15)';
                
            const badgeColor = isCritical ? '#f87171' : isHigh ? '#fb923c' : '#fbbf24';
            const borderCol = isCritical ? 'rgba(239, 68, 68, 0.4)' : 'rgba(249, 115, 22, 0.4)';

            return (
              <div key={threat.id} style={{
                background: '#090d16',
                border: `1px solid ${borderCol || '#1e293b'}`,
                borderRadius: '10px',
                padding: '16px',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', alignItems: 'center', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{
                      background: badgeBg,
                      color: badgeColor,
                      border: `1px solid ${badgeColor}`,
                      borderRadius: '4px',
                      padding: '2px 8px',
                      fontSize: '10px',
                      fontWeight: 800,
                      letterSpacing: '0.05em'
                    }}>
                      {threat.severity} THREAT
                    </span>
                    <strong style={{ color: '#f1f5f9', fontSize: '14px' }}>
                      {threat.title}
                    </strong>
                  </div>
                  <span style={{ color: '#64748b', fontSize: '11px', fontFamily: 'monospace' }}>
                    [{threat.timestamp}]
                  </span>
                </div>
                
                <p style={{ margin: '4px 0', fontSize: '13px', color: '#cbd5e1', lineHeight: '1.5' }}>
                  {threat.description}
                </p>

                <div style={{
                  background: 'rgba(59, 130, 246, 0.08)',
                  borderLeft: '4px solid #3b82f6',
                  padding: '8px 12px',
                  borderRadius: '0 6px 6px 0',
                  fontSize: '12px',
                  color: '#93c5fd',
                  marginTop: '6px'
                }}>
                  <strong>🔧 Automated Mitigation Advice:</strong> {threat.remediation}
                </div>
              </div>
            );
          }) : (
            <div style={{ textAlign: 'center', color: '#64748b', padding: '40px 10px', fontFamily: 'monospace' }}>
              🟢 Threat analysis complete. Zero active intrusions detected on standard channels.
            </div>
          )}
        </div>
      </div>

      {/* ── SECURITY LOG AUDIT DESK ─────────────────────────────── */}
      <div className="card glass-card" style={{ marginTop: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '15px', borderBottom: '1px solid #e2e8f0', paddingBottom: '15px', marginBottom: '20px' }}>
          <h3 style={{ margin: 0, padding: 0, border: 'none', fontSize: '18px' }}>
            🔍 Secure Log Audit & Forensic Filter Desk
          </h3>
          <button className="btn btn-blue btn-sm" onClick={fetchLogs} disabled={loading}>
            {loading ? '⏳ Analyzing...' : '🔄 Live Sync Logs'}
          </button>
        </div>

        {/* Filters Panel */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '15px',
          marginBottom: '20px'
        }}>
          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
              Search Description / ID
            </label>
            <input
              type="text"
              placeholder="e.g. mismatch, device ID..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #cbd5e0',
                borderRadius: '8px',
                fontSize: '13px'
              }}
            />
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
              Event Severity Match
            </label>
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #cbd5e0',
                borderRadius: '8px',
                fontSize: '13px',
                background: '#fff'
              }}
            >
              <option value="ALL">All Severities</option>
              <option value="CRITICAL">Errors & Failures</option>
              <option value="WARNING">Pending & Warnings</option>
              <option value="SUCCESS">Success Actions</option>
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
              Terminal Hardware Node
            </label>
            <select
              value={deviceFilter}
              onChange={e => setDeviceFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #cbd5e0',
                borderRadius: '8px',
                fontSize: '13px',
                background: '#fff'
              }}
            >
              <option value="ALL">All Terminal Devices</option>
              {deviceOptions.map(opt => (
                <option key={opt} value={opt}>Device ID: {opt}</option>
              ))}
            </select>
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 800, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase' }}>
              Category Type
            </label>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              style={{
                width: '100%',
                padding: '10px 14px',
                border: '1px solid #cbd5e0',
                borderRadius: '8px',
                fontSize: '13px',
                background: '#fff'
              }}
            >
              <option value="ALL">All Categories</option>
              <option value="FINGERPRINT">Biometric verification</option>
              <option value="ENROLL">Biometric Enrollment</option>
              <option value="CYCLE">Cycle Advancement</option>
              <option value="SYNC">Blockchain Sync</option>
              <option value="SMS">SMS / Phone events</option>
            </select>
          </div>
        </div>

        {/* Forensic Log Table */}
        <div className="table-wrap" style={{ border: '1px solid #cbd5e0', borderRadius: '10px', boxShadow: '0 4px 6px rgba(0,0,0,0.02)' }}>
          <table>
            <thead>
              <tr>
                <th style={{ width: '18%' }}>Timestamp</th>
                <th style={{ width: '18%' }}>Event Type</th>
                <th>Secure Message Feed</th>
                <th style={{ width: '12%' }}>Terminal</th>
                <th style={{ width: '12%' }}>Operator</th>
                <th style={{ width: '8%' }}>Cycle</th>
              </tr>
            </thead>
            <tbody>
              {filteredEvents.length > 0 ? filteredEvents.map((ev, idx) => {
                const isFail = ev.event_type.includes('FAIL') || ev.event_type.includes('ERROR') || ev.message.toLowerCase().includes('fail');
                const isSuccess = ev.event_type.includes('SUCCESS') || ev.event_type.includes('OK') || ev.event_type.includes('REGISTERED');
                
                const badgeColor = isFail 
                  ? 'badge-red' 
                  : isSuccess 
                    ? 'badge-green' 
                    : 'badge-gray';

                return (
                  <tr key={ev.id || idx} style={{ transition: 'all 0.15s ease' }}>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#64748b' }}>
                      {ev.timestamp}
                    </td>
                    <td>
                      <span className={`badge ${badgeColor}`} style={{ letterSpacing: '0.03em', fontSize: '10px', fontWeight: 700 }}>
                        {ev.event_type}
                      </span>
                    </td>
                    <td style={{ fontSize: '12px', fontWeight: 500, color: '#1e293b' }}>
                      {ev.message}
                      {ev.details && ev.details !== '{}' && (
                        <div style={{ fontSize: '10px', color: '#64748b', background: '#f8fafc', padding: '6px', borderRadius: '4px', marginTop: '4px', borderLeft: '2px solid #cbd5e0', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                          {ev.details}
                        </div>
                      )}
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '11px', color: '#4b5563' }}>
                      {ev.device_id || 'system'}
                    </td>
                    <td style={{ fontSize: '12px', fontWeight: 600 }}>
                      {ev.officer_id || 'system'}
                    </td>
                    <td>
                      <span className="badge badge-gray" style={{ fontSize: '10px' }}>
                        Cycle {ev.cycle}
                      </span>
                    </td>
                  </tr>
                );
              }) : (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '30px', color: '#718096' }}>
                    No security events matched your active filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
