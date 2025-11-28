'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Form, Button, Spinner } from 'react-bootstrap';
import { account } from '@/lib/appwriteClient';
import Image from 'next/image';
import Link from 'next/link';
import '../login/login.css';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [validationErrors, setValidationErrors] = useState({});

  // Get userId and secret from URL params
  const userId = searchParams.get('userId');
  const secret = searchParams.get('secret');

  // Logo configuration
  const LOGO_PATH = '/images/logo.png';
  const LOGO_ALT = 'NREP Logo';
  const FALLBACK_LETTER = 'N';

  useEffect(() => {
    // Check if required params are present
    if (!userId || !secret) {
      setError('Invalid or expired password reset link. Please request a new one.');
    }
  }, [userId, secret]);

  const validatePassword = (pwd) => {
    const errors = {};

    if (pwd.length < 8) {
      errors.length = 'Password must be at least 8 characters long';
    }

    if (!/[A-Z]/.test(pwd)) {
      errors.uppercase = 'Password must contain at least one uppercase letter';
    }

    if (!/[a-z]/.test(pwd)) {
      errors.lowercase = 'Password must contain at least one lowercase letter';
    }

    if (!/[0-9]/.test(pwd)) {
      errors.number = 'Password must contain at least one number';
    }

    return errors;
  };

  const handlePasswordChange = (e) => {
    const newPassword = e.target.value;
    setPassword(newPassword);

    if (newPassword) {
      const errors = validatePassword(newPassword);
      setValidationErrors(errors);
    } else {
      setValidationErrors({});
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    // Validate passwords match
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    // Validate password strength
    const errors = validatePassword(password);
    if (Object.keys(errors).length > 0) {
      setError('Please ensure your password meets all requirements');
      return;
    }

    if (!userId || !secret) {
      setError('Invalid or expired password reset link');
      return;
    }

    setLoading(true);

    try {
      // Complete the password recovery
      await account.updateRecovery(
        userId,
        secret,
        password,
        password // Appwrite requires password confirmation
      );

      setSuccess(true);

      // Redirect to login after 3 seconds
      setTimeout(() => {
        router.push('/login');
      }, 3000);
    } catch (err) {
      console.error('[Reset Password] Error:', err);
      if (err.code === 401) {
        setError('Password reset link has expired or is invalid. Please request a new one.');
      } else {
        setError(err.message || 'Failed to reset password. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="login-container">
        <div className="login-hero">
          <div className="decorative-shape shape-1"></div>
          <div className="decorative-shape shape-2"></div>

          <div className="hero-content">
            <div className="hero-logo">
              {!logoError ? (
                <Image
                  src={LOGO_PATH}
                  alt={LOGO_ALT}
                  fill
                  style={{ objectFit: 'contain', padding: '10px' }}
                  onError={() => setLogoError(true)}
                  priority
                />
              ) : (
                <span className="hero-logo-text">{FALLBACK_LETTER}</span>
              )}
            </div>

            <h1 className="hero-title">
              NREP Project Management System
            </h1>

            <p className="hero-subtitle">
              Your password has been successfully reset
            </p>
          </div>
        </div>

        <div className="login-form-section">
          <div className="login-form-container">
            <div className="form-header">
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <div
                  style={{
                    width: '80px',
                    height: '80px',
                    background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    margin: '0 auto 1.5rem',
                    boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)',
                    animation: 'scaleIn 0.5s ease'
                  }}
                >
                  <i className="bi bi-check-circle" style={{ fontSize: '3rem', color: 'white' }}></i>
                </div>
              </div>
              <h2 style={{ textAlign: 'center', color: 'var(--primary-color)' }}>Password Reset Successful!</h2>
              <p style={{ textAlign: 'center', color: '#6c757d' }}>
                Your password has been changed successfully.
              </p>
            </div>

            <div style={{
              padding: '1.5rem',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '12px',
              marginBottom: '2rem'
            }}>
              <p className="mb-2" style={{ color: '#166534', fontSize: '0.9rem' }}>
                <i className="bi bi-check-circle-fill me-2" style={{ color: '#10b981' }}></i>
                You can now sign in with your new password
              </p>
              <p className="mb-0" style={{ color: '#166534', fontSize: '0.9rem' }}>
                <i className="bi bi-arrow-clockwise me-2" style={{ color: '#10b981' }}></i>
                Redirecting to sign in page in a few seconds...
              </p>
            </div>

            <Link href="/login" style={{ textDecoration: 'none' }}>
              <button className="login-button">
                <i className="bi bi-box-arrow-in-right me-2"></i>
                Go to Sign In
              </button>
            </Link>
          </div>
        </div>

        <style jsx>{`
          @keyframes scaleIn {
            from {
              transform: scale(0);
              opacity: 0;
            }
            to {
              transform: scale(1);
              opacity: 1;
            }
          }
        `}</style>
      </div>
    );
  }

  return (
    <div className="login-container">
      <div className="login-hero">
        <div className="decorative-shape shape-1"></div>
        <div className="decorative-shape shape-2"></div>

        <div className="hero-content">
          <div className="hero-logo">
            {!logoError ? (
              <Image
                src={LOGO_PATH}
                alt={LOGO_ALT}
                fill
                style={{ objectFit: 'contain', padding: '10px' }}
                onError={() => setLogoError(true)}
                priority
              />
            ) : (
              <span className="hero-logo-text">{FALLBACK_LETTER}</span>
            )}
          </div>

          <h1 className="hero-title">
            NREP Project Management System
          </h1>

          <p className="hero-subtitle">
            Create a strong password to secure your account and protect your data.
          </p>

          <div className="hero-features">
            <div className="hero-feature">
              <div className="hero-feature-icon">
                <i className="bi bi-shield-check"></i>
              </div>
              <div className="hero-feature-text">
                <div className="hero-feature-title">Secure Password</div>
                <div className="hero-feature-desc">Use a strong, unique password</div>
              </div>
            </div>

            <div className="hero-feature">
              <div className="hero-feature-icon">
                <i className="bi bi-key"></i>
              </div>
              <div className="hero-feature-text">
                <div className="hero-feature-title">Encrypted Storage</div>
                <div className="hero-feature-desc">Your password is safely encrypted</div>
              </div>
            </div>

            <div className="hero-feature">
              <div className="hero-feature-icon">
                <i className="bi bi-check-circle"></i>
              </div>
              <div className="hero-feature-text">
                <div className="hero-feature-title">Instant Access</div>
                <div className="hero-feature-desc">Sign in immediately after</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-section">
        <div className="login-form-container">
          <div className="form-header">
            <h2>Set New Password</h2>
            <p>Choose a strong password for your account</p>
          </div>

          {error && (
            <div className="alert-custom">
              <i className="bi bi-exclamation-circle"></i>
              <span>{error}</span>
            </div>
          )}

          <Form onSubmit={handleSubmit}>
            <div className="form-group-custom">
              <label className="form-label-custom">NEW PASSWORD</label>
              <div className="input-wrapper">
                <i className="bi bi-lock input-icon"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control-custom"
                  placeholder="Enter new password"
                  value={password}
                  onChange={handlePasswordChange}
                  required
                  disabled={loading || !userId || !secret}
                  autoFocus
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  tabIndex="-1"
                >
                  <i className={`bi bi-eye${showPassword ? '-slash' : ''}`}></i>
                </button>
              </div>

              {/* Password Requirements */}
              {password && (
                <div style={{
                  marginTop: '0.75rem',
                  padding: '0.75rem',
                  background: '#f8f9fa',
                  borderRadius: '8px',
                  fontSize: '0.8rem'
                }}>
                  <div style={{ fontWeight: '600', marginBottom: '0.5rem', color: 'var(--primary-color)' }}>
                    Password Requirements:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                    <div style={{ color: validationErrors.length ? '#dc3545' : '#10b981' }}>
                      <i className={`bi bi-${validationErrors.length ? 'x' : 'check'}-circle me-2`}></i>
                      At least 8 characters
                    </div>
                    <div style={{ color: validationErrors.uppercase ? '#dc3545' : '#10b981' }}>
                      <i className={`bi bi-${validationErrors.uppercase ? 'x' : 'check'}-circle me-2`}></i>
                      One uppercase letter
                    </div>
                    <div style={{ color: validationErrors.lowercase ? '#dc3545' : '#10b981' }}>
                      <i className={`bi bi-${validationErrors.lowercase ? 'x' : 'check'}-circle me-2`}></i>
                      One lowercase letter
                    </div>
                    <div style={{ color: validationErrors.number ? '#dc3545' : '#10b981' }}>
                      <i className={`bi bi-${validationErrors.number ? 'x' : 'check'}-circle me-2`}></i>
                      One number
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="form-group-custom">
              <label className="form-label-custom">CONFIRM PASSWORD</label>
              <div className="input-wrapper">
                <i className="bi bi-lock-fill input-icon"></i>
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  className="form-control-custom"
                  placeholder="Confirm new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading || !userId || !secret}
                />
                <button
                  type="button"
                  className="password-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  tabIndex="-1"
                >
                  <i className={`bi bi-eye${showConfirmPassword ? '-slash' : ''}`}></i>
                </button>
              </div>
              {confirmPassword && password !== confirmPassword && (
                <small className="text-danger d-block mt-2" style={{ fontSize: '0.8rem' }}>
                  <i className="bi bi-exclamation-circle me-1"></i>
                  Passwords do not match
                </small>
              )}
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loading || !userId || !secret || Object.keys(validationErrors).length > 0 || password !== confirmPassword}
            >
              {loading ? (
                <>
                  <Spinner
                    as="span"
                    animation="border"
                    size="sm"
                    role="status"
                    aria-hidden="true"
                    style={{ marginRight: '8px' }}
                  />
                  Resetting Password...
                </>
              ) : (
                <>
                  <i className="bi bi-check-circle" style={{ marginRight: '8px' }}></i>
                  Reset Password
                </>
              )}
            </button>
          </Form>

          <div className="form-footer">
            <p>
              <Link href="/login">
                <i className="bi bi-arrow-left me-2"></i>
                Back to Sign In
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="login-container">
        <div className="login-form-section" style={{ width: '100%' }}>
          <div style={{ textAlign: 'center', padding: '4rem 2rem' }}>
            <Spinner animation="border" style={{ color: 'var(--primary-color)' }} />
            <p className="mt-3" style={{ color: '#6c757d' }}>Loading...</p>
          </div>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
