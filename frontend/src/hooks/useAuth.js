import { useState, useCallback } from 'react'
import { login as apiLogin, signup as apiSignup } from '../services/api'

export function useAuth() {
  const [token, setToken] = useState(() => {
    try {
      return localStorage.getItem('ideaforge_token') || ''
    } catch (e) {
      console.warn(e)
      return ''
    }
  })

  const [currentUserEmail, setCurrentUserEmail] = useState(() => {
    try {
      return localStorage.getItem('ideaforge_user_email') || ''
    } catch (e) {
      console.warn(e)
      return ''
    }
  })

  const [authMode, setAuthMode] = useState('login') // 'login' | 'signup'
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authLoading, setAuthLoading] = useState(false)
  const [authError, setAuthError] = useState(null)

  const logout = useCallback((extraCleanupCallback) => {
    try {
      localStorage.removeItem('ideaforge_token')
      localStorage.removeItem('ideaforge_user_email')
      localStorage.removeItem('ideaforge_active_roadmap')
      localStorage.removeItem('ideaforge_active_roadmap_id')
      localStorage.removeItem('ideaforge_active_view')
    } catch (e) {
      console.warn('Error clearing localStorage on logout:', e)
    }
    setToken('')
    setCurrentUserEmail('')
    setAuthEmail('')
    setAuthPassword('')
    setAuthError(null)

    if (typeof extraCleanupCallback === 'function') {
      extraCleanupCallback()
    }
  }, [])

  const handleSubmit = useCallback(
    async (e) => {
      e?.preventDefault()
      const email = authEmail.trim()
      const password = authPassword.trim()
      if (!email || !password) {
        setAuthError('Please enter both email and password.')
        return
      }
      if (authMode === 'signup' && password.length < 6) {
        setAuthError('Password must be at least 6 characters.')
        return
      }

      setAuthLoading(true)
      setAuthError(null)

      try {
        const data =
          authMode === 'signup'
            ? await apiSignup(email, password)
            : await apiLogin(email, password)

        try {
          localStorage.setItem('ideaforge_token', data.access_token)
          localStorage.setItem('ideaforge_user_email', email)
        } catch (storageErr) {
          console.warn('Could not store token in localStorage:', storageErr)
        }

        setToken(data.access_token)
        setCurrentUserEmail(email)
        setAuthPassword('')
        setAuthError(null)
      } catch (err) {
        console.error('Auth error:', err)
        setAuthError(err.message || 'Authentication failed. Please try again.')
      } finally {
        setAuthLoading(false)
      }
    },
    [authEmail, authPassword, authMode]
  )

  return {
    token,
    setToken,
    currentUserEmail,
    setCurrentUserEmail,
    authMode,
    setAuthMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authLoading,
    authError,
    setAuthError,
    handleSubmit,
    logout,
  }
}
