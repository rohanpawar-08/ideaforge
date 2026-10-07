import React, { useState, useEffect } from 'react'
import { Icon } from '../components/common/Icon'
import { getAccount, changePassword, exportAccountData, deleteAccount } from '../services/api'

export function AccountPage({
  token,
  currentUserEmail,
  onBack,
  onLogout,
}) {
  const [account, setAccount] = useState(null)
  const [isLoadingAccount, setIsLoadingAccount] = useState(true)
  const [accountError, setAccountError] = useState(null)

  // Change Password State
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [isChangingPassword, setIsChangingPassword] = useState(false)
  const [changePasswordSuccess, setChangePasswordSuccess] = useState('')
  const [changePasswordError, setChangePasswordError] = useState('')

  // Export Data State
  const [isExporting, setIsExporting] = useState(false)
  const [exportSuccess, setExportSuccess] = useState('')
  const [exportError, setExportError] = useState('')

  // Delete Account State
  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirmText, setDeleteConfirmText] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState('')

  // Load account data on mount
  useEffect(() => {
    let isMounted = true
    const loadAccount = async () => {
      setIsLoadingAccount(true)
      setAccountError(null)
      try {
        const data = await getAccount(token, onLogout)
        if (isMounted) {
          setAccount(data)
        }
      } catch (err) {
        if (isMounted) {
          setAccountError(err.message || 'Failed to load account profile.')
        }
      } finally {
        if (isMounted) {
          setIsLoadingAccount(false)
        }
      }
    }
    loadAccount()
    return () => {
      isMounted = false
    }
  }, [token, onLogout])

  // Change Password Handler
  const handleChangePassword = async (e) => {
    e.preventDefault()
    setChangePasswordSuccess('')
    setChangePasswordError('')

    if (!currentPassword) {
      setChangePasswordError('Please enter your current password.')
      return
    }
    if (newPassword.length < 8) {
      setChangePasswordError('New password must be at least 8 characters.')
      return
    }
    if (newPassword === currentPassword) {
      setChangePasswordError('New password cannot be the same as your current password.')
      return
    }
    if (newPassword !== confirmPassword) {
      setChangePasswordError('New passwords do not match.')
      return
    }

    setIsChangingPassword(true)
    try {
      const res = await changePassword(currentPassword, newPassword, token, onLogout)
      setChangePasswordSuccess(res.message || 'Password changed successfully.')
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setChangePasswordError(err.message || 'Failed to change password.')
    } finally {
      setIsChangingPassword(false)
    }
  }

  // Export Data Handler
  const handleExportData = async () => {
    setExportError('')
    setExportSuccess('')
    setIsExporting(true)

    try {
      const data = await exportAccountData(token, onLogout)
      const jsonStr = JSON.stringify(data, null, 2)
      const blob = new Blob([jsonStr], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const dateStr = new Date().toISOString().slice(0, 10)
      const filename = `ideaforge-export-${dateStr}.json`

      const link = document.createElement('a')
      link.href = url
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(url)

      setExportSuccess(`Successfully exported account data and ${data.roadmaps?.length || 0} saved roadmap(s).`)
    } catch (err) {
      setExportError(err.message || 'Failed to export account data.')
    } finally {
      setIsExporting(false)
    }
  }

  // Delete Account Handler
  const handleDeleteAccount = async (e) => {
    e.preventDefault()
    setDeleteError('')

    if (!deletePassword) {
      setDeleteError('Please enter your current password to confirm deletion.')
      return
    }
    if (deleteConfirmText.trim() !== 'DELETE') {
      setDeleteError('Please type "DELETE" in uppercase to confirm.')
      return
    }

    const reallySure = window.confirm(
      'Are you absolutely sure you want to permanently delete your account and all data? This cannot be undone.'
    )
    if (!reallySure) return

    setIsDeleting(true)
    try {
      await deleteAccount(deletePassword, token, onLogout)
      // Successful deletion immediately logs out and redirects
      onLogout()
    } catch (err) {
      setDeleteError(err.message || 'Failed to delete account. Please try again.')
      setIsDeleting(false)
    }
  }

  const formatCreationDate = (dateStr) => {
    if (!dateStr) return 'Active Member'
    try {
      const d = new Date(dateStr)
      return d.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    } catch {
      return dateStr
    }
  }

  return (
    <div className="account-page-container">
      {/* Navigation & Header */}
      <div className="account-top-nav">
        <button
          type="button"
          className="btn-secondary btn-sm btn-back"
          onClick={onBack}
          id="btn-back-to-generator"
        >
          <Icon name="arrowLeft" size={14} />
          Back to Generator
        </button>
      </div>

      <header className="account-page-header">
        <div className="account-header-badge">
          <Icon name="user" size={24} />
        </div>
        <div>
          <h2>Account & Security</h2>
          <p className="account-header-desc">
            Manage your credentials, export your project roadmaps, or delete your account.
          </p>
        </div>
      </header>

      {accountError && (
        <div className="auth-error-banner" role="alert">
          <Icon name="warning" size={14} />
          <span>{accountError}</span>
        </div>
      )}

      <div className="account-grid">
        {/* Card 1: Profile Information */}
        <section className="account-card" aria-labelledby="section-profile-info">
          <div className="account-card-header">
            <div className="account-card-icon">
              <Icon name="shield" size={18} />
            </div>
            <div>
              <h3 id="section-profile-info">Profile Information</h3>
              <p className="account-card-subtitle">Your registered IdeaForge account details</p>
            </div>
          </div>

          <div className="account-details-list">
            <div className="account-detail-row">
              <span className="account-detail-label">Email Address</span>
              <span className="account-detail-value" id="account-email-value">
                {account?.email || currentUserEmail || 'Loading...'}
              </span>
            </div>
            <div className="account-detail-row">
              <span className="account-detail-label">Account Created</span>
              <span className="account-detail-value" id="account-created-value">
                {isLoadingAccount ? 'Loading...' : formatCreationDate(account?.created_at)}
              </span>
            </div>
            <div className="account-detail-row">
              <span className="account-detail-label">Status</span>
              <span className="account-status-pill">
                <Icon name="check" size={12} /> Active
              </span>
            </div>
          </div>
        </section>

        {/* Card 2: Change Password */}
        <section className="account-card" aria-labelledby="section-change-password">
          <div className="account-card-header">
            <div className="account-card-icon">
              <Icon name="key" size={18} />
            </div>
            <div>
              <h3 id="section-change-password">Change Password</h3>
              <p className="account-card-subtitle">Ensure your account uses a secure password</p>
            </div>
          </div>

          {changePasswordSuccess && (
            <div className="auth-success-banner" role="status">
              <Icon name="check" size={15} />
              <span>{changePasswordSuccess}</span>
            </div>
          )}

          {changePasswordError && (
            <div className="auth-error-banner" role="alert">
              <Icon name="warning" size={14} />
              <span>{changePasswordError}</span>
            </div>
          )}

          <form onSubmit={handleChangePassword} className="account-form" noValidate>
            <div className="form-group">
              <label htmlFor="input-current-password">Current Password</label>
              <div className="password-input-wrapper">
                <input
                  id="input-current-password"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  autoComplete="current-password"
                  required
                  disabled={isChangingPassword}
                />
                <button
                  type="button"
                  className="btn-toggle-password"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  title={showCurrentPassword ? 'Hide password' : 'Show password'}
                  aria-label={showCurrentPassword ? 'Hide password' : 'Show password'}
                >
                  <Icon name={showCurrentPassword ? 'eyeOff' : 'eye'} size={15} />
                </button>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="input-new-password">New Password</label>
              <div className="password-input-wrapper">
                <input
                  id="input-new-password"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  autoComplete="new-password"
                  required
                  disabled={isChangingPassword}
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
              <label htmlFor="input-confirm-password">Confirm New Password</label>
              <input
                id="input-confirm-password"
                type={showNewPassword ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repeat new password"
                autoComplete="new-password"
                required
                disabled={isChangingPassword}
              />
            </div>

            <button
              type="submit"
              id="btn-update-password"
              className="btn-primary"
              disabled={isChangingPassword || !currentPassword || !newPassword || !confirmPassword}
            >
              {isChangingPassword ? (
                <>
                  <span className="btn-spinner" aria-hidden="true"></span>
                  <span>Updating Password...</span>
                </>
              ) : (
                'Update Password'
              )}
            </button>
          </form>
        </section>

        {/* Card 3: Export My Data */}
        <section className="account-card" aria-labelledby="section-export-data">
          <div className="account-card-header">
            <div className="account-card-icon">
              <Icon name="download" size={18} />
            </div>
            <div>
              <h3 id="section-export-data">Export My Data</h3>
              <p className="account-card-subtitle">Download a complete copy of your personal data</p>
            </div>
          </div>

          <p className="account-card-body-text">
            Export includes your account profile information and all generated project roadmaps,
            milestones, and technical specifications in standard JSON format.
          </p>

          {exportSuccess && (
            <div className="auth-success-banner" role="status">
              <Icon name="check" size={15} />
              <span>{exportSuccess}</span>
            </div>
          )}

          {exportError && (
            <div className="auth-error-banner" role="alert">
              <Icon name="warning" size={14} />
              <span>{exportError}</span>
            </div>
          )}

          <div className="account-action-row">
            <button
              type="button"
              id="btn-export-account-data"
              className="btn-secondary"
              onClick={handleExportData}
              disabled={isExporting}
            >
              {isExporting ? (
                <>
                  <span className="btn-spinner" aria-hidden="true"></span>
                  <span>Generating Export...</span>
                </>
              ) : (
                <>
                  <Icon name="download" size={14} />
                  <span>Download Data Package (JSON)</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Card 4: Danger Zone */}
        <section className="account-card danger-card" aria-labelledby="section-danger-zone">
          <div className="account-card-header">
            <div className="account-card-icon danger-icon">
              <Icon name="warning" size={18} />
            </div>
            <div>
              <h3 id="section-danger-zone" className="danger-heading">Danger Zone</h3>
              <p className="account-card-subtitle">Permanent and irreversible account deletion</p>
            </div>
          </div>

          <div className="danger-alert-box">
            <Icon name="warning" size={18} />
            <div>
              <strong>Warning: Deleting your account is permanent!</strong>
              <p>
                All your roadmaps, generated documents, and authentication tokens will be
                immediately wiped from the database. This action cannot be reversed.
              </p>
            </div>
          </div>

          {deleteError && (
            <div className="auth-error-banner" role="alert">
              <Icon name="warning" size={14} />
              <span>{deleteError}</span>
            </div>
          )}

          <form onSubmit={handleDeleteAccount} className="account-form" noValidate>
            <div className="form-group">
              <label htmlFor="input-delete-password">Confirm Password</label>
              <input
                id="input-delete-password"
                type="password"
                value={deletePassword}
                onChange={(e) => setDeletePassword(e.target.value)}
                placeholder="Enter current password to confirm"
                autoComplete="current-password"
                required
                disabled={isDeleting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="input-delete-confirmation">
                Type <strong>DELETE</strong> to confirm:
              </label>
              <input
                id="input-delete-confirmation"
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="DELETE"
                required
                disabled={isDeleting}
              />
            </div>

            <button
              type="submit"
              id="btn-confirm-delete-account"
              className="btn-danger"
              disabled={isDeleting || !deletePassword || deleteConfirmText.trim() !== 'DELETE'}
            >
              {isDeleting ? (
                <>
                  <span className="btn-spinner" aria-hidden="true"></span>
                  <span>Deleting Account...</span>
                </>
              ) : (
                <>
                  <Icon name="trash" size={14} />
                  <span>Permanently Delete Account</span>
                </>
              )}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}
