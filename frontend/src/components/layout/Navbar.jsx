import React from 'react'
import { Icon } from '../common/Icon'

export function Navbar({
  token,
  currentUserEmail,
  theme,
  onToggleTheme,
  view,
  hasStarted,
  onOpenHistory,
  onOpenAccount,
  onReset,
  onLogout,
}) {
  return (
    <header className="app-header">
      <div
        className="header-brand"
        onClick={onReset}
        title="Back to Generator"
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            onReset()
          }
        }}
      >
        <div className="brand-badge">
          <Icon name="zap" size={12} /> IdeaForge
        </div>
        <h1>Technical Roadmap Generator</h1>
        <p>Turn a rough project idea into an actionable, week-by-week build plan.</p>
      </div>

      <div className="header-actions">
        {token && currentUserEmail && (
          <span
            className="user-badge clickable"
            onClick={onOpenAccount}
            title={`Signed in as ${currentUserEmail} · Click to manage account`}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                onOpenAccount?.()
              }
            }}
          >
            <Icon name="user" size={12} />
            {currentUserEmail}
          </span>
        )}
        <button
          type="button"
          className="btn-theme-toggle"
          onClick={onToggleTheme}
          id="btn-theme-toggle"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
        </button>
        {token && (
          <>
            <button
              type="button"
              className={`btn-secondary btn-sm ${view === 'history' ? 'active-nav-tab' : ''}`}
              onClick={onOpenHistory}
              id="btn-history"
            >
              <Icon name="book" size={14} />
              History
            </button>
            <button
              type="button"
              className={`btn-secondary btn-sm ${view === 'account' ? 'active-nav-tab' : ''}`}
              onClick={onOpenAccount}
              id="btn-account"
              title="Account & Security Settings"
            >
              <Icon name="user" size={14} />
              Account
            </button>
            <button
              type="button"
              className={`btn-secondary btn-sm ${
                view === 'generator' && !hasStarted ? 'active-nav-tab' : ''
              }`}
              onClick={onReset}
              id="btn-new-idea"
            >
              <Icon name="refresh" size={14} />
              New Idea
            </button>
            <button
              type="button"
              className="btn-secondary btn-sm btn-logout"
              onClick={onLogout}
              id="btn-logout"
              title="Log out of IdeaForge"
            >
              <Icon name="logout" size={14} />
              Log out
            </button>
          </>
        )}
      </div>
    </header>
  )
}
