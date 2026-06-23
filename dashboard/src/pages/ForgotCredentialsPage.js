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
  const [showPassword, setShowPassword] = useState(false);
  const [recoverErrors, setRecoverErrors] = useState({});
  const [resetErrors, setResetErrors] = useState({});

  // ── Validation constants ──
  const USERNAME_MIN = 3;
  const USERNAME_MAX = 30;
  const PASSWORD_MIN = 8;
  const PASSWORD_MAX = 128;
  const EMAIL_MAX = 100;
  const USERNAME_PATTERN = /^[a-zA-Z0-9_]+$/;
  const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const PASSWORD_COMPLEXITY = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#])[A-Za-z\d@$!%*?&#]{8,}$/;

  /** Strip characters that aren't alphanumeric or underscore */
  const sanitizeUsername = (value) => value.replace(/[^a-zA-Z0-9_]/g, '');

  const cardStyle = {
    background: '#fff',
    borderRadius: '18px',
    padding: '28px',
    boxShadow: '0 20px 60px rgba(15,23,42,0.16)',
    border: '1px solid rgba(255,255,255,0.5)'
  };

  const inputBaseStyle = {
    width: '100%',
    padding: '12px 14px',
    border: '1px solid #dbe3ee',
    borderRadius: '10px',
    fontSize: '14px',
    background: '#f8fafc',
    color: '#1e293b',
    outline: 'none',
    transition: 'border-color 0.2s'
  };

  const inputErrStyle = {
    ...inputBaseStyle,
    border: '1.5px solid #ef4444',
    background: 'rgba(239, 68, 68, 0.06)'
  };

  const inputStyle = (hasError) => hasError ? inputErrStyle : inputBaseStyle;

  const labelStyle = {
    display: 'block',
    marginBottom: '6px',
    fontSize: '11px',
    fontWeight: 700,
    color: '#475569',
    textTransform: 'uppercase',
    letterSpacing: '0.08em'
  };

  const fieldErrStyle = {
    fontSize: '11px',
    color: '#ef4444',
    marginTop: '4px',
    fontWeight: 600
  };

  const hintStyle = {
    fontSize: '10px',
    color: '#94a3b8',
    marginTop: '4px',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  };

  const validateRecoverEmail = () => {
    const errs = {};
    const email = usernameForm.email.trim();
    if (!email) {
      errs.email = 'Email is required';
    } else if (!EMAIL_PATTERN.test(email)) {
      errs.email = 'Please enter a valid email address';
    } else if (email.length > EMAIL_MAX) {
      errs.email = `Email cannot exceed ${EMAIL_MAX} characters`;
    }
    return errs;
  };

  const submitRecoverUsername = async () => {
    setError('');
    setMessage('');
    setUsernameResult([]);

    const errs = validateRecoverEmail();
    setRecoverErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
    try {
      const res = await recoverUsername({ email: usernameForm.email.trim() });
      setUsernameResult(res.data.accounts || []);
      setMessage(res.data.message || 'Account details found');
    } catch (e) {
      setError(e.response?.data?.error || 'Unable to recover username');
    }
    setLoading(false);
  };

  const validateResetForm = () => {
    const errs = {};
    const trimmedUser = passwordForm.username.trim();
    const trimmedEmail = passwordForm.email.trim();

    // Username
    if (!trimmedUser) {
      errs.username = 'Username is required';
    } else if (trimmedUser.length < USERNAME_MIN) {
      errs.username = `Username must be at least ${USERNAME_MIN} characters`;
    } else if (trimmedUser.length > USERNAME_MAX) {
      errs.username = `Username cannot exceed ${USERNAME_MAX} characters`;
    } else if (!USERNAME_PATTERN.test(trimmedUser)) {
      errs.username = 'Username may only contain letters, numbers, and underscores';
    }

    // Email
    if (!trimmedEmail) {
      errs.email = 'Email is required';
    } else if (!EMAIL_PATTERN.test(trimmedEmail)) {
      errs.email = 'Please enter a valid email address';
    } else if (trimmedEmail.length > EMAIL_MAX) {
      errs.email = `Email cannot exceed ${EMAIL_MAX} characters`;
    }

    // New password
    if (!passwordForm.new_password) {
      errs.new_password = 'New password is required';
    } else if (passwordForm.new_password.length < PASSWORD_MIN) {
      errs.new_password = `Password must be at least ${PASSWORD_MIN} characters`;
    } else if (passwordForm.new_password.length > PASSWORD_MAX) {
      errs.new_password = `Password cannot exceed ${PASSWORD_MAX} characters`;
    } else if (!PASSWORD_COMPLEXITY.test(passwordForm.new_password)) {
      errs.new_password = 'Must include uppercase, lowercase, number, and special character (@$!%*?&#)';
    }

    // Confirm password
    if (!passwordForm.confirm_password) {
      errs.confirm_password = 'Please confirm your new password';
    } else if (passwordForm.new_password !== passwordForm.confirm_password) {
      errs.confirm_password = 'Passwords do not match';
    }

    return errs;
  };

  const submitResetPassword = async () => {
    setError('');
    setMessage('');

    const errs = validateResetForm();
    setResetErrors(errs);
    if (Object.keys(errs).length > 0) return;

    setLoading(true);
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
      setResetErrors({});
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
                id="recover-email"
                type="email"
                value={usernameForm.email}
                maxLength={EMAIL_MAX}
                onChange={e => {
                  setUsernameForm({ email: e.target.value });
                  setRecoverErrors({ ...recoverErrors, email: '' });
                  setError('');
                }}
                style={inputStyle(recoverErrors.email)}
                placeholder="you@example.com"
                aria-describedby="recover-email-hint"
              />
              {recoverErrors.email && <div style={fieldErrStyle}>⚠️ {recoverErrors.email}</div>}
              <div id="recover-email-hint" style={hintStyle}>
                <span>Valid email address</span>
                <span style={{ color: EMAIL_PATTERN.test(usernameForm.email.trim()) ? '#10b981' : '#94a3b8' }}>
                  {usernameForm.email.trim().length}/{EMAIL_MAX}
                </span>
              </div>
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
                id="reset-username"
                type="text"
                value={passwordForm.username}
                maxLength={USERNAME_MAX}
                onChange={e => {
                  const sanitized = sanitizeUsername(e.target.value);
                  setPasswordForm({ ...passwordForm, username: sanitized });
                  setResetErrors({ ...resetErrors, username: '' });
                  setError('');
                }}
                style={inputStyle(resetErrors.username)}
                placeholder="Letters, numbers, underscores only"
                aria-describedby="reset-username-hint"
              />
              {resetErrors.username && <div style={fieldErrStyle}>⚠️ {resetErrors.username}</div>}
              <div id="reset-username-hint" style={hintStyle}>
                <span>a-z, 0-9, underscore</span>
                <span style={{ color: passwordForm.username.trim().length >= USERNAME_MIN ? '#10b981' : '#94a3b8' }}>
                  {passwordForm.username.trim().length}/{USERNAME_MAX}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>Registered Email</label>
              <input
                id="reset-email"
                type="email"
                value={passwordForm.email}
                maxLength={EMAIL_MAX}
                onChange={e => {
                  setPasswordForm({ ...passwordForm, email: e.target.value });
                  setResetErrors({ ...resetErrors, email: '' });
                  setError('');
                }}
                style={inputStyle(resetErrors.email)}
                placeholder="you@example.com"
                aria-describedby="reset-email-hint"
              />
              {resetErrors.email && <div style={fieldErrStyle}>⚠️ {resetErrors.email}</div>}
              <div id="reset-email-hint" style={hintStyle}>
                <span>Valid email address</span>
                <span style={{ color: EMAIL_PATTERN.test(passwordForm.email.trim()) ? '#10b981' : '#94a3b8' }}>
                  {passwordForm.email.trim().length}/{EMAIL_MAX}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '14px' }}>
              <label style={labelStyle}>New Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reset-new-password"
                  type={showPassword ? "text" : "password"}
                  value={passwordForm.new_password}
                  maxLength={PASSWORD_MAX}
                  onChange={e => {
                    setPasswordForm({ ...passwordForm, new_password: e.target.value });
                    setResetErrors({ ...resetErrors, new_password: '' });
                    setError('');
                  }}
                  style={{ ...inputStyle(resetErrors.new_password), paddingRight: '44px' }}
                  placeholder="Min 8 chars, Aa1@"
                  aria-describedby="reset-pw-hint"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#475569'
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {resetErrors.new_password && <div style={fieldErrStyle}>⚠️ {resetErrors.new_password}</div>}
              <div id="reset-pw-hint" style={hintStyle}>
                <span>Upper, lower, digit, special</span>
                <span style={{ color: passwordForm.new_password.length >= PASSWORD_MIN ? '#10b981' : '#94a3b8' }}>
                  {passwordForm.new_password.length}/{PASSWORD_MAX}
                </span>
              </div>
            </div>

            <div style={{ marginBottom: '18px' }}>
              <label style={labelStyle}>Confirm Password</label>
              <div style={{ position: 'relative' }}>
                <input
                  id="reset-confirm-password"
                  type={showPassword ? "text" : "password"}
                  value={passwordForm.confirm_password}
                  maxLength={PASSWORD_MAX}
                  onChange={e => {
                    setPasswordForm({ ...passwordForm, confirm_password: e.target.value });
                    setResetErrors({ ...resetErrors, confirm_password: '' });
                  }}
                  style={{ ...inputStyle(resetErrors.confirm_password), paddingRight: '44px' }}
                  placeholder="Re-enter new password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  style={{
                    position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)',
                    background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: '#475569'
                  }}
                >
                  {showPassword ? 'Hide' : 'Show'}
                </button>
              </div>
              {resetErrors.confirm_password && <div style={fieldErrStyle}>⚠️ {resetErrors.confirm_password}</div>}
              {passwordForm.confirm_password && passwordForm.new_password === passwordForm.confirm_password && (
                <div style={{ fontSize: '11px', color: '#10b981', marginTop: '4px', fontWeight: 600 }}>
                  ✅ Passwords match
                </div>
              )}
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
