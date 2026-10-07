import { useState, useEffect, useCallback } from 'react'

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    try {
      const savedTheme = localStorage.getItem('ideaforge_theme')
      if (savedTheme === 'dark' || savedTheme === 'light') {
        return savedTheme
      }
    } catch (e) {
      console.warn(e)
    }
    if (typeof window !== 'undefined' && window.matchMedia) {
      return window.matchMedia('(prefers-color-scheme: dark)').matches
        ? 'dark'
        : 'light'
    }
    return 'light'
  })

  // Synchronize document data-theme attribute and localStorage on theme change
  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
    try {
      localStorage.setItem('ideaforge_theme', theme)
    } catch (e) {
      console.warn(e)
    }
  }, [theme])

  // Listen for system theme changes if user hasn't explicitly set a preference
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mediaQuery) return

    const handleSystemThemeChange = (e) => {
      try {
        const savedTheme = localStorage.getItem('ideaforge_theme')
        if (!savedTheme) {
          setTheme(e.matches ? 'dark' : 'light')
        }
      } catch (err) {
        console.warn(err)
      }
    }

    mediaQuery.addEventListener?.('change', handleSystemThemeChange)
    return () => {
      mediaQuery.removeEventListener?.('change', handleSystemThemeChange)
    }
  }, [])

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }, [])

  return {
    theme,
    setTheme,
    toggleTheme,
  }
}
