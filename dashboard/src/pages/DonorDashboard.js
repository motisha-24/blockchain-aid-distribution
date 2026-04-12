// ================================================================
//  DonorDashboard.js — Donor Transparency View
//  Shows real-time fund and aid utilisation
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip,
         BarChart, Bar, XAxis, YAxis,
         CartesianGrid, Legend, ResponsiveContainer } from 'recharts';
import StatCard from '../components/StatCard';
import { getStats, getSMSLog } from '../services/api';

const COLORS = [
  '#1a2d5a','#38a169','#d69e2e',
  '#e53e3e','#805ad5','#3182ce','#dd6b20'
];

export default function DonorDashboard() {
  const [stats,  setStats]  = useState({});
  const [smsLog, setSmsLog] = useState([]);

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
    fetchData();
    const interval = setInterval(fetchData, 15000);
    return () => clearInterval(interval);
  }, []);

  const fetchData = async () => {
    try {
      const [s, sms] = await Promise.all([
        getStats(), getSMSLog()
      ]);
      setStats(s.data);
      setSmsLog(sms.data.sms_log || []);
    } catch {}
  };

  // Build aid type distribution from stats data
  const aidTypeData = Array.isArray(stats.aid_type_breakdown)
    ? stats.aid_type_breakdown.map(entry => {
        if (typeof entry === 'string') {
          const match = entry.match(/(\d+)\s+(\w+)\s+of\s+(\w+)/);
          return match ? {
            name: match[3],
            value: parseInt(match[1], 10)
          } : null;
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

  // Build recent activity from stats data
  const recentActivity = Array.isArray(stats.recent_activity)
    ? stats.recent_activity.map((entry, i) => {
        if (typeof entry === 'string') {
          const match = entry.match(/(\d+)\s+(\w+)\s+of\s+(\w+)/);
          return match ? {
            name: match[3],
            amount: parseInt(match[1], 10)
          } : null;
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

  return (
    <div className="page">
      <div className="page-title">Donor Dashboard — Transparency</div>
      <div className="page-subtitle">
        Real-time view of all aid distributed on the blockchain
      </div>

      {/* Stats */}
      <div className="stats-grid">
        <StatCard label="Total Distributions"
          value={stats.total_transactions}
          color="#1a2d5a" icon="📦" sub="All aid types"/>
        <StatCard label="Beneficiaries Served"
          value={stats.total_beneficiaries}
          color="#38a169" icon="👥" sub="Unique individuals"/>
        <StatCard label="Current Cycle"
          value={stats.current_cycle}
          color="#d69e2e" icon="🔄" sub="Distribution round"/>
        <StatCard label="SMS Notifications"
          value={smsLog.length}
          color="#805ad5" icon="💬" sub="Beneficiaries notified"/>
        <StatCard label="Blockchain Status"
          value={stats.blockchain_online ? 'Verified' : 'Offline'}
          color={stats.blockchain_online ? '#38a169' : '#e53e3e'}
          icon="✅" sub="Immutable record"/>
      </div>

      {/* Charts */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'20px' }}>

        {/* Pie chart — aid type breakdown */}
        <div className="card">
          <h3>📊 Aid Distribution by Type</h3>
          {aidTypeData.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <PieChart>
                <Pie data={aidTypeData} dataKey="value"
                  nameKey="name" cx="50%" cy="50%" outerRadius={90} label>
                  {aidTypeData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]}/>
                  ))}
                </Pie>
                <Tooltip/>
                <Legend/>
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign:'center', color:'#a0aec0', padding:'40px' }}>
              No distribution data yet
            </div>
          )}
        </div>

        {/* Bar chart — recent activity */}
        <div className="card">
          <h3>📈 Recent Distribution Activity</h3>
          {recentActivity.length > 0 ? (
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={recentActivity}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0"/>
                <XAxis dataKey="name" tick={{ fontSize: 11 }}/>
                <YAxis tick={{ fontSize: 11 }}/>
                <Tooltip/>
                <Legend/>
                <Bar dataKey="amount" fill="#1a2d5a" radius={[4,4,0,0]}/>
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div style={{ textAlign:'center', color:'#a0aec0', padding:'40px' }}>
              No activity data yet
            </div>
          )}
        </div>
      </div>

      {/* SMS notification log */}
      <div className="card">
        <h3>💬 Beneficiary Notification Log (SMS)</h3>
        <div style={{
          background:'#1a1a2e', borderRadius:'8px',
          padding:'16px', maxHeight:'300px', overflowY:'auto'
        }}>
          {smsLog.length > 0 ? (
            [...smsLog].reverse().map((entry, i) => (
              <div key={i} style={{
                fontFamily:'monospace', fontSize:'12px',
                color:'#7dd3a8', padding:'4px 0',
                borderBottom:'1px solid #2a2a4a'
              }}>
                {normaliseLogEntry(entry).message}
              </div>
            ))
          ) : (
            <div style={{ color:'#4a5568', textAlign:'center' }}>
              No SMS notifications sent yet
            </div>
          )}
        </div>
      </div>

      {/* Transparency note */}
      <div style={{
        background:'#ebf8ff', border:'1px solid #bee3f8',
        borderRadius:'8px', padding:'16px',
        fontSize:'12px', color:'#2a69ac'
      }}>
        <strong>🔒 Blockchain Transparency Guarantee:</strong> Every
        transaction shown on this dashboard is permanently recorded on the
        Ethereum blockchain. Records cannot be altered, deleted, or tampered
        with by any party — including the NGO. Each distribution is linked to
        a unique transaction hash that can be independently verified.
      </div>
    </div>
  );
}
