'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Button, Spinner, Alert } from 'react-bootstrap';
import { account } from '@/lib/appwriteClient';
import Image from 'next/image';
import Link from 'next/link';
import '../login/login.css';

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [logoError, setLogoError] = useState(false);

  // Logo configuration
  const LOGO_PATH = '/images/logo.png';
  const LOGO_ALT = 'NREP Logo';
  const FALLBACK_LETTER = 'N';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Create recovery URL - Appwrite will send email with this URL
      const appUrl = process.env.NEXT_PUBLIC_APP_URL || window.location.origin;
      const resetUrl = `${appUrl}/reset-password`;

      await account.createRecovery(
        email,
        resetUrl
      );

      setSuccess(true);
    } catch (err) {
      console.error('[Forgot Password] Error:', err);
      setError(err.message || 'Failed to send recovery email. Please check your email address.');
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
              Secure password recovery for your account
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
                    boxShadow: '0 10px 30px rgba(16, 185, 129, 0.3)'
                  }}
                >
                  <i className="bi bi-check-circle" style={{ fontSize: '3rem', color: 'white' }}></i>
                </div>
              </div>
              <h2 style={{ textAlign: 'center' }}>Check Your Email</h2>
              <p style={{ textAlign: 'center' }}>
                We've sent a password recovery link to <strong>{email}</strong>
              </p>
            </div>

            <Alert variant="success" className="mb-4">
              <Alert.Heading className="h6">
                <i className="bi bi-info-circle me-2"></i>
                What's Next?
              </Alert.Heading>
              <hr />
              <ul className="mb-0" style={{ fontSize: '0.875rem', paddingLeft: '1.25rem' }}>
                <li>Check your email inbox (and spam folder)</li>
                <li>Click the password reset link in the email</li>
                <li>Enter your new password</li>
                <li>Sign in with your new password</li>
              </ul>
            </Alert>

            <div style={{ textAlign: 'center' }}>
              <p className="text-muted mb-3" style={{ fontSize: '0.875rem' }}>
                Didn't receive the email?
              </p>
              <Button
                variant="outline-secondary"
                onClick={() => {
                  setSuccess(false);
                  setEmail('');
                }}
                className="mb-3"
                style={{ borderRadius: '10px' }}
              >
                <i className="bi bi-arrow-repeat me-2"></i>
                Try Again
              </Button>
            </div>

            <div className="form-footer">
              <p>
                <Link href="/login" style={{ color: 'var(--secondary-color)', textDecoration: 'none', fontWeight: 600 }}>
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
            Enter your email address and we'll send you a link to reset your password.
          </p>

          <div className="hero-features">
            <div className="hero-feature">
              <div className="hero-feature-icon">
                <i className="bi bi-shield-check"></i>
              </div>
              <div className="hero-feature-text">
                <div className="hero-feature-title">Secure Process</div>
                <div className="hero-feature-desc">Your data is protected</div>
              </div>
            </div>

            <div className="hero-feature">
              <div className="hero-feature-icon">
                <i className="bi bi-clock-history"></i>
              </div>
              <div className="hero-feature-text">
                <div className="hero-feature-title">Quick Recovery</div>
                <div className="hero-feature-desc">Get back to work fast</div>
              </div>
            </div>

            <div className="hero-feature">
              <div className="hero-feature-icon">
                <i className="bi bi-envelope-check"></i>
              </div>
              <div className="hero-feature-text">
                <div className="hero-feature-title">Email Verification</div>
                <div className="hero-feature-desc">Instant recovery link</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="login-form-section">
        <div className="login-form-container">
          <div className="form-header">
            <h2>Forgot Password?</h2>
            <p>No worries, we'll send you reset instructions</p>
          </div>

          {error && (
            <div className="alert-custom">
              <i className="bi bi-exclamation-circle"></i>
              <span>{error}</span>
            </div>
          )}

          <Form onSubmit={handleSubmit}>
            <div className="form-group-custom">
              <label className="form-label-custom">EMAIL ADDRESS</label>
              <div className="input-wrapper">
                <i className="bi bi-envelope input-icon"></i>
                <input
                  type="email"
                  className="form-control-custom"
                  placeholder="Enter your email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={loading}
                  autoFocus
                />
              </div>
              <small className="text-muted d-block mt-2" style={{ fontSize: '0.8rem' }}>
                Enter the email address associated with your account
              </small>
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loading}
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
                  Sending Recovery Link...
                </>
              ) : (
                <>
                  <i className="bi bi-send" style={{ marginRight: '8px' }}></i>
                  Send Recovery Link
                </>
              )}
            </button>
          </Form>

          <div className="form-footer">
            <p>
              Remember your password? <Link href="/login">Sign In</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
