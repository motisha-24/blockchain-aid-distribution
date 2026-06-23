// ================================================================
//  LoginPage.js — Secure Login Portal
//  Updated with recovery access and shared footer
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import Footer from '../components/Footer';
import { loginUser } from '../services/api';

export default function LoginPage() {
  const navigate  = useNavigate();
  const [form,    setForm]    = useState({ username: '', password: '' });
  const [errors,  setErrors]  = useState({});
  const [error,   setError]   = useState('');
  const [loading, setLoading] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [theme, setTheme] = useState(localStorage.getItem('theme') || 'light');

  React.useEffect(() => {
    document.body.classList.toggle('dark-theme', theme === 'dark');
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  };

  // ── Validation constants ──
  const USERNAME_MIN = 3;
  const USERNAME_MAX = 30;
  const PASSWORD_MIN = 6;
  const PASSWORD_MAX = 128;
  const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/; // alphanumeric + underscore only

  const validateForm = () => {
    const errs = {};
    const trimmedUser = form.username.trim();

    // ── Username validation ──
    if (!trimmedUser) {
      errs.username = 'Username is required';
    } else if (trimmedUser.length < USERNAME_MIN) {
      errs.username = `Username must be at least ${USERNAME_MIN} characters`;
    } else if (trimmedUser.length > USERNAME_MAX) {
      errs.username = `Username cannot exceed ${USERNAME_MAX} characters`;
    } else if (!USERNAME_PATTERN.test(trimmedUser)) {
      errs.username = 'Username may only contain letters, numbers, and underscores';
    }

    // ── Password validation ──
    if (!form.password) {
      errs.password = 'Password is required';
    } else if (form.password.length < PASSWORD_MIN) {
      errs.password = `Password must be at least ${PASSWORD_MIN} characters`;
    } else if (form.password.length > PASSWORD_MAX) {
      errs.password = `Password cannot exceed ${PASSWORD_MAX} characters`;
    }

    return errs;
  };

  const handleLogin = async () => {
    setError('');

    const errs = validateForm();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await loginUser({
        username: form.username.trim(),
        password: form.password
      });

      const { token, role, name, username } = res.data;
      localStorage.setItem('token', token);
      localStorage.setItem('role', role);
      localStorage.setItem('name', name);
      localStorage.setItem('username', username);

      const routes = {
        ADMIN  : '/admin',
        NGO    : '/ngo',
        DONOR  : '/donor',
        AUDITOR: '/auditor'
      };
      navigate(routes[role] || '/login');
    } catch (e) {
      setError(e.response?.data?.error || 'Login failed. Please try again.');
    }
    setLoading(false);
  };

  const inputStyle = (hasError) => ({
    width: '100%',
    padding: '11px 14px',
    border: `1.5px solid ${hasError ? '#ef4444' : 'var(--border-strong)'}`,
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    background: hasError ? 'rgba(239, 68, 68, 0.08)' : 'var(--surface-soft)',
    color: 'var(--ink)',
    transition: 'all 0.2s'
  });

  const errStyle = {
    fontSize: '11px',
    color: '#ef4444',
    marginTop: '4px',
    fontWeight: 600
  };

  const hintStyle = {
    fontSize: '10px',
    color: 'var(--muted)',
    marginTop: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  /** Strip characters that aren't alphanumeric or underscore */
  const sanitizeUsername = (value) => value.replace(/[^a-zA-Z0-9_]/g, '');

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(circle at top left, var(--bg-accent) 0%, var(--bg) 100%)',
      display: 'flex',
      flexDirection: 'column',
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Floating Theme Toggler */}
      <button 
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          width: '38px',
          height: '38px',
          borderRadius: '50%',
          background: 'var(--surface-strong)',
          border: '1px solid var(--border-strong)',
          boxShadow: 'var(--shadow-soft)',
          cursor: 'pointer',
          display: 'grid',
          placeItems: 'center',
          color: 'var(--ink)',
          fontSize: '15px',
          transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 10,
          userSelect: 'none',
          padding: 0
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.transform = 'scale(1.08) rotate(15deg)';
          e.currentTarget.style.background = 'var(--surface)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.transform = 'scale(1) rotate(0deg)';
          e.currentTarget.style.background = 'var(--surface-strong)';
        }}
        title={theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode'}
      >
        {theme === 'dark' ? '☀️' : '🌙'}
      </button>

      {/* ── Cryptographic Blockchain Network Nodes Overlay ── */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'none',
        opacity: 0.55,
        zIndex: 0
      }}>
        <svg width="100%" height="100%" xmlns="http://www.w3.org/2000/svg" style={{ position: 'absolute' }}>
          <defs>
            <radialGradient id="glow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.45" />
              <stop offset="100%" stopColor="#3b82f6" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="line-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.08" />
            </linearGradient>
          </defs>

          {/* Connected Network Edges */}
          <line x1="10%" y1="20%" x2="30%" y2="40%" stroke="url(#line-grad)" strokeWidth="1.5" strokeDasharray="5,5" />
          <line x1="30%" y1="40%" x2="25%" y2="70%" stroke="url(#line-grad)" strokeWidth="1.5" />
          <line x1="30%" y1="40%" x2="50%" y2="30%" stroke="url(#line-grad)" strokeWidth="2" />
          <line x1="50%" y1="30%" x2="70%" y2="50%" stroke="url(#line-grad)" strokeWidth="1.5" strokeDasharray="3,3" />
          <line x1="70%" y1="50%" x2="85%" y2="25%" stroke="url(#line-grad)" strokeWidth="2" />
          <line x1="70%" y1="50%" x2="75%" y2="80%" stroke="url(#line-grad)" strokeWidth="1.5" />
          <line x1="25%" y1="70%" x2="55%" y2="75%" stroke="url(#line-grad)" strokeWidth="2" />
          <line x1="55%" y1="75%" x2="75%" y2="80%" stroke="url(#line-grad)" strokeWidth="1.5" />
          <line x1="50%" y1="30%" x2="55%" y2="75%" stroke="url(#line-grad)" strokeWidth="1.5" />

          {/* Network Nodes (Vertices) */}
          <circle cx="10%" cy="20%" r="25" fill="url(#glow)" />
          <circle cx="10%" cy="20%" r="5" fill="#3b82f6" />
          <circle cx="10%" cy="20%" r="8" fill="none" stroke="#3b82f6" strokeWidth="1" />

          <circle cx="30%" cy="40%" r="35" fill="url(#glow)" />
          <circle cx="30%" cy="40%" r="7" fill="#60a5fa" />
          <circle cx="30%" cy="40%" r="12" fill="none" stroke="#60a5fa" strokeWidth="1" />

          <circle cx="25%" cy="70%" r="30" fill="url(#glow)" />
          <circle cx="25%" cy="70%" r="6" fill="#3b82f6" />

          <circle cx="50%" cy="30%" r="40" fill="url(#glow)" />
          <circle cx="50%" cy="30%" r="8" fill="#10b981" />
          <circle cx="50%" cy="30%" r="14" fill="none" stroke="#10b981" strokeWidth="1" />

          <circle cx="70%" cy="50%" r="35" fill="url(#glow)" />
          <circle cx="70%" cy="50%" r="7" fill="#3b82f6" />

          <circle cx="85%" cy="25%" r="25" fill="url(#glow)" />
          <circle cx="85%" cy="25%" r="5" fill="#60a5fa" />

          <circle cx="75%" cy="80%" r="35" fill="url(#glow)" />
          <circle cx="75%" cy="80%" r="6" fill="#10b981" />

          <circle cx="55%" cy="75%" r="30" fill="url(#glow)" />
          <circle cx="55%" cy="75%" r="6" fill="#3b82f6" />
        </svg>
      </div>

      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px',
        position: 'relative',
        zIndex: 1
      }}>
        <div style={{
          background: 'var(--surface-strong)',
          border: '1px solid var(--border-strong)',
          borderRadius: '20px',
          padding: '48px 40px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: 'var(--shadow)',
          backdropFilter: 'blur(16px)',
          transition: 'all 0.3s ease'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '42px', marginBottom: '12px' }}>🔐</div>
            <h1 style={{
              fontSize: '24px',
              fontWeight: 800,
              color: 'var(--heading)',
              marginBottom: '4px',
              fontFamily: 'Georgia, serif'
            }}>
              AidChain Zimbabwe
            </h1>
            <p style={{ fontSize: '13px', color: 'var(--muted)', fontWeight: 600 }}>
              Decentralized Aid Ledger Portal
            </p>
            <p style={{ fontSize: '11px', color: 'var(--muted)', marginTop: '6px', lineHeights: 1.4 }}>
              Secure authorization panel for system officers, donors, and state auditors
            </p>
          </div>

          {error && (
            <div style={{
              background: 'rgba(239, 68, 68, 0.1)',
              color: '#ef4444',
              padding: '10px 14px',
              borderRadius: '8px',
              fontSize: '13px',
              marginBottom: '18px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              fontWeight: 600
            }}>
              <span>⚠️</span> {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '10px',
              fontWeight: 800,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '6px'
            }}>
              Username
            </label>
            <input
              id="login-username"
              type="text"
              placeholder="Letters, numbers, underscores only"
              value={form.username}
              maxLength={USERNAME_MAX}
              onChange={e => {
                const sanitized = sanitizeUsername(e.target.value);
                setForm({ ...form, username: sanitized });
                setErrors({ ...errors, username: '' });
                setError('');
              }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={inputStyle(errors.username)}
              autoComplete="username"
              aria-describedby="username-hint"
            />
            {errors.username && <div style={errStyle}>⚠️ {errors.username}</div>}
            <div id="username-hint" style={hintStyle}>
              <span>a-z, 0-9, underscore</span>
              <span style={{ color: form.username.trim().length >= USERNAME_MIN ? '#10b981' : 'var(--muted)' }}>
                {form.username.trim().length}/{USERNAME_MAX}
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '10px',
              fontWeight: 800,
              color: 'var(--muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.08em',
              marginBottom: '6px'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                id="login-password"
                type={showPass ? 'text' : 'password'}
                placeholder="Minimum 6 characters"
                value={form.password}
                maxLength={PASSWORD_MAX}
                onChange={e => {
                  setForm({ ...form, password: e.target.value });
                  setErrors({ ...errors, password: '' });
                  setError('');
                }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ ...inputStyle(errors.password), paddingRight: '44px' }}
                autoComplete="current-password"
                aria-describedby="password-hint"
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                style={{
                  position: 'absolute',
                  right: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  fontWeight: 700,
                  color: 'var(--muted)',
                  padding: '2px'
                }}
                title={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? 'HIDE' : 'SHOW'}
              </button>
            </div>
            {errors.password && <div style={errStyle}>⚠️ {errors.password}</div>}
            <div id="password-hint" style={hintStyle}>
              <span>Min {PASSWORD_MIN} characters</span>
              <span style={{ color: form.password.length >= PASSWORD_MIN ? '#10b981' : 'var(--muted)' }}>
                {form.password.length}/{PASSWORD_MAX}
              </span>
            </div>
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              background: loading ? 'var(--muted)' : 'linear-gradient(135deg, var(--brand) 0%, var(--brand-2) 100%)',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s',
              boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)'
            }}
          >
            {loading ? 'Verifying Credentials...' : 'Sign In'}
          </button>

          <div style={{
            marginTop: '16px',
            textAlign: 'center',
            fontSize: '12px'
          }}>
            <Link
              to="/recover"
              style={{
                color: 'var(--brand)',
                textDecoration: 'none',
                fontWeight: 700
              }}
            >
              Recover recovery credentials?
            </Link>
          </div>

          <div style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '11px',
            color: 'var(--muted)',
            padding: '12px',
            background: 'var(--surface-soft)',
            borderRadius: '8px',
            border: '1px solid var(--border)'
          }}>
            Access restricted to EVM-registered cryptographic wallets. Activity is audited on the smart-contract access log.
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
