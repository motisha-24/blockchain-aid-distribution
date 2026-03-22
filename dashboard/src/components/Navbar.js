// ================================================================
//  Navbar.js — Top Navigation Bar with Profile and Logout
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getStats } from '../services/api';
import ProfileModal from './ProfileModal';

export default function Navbar() {
  const location    = useLocation();
  const navigate    = useNavigate();
  const [online,      setOnline]      = useState(false);
  const [cycle,       setCycle]       = useState(null);
  const [showProfile, setShowProfile] = useState(false);

  // Get logged-in user info from localStorage
  const role = localStorage.getItem('role');
  const name = localStorage.getItem('name');

  useEffect(() => {
    getStats()
      .then(res => {
        setOnline(res.data.blockchain_online);
        setCycle(res.data.current_cycle);
      })
      .catch(() => setOnline(false));

    const interval = setInterval(() => {
      getStats()
        .then(res => {
          setOnline(res.data.blockchain_online);
          setCycle(res.data.current_cycle);
        })
        .catch(() => setOnline(false));
    }, 15000);

    return () => clearInterval(interval);
  }, []);

  // Each link specifies which roles can see it
  const allLinks = [
    { path: '/admin',   label: '⚙️ Admin',   roles: ['ADMIN'] },
    { path: '/ngo',     label: '🏢 NGO',     roles: ['ADMIN', 'NGO'] },
    { path: '/donor',   label: '💰 Donor',   roles: ['ADMIN', 'DONOR'] },
    { path: '/auditor', label: '🔍 Auditor', roles: ['ADMIN', 'AUDITOR'] },
  ];

  const visibleLinks = allLinks.filter(l => l.roles.includes(role));

  const handleLogout = () => {
    localStorage.clear();
    navigate('/login');
  };

  const roleBadge = {
    ADMIN  : { bg: '#e9d8fd', color: '#553c9a' },
    NGO    : { bg: '#c6f6d5', color: '#276749' },
    DONOR  : { bg: '#fefcbf', color: '#744210' },
    AUDITOR: { bg: '#fed7d7', color: '#9b2c2c' },
  };

  const badge = roleBadge[role] || { bg: '#e2e8f0', color: '#4a5568' };

  const btnStyle = {
    background  : 'rgba(255,255,255,0.1)',
    border      : '1px solid rgba(255,255,255,0.2)',
    color       : '#fff',
    padding     : '5px 14px',
    borderRadius: '6px',
    fontSize    : '12px',
    cursor      : 'pointer',
    fontWeight  : 600,
    transition  : 'background 0.2s'
  };

  return (
    <>
      <nav style={{
        background    : '#1a2d5a',
        padding       : '0 24px',
        display       : 'flex',
        alignItems    : 'center',
        justifyContent: 'space-between',
        height        : '56px',
        boxShadow     : '0 2px 8px rgba(0,0,0,0.2)',
        position      : 'sticky',
        top           : 0,
        zIndex        : 100
      }}>

        {/* ── Logo ── */}
        <div style={{
          color        : '#fff',
          fontWeight   : 800,
          fontSize     : '15px',
          letterSpacing: '-0.01em'
        }}>
          🛡️ AidChain Zimbabwe
        </div>

        {/* ── Nav Links ── */}
        <div style={{ display: 'flex', gap: '4px' }}>
          {visibleLinks.map(l => (
            <Link
              key={l.path}
              to={l.path}
              style={{
                padding       : '6px 16px',
                borderRadius  : '6px',
                textDecoration: 'none',
                fontSize      : '13px',
                fontWeight    : 600,
                background    : location.pathname === l.path
                  ? 'rgba(255,255,255,0.2)'
                  : 'transparent',
                color     : '#fff',
                transition: 'background 0.2s'
              }}
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* ── Right side ── */}
        <div style={{
          display   : 'flex',
          alignItems: 'center',
          gap       : '14px',
          fontSize  : '12px'
        }}>

          {/* Cycle indicator */}
          {cycle && (
            <span style={{
              color     : '#f0b840',
              fontWeight: 700,
              fontSize  : '12px'
            }}>
              Cycle {cycle}
            </span>
          )}

          {/* Blockchain status */}
          <span style={{
            display   : 'flex',
            alignItems: 'center',
            gap       : '5px'
          }}>
            <span style={{
              width       : '8px',
              height      : '8px',
              borderRadius: '50%',
              background  : online ? '#38a169' : '#e53e3e',
              display     : 'inline-block'
            }}/>
            <span style={{ color: '#a0aec0' }}>
              {online ? 'Online' : 'Offline'}
            </span>
          </span>

          {/* User name */}
          {name && (
            <span style={{ color: '#e2e8f0', fontSize: '12px' }}>
              {name}
            </span>
          )}

          {/* Role badge */}
          {role && (
            <span style={{
              background   : badge.bg,
              color        : badge.color,
              padding      : '2px 10px',
              borderRadius : '20px',
              fontSize     : '10px',
              fontWeight   : 700,
              letterSpacing: '0.06em'
            }}>
              {role}
            </span>
          )}

          {/* Profile button */}
          <button
            onClick={() => setShowProfile(true)}
            style={btnStyle}
            onMouseEnter={e =>
              e.target.style.background = 'rgba(255,255,255,0.2)'
            }
            onMouseLeave={e =>
              e.target.style.background = 'rgba(255,255,255,0.1)'
            }
          >
            👤 Profile
          </button>

          {/* Logout button */}
          <button
            onClick={handleLogout}
            style={btnStyle}
            onMouseEnter={e =>
              e.target.style.background = 'rgba(255,255,255,0.2)'
            }
            onMouseLeave={e =>
              e.target.style.background = 'rgba(255,255,255,0.1)'
            }
          >
            Logout
          </button>

        </div>
      </nav>

      {/* Profile Modal */}
      {showProfile && (
        <ProfileModal onClose={() => setShowProfile(false)}/>
      )}
    </>
  );
}