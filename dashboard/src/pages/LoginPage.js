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

  const validateForm = () => {
    const errs = {};

    if (!form.username.trim()) {
      errs.username = 'Username is required';
    } else if (form.username.trim().length < 3) {
      errs.username = 'Username must be at least 3 characters';
    } else if (form.username.trim().length > 50) {
      errs.username = 'Username cannot exceed 50 characters';
    }

    if (!form.password) {
      errs.password = 'Password is required';
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
    border: `1.5px solid ${hasError ? '#e53e3e' : '#e2e8f0'}`,
    borderRadius: '8px',
    fontSize: '14px',
    outline: 'none',
    background: hasError ? '#fff5f5' : '#f7fafc',
    color: '#2d3748',
    transition: 'border 0.2s'
  });

  const errStyle = {
    fontSize: '11px',
    color: '#e53e3e',
    marginTop: '4px',
    fontWeight: 500
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1a2d5a 0%, #0a1628 100%)',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '20px'
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '16px',
          padding: '48px 40px',
          width: '100%',
          maxWidth: '420px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.3)'
        }}>
          <div style={{ textAlign: 'center', marginBottom: '32px' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>Shield Access</div>
            <h1 style={{
              fontSize: '22px',
              fontWeight: 800,
              color: '#1a2d5a',
              marginBottom: '4px'
            }}>
              AidChain Zimbabwe
            </h1>
            <p style={{ fontSize: '13px', color: '#718096' }}>
              Blockchain Aid Distribution System
            </p>
            <p style={{ fontSize: '11px', color: '#a0aec0', marginTop: '4px' }}>
              Secure access for administrators, NGO staff, donors, and auditors
            </p>
          </div>

          {error && (
            <div style={{
              background: '#fed7d7',
              color: '#9b2c2c',
              padding: '10px 14px',
              borderRadius: '7px',
              fontSize: '13px',
              marginBottom: '16px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}>
              <span>Warning</span> {error}
            </div>
          )}

          <div style={{ marginBottom: '16px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 700,
              color: '#4a5568',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '6px'
            }}>
              Username
            </label>
            <input
              type="text"
              placeholder="Enter your username"
              value={form.username}
              onChange={e => {
                setForm({ ...form, username: e.target.value });
                setErrors({ ...errors, username: '' });
                setError('');
              }}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              style={inputStyle(errors.username)}
              autoComplete="username"
            />
            {errors.username && <div style={errStyle}>Warning {errors.username}</div>}
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '11px',
              fontWeight: 700,
              color: '#4a5568',
              textTransform: 'uppercase',
              letterSpacing: '0.06em',
              marginBottom: '6px'
            }}>
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPass ? 'text' : 'password'}
                placeholder="Enter your password"
                value={form.password}
                onChange={e => {
                  setForm({ ...form, password: e.target.value });
                  setErrors({ ...errors, password: '' });
                  setError('');
                }}
                onKeyDown={e => e.key === 'Enter' && handleLogin()}
                style={{ ...inputStyle(errors.password), paddingRight: '44px' }}
                autoComplete="current-password"
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
                  fontSize: '12px',
                  color: '#475569',
                  padding: '2px'
                }}
                title={showPass ? 'Hide password' : 'Show password'}
              >
                {showPass ? 'Hide' : 'Show'}
              </button>
            </div>
            {errors.password && <div style={errStyle}>Warning {errors.password}</div>}
          </div>

          <button
            onClick={handleLogin}
            disabled={loading}
            style={{
              width: '100%',
              padding: '13px',
              background: loading ? '#a0aec0' : '#1a2d5a',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontSize: '14px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'background 0.2s'
            }}
          >
            {loading ? 'Logging in...' : 'Login'}
          </button>

          <div style={{
            marginTop: '14px',
            textAlign: 'center',
            fontSize: '12px'
          }}>
            <Link
              to="/recover"
              style={{
                color: '#1d4ed8',
                textDecoration: 'none',
                fontWeight: 700
              }}
            >
              Forgot username or password?
            </Link>
          </div>

          <div style={{
            marginTop: '24px',
            textAlign: 'center',
            fontSize: '11px',
            color: '#a0aec0',
            padding: '12px',
            background: '#f7fafc',
            borderRadius: '8px',
            border: '1px solid #e2e8f0'
          }}>
            Access is restricted to authorised personnel only.
            <br />
            Use account recovery or contact the system administrator for assistance.
          </div>
        </div>
      </div>
      <Footer />
    </div>
  );
}
