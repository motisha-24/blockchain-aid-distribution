// ================================================================
//  Navbar.js — Top Navigation Bar with Profile and Logout
//  Enhanced with Mobile Menu and Professional UI — May 2026
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { getStats } from '../services/api';
import ProfileModal from './ProfileModal';
import '../navbar.css';

export default function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const [online, setOnline] = useState(false);
  const [cycle, setCycle] = useState(null);
  const [showProfile, setShowProfile] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showMobileMenu, setShowMobileMenu] = useState(false);
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
      {/* Main Navbar */}
      <nav className="navbar">
        <div className="navbar-container">
          {/* Brand */}
          <div className="navbar-brand">
            <div className="navbar-brand-logo">AC</div>
            <div>
              <p className="navbar-brand-text-primary">AidChain Zimbabwe</p>
              <p className="navbar-brand-text-secondary">Transparent aid operations and role-based oversight</p>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="navbar-menu">
            {visibleLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`navbar-link ${location.pathname === link.path ? 'active' : ''}`}
                onClick={() => setShowMobileMenu(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right Section */}
          <div className="navbar-right">
            {typeof cycle === 'number' && (
              <div className="navbar-status">
                🔄 Cycle {cycle}
              </div>
            )}

            <div className="navbar-online-indicator" title={online ? 'Blockchain On-Chain' : 'Syncing'}>
              <span className={`navbar-online-dot ${online ? 'online' : 'offline'}`} />
              {online ? 'On-Chain' : 'Syncing'}
            </div>

            {/* Theme Toggle */}
            <button 
              onClick={toggleTheme}
              className="navbar-theme-toggle"
              title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
              aria-label="Toggle theme"
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>

            {/* Profile Dropdown */}
            <div className={`navbar-profile ${showDropdown ? 'open' : ''}`}>
              <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="navbar-profile-toggle"
                aria-label="User menu"
                aria-expanded={showDropdown}
              >
                <div className="navbar-profile-avatar">{initials || 'U'}</div>
                <div className="navbar-profile-info">
                  <div className="navbar-profile-name">{name || 'User'}</div>
                  {role && (
                    <span className="navbar-profile-role" style={{
                      background: badge.bg,
                      color: badge.color
                    }}>
                      {role}
                    </span>
                  )}
                </div>
                <span className="navbar-profile-chevron">{showDropdown ? '▲' : '▼'}</span>
              </button>

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
                    aria-hidden="true"
                  />
                  <div className="navbar-dropdown">
                    <div className="navbar-dropdown-header">
                      <div className="navbar-dropdown-label">Logged in as</div>
                      <div className="navbar-dropdown-user">{name || 'User'}</div>
                    </div>
                    
                    <button 
                      onClick={() => {
                        setShowProfile(true);
                        setShowDropdown(false);
                      }}
                      className="navbar-dropdown-item"
                    >
                      👤 Manage Profile
                    </button>
                    
                    <button 
                      onClick={handleLogout}
                      className="navbar-dropdown-item logout"
                    >
                      🚪 Log Out
                    </button>
                  </div>
                </>
              )}
            </div>

            {/* Mobile Menu Toggle */}
            <button 
              onClick={() => setShowMobileMenu(!showMobileMenu)}
              className="navbar-mobile-toggle"
              aria-label="Toggle menu"
              aria-expanded={showMobileMenu}
            >
              ☰
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        {showMobileMenu && (
          <div 
            className="navbar-mobile-menu-backdrop"
            onClick={() => setShowMobileMenu(false)}
            aria-hidden="true"
          />
        )}
        <div className={`navbar-mobile-menu ${showMobileMenu ? 'open' : ''}`}>
          <div className="navbar-mobile-menu-section">
            <div className="navbar-mobile-menu-section-title">Navigation</div>
            {visibleLinks.map(link => (
              <Link
                key={link.path}
                to={link.path}
                className={`navbar-mobile-menu-link ${location.pathname === link.path ? 'active' : ''}`}
                onClick={() => setShowMobileMenu(false)}
              >
                {link.label}
              </Link>
            ))}
          </div>

          <div className="navbar-mobile-menu-section">
            <div className="navbar-mobile-menu-section-title">Account</div>
            <button 
              onClick={() => {
                setShowProfile(true);
                setShowMobileMenu(false);
              }}
              style={{
                width: '100%',
                padding: 'var(--space-md) var(--space-base)',
                background: 'none',
                border: 'none',
                color: '#f8fafc',
                textAlign: 'left',
                fontSize: 'var(--font-size-14)',
                fontWeight: 'var(--font-weight-bold)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                transition: 'all var(--transition-base)',
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
                padding: 'var(--space-md) var(--space-base)',
                background: 'none',
                border: 'none',
                color: '#f87171',
                textAlign: 'left',
                fontSize: 'var(--font-size-14)',
                fontWeight: 'var(--font-weight-bold)',
                borderRadius: 'var(--radius-md)',
                cursor: 'pointer',
                marginTop: 'var(--space-xs)',
                transition: 'all var(--transition-base)',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              🚪 Log Out
            </button>
          </div>
        </div>
      </nav>

      {showProfile && <ProfileModal onClose={() => setShowProfile(false)} />}
    </>
  );
}
