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
  const [showDropdown, setShowDropdown] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  useEffect(() => {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

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
    { path: '/auditor', label: 'Audit Desk', roles: ['ADMIN', 'AUDITOR'] },
    { path: '/security', label: '🛡️ Threat Intel', roles: ['ADMIN', 'AUDITOR'] }
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
                    : '1px solid transparent',
                  transition: 'all 0.2s ease-in-out'
                }}
                onMouseEnter={(e) => {
                  if (location.pathname !== link.path) {
                    e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                  }
                }}
                onMouseLeave={(e) => {
                  if (location.pathname !== link.path) {
                    e.currentTarget.style.background = 'transparent';
                  }
                }}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap',
            justifyContent: 'flex-end'
          }}>
            {typeof cycle === 'number' && (
              <div style={{
                color: '#fef3c7',
                fontSize: '12px',
                fontWeight: 700,
                padding: '8px 14px',
                borderRadius: '999px',
                background: 'rgba(245, 158, 11, 0.12)',
                border: '1px solid rgba(245, 158, 11, 0.18)'
              }}>
                🔄 Cycle {cycle}
              </div>
            )}

            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '8px 14px',
              borderRadius: '999px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.1)',
              color: '#dbeafe',
              fontSize: '12px',
              fontWeight: 700
            }}>
              <span style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                background: online ? '#22c55e' : '#ef4444',
                boxShadow: online ? '0 0 8px rgba(34,197,94,0.6)' : '0 0 8px rgba(239,68,68,0.6)'
              }} />
              {online ? 'On-Chain' : 'Syncing'}
            </div>

            {/* Theme Toggle Button */}
            <button 
              onClick={toggleTheme}
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.1)',
                cursor: 'pointer',
                display: 'grid',
                placeItems: 'center',
                color: '#f8fafc',
                fontSize: '14px',
                transition: 'all 0.2s ease',
                userSelect: 'none',
                padding: 0
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.14)';
                e.currentTarget.style.transform = 'scale(1.05)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.06)';
                e.currentTarget.style.transform = 'scale(1)';
              }}
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Profile Dropdown */}
            <div style={{ position: 'relative' }}>
              <div 
                onClick={() => setShowDropdown(!showDropdown)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  padding: '5px 12px 5px 6px',
                  borderRadius: '999px',
                  background: showDropdown ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                  userSelect: 'none',
                  transition: 'all 0.2s ease'
                }}
              >
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
                <div style={{ lineHeight: 1.15, display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                  <div style={{ color: '#f8fafc', fontSize: '12px', fontWeight: 700 }}>
                    {name || 'User'}
                  </div>
                  {role && (
                    <span style={{
                      marginTop: '2px',
                      background: badge.bg,
                      color: badge.color,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      fontSize: '9px',
                      fontWeight: 800,
                      letterSpacing: '0.05em'
                    }}>
                      {role}
                    </span>
                  )}
                </div>
                <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '9px', marginLeft: '2px' }}>
                  {showDropdown ? '▲' : '▼'}
                </span>
              </div>

              {showDropdown && (
                <>
                  <div 
                    onClick={() => setShowDropdown(false)}
                    style={{
                      position: 'fixed',
                      top: 0,
                      left: 0,
                      width: '100vw',
                      height: '100vh',
                      zIndex: 199
                    }}
                  />
                  <div style={{
                    position: 'absolute',
                    right: 0,
                    top: '44px',
                    width: '210px',
                    background: 'rgba(15, 23, 42, 0.95)',
                    backdropFilter: 'blur(16px)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 12px 40px rgba(0,0,0,0.4)',
                    padding: '6px',
                    zIndex: 200,
                    animation: 'fadeIn 0.15s ease-out'
                  }}>
                    <div style={{
                      padding: '8px 12px',
                      borderBottom: '1px solid rgba(255,255,255,0.06)',
                      marginBottom: '4px'
                    }}>
                      <div style={{ color: 'rgba(226,232,240,0.4)', fontSize: '9px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Logged in as
                      </div>
                      <div style={{ color: '#fff', fontSize: '13px', fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginTop: '2px' }}>
                        {name || 'User'}
                      </div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setShowProfile(true);
                        setShowDropdown(false);
                      }}
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        color: '#f8fafc',
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      👤 Manage Profile
                    </button>
                    
                    <button 
                      onClick={handleLogout}
                      style={{
                        width: '100%',
                        background: 'none',
                        border: 'none',
                        color: '#f87171',
                        padding: '8px 12px',
                        textAlign: 'left',
                        fontSize: '12px',
                        fontWeight: 700,
                        borderRadius: '6px',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        transition: 'background 0.2s'
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
                    >
                      🚪 Log Out
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
}
