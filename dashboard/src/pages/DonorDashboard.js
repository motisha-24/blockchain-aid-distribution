// ================================================================
//  DonorDashboard.js — Donor Transparency View
//  Shows real-time fund and aid utilisation
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState, useEffect } from 'react';
import {
  PieChart, Pie, Cell, Tooltip,
  BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Legend, ResponsiveContainer
} from 'recharts';
import DashboardHero from '../components/DashboardHero';
import StatCard from '../components/StatCard';
import { getStats, getSMSLog, getHardwareEvents } from '../services/api';

const COLORS = [
  '#1a2d5a', '#38a169', '#d69e2e',
  '#e53e3e', '#805ad5', '#3182ce', '#dd6b20'
];

export default function DonorDashboard() {
  const [stats, setStats] = useState({});
  const [smsLog, setSmsLog] = useState([]);
  const [hardwareEvents, setHardwareEvents] = useState([]);

  const normaliseLogEntry = (entry) => {
    if (typeof entry === 'string') {
      const match = entry.match(/(\d+)\s+(\w+)\s+of\s+(\w+)/);
      return {
        amount: match ? parseInt(match[1], 10) : 0,
        aidType: match ? match[3] : 'UNKNOWN',
        message: entry
      };
    }

    if (entry && typeof entry === 'object') {
      return {
        amount: Number(entry.amount) || 0,
        aidType: entry.aid_type || 'UNKNOWN',
        message: entry.message || JSON.stringify(entry)
      };
    }

    return {
      amount: 0,
      aidType: 'UNKNOWN',
      message: String(entry ?? '')
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [s, sms, he] = await Promise.all([getStats(), getSMSLog(), getHardwareEvents()]);
        setStats(s.data);
        setSmsLog(sms.data.sms_log || []);
        setHardwareEvents(he.data.events || []);
      } catch {}
    };

    fetchData();
    const interval = setInterval(fetchData, 5000); // Poll every 5 seconds for live updates
    return () => clearInterval(interval);
  }, []);

  const getLiveDistributionStats = () => {
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = hardwareEvents.filter(event => event.timestamp.startsWith(today));
    
    let beneficiariesServed = 0;
    const aidDistributed = {};
    let pending = 0;

    todayEvents.forEach(event => {
      if (event.event_type === 'AID_DISTRIBUTED') {
        beneficiariesServed++;
        const match = event.message.match(/(\w+)\s+(\d+)\s+(\w+)\s+distributed/);
        if (match) {
          const aidType = match[1];
          const amount = parseInt(match[2]);
          const unit = match[3];
          const key = `${aidType} ${unit}`;
          aidDistributed[key] = (aidDistributed[key] || 0) + amount;
        }
      } else if (event.event_type === 'DUPLICATE_BLOCKED') {
        // Count as served but not new distribution
        beneficiariesServed++;
      }
    });

    // Count pending enrollments as pending
    pending = hardwareEvents.filter(event => 
      event.event_type.includes('PENDING') || event.event_type.includes('ENROLLING')
    ).length;

    return { beneficiariesServed, aidDistributed, pending };
  };

  const liveStats = getLiveDistributionStats();

  const aidTypeData = Array.isArray(stats.aid_type_breakdown)
    ? stats.aid_type_breakdown.map(entry => {
        if (typeof entry === 'string') {
          const match = entry.match(/(\d+)\s+(\w+)\s+of\s+(\w+)/);
          return match ? { name: match[3], value: parseInt(match[1], 10) } : null;
        }
        if (entry && typeof entry === 'object' && entry.name && entry.value) {
          return {
            name: entry.name,
            value: parseInt(entry.value, 10)
          };
        }
        return null;
      }).filter(Boolean)
    : [];

  const recentActivity = Array.isArray(stats.recent_activity)
    ? stats.recent_activity.map(entry => {
        if (typeof entry === 'string') {
          const match = entry.match(/(\d+)\s+(\w+)\s+of\s+(\w+)/);
          return match ? { name: match[3], amount: parseInt(match[1], 10) } : null;
        }
        if (entry && typeof entry === 'object' && entry.name && entry.amount) {
          return {
            name: entry.name,
            amount: parseInt(entry.amount, 10)
          };
        }
        return null;
      }).filter(Boolean)
    : [];

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="custom-tooltip">
          {label && <div className="custom-tooltip-label">{label}</div>}
          {payload.map((entry, index) => (
            <div key={`item-${index}`} className="custom-tooltip-value" style={{ color: entry.color || '#4f46e5' }}>
              {entry.name}: {entry.value}
            </div>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="page">
      <DashboardHero
        eyebrow="Donor Transparency"
        title="Funding visibility with live distribution oversight"
        subtitle="Review how aid is distributed, confirm beneficiary reach, and follow the reporting trail through a cleaner transparency-first dashboard."
        badges={[
          `${stats.total_transactions || 0} recorded distributions`,
          `${stats.total_beneficiaries || 0} beneficiaries served`,
          stats.blockchain_online ? 'Blockchain verified' : 'Blockchain unavailable'
        ]}
      />

      <div className="stats-grid">
        <StatCard label="Total Distributions" value={stats.total_transactions} color="#1a2d5a" icon="Records" sub="All aid types" />
        <StatCard label="Beneficiaries Served" value={stats.total_beneficiaries} color="#38a169" icon="Reach" sub="Unique individuals" />
        <StatCard label="Current Cycle" value={stats.current_cycle} color="#d69e2e" icon="Cycle" sub="Distribution round" />
        <StatCard label="SMS Notifications" value={smsLog.length} color="#805ad5" icon="SMS" sub="Beneficiaries notified" />
        <StatCard label="Blockchain Status" value={stats.blockchain_online ? 'Verified' : 'Offline'} color={stats.blockchain_online ? '#38a169' : '#e53e3e'} icon="Chain" sub="Immutable record" />
      </div>

      {/* ── Live Distribution Tracking ── */}
      <div className="card glass-card">
        <h3>📊 Live Distribution Tracking</h3>
        <div style={{ fontSize: '14px', color: '#4a5568', marginBottom: '16px' }}>
          Real-time overview of today's aid distribution progress.
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#1a2d5a' }}>
              {liveStats.beneficiariesServed}
            </div>
            <div style={{ fontSize: '14px', color: '#718096', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Beneficiaries served today
            </div>
          </div>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <div style={{ fontSize: '24px', fontWeight: '800', color: '#38a169', display: 'flex', alignItems: 'center', minHeight: '48px' }}>
              {Object.keys(liveStats.aidDistributed).length > 0 ? 
                Object.entries(liveStats.aidDistributed).map(([key, amount]) => `${amount} ${key}`).join(', ') : 
                '0 items'
              }
            </div>
            <div style={{ fontSize: '14px', color: '#718096', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Aid distributed today
            </div>
          </div>
          <div style={{ flex: '1', minWidth: '200px' }}>
            <div style={{ fontSize: '32px', fontWeight: '800', color: '#d69e2e' }}>
              {liveStats.pending}
            </div>
            <div style={{ fontSize: '14px', color: '#718096', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Pending operations
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '20px' }}>
        <div className="card">
          <h3>Aid Distribution by Type</h3>
          {aidTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <PieChart>
                <Pie data={aidTypeData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={94} label>
                  {aidTypeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} style={{ outline: 'none' }} />
                  ))}
                </Pie>
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0,0,0,0.02)' }} />
                <Legend iconType="circle" wrapperStyle={{ paddingTop: '20px' }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '46px 20px' }}>
              No distribution data yet
            </div>
          )}
        </div>

        <div className="card">
          <h3>Recent Distribution Activity</h3>
          {recentActivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={recentActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                <XAxis dataKey="name" tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={{ stroke: '#e2e8f0' }} />
                <YAxis tick={{ fontSize: 11, fill: '#64748b' }} tickLine={false} axisLine={false} />
                <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(79, 70, 229, 0.05)' }} />
                <Bar dataKey="amount" fill="url(#colorBar)" radius={[6, 6, 0, 0]}>
                  {recentActivity.map((_, i) => (
                    <Cell key={i} fill={`url(#colorBar${i % 2})`} />
                  ))}
                </Bar>
                <defs>
                  <linearGradient id="colorBar0" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#4f46e5" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#312e81" stopOpacity={1}/>
                  </linearGradient>
                  <linearGradient id="colorBar1" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={1}/>
                    <stop offset="100%" stopColor="#064e3b" stopOpacity={1}/>
                  </linearGradient>
                </defs>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign: 'center', color: '#94a3b8', padding: '46px 20px' }}>
              No activity data yet
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
        <h3 style={{ padding: '22px 22px 0', borderBottom: 'none', marginBottom: '12px' }}>Beneficiary Notification Log</h3>
        <div className="terminal-log-container" style={{ borderRadius: '0 0 18px 18px', border: 'none', borderTop: '1px solid #1e293b' }}>
          {smsLog.length > 0 ? (
            [...smsLog].reverse().map((entry, i) => (
              <div key={i} className="terminal-line">
                <span>{normaliseLogEntry(entry).message}</span>
              </div>
            ))
          ) : (
            <div style={{ color: '#475569', textAlign: 'center', padding: '24px 0', fontFamily: 'monospace' }}>
              > Waiting for outgoing SMS traffic... <span className="terminal-cursor"></span>
            </div>
          )}
          {smsLog.length > 0 && (
            <div className="terminal-line" style={{ borderBottom: 'none' }}>
              <span className="terminal-cursor"></span>
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ background: 'linear-gradient(135deg, #eff6ff 0%, #e0f2fe 100%)', border: '1px solid #bae6fd' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '24px' }}>🛡️</span>
          <h3 style={{ margin: 0, padding: 0, border: 'none', color: '#1e3a8a' }}>Transparency Commitment</h3>
        </div>
        <div style={{ fontSize: '14px', color: '#1e3a8a', lineHeight: 1.8, opacity: 0.9 }}>
          Every distribution displayed in this view is permanently anchored to an auditable blockchain ledger, helping donors monitor delivery performance and strengthen operational confidence.
        </div>
      </div>
    </div>
  );
}
