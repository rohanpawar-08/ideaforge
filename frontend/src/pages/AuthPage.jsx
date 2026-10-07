import React, { useState, useEffect } from 'react'
import { Icon } from '../components/common/Icon'
import { forgotPassword, resetPassword } from '../services/api'

export function AuthPage({
  authMode,
  setAuthMode,
  authEmail,
  setAuthEmail,
  authPassword,
  setAuthPassword,
  authLoading,
  authError,
  setAuthError,
  onSubmit,
}) {
  // Reset token from URL query string
  const [resetToken, setResetToken] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)

  // Sub-flow states for forgot / reset
  const [flowLoading, setFlowLoading] = useState(false)
  const [flowSuccessMessage, setFlowSuccessMessage] = useState('')
  const [flowErrorMessage, setFlowErrorMessage] = useState('')

  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search)
      const tokenFromUrl = urlParams.get('reset_token')
      if (tokenFromUrl) {
        setResetToken(tokenFromUrl)
        setAuthMode('reset')
        setAuthError(null)
      }
    } catch (e) {
      console.warn('Could not read reset_token from URL:', e)
    }
  }, [setAuthMode, setAuthError])

  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault()
    const email = authEmail.trim()
    if (!email) {
      setFlowErrorMessage('Please enter your email address.')
      return
    }

    setFlowLoading(true)
    setFlowErrorMessage('')
    setFlowSuccessMessage('')

    try {
      const res = await forgotPassword(email)
      setFlowSuccessMessage(
        res.message || 'If an account exists for that email, reset instructions have been sent.'
      )
    } catch (err) {
      setFlowErrorMessage(err.message || 'Unable to request password reset. Please try again.')
    } finally {
      setFlowLoading(false)
    }
  }

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault()
    const token = resetToken.trim()
    if (!token) {
      setFlowErrorMessage('Reset token is missing or invalid. Please check your reset link.')
      return
    }
    if (newPassword.length < 8) {
      setFlowErrorMessage('Password must be at least 8 characters long.')
      return
    }
    if (newPassword !== confirmPassword) {
      setFlowErrorMessage('Passwords do not match.')
      return
    }

    setFlowLoading(true)
    setFlowErrorMessage('')
    setFlowSuccessMessage('')

    try {
      const res = await resetPassword(token, newPassword)
      setFlowSuccessMessage(
        res.message || 'Password has been successfully reset! You can now log in.'
      )
      // Clean URL query string without reloading
      try {
        const cleanUrl = window.location.pathname
        window.history.replaceState({}, '', cleanUrl)
      } catch (e) {
        console.warn(e)
      }
    } catch (err) {
      setFlowErrorMessage(err.message || 'Invalid or expired reset token.')
    } finally {
      setFlowLoading(false)
    }
  }

  const switchToLogin = () => {
    setAuthMode('login')
    setAuthError(null)
    setFlowErrorMessage('')
    setFlowSuccessMessage('')
    setNewPassword('')
    setConfirmPassword('')
  }

  const switchToSignup = () => {
    setAuthMode('signup')
    setAuthError(null)
    setFlowErrorMessage('')
    setFlowSuccessMessage('')
  }

  const switchToForgot = () => {
    setAuthMode('forgot')
    setAuthError(null)
    setFlowErrorMessage('')
    setFlowSuccessMessage('')
  }

  return (
    <section className="auth-card-container">
      <div className="auth-card">
        <div className="auth-brand-row">
          <span className="auth-brand-mark">
            <Icon name="sparkles" size={15} />
          </span>
          IdeaForge
        </div>

        {/* --- FORGOT PASSWORD MODE --- */}
        {authMode === 'forgot' ? (
          <>
            <div className="auth-header">
              <div className="auth-icon-badge">
                <Icon name="key" size={22} />
              </div>
              <h2>Reset your password</h2>
              <p className="auth-tagline">
                Enter your email address and we will send you a secure link to reset your password.
              </p>
            </div>

            {flowErrorMessage && (
              <div className="auth-error-banner" role="alert">
                <Icon name="warning" size={14} />
                <span>{flowErrorMessage}</span>
              </div>
            )}

            {flowSuccessMessage ? (
              <div className="auth-success-banner" role="status">
                <div className="auth-success-icon">
                  <Icon name="check" size={18} />
                </div>
                <p className="auth-success-text">{flowSuccessMessage}</p>
                <button
                  type="button"
                  className="btn-primary btn-auth-submit"
                  onClick={switchToLogin}
                  id="btn-back-to-login"
                >
                  Return to Log In
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotPasswordSubmit} className="auth-form" noValidate>
                <div className="form-group">
                  <label htmlFor="auth-forgot-email">Email Address</label>
                  <input
                    id="auth-forgot-email"
                    type="email"
                    value={authEmail}
                    onChange={(e) => setAuthEmail(e.target.value)}
                    placeholder="developer@example.com"
                    autoComplete="email"
                    required
                    disabled={flowLoading}
                  />
                </div>

                <button
                  type="submit"
                  id="btn-forgot-submit"
                  className="btn-primary btn-auth-submit"
                  disabled={flowLoading}
                >
                  {flowLoading ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true"></span>
                      <span>Sending link...</span>
                    </>
                  ) : (
                    'Send Reset Link'
                  )}
                </button>
              </form>
            )}

            <div className="auth-footer">
              <p>
                Remember your password?{' '}
                <button
                  type="button"
                  id="btn-toggle-login-from-forgot"
                  className="btn-link"
                  onClick={switchToLogin}
                >
                  Back to Log in
                </button>
              </p>
            </div>
          </>
        ) : authMode === 'reset' ? (
          /* --- RESET PASSWORD MODE --- */
          <>
            <div className="auth-header">
              <div className="auth-icon-badge">
                <Icon name="lock" size={22} />
              </div>
              <h2>Set new password</h2>
              <p className="auth-tagline">
                Choose a strong password with at least 8 characters.
              </p>
            </div>

            {flowErrorMessage && (
              <div className="auth-error-banner" role="alert">
                <Icon name="warning" size={14} />
                <span>{flowErrorMessage}</span>
              </div>
            )}

            {flowSuccessMessage ? (
              <div className="auth-success-banner" role="status">
                <div className="auth-success-icon">
                  <Icon name="check" size={18} />
                </div>
                <p className="auth-success-text">{flowSuccessMessage}</p>
                <button
                  type="button"
                  className="btn-primary btn-auth-submit"
                  onClick={switchToLogin}
                  id="btn-login-after-reset"
                >
                  Log In with New Password
                </button>
              </div>
            ) : (
              <form onSubmit={handleResetPasswordSubmit} className="auth-form" noValidate>
                {!resetToken && (
                  <div className="form-group">
                    <label htmlFor="auth-reset-token">Reset Token</label>
                    <input
                      id="auth-reset-token"
                      type="text"
                      value={resetToken}
                      onChange={(e) => setResetToken(e.target.value)}
                      placeholder="Paste your reset token"
                      required
                      disabled={flowLoading}
                    />
                  </div>
                )}

                <div className="form-group">
                  <label htmlFor="auth-new-password">New Password</label>
                  <div className="password-input-wrapper">
                    <input
                      id="auth-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="At least 8 characters"
                      autoComplete="new-password"
                      required
                      disabled={flowLoading}
                    />
                    <button
                      type="button"
                      className="btn-toggle-password"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      title={showNewPassword ? 'Hide password' : 'Show password'}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                    >
                      <Icon name={showNewPassword ? 'eyeOff' : 'eye'} size={15} />
                    </button>
                  </div>
                </div>

                <div className="form-group">
                  <label htmlFor="auth-confirm-password">Confirm New Password</label>
                  <input
                    id="auth-confirm-password"
                    type={showNewPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repeat new password"
                    autoComplete="new-password"
                    required
                    disabled={flowLoading}
                  />
                </div>

                <button
                  type="submit"
                  id="btn-reset-submit"
                  className="btn-primary btn-auth-submit"
                  disabled={flowLoading}
                >
                  {flowLoading ? (
                    <>
                      <span className="btn-spinner" aria-hidden="true"></span>
                      <span>Resetting password...</span>
                    </>
                  ) : (
                    'Reset Password'
                  )}
                </button>
              </form>
            )}

            <div className="auth-footer">
              <p>
                <button
                  type="button"
                  id="btn-back-login-from-reset"
                  className="btn-link"
                  onClick={switchToLogin}
                >
                  Back to Log in
                </button>
              </p>
            </div>
          </>
        ) : (
          /* --- LOGIN / SIGNUP MODE --- */
          <>
            <div className="auth-header">
              <div className="auth-icon-badge">
                <Icon name={authMode === 'login' ? 'lock' : 'sparkles'} size={22} />
              </div>
              <h2>{authMode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
              <p className="auth-tagline">
                {authMode === 'login'
                  ? 'Sign in to access and manage your personalized project roadmaps.'
                  : 'Join IdeaForge to turn rough project ideas into structured timelines.'}
              </p>
              <p className="auth-description">
                IdeaForge turns a rough idea into an actionable, week-by-week build plan — complete
                with milestones, a recommended tech stack, and a database schema.
              </p>
            </div>

            {authError && (
              <div className="auth-error-banner" role="alert">
                <Icon name="warning" size={14} />
                <span>{authError}</span>
              </div>
            )}

            <form onSubmit={onSubmit} className="auth-form" noValidate>
              <div className="form-group">
                <label htmlFor="auth-email">Email Address</label>
                <input
                  id="auth-email"
                  type="email"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  placeholder="developer@example.com"
                  autoComplete="email"
                  required
                  disabled={authLoading}
                />
              </div>

              <div className="form-group">
                <div className="form-label-row">
                  <label htmlFor="auth-password">Password</label>
                  {authMode === 'login' && (
                    <button
                      type="button"
                      id="btn-forgot-password-link"
                      className="btn-link btn-forgot-link"
                      onClick={switchToForgot}
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
                <div className="password-input-wrapper">
                  <input
                    id="auth-password"
                    type={showPassword ? 'text' : 'password'}
                    value={authPassword}
                    onChange={(e) => setAuthPassword(e.target.value)}
                    placeholder={
                      authMode === 'signup'
                        ? 'At least 6 characters'
                        : 'Enter your password'
                    }
                    autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                    required
                    disabled={authLoading}
                  />
                  <button
                    type="button"
                    className="btn-toggle-password"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? 'Hide password' : 'Show password'}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <Icon name={showPassword ? 'eyeOff' : 'eye'} size={15} />
                  </button>
                </div>
              </div>

              <button
                type="submit"
                id="btn-auth-submit"
                className="btn-primary btn-auth-submit"
                disabled={authLoading}
              >
                {authLoading ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true"></span>
                    <span>
                      {authMode === 'login' ? 'Signing in...' : 'Creating account...'}
                    </span>
                  </>
                ) : authMode === 'login' ? (
                  'Log In'
                ) : (
                  'Sign Up'
                )}
              </button>
            </form>

            <div className="auth-footer">
              {authMode === 'login' ? (
                <p>
                  Don&apos;t have an account?{' '}
                  <button
                    type="button"
                    id="btn-auth-toggle"
                    className="btn-link"
                    onClick={switchToSignup}
                  >
                    Sign up
                  </button>
                </p>
              ) : (
                <p>
                  Already have an account?{' '}
                  <button
                    type="button"
                    id="btn-auth-toggle"
                    className="btn-link"
                    onClick={switchToLogin}
                  >
                    Log in
                  </button>
                </p>
              )}
            </div>
          </>
        )}

        <p className="auth-footnote">
          Free to use · Your roadmaps are saved to your account
        </p>
      </div>
    </section>
  )
}
