// ================================================================
//  ProfileModal.js — User Profile and Password Change
//  Author: Motisha John Mafukashe — R2211825P
// ================================================================

import React, { useState } from 'react';
import { changePassword } from '../services/api';

export default function ProfileModal({ onClose }) {
  const username = localStorage.getItem('username');
  const name     = localStorage.getItem('name');
  const role     = localStorage.getItem('role');

  const [form, setForm] = useState({
    current_password : '',
    new_password     : '',
    confirm_password : ''
  });

  const [errors,  setErrors]  = useState({});
  const [alert,   setAlert]   = useState(null);
  const [loading, setLoading] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const roleBadge = {
    ADMIN  : { bg: '#e9d8fd', color: '#553c9a' },
    NGO    : { bg: '#c6f6d5', color: '#276749' },
    DONOR  : { bg: '#fefcbf', color: '#744210' },
    AUDITOR: { bg: '#fed7d7', color: '#9b2c2c' },
  };

  const badge = roleBadge[role] || { bg: '#e2e8f0', color: '#4a5568' };

  const showAlert = (msg, type = 'success') => {
    setAlert({ msg, type });
    setTimeout(() => setAlert(null), 4000);
  };

  // ── Validate password form ─────────────────────────────────
  const validateForm = () => {
    const errs = {};

    if (!form.current_password) {
      errs.current_password = "Current password is required";
    }

    if (!form.new_password) {
      errs.new_password = "New password is required";
    } else if (form.new_password.length < 8) {
      errs.new_password = "Password must be at least 8 characters";
    } else if (!/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/.test(form.new_password)) {
      errs.new_password = "Must include uppercase, lowercase, number, and special character";
    } else if (form.new_password === form.current_password) {
      errs.new_password = "New password must be different from current";
    }

    if (!form.confirm_password) {
      errs.confirm_password = "Please confirm your new password";
    } else if (form.new_password !== form.confirm_password) {
      errs.confirm_password = "Passwords do not match";
    }

    return errs;
  };

  // ── Handle password change ─────────────────────────────────
  const handleChangePassword = async () => {
    const errs = validateForm();
    setErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      await changePassword({
        username        : username,
        current_password: form.current_password,
        new_password    : form.new_password
      });
      showAlert('✓ Password changed successfully');
      setForm({
        current_password: '',
        new_password    : '',
        confirm_password: ''
      });
      setErrors({});
    } catch (e) {
      showAlert(
        e.response?.data?.error || 'Failed to change password',
        'error'
      );
    }
    setLoading(false);
  };

  // ── Input style ────────────────────────────────────────────
  const inputStyle = (hasError) => ({
    width     : '100%',
    padding   : '10px 40px 10px 12px',
    border    : `1px solid ${hasError ? '#e53e3e' : '#e2e8f0'}`,
    borderRadius: '7px',
    fontSize  : '13px',
    background: hasError ? '#fff5f5' : '#f7fafc',
    outline   : 'none',
    color     : '#2d3748'
  });

  const errStyle = {
    fontSize  : '11px',
    color     : '#e53e3e',
    marginTop : '3px',
    fontWeight: 500
  };

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position  : 'fixed', top: 0, left: 0,
          width     : '100vw', height: '100vh',
          background: 'rgba(0,0,0,0.5)',
          zIndex    : 200
        }}
      />

      {/* Modal */}
      <div style={{
        position    : 'fixed',
        top         : '50%',
        left        : '50%',
        transform   : 'translate(-50%, -50%)',
        background  : '#fff',
        borderRadius: '14px',
        padding     : '32px',
        width       : '100%',
        maxWidth    : '440px',
        zIndex      : 201,
        boxShadow   : '0 24px 80px rgba(0,0,0,0.25)'
      }}>

        {/* Header */}
        <div style={{
          display       : 'flex',
          justifyContent: 'space-between',
          alignItems    : 'center',
          marginBottom  : '24px'
        }}>
          <h2 style={{
            fontSize  : '18px',
            fontWeight: 800,
            color     : '#1a2d5a',
            margin    : 0
          }}>
            My Profile
          </h2>
          <button
            onClick={onClose}
            style={{
              background  : '#f7fafc',
              border      : '1px solid #e2e8f0',
              borderRadius: '6px',
              padding     : '4px 10px',
              cursor      : 'pointer',
              fontSize    : '16px',
              color       : '#718096'
            }}
          >
            ✕
          </button>
        </div>

        {/* Alert */}
        {alert && (
          <div style={{
            background  : alert.type === 'success' ? '#c6f6d5' : '#fed7d7',
            color       : alert.type === 'success' ? '#276749' : '#9b2c2c',
            padding     : '10px 14px',
            borderRadius: '7px',
            fontSize    : '13px',
            marginBottom: '16px'
          }}>
            {alert.msg}
          </div>
        )}

        {/* Profile info */}
        <div style={{
          background  : '#f7fafc',
          border      : '1px solid #e2e8f0',
          borderRadius: '10px',
          padding     : '16px',
          marginBottom: '24px'
        }}>
          <div style={{
            display      : 'flex',
            alignItems   : 'center',
            gap          : '14px',
            marginBottom : '14px'
          }}>
            {/* Avatar */}
            <div style={{
              width       : '48px',
              height      : '48px',
              borderRadius: '50%',
              background  : '#1a2d5a',
              display     : 'flex',
              alignItems  : 'center',
              justifyContent: 'center',
              fontSize    : '20px',
              color       : '#fff',
              fontWeight  : 800,
              flexShrink  : 0
            }}>
              {name?.charAt(0).toUpperCase()}
            </div>
            <div>
              <div style={{
                fontWeight: 700,
                color     : '#2d3748',
                fontSize  : '15px'
              }}>
                {name}
              </div>
              <div style={{
                fontSize: '12px',
                color   : '#718096',
                marginTop: '2px'
              }}>
                @{username}
              </div>
            </div>
          </div>

          {/* Role badge */}
          <div style={{
            display    : 'flex',
            alignItems : 'center',
            gap        : '8px',
            fontSize   : '12px',
            color      : '#718096'
          }}>
            <span>Role:</span>
            <span style={{
              background  : badge.bg,
              color       : badge.color,
              padding     : '2px 12px',
              borderRadius: '20px',
              fontSize    : '11px',
              fontWeight  : 700
            }}>
              {role}
            </span>
          </div>
        </div>

        {/* Change password section */}
        <div style={{
          fontSize    : '12px',
          fontWeight  : 700,
          color       : '#1a2d5a',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          marginBottom: '14px'
        }}>
          🔒 Change Password
        </div>

        {/* Current password */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{
            display      : 'block',
            fontSize     : '11px',
            fontWeight   : 700,
            color        : '#4a5568',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom : '5px'
          }}>
            Current Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showCurrent ? 'text' : 'password'}
              placeholder="Enter current password"
              value={form.current_password}
              style={inputStyle(errors.current_password)}
              onChange={e => {
                setForm({ ...form, current_password: e.target.value });
                setErrors({ ...errors, current_password: '' });
              }}
            />
            <button
              type="button"
              onClick={() => setShowCurrent(!showCurrent)}
              style={{
                position : 'absolute', right: '10px',
                top      : '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                cursor   : 'pointer', fontSize: '14px'
              }}
            >
              {showCurrent ? '🙈' : '👁️'}
            </button>
          </div>
          {errors.current_password && (
            <div style={errStyle}>⚠ {errors.current_password}</div>
          )}
        </div>

        {/* New password */}
        <div style={{ marginBottom: '14px' }}>
          <label style={{
            display      : 'block',
            fontSize     : '11px',
            fontWeight   : 700,
            color        : '#4a5568',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom : '5px'
          }}>
            New Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showNew ? 'text' : 'password'}
              placeholder="Minimum 8 characters"
              value={form.new_password}
              style={inputStyle(errors.new_password)}
              onChange={e => {
                setForm({ ...form, new_password: e.target.value });
                setErrors({ ...errors, new_password: '' });
              }}
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              style={{
                position : 'absolute', right: '10px',
                top      : '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                cursor   : 'pointer', fontSize: '14px'
              }}
            >
              {showNew ? '🙈' : '👁️'}
            </button>
          </div>
          {errors.new_password && (
            <div style={errStyle}>⚠ {errors.new_password}</div>
          )}

          {/* Password strength indicator */}
          {form.new_password && (
            <div style={{ marginTop: '6px' }}>
              <div style={{
                height      : '4px',
                borderRadius: '2px',
                background  : '#e2e8f0',
                overflow    : 'hidden'
              }}>
                <div style={{
                  height    : '100%',
                  borderRadius: '2px',
                  width     : form.new_password.length >= 12 ? '100%'
                            : form.new_password.length >= 8  ? '60%'
                            : '30%',
                  background: form.new_password.length >= 12 ? '#38a169'
                            : form.new_password.length >= 8  ? '#d69e2e'
                            : '#e53e3e',
                  transition: 'all 0.3s'
                }}/>
              </div>
              <div style={{
                fontSize : '10px',
                marginTop: '3px',
                color    : form.new_password.length >= 12 ? '#38a169'
                         : form.new_password.length >= 8  ? '#d69e2e'
                         : '#e53e3e'
              }}>
                {form.new_password.length >= 12 ? '✓ Strong password'
               : form.new_password.length >= 8  ? '⚠ Acceptable password'
               : '✕ Weak password'}
              </div>
            </div>
          )}
        </div>

        {/* Confirm password */}
        <div style={{ marginBottom: '20px' }}>
          <label style={{
            display      : 'block',
            fontSize     : '11px',
            fontWeight   : 700,
            color        : '#4a5568',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            marginBottom : '5px'
          }}>
            Confirm New Password
          </label>
          <div style={{ position: 'relative' }}>
            <input
              type={showConfirm ? 'text' : 'password'}
              placeholder="Re-enter new password"
              value={form.confirm_password}
              style={inputStyle(errors.confirm_password)}
              onChange={e => {
                setForm({ ...form, confirm_password: e.target.value });
                setErrors({ ...errors, confirm_password: '' });
              }}
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              style={{
                position : 'absolute', right: '10px',
                top      : '50%', transform: 'translateY(-50%)',
                background: 'none', border: 'none',
                cursor   : 'pointer', fontSize: '14px'
              }}
            >
              {showConfirm ? '🙈' : '👁️'}
            </button>
          </div>
          {errors.confirm_password && (
            <div style={errStyle}>⚠ {errors.confirm_password}</div>
          )}

          {/* Match indicator */}
          {form.confirm_password && form.new_password && (
            <div style={{
              fontSize : '11px',
              marginTop: '4px',
              color    : form.new_password === form.confirm_password
                ? '#38a169' : '#e53e3e'
            }}>
              {form.new_password === form.confirm_password
                ? '✓ Passwords match'
                : '✕ Passwords do not match'}
            </div>
          )}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <button
            onClick={handleChangePassword}
            disabled={loading}
            style={{
              flex        : 1,
              padding     : '11px',
              background  : loading ? '#a0aec0' : '#1a2d5a',
              color       : '#fff',
              border      : 'none',
              borderRadius: '8px',
              fontSize    : '13px',
              fontWeight  : 700,
              cursor      : loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? '⏳ Updating...' : '🔒 Update Password'}
          </button>
          <button
            onClick={onClose}
            style={{
              padding     : '11px 20px',
              background  : '#f7fafc',
              color       : '#4a5568',
              border      : '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize    : '13px',
              fontWeight  : 600,
              cursor      : 'pointer'
            }}
          >
            Cancel
          </button>
        </div>

      </div>
    </>
  );
}