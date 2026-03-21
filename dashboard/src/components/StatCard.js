// ================================================================
//  StatCard.js — Reusable statistics card component
// ================================================================

import React from 'react';

export default function StatCard({ label, value, sub, color, icon }) {
  return (
    <div className="stat-card" style={{ '--color': color }}>
      <div className="label">{icon} {label}</div>
      <div className="value">{value ?? '—'}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}