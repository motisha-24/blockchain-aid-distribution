// ================================================================
//  Navbar.js — Top Navigation Bar with Profile and Logout
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getStats } from '../services/api';
import ProfileModal from './ProfileModal';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [online, setOnline] = useState(false);
  const [cycle, setCycle] = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  const role = localStorage.getItem('role');
  const name = localStorage.getItem('name');

  useEffect(() => {
    const refresh = () => {
      getStats()
        .then(res => {
          setOnline(res.data.blockchain_online);
          setCycle(res.data.current_cycle);
        })
        .catch(() => setOnline(false));
    };

    refresh();
    const interval = setInterval(refresh, 15000);
    return () => clearInterval(interval);
  }, []);

  const allLinks = [
    { path: '/admin', label: 'Admin Console', roles: ['ADMIN'] },
    { path: '/ngo', label: 'Operations', roles: ['ADMIN', 'NGO'] },
    { path: '/donor', label: 'Donor View', roles: ['ADMIN', 'DONOR'] },
    { path: '/auditor', label: 'Audit Desk', roles: ['ADMIN', 'AUDITOR'] }
  ];

  const visibleLinks = allLinks.filter(link => link.roles.includes(role));

  const roleBadge = {
    ADMIN: { bg: '#ede9fe', color: '#5b21b6' },
    NGO: { bg: '#dcfce7', color: '#166534' },
    DONOR: { bg: '#fef3c7', color: '#92400e' },
    AUDITOR: { bg: '#fee2e2', color: '#991b1b' }
  };

  const badge = roleBadge[role] || { bg: '#e2e8f0', color: '#475569' };
  const initials = (name || 'User')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map(part => part[0]?.toUpperCase())
    .join('');

  const buttonStyle = {
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.14)',
    color: '#f8fafc',
    padding: '8px 14px',
    borderRadius: '999px',
    fontSize: '12px',
    cursor: 'pointer',
    fontWeight: 700
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  return (
    <>
      <nav style={{
        position: 'sticky',
        top: 0,
        zIndex: 100,
        backdropFilter: 'blur(14px)',
        background: 'linear-gradient(135deg, rgba(17,40,79,0.96) 0%, rgba(24,59,107,0.95) 52%, rgba(34,83,135,0.95) 100%)',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        boxShadow: '0 10px 25px rgba(15,23,42,0.15)'
      }}>
        <div style={{
          maxWidth: '1400px',
          margin: '0 auto',
          padding: '14px 24px',
          display: 'flex',
          gap: '16px',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            minWidth: '260px'
          }}>
            <div style={{
              width: '42px',
              height: '42px',
              borderRadius: '14px',
              background: 'linear-gradient(135deg, #f8fafc 0%, #dbeafe 100%)',
              color: '#183b6b',
              display: 'grid',
              placeItems: 'center',
              fontWeight: 800,
              fontSize: '14px',
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.6)'
            }}>
              AC
            </div>
            <div>
              <div style={{
                color: '#f8fafc',
                fontWeight: 800,
                fontSize: '16px',
                letterSpacing: '-0.02em'
              }}>
                AidChain Zimbabwe
              </div>
              <div style={{
                color: 'rgba(226,232,240,0.78)',
                fontSize: '12px'
              }}>
                Transparent aid operations and role-based oversight
              </div>
            </div>
          </div>

          <div style={{
            display: 'flex',
            gap: '8px',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            flex: 1
          }}>
            {visibleLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                style={{
                  padding: '9px 16px',
                  borderRadius: '999px',
                  textDecoration: 'none',
                  fontSize: '13px',
                  fontWeight: 700,
                  color: '#f8fafc',
                  background: location.pathname === link.path
                    ? 'rgba(255,255,255,0.16)'
                    : 'transparent',
                  border: location.pathname === link.path
                    ? '1px solid rgba(255,255,255,0.14)'
                    : '1px solid transparent'
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            flexWrap: 'wrap',
            justifyContent: 'flex-end'
          }}>
            {typeof cycle === 'number' && (
              <div style={{
                color: '#fef3c7',
                fontSize: '12px',
                fontWeight: 700,
                padding: '8px 12px',
                borderRadius: '999px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.18)'
              }}>
                Cycle {cycle}
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 12px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: '#dbeafe',
              fontSize: '12px',
              fontWeight: 700
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: online ? '#22c55e' : '#ef4444',
                boxShadow: online ? '0 0 0 5px rgba(34,197,94,0.12)' : '0 0 0 5px rgba(239,68,68,0.12)'
              }} />
              {online ? 'Blockchain Online' : 'Blockchain Offline'}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              padding: '6px 10px 6px 6px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)'
            }}>
              <div style={{
                width: '30px',
                height: '30px',
                borderRadius: '50%',
                background: 'linear-gradient(135deg, #dbeafe 0%, #eff6ff 100%)',
                color: '#183b6b',
                display: 'grid',
                placeItems: 'center',
                fontSize: '12px',
                fontWeight: 800
              }}>
                {initials || 'U'}
              </div>
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ color: '#f8fafc', fontSize: '12px', fontWeight: 700 }}>
                  {name || 'Authenticated User'}
                </div>
                {role && (
                  <span style={{
                    display: 'inline-block',
                    marginTop: '4px',
                    background: badge.bg,
                    color: badge.color,
                    padding: '2px 9px',
                    borderRadius: '999px',
                    fontSize: '10px',
                    fontWeight: 800,
                    letterSpacing: '0.07em'
                  }}>
                    {role}
                  </span>
                )}
              </div>
            </div>

            <button type="button" onClick={() => setShowProfile(true)} style={buttonStyle}>
              Profile
            </button>
            <button type="button" onClick={handleLogout} style={buttonStyle}>
              Logout
            </button>
          </div>
        </div>
      </nav>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
}
