'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Form, Button, Spinner } from 'react-bootstrap';
import { login } from '@/lib/auth';
import { useSession } from '@/contexts/SessionContext';
import Image from 'next/image';
import Link from 'next/link';
import './login.css';

export default function LoginPage() {
  const router = useRouter();
  const { refreshSession } = useSession();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [logoError, setLogoError] = useState(false);

  // Logo configuration - update these paths as needed
  const LOGO_PATH = '/images/logo.png';
  const LOGO_ALT = 'NREP Logo';
  const FALLBACK_LETTER = 'N';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const loginResult = await login(email, password);
      const sessionData = await refreshSession();

      if (!sessionData) {
        throw new Error('Failed to load session data after login');
      }

      const targetUrl = sessionData.isClient ? '/client/dashboard' : '/dashboard';
      router.push(targetUrl);
    } catch (err) {
      console.error('[Login] Error:', err);
      setError(err.message || 'Login failed. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      {/* Left Hero Section */}
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
            Streamline your projects, collaborate with your team, and deliver exceptional results with our comprehensive project management platform.
          </p>

          <div className="hero-features">
            <div className="hero-feature">
              <div className="hero-feature-icon">
                <i className="bi bi-kanban"></i>
              </div>
              <div className="hero-feature-text">
                <div className="hero-feature-title">Project Tracking</div>
                <div className="hero-feature-desc">Monitor progress in real-time</div>
              </div>
            </div>

            <div className="hero-feature">
              <div className="hero-feature-icon">
                <i className="bi bi-people"></i>
              </div>
              <div className="hero-feature-text">
                <div className="hero-feature-title">Team Collaboration</div>
                <div className="hero-feature-desc">Work together seamlessly</div>
              </div>
            </div>

            <div className="hero-feature">
              <div className="hero-feature-icon">
                <i className="bi bi-graph-up"></i>
              </div>
              <div className="hero-feature-text">
                <div className="hero-feature-title">Analytics & Reports</div>
                <div className="hero-feature-desc">Make data-driven decisions</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Form Section */}
      <div className="login-form-section">
        <div className="login-form-container">
          <div className="form-header">
            <h2>Welcome Back</h2>
            <p>Sign in to continue to your dashboard</p>
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
                />
              </div>
            </div>

            <div className="form-group-custom">
              <label className="form-label-custom">PASSWORD</label>
              <div className="input-wrapper">
                <i className="bi bi-lock input-icon"></i>
                <input
                  type={showPassword ? 'text' : 'password'}
                  className="form-control-custom"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
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
            </div>

            <div className="form-extras">
              <div className="remember-me">
                <input type="checkbox" id="remember" />
                <label htmlFor="remember">Remember me</label>
              </div>
              <Link href="/forgot-password" className="forgot-password">
                Forgot password?
              </Link>
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
                  Signing in...
                </>
              ) : (
                <>
                  <i className="bi bi-box-arrow-in-right" style={{ marginRight: '8px' }}></i>
                  Sign In
                </>
              )}
            </button>
          </Form>

          <div className="form-footer">
            <p>
              Don&apos;t have an account? <a href="#" onClick={(e) => e.preventDefault()}>Contact Administrator</a>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
