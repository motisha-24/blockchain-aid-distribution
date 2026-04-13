import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import Footer from '../components/Footer';
import { recoverPassword, recoverUsername } from '../services/api';

export default function ForgotCredentialsPage() {
  const [usernameForm, setUsernameForm] = useState({ email: '' });
  const [passwordForm, setPasswordForm] = useState({
    username: '',
    email: '',
    new_password: '',
    confirm_password: ''
  });
  const [usernameResult, setUsernameResult] = useState([]);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const cardStyle = {
    background: '#fff',
    borderRadius: '18px',
    padding: '28px',
    boxShadow: '0 20px 60px rgba(15,23,42,0.16)',
    border: '1px solid rgba(255,255,255,0.5)'
  };

  const inputStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #dbe3ee',
    borderRadius: '10px',
    fontSize: '14px',
    background: '#f8fafc',
    color: '#1e293b',
    outline: 'none'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  };

  const submitRecoverUsername = async () => {
    setLoading(true);
    setError('');
    setMessage('');
    setUsernameResult([]);

    try {
      const res = await recoverUsername({ email: usernameForm.email.trim() });
      setUsernameResult(res.data.accounts || []);
      setMessage(res.data.message || 'Account details found');
    } catch (e) {
      setError(e.response?.data?.error || 'Unable to recover username');
    }
    setLoading(false);
  };

  const submitResetPassword = async () => {
    setLoading(true);
    setError('');
    setMessage('');

    if (passwordForm.new_password !== passwordForm.confirm_password) {
      setLoading(false);
      setError('New password and confirmation do not match');
      return;
    }

    try {
      const res = await recoverPassword({
        username: passwordForm.username.trim(),
        email: passwordForm.email.trim(),
        new_password: passwordForm.new_password
      });
      setMessage(res.data.message || 'Password reset successful');
      setPasswordForm({
        username: '',
        email: '',
        new_password: '',
        confirm_password: ''
      });
    } catch (e) {
      setError(e.response?.data?.error || 'Unable to reset password');
    }
    setLoading(false);
  };

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      flexDirection: 'column',
      background: 'radial-gradient(circle at top left, #dbeafe 0%, #eff6ff 28%, #f8fafc 58%, #e2e8f0 100%)'
    }}>
      <div style={{
        flex: 1,
        maxWidth: '1100px',
        width: '100%',
        margin: '0 auto',
        padding: '56px 20px 24px'
      }}>
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>Account Recovery</div>
          <div style={{ fontSize: '15px', color: '#475569', maxWidth: '720px', margin: '0 auto', lineHeight: 1.7 }}>
            Recover your username from your registered email or reset your password by confirming your username and email.
          </div>
        </div>

        {(message || error) && (
          <div style={{
            marginBottom: '20px',
            padding: '14px 16px',
            borderRadius: '12px',
            background: error ? '#fef2f2' : '#ecfdf5',
            color: error ? '#b91c1c' : '#166534',
            border: `1px solid ${error ? '#fecaca' : '#bbf7d0'}`
          }}>
            {error || message}
          </div>
        )}

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
          gap: '22px'
        }}>
          <div style={cardStyle}>
            <h2 style={{ color: '#1a2d5a', marginBottom: '10px', fontSize: '20px' }}>
              Recover Username
            </h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px', lineHeight: 1.7 }}>
              Enter your registered email address to retrieve the username linked to your active account.
            </p>

            <div style={{ marginBottom: '16px' }}>
              <label style={labelStyle}>Registered Email</label>
              <input
                type="email"
                value={usernameForm.email}
                onChange={e => setUsernameForm({ email: e.target.value })}
                style={inputStyle}
                placeholder="you@example.com"
              />
            </div>

            <button
              type="button"
              onClick={submitRecoverUsername}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: 'none',
                background: '#1d4ed8',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {loading ? 'Processing...' : 'Find Username'}
            </button>

            {usernameResult.length > 0 && (
              <div style={{
                marginTop: '18px',
                padding: '14px',
                borderRadius: '12px',
                background: '#eff6ff',
                border: '1px solid #bfdbfe'
              }}>
                {usernameResult.map((account, index) => (
                  <div key={`${account.username}-${index}`} style={{ fontSize: '13px', color: '#1e3a8a', lineHeight: 1.7 }}>
                    <strong>{account.username}</strong> — {account.name} ({account.role})
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={cardStyle}>
            <h2 style={{ color: '#1a2d5a', marginBottom: '10px', fontSize: '20px' }}>
              Reset Password
            </h2>
            <p style={{ color: '#64748b', fontSize: '13px', marginBottom: '20px', lineHeight: 1.7 }}>
              Confirm your username and registered email, then choose a new password with at least 8 characters.
            </p>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Username</label>
              <input
                type="text"
                value={passwordForm.username}
                onChange={e => setPasswordForm({ ...passwordForm, username: e.target.value })}
                style={inputStyle}
                placeholder="Enter your username"
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Registered Email</label>
              <input
                type="email"
                value={passwordForm.email}
                onChange={e => setPasswordForm({ ...passwordForm, email: e.target.value })}
                style={inputStyle}
                placeholder="Enter your email"
              />
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>New Password</label>
              <input
                type="password"
                value={passwordForm.new_password}
                onChange={e => setPasswordForm({ ...passwordForm, new_password: e.target.value })}
                style={inputStyle}
                placeholder="Minimum 8 characters"
              />
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Confirm Password</label>
              <input
                type="password"
                value={passwordForm.confirm_password}
                onChange={e => setPasswordForm({ ...passwordForm, confirm_password: e.target.value })}
                style={inputStyle}
                placeholder="Re-enter new password"
              />
            </div>

            <button
              type="button"
              onClick={submitResetPassword}
              disabled={loading}
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '10px',
                border: 'none',
                background: '#0f766e',
                color: '#fff',
                fontWeight: 700,
                cursor: 'pointer'
              }}
            >
              {loading ? 'Processing...' : 'Reset Password'}
            </button>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '24px' }}>
          <Link to="/login" style={{ color: '#1d4ed8', fontWeight: 700, textDecoration: 'none' }}>
            Return to Login
          </Link>
        </div>
      </div>

      <Footer />
    </div>
  );
}
