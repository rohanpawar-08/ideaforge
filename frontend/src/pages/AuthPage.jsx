import React from 'react'
import { Icon } from '../components/common/Icon'

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
  return (
    <section className="auth-card-container">
      <div className="auth-card">
        <div className="auth-brand-row">
          <span className="auth-brand-mark">
            <Icon name="sparkles" size={15} />
          </span>
          IdeaForge
        </div>

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
            <label htmlFor="auth-password">Password</label>
            <input
              id="auth-password"
              type="password"
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
                onClick={() => {
                  setAuthMode('signup')
                  setAuthError(null)
                }}
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
                onClick={() => {
                  setAuthMode('login')
                  setAuthError(null)
                }}
              >
                Log in
              </button>
            </p>
          )}
        </div>

        <p className="auth-footnote">
          Free to use · Your roadmaps are saved to your account
        </p>
      </div>
    </section>
  )
}
