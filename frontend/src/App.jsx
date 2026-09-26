import { useState, useRef, useEffect } from 'react'
import { downloadRoadmapPdf } from './pdfExport'
import { downloadRoadmapReadme } from './readmeExport'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

const DIFFICULTY_CATEGORIES = [
  { key: 'frontend_complexity', label: 'Frontend' },
  { key: 'backend_complexity', label: 'Backend' },
  { key: 'database_complexity', label: 'Database' },
  { key: 'ai_complexity', label: 'AI' },
  { key: 'deployment_complexity', label: 'Deployment' },
]

function formatDifficultyLabel(val) {
  if (!val) return 'N/A'
  const normalized = String(val).toLowerCase().replace('-', '_')
  if (normalized === 'not_applicable' || normalized === 'na') return 'N/A'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

// Lightweight inline SVG icon system (stroke-based, inherits currentColor)
// Used uniformly across the app so no section relies on emoji-as-icon.
function Icon({ name, size = 16, className = '' }) {
  const iconPaths = {
    zap: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
    bulb: 'M9 18h6M10 22h4M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14',
    sparkles:
      'M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3zM19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15zM5 16l.7 1.8 1.8.7-1.8.7L5 21l-.7-1.8-1.8-.7 1.8-.7L5 16z',
    lock: 'M5 11h14v10H5zM8 11V7a4 4 0 0 1 8 0v4',
    user: 'M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8',
    logout: 'M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9',
    book: 'M4 19.5A2.5 2.5 0 0 1 6.5 17H20M4 19.5A2.5 2.5 0 0 0 6.5 22H20V2H6.5A2.5 2.5 0 0 0 4 4.5z',
    refresh: 'M21 12a9 9 0 1 1-2.64-6.36L21 8M21 3v5h-5',
    sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42',
    moon: 'M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z',
    folder: 'M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z',
    clock: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 6v6l4 2',
    target:
      'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M12 18a6 6 0 1 0 0-12 6 6 0 0 0 0 12M12 14a2 2 0 1 0 0-4 2 2 0 0 0 0 4',
    rocket:
      'M4.5 16.5c-1.5 1.26-2 5-2 5s3.74-.5 5-2c.71-.84.7-2.13-.09-2.91a2.18 2.18 0 0 0-2.91-.09zM12 15l-3-3a22 22 0 0 1 2-3.95A12.88 12.88 0 0 1 22 2c0 2.72-.78 7.5-6 11a22.35 22.35 0 0 1-4 2zM9 12H4s.55-3.03 2-4c1.62-1.08 5 0 5 0M12 15v5s3.03-.55 4-2c1.08-1.62 0-5 0-5',
    file: 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8',
    download: 'M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3',
    database:
      'M12 8c4.97 0 9-1.34 9-3s-4.03-3-9-3-9 1.34-9 3 4.03 3 9 3M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3',
    table: 'M3 5h18v14H3zM3 10h18M9 5v14',
    message:
      'M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8z',
    help: 'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3M12 17h.01',
    scale: 'M12 3v18M8 21h8M3 7h18M6 7l-2.5 5.5a3 3 0 0 0 5 0L6 7M18 7l-2.5 5.5a3 3 0 0 0 5 0L18 7',
    cap: 'M22 10L12 5 2 10l10 5 10-5zM6 12v5c0 1.7 2.7 3 6 3s6-1.3 6-3v-5',
    card: 'M2 5h20v14H2zM2 10h20',
    copy: 'M9 9h13v13H9zM5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1',
    check: 'M20 6L9 17l-5-5',
    warning:
      'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0zM12 9v4M12 17h.01',
  }
  const pathData = iconPaths[name] || iconPaths.sparkles
  return (
    <svg
      className={`icon ${className}`.trim()}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <path d={pathData} />
    </svg>
  )
}

function App() {
  // Authentication states
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

  // Navigation view state: 'generator' | 'history' | 'saved_roadmap'
  const [view, setView] = useState('generator')

  // Generator states
  const [idea, setIdea] = useState('')
  const [hasStarted, setHasStarted] = useState(false)
  const [messages, setMessages] = useState([])
  const [previousAnswers, setPreviousAnswers] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [roadmap, setRoadmap] = useState(null)
  const [error, setError] = useState(null)
  const [copiedCommand, setCopiedCommand] = useState(false)

  // History states
  const [historyRoadmaps, setHistoryRoadmaps] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState(null)
  const [isLoadingSaved, setIsLoadingSaved] = useState(false)

  // Progress tracking: map of { [taskText]: boolean } for the current roadmap
  const [checkedTasks, setCheckedTasks] = useState({})

  // Section regeneration states
  const [regeneratingSection, setRegeneratingSection] = useState({})
  const [regenerateError, setRegenerateError] = useState(null)

  // Idea comparison states
  const [generatorMode, setGeneratorMode] = useState('single') // 'single' | 'compare'
  const [compareIdeas, setCompareIdeas] = useState(['', ''])
  const [isComparing, setIsComparing] = useState(false)
  const [compareError, setCompareError] = useState(null)
  const [comparisonResult, setComparisonResult] = useState(null)

  // Roadmap Follow-Up Chat states
  const [roadmapChatMessages, setRoadmapChatMessages] = useState([])
  const [roadmapChatInput, setRoadmapChatInput] = useState('')
  const [isAskingRoadmap, setIsAskingRoadmap] = useState(false)
  const [roadmapChatError, setRoadmapChatError] = useState(null)
  const [applyingChangeId, setApplyingChangeId] = useState(null)

  // Theme state: 'light' | 'dark' (defaults to user choice or prefers-color-scheme)
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
    document.documentElement.setAttribute('data-theme', theme)
    try {
      localStorage.setItem('ideaforge_theme', theme)
    } catch (e) {
      console.warn(e)
    }
  }, [theme])

  // Listen for system theme changes if user hasn't explicitly set a preference
  useEffect(() => {
    const mediaQuery = window.matchMedia?.('(prefers-color-scheme: dark)')
    if (!mediaQuery) return

    const handleSystemThemeChange = (e) => {
      const savedTheme = localStorage.getItem('ideaforge_theme')
      if (!savedTheme) {
        setTheme(e.matches ? 'dark' : 'light')
      }
    }

    mediaQuery.addEventListener?.('change', handleSystemThemeChange)
    return () => {
      mediaQuery.removeEventListener?.('change', handleSystemThemeChange)
    }
  }, [])

  const toggleTheme = () => {
    setTheme((prev) => (prev === 'dark' ? 'light' : 'dark'))
  }

  const chatEndRef = useRef(null)
  const inputRef = useRef(null)
  const lastRequestRef = useRef({ ideaText: '', answers: [] })

  // Restore active roadmap across page reloads (only when authenticated)
  useEffect(() => {
    if (!token) return
    try {
      const savedRoadmap = localStorage.getItem('ideaforge_active_roadmap')
      const savedRoadmapId = localStorage.getItem('ideaforge_active_roadmap_id')
      const savedView = localStorage.getItem('ideaforge_active_view')
      if (savedRoadmap && savedRoadmapId) {
        const parsed = JSON.parse(savedRoadmap)
        setRoadmap(parsed)
        setView(savedView === 'saved_roadmap' ? 'saved_roadmap' : 'generator')
      }
    } catch (err) {
      console.warn('Could not restore active roadmap from localStorage:', err)
    }
  }, [token])

  // Sync checked tasks state from localStorage whenever roadmap changes
  useEffect(() => {
    if (!roadmap?.id) {
      setCheckedTasks({})
      return
    }
    const roadmapId = roadmap.id
    const milestones = roadmap.milestones || []
    setCheckedTasks((prevChecked) => {
      const newChecked = { ...prevChecked }
      milestones.forEach((m) => {
        const tasks = Array.isArray(m.tasks)
          ? m.tasks
          : typeof m.tasks === 'string'
          ? [m.tasks]
          : []
        tasks.forEach((t) => {
          const isChecked =
            localStorage.getItem(`roadmap_${roadmapId}_task_${t}`) === 'true' ||
            localStorage.getItem(`roadmap_${roadmapId}_${t}`) === 'true'
          if (isChecked) {
            newChecked[t] = true
          }
        })
      })
      return newChecked
    })
  }, [roadmap?.id, roadmap?.milestones])

  // Toggle task completion and persist in localStorage keyed by roadmap id and task text
  const handleToggleTask = (taskText) => {
    if (!roadmap?.id) return
    const roadmapId = roadmap.id
    const isCurrentlyChecked = Boolean(checkedTasks[taskText])
    const nextState = !isCurrentlyChecked

    const keyWithTask = `roadmap_${roadmapId}_task_${taskText}`
    const keySimple = `roadmap_${roadmapId}_${taskText}`

    if (nextState) {
      localStorage.setItem(keyWithTask, 'true')
      localStorage.setItem(keySimple, 'true')
    } else {
      localStorage.removeItem(keyWithTask)
      localStorage.removeItem(keySimple)
    }

    setCheckedTasks((prev) => {
      const updated = { ...prev, [taskText]: nextState }
      if (!nextState) {
        delete updated[taskText]
      }
      return updated
    })
  }

  const formatDate = (dateString) => {
    if (!dateString) return ''
    try {
      const d = new Date(dateString)
      return d.toLocaleDateString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    } catch {
      return dateString
    }
  }

  const handleCopyCommand = async (command) => {
    if (!command) return
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(command)
      } else {
        const textArea = document.createElement('textarea')
        textArea.value = command
        document.body.appendChild(textArea)
        textArea.select()
        document.execCommand('copy')
        document.body.removeChild(textArea)
      }
      setCopiedCommand(true)
      setTimeout(() => setCopiedCommand(false), 2000)
    } catch (err) {
      console.error('Failed to copy to clipboard:', err)
    }
  }

  // Generate and download roadmap as clean, formatted PDF
  const handleDownloadPdf = () => {
    if (!roadmap) return
    try {
      downloadRoadmapPdf(roadmap, roadmap.original_idea || idea)
    } catch (err) {
      console.error('Failed to export roadmap as PDF:', err)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  // Generate and download roadmap as clean, GitHub-style README.md
  const handleDownloadReadme = () => {
    if (!roadmap) return
    try {
      const md = downloadRoadmapReadme(roadmap, roadmap.original_idea || idea)
      if (typeof window !== 'undefined') {
        window.__lastGeneratedReadme = md
      }
    } catch (err) {
      console.error('Failed to export roadmap as README.md:', err)
      alert('Failed to generate README. Please try again.')
    }
  }

  // Logout handler: clears credentials, active roadmap, and resets view
  const handleLogout = () => {
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
    setRoadmap(null)
    setCheckedTasks({})
    setHistoryRoadmaps([])
    setHasStarted(false)
    setMessages([])
    setPreviousAnswers([])
    setIdea('')
    setInputValue('')
    setError(null)
    setComparisonResult(null)
    setCompareError(null)
    setRoadmapChatMessages([])
    setRoadmapChatInput('')
    setRoadmapChatError(null)
    setView('generator')
    setAuthError(null)
  }

  // Centralized authenticated fetch helper
  // Automatically attaches Authorization: Bearer <token>
  // Automatically clears token and redirects to login if 401 is received
  const authFetch = async (url, options = {}) => {
    const currentToken = token || localStorage.getItem('ideaforge_token')
    const headers = {
      ...(options.headers || {}),
    }
    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`
    }
    const res = await fetch(url, {
      ...options,
      headers,
    })
    if (res.status === 401) {
      handleLogout()
      throw new Error('Your session has expired or is unauthorized. Please log in again.')
    }
    return res
  }

  // Handle Login & Signup form submissions
  const handleAuthSubmit = async (e) => {
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
      const endpoint =
        authMode === 'signup' ? `${API_URL}/auth/signup` : `${API_URL}/auth/login`
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })

      const data = await res.json().catch(() => null)
      if (!res.ok) {
        throw new Error(data?.detail || `Authentication failed (${res.status})`)
      }

      if (!data?.access_token) {
        throw new Error('No access token received from server.')
      }

      try {
        localStorage.setItem('ideaforge_token', data.access_token)
        localStorage.setItem('ideaforge_user_email', email)
      } catch (e) {
        console.warn('Could not store token in localStorage:', e)
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
  }

  // Regenerate an individual section of the roadmap
  const handleRegenerateSection = async (sectionKey) => {
    if (!roadmap?.id) {
      return
    }
    if (regeneratingSection[sectionKey]) return

    setRegeneratingSection((prev) => ({ ...prev, [sectionKey]: true }))
    setRegenerateError(null)

    try {
      const res = await authFetch(`${API_URL}/roadmaps/${roadmap.id}/regenerate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: sectionKey,
          previous_answers: previousAnswers,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || `Server error (${res.status})`)
      }

      const result = await res.json()
      if (result.error) {
        throw new Error(result.message || 'Failed to regenerate section')
      }

      const targetKey = result.target_key
      const updatedSectionData = result.data

      setRoadmap((prev) => {
        if (!prev) return prev
        const updated = {
          ...prev,
          [targetKey]: updatedSectionData,
        }
        try {
          localStorage.setItem('ideaforge_active_roadmap', JSON.stringify(updated))
        } catch (e) {
          console.warn('Could not save updated roadmap to localStorage:', e)
        }
        return updated
      })
    } catch (err) {
      console.error(`Failed to regenerate section ${sectionKey}:`, err)
      setRegenerateError(
        `Failed to regenerate ${sectionKey.replace('_', ' ')}. Please try again.`
      )
    } finally {
      setRegeneratingSection((prev) => ({ ...prev, [sectionKey]: false }))
    }
  }

  // Auto-scroll to bottom of chat when new messages or loading state change
  useEffect(() => {
    if (view === 'generator') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, roadmap, error, view])

  // Focus input field when ready for user response
  useEffect(() => {
    if (view === 'generator' && !isLoading && !roadmap) {
      inputRef.current?.focus()
    }
  }, [isLoading, roadmap, hasStarted, view])

  // Fetch past roadmaps from backend
  const fetchHistoryRoadmaps = async () => {
    setIsLoadingHistory(true)
    setHistoryError(null)
    try {
      const res = await authFetch(`${API_URL}/roadmaps`)
      if (!res.ok) {
        throw new Error(`Failed to load history (Status: ${res.status})`)
      }
      const data = await res.json()
      setHistoryRoadmaps(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('Error fetching roadmaps history:', err)
      setHistoryError('Could not load past roadmaps. Please try again.')
    } finally {
      setIsLoadingHistory(false)
    }
  }

  // Open history view
  const handleOpenHistory = async () => {
    setView('history')
    await fetchHistoryRoadmaps()
  }

  // Select a saved roadmap card to view full roadmap
  const handleSelectRoadmap = async (id) => {
    setIsLoadingSaved(true)
    setHistoryError(null)
    try {
      const res = await authFetch(`${API_URL}/roadmaps/${id}`)
      if (!res.ok) {
        throw new Error(`Failed to fetch roadmap ${id}`)
      }
      const data = await res.json()
      const innerData = data.data || data
      const fullRoadmap = {
        ...innerData,
        id: data.id,
        original_idea: data.original_idea,
        created_at: data.created_at,
      }
      setRoadmap(fullRoadmap)
      setView('saved_roadmap')
      try {
        localStorage.setItem('ideaforge_active_roadmap_id', String(data.id))
        localStorage.setItem('ideaforge_active_roadmap', JSON.stringify(fullRoadmap))
        localStorage.setItem('ideaforge_active_view', 'saved_roadmap')
      } catch (e) {
        console.warn('Could not save active roadmap to localStorage:', e)
      }
    } catch (err) {
      console.error('Failed to load roadmap details:', err)
      setHistoryError('Could not open the selected roadmap. Please try again.')
    } finally {
      setIsLoadingSaved(false)
    }
  }

  const sendToBackend = async (ideaText, answers) => {
    setIsLoading(true)
    setError(null)
    lastRequestRef.current = { ideaText, answers }

    try {
      const res = await authFetch(`${API_URL}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idea: ideaText,
          previous_answers: answers,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        console.error('Backend returned error status:', res.status, errData)
        throw new Error('Something went wrong — please try again.')
      }

      let data
      try {
        data = await res.json()
      } catch (parseErr) {
        console.error('Malformed JSON from server:', parseErr)
        throw new Error('Something went wrong — please try again.')
      }

      if (data.error) {
        console.error('Backend returned business error:', data)
        throw new Error('Something went wrong — please try again.')
      }

      if (data.type === 'question') {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', text: data.text },
        ])
      } else if (data.type === 'roadmap') {
        const roadmapData = data.data || data
        const fullRoadmap = {
          ...roadmapData,
          id: data.id || roadmapData.id,
          original_idea: ideaText,
        }
        setRoadmap(fullRoadmap)
        try {
          if (fullRoadmap.id) {
            localStorage.setItem('ideaforge_active_roadmap_id', String(fullRoadmap.id))
          }
          localStorage.setItem('ideaforge_active_roadmap', JSON.stringify(fullRoadmap))
          localStorage.setItem('ideaforge_active_view', 'generator')
        } catch (e) {
          console.warn('Could not save active roadmap to localStorage:', e)
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'Your project roadmap is ready! Review your customized timeline below.',
          },
        ])
      } else {
        console.error('Unexpected response format:', data)
        throw new Error('Something went wrong — please try again.')
      }
    } catch (err) {
      console.error('Request failed:', err)
      setError('Something went wrong — please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  // Handle submitting initial project idea
  const handleStart = async (e) => {
    e?.preventDefault()
    const trimmed = idea.trim()
    if (!trimmed || isLoading) return

    setView('generator')
    setHasStarted(true)
    setMessages([{ role: 'user', text: trimmed }])
    await sendToBackend(trimmed, [])
  }

  // Handle submitting an answer to a clarifying question
  const handleSendAnswer = async (e) => {
    e?.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed || isLoading || roadmap) return

    const updatedAnswers = [...previousAnswers, trimmed]
    setPreviousAnswers(updatedAnswers)
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }])
    setInputValue('')

    await sendToBackend(idea, updatedAnswers)
  }

  // Quick prompt filler for the initial idea
  const handleQuickPrompt = (promptText) => {
    setIdea(promptText)
  }

  // Reset to start a new idea
  const handleReset = () => {
    try {
      localStorage.removeItem('ideaforge_active_roadmap')
      localStorage.removeItem('ideaforge_active_roadmap_id')
      localStorage.removeItem('ideaforge_active_view')
    } catch (e) {
      console.warn(e)
    }
    setView('generator')
    setGeneratorMode('single')
    setIdea('')
    setHasStarted(false)
    setMessages([])
    setPreviousAnswers([])
    setInputValue('')
    setRoadmap(null)
    setCheckedTasks({})
    setError(null)
    setComparisonResult(null)
    setCompareError(null)
    setRoadmapChatMessages([])
    setRoadmapChatInput('')
    setRoadmapChatError(null)
    lastRequestRef.current = { ideaText: '', answers: [] }
  }

  // Idea Comparison Handlers
  const handleAddCompareIdea = () => {
    if (compareIdeas.length < 3) {
      setCompareIdeas((prev) => [...prev, ''])
    }
  }

  const handleRemoveCompareIdea = (index) => {
    if (compareIdeas.length > 2) {
      setCompareIdeas((prev) => prev.filter((_, idx) => idx !== index))
    }
  }

  const handleUpdateCompareIdea = (index, value) => {
    setCompareIdeas((prev) => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }

  const handleLoadCompareExamples = () => {
    setCompareIdeas([
      'A simple command-line pomodoro timer in Python that beeps when time is up',
      'A fullstack collaborative Kanban board web application with real-time updates and user auth',
      'A distributed real-time event streaming analytics engine with Apache Kafka and Raft consensus',
    ])
    setCompareError(null)
  }

  const handleCompareIdeas = async () => {
    const validIdeas = compareIdeas.map((i) => i.trim()).filter(Boolean)
    if (validIdeas.length < 2) {
      setCompareError('Please enter at least 2 ideas to compare.')
      return
    }

    setIsComparing(true)
    setCompareError(null)

    try {
      const res = await authFetch(`${API_URL}/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ideas: validIdeas }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || `Server returned status ${res.status}`)
      }

      const data = await res.json()
      if (data.error) {
        throw new Error(data.message || 'Failed to compare ideas.')
      }

      setComparisonResult(data)
    } catch (err) {
      console.error('Idea comparison failed:', err)
      setCompareError('Failed to compare ideas. Please check your connection and try again.')
    } finally {
      setIsComparing(false)
    }
  }

  const handlePickIdeaForRoadmap = (chosenIdea) => {
    setGeneratorMode('single')
    setComparisonResult(null)
    setIdea(chosenIdea)
    setHasStarted(true)
    setMessages([{ role: 'user', text: chosenIdea }])
    sendToBackend(chosenIdea, [])
  }

  // Follow-Up Roadmap Chat Handlers
  const handleSendRoadmapChat = async (e, directText = null) => {
    e?.preventDefault()
    const textToSend = (directText || roadmapChatInput).trim()
    if (!textToSend || !roadmap?.id || isAskingRoadmap) return

    const userMsg = {
      id: Date.now(),
      role: 'user',
      text: textToSend,
    }

    setRoadmapChatMessages((prev) => [...prev, userMsg])
    setRoadmapChatInput('')
    setIsAskingRoadmap(true)
    setRoadmapChatError(null)

    try {
      const res = await authFetch(`${API_URL}/roadmaps/${roadmap.id}/ask`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textToSend }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || `Server returned ${res.status}`)
      }

      const data = await res.json()
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: data.reply || 'Here is my evaluation of your roadmap question.',
        proposed_change: data.proposed_change || null,
        applied: false,
      }
      setRoadmapChatMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      console.error('Roadmap ask failed:', err)
      setRoadmapChatError('Could not process your question. Please try again.')
    } finally {
      setIsAskingRoadmap(false)
    }
  }

  const handleApplyRoadmapChange = async (msgId, proposedChange) => {
    if (!roadmap?.id || !proposedChange || applyingChangeId) return

    setApplyingChangeId(msgId)
    setRoadmapChatError(null)

    try {
      const res = await authFetch(`${API_URL}/roadmaps/${roadmap.id}/apply-change`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          section: proposedChange.section,
          data: proposedChange.data,
        }),
      })

      if (!res.ok) {
        const errData = await res.json().catch(() => null)
        throw new Error(errData?.detail || 'Failed to apply change to database')
      }

      const targetKey =
        proposedChange.target_key ||
        (proposedChange.section === 'stack'
          ? 'recommended_stack'
          : proposedChange.section === 'setup_guide'
          ? 'setup_guide'
          : proposedChange.section === 'suggested_schema' || proposedChange.section === 'schema'
          ? 'suggested_schema'
          : 'milestones')

      setRoadmap((prev) => {
        if (!prev) return prev
        const updated = {
          ...prev,
          [targetKey]: proposedChange.data,
        }
        try {
          localStorage.setItem('ideaforge_active_roadmap', JSON.stringify(updated))
        } catch (e) {
          console.warn('Could not save updated roadmap to localStorage:', e)
        }
        return updated
      })

      setRoadmapChatMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
      )
    } catch (err) {
      console.error('Failed to apply change:', err)
      setRoadmapChatError('Failed to apply this change to the roadmap. Please try again.')
    } finally {
      setApplyingChangeId(null)
    }
  }

  // Retry previous action if failed
  const handleRetry = () => {
    setError(null)
    if (lastRequestRef.current.ideaText) {
      sendToBackend(lastRequestRef.current.ideaText, lastRequestRef.current.answers)
    } else if (idea.trim()) {
      handleStart()
    }
  }

  const isShowingRoadmap =
    (view === 'generator' && Boolean(roadmap)) || view === 'saved_roadmap'

  // Progress metrics calculation
  const allMilestones = roadmap?.milestones || []
  const allTasks = allMilestones.flatMap((m) =>
    Array.isArray(m.tasks) ? m.tasks : typeof m.tasks === 'string' ? [m.tasks] : []
  )
  const totalTasksCount = allTasks.length
  const completedTasksCount = allTasks.filter((t) => Boolean(checkedTasks[t])).length
  const progressPercentage =
    totalTasksCount > 0
      ? Math.round((completedTasksCount / totalTasksCount) * 100)
      : 0

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div
          className="header-brand"
          onClick={handleReset}
          title="Back to Generator"
        >
          <div className="brand-badge">
            <Icon name="zap" size={12} /> IdeaForge
          </div>
          <h1>Technical Roadmap Generator</h1>
          <p>Turn a rough project idea into an actionable, week-by-week build plan.</p>
        </div>
        <div className="header-actions">
          {token && currentUserEmail && (
            <span className="user-badge" title={`Signed in as ${currentUserEmail}`}>
              <Icon name="user" size={12} />
              {currentUserEmail}
            </span>
          )}
          <button
            type="button"
            className="btn-theme-toggle"
            onClick={toggleTheme}
            id="btn-theme-toggle"
            title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            <Icon name={theme === 'dark' ? 'sun' : 'moon'} size={16} />
          </button>
          {token && (
            <>
              <button
                className={`btn-secondary btn-sm ${view === 'history' ? 'active-nav-tab' : ''}`}
                onClick={handleOpenHistory}
                id="btn-history"
              >
                <Icon name="book" size={14} />
                History
              </button>
              <button
                className={`btn-secondary btn-sm ${view === 'generator' && !hasStarted ? 'active-nav-tab' : ''}`}
                onClick={handleReset}
                id="btn-new-idea"
              >
                <Icon name="refresh" size={14} />
                New Idea
              </button>
              <button
                className="btn-secondary btn-sm btn-logout"
                onClick={handleLogout}
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

      {/* Main Content Area */}
      <main className="main-content" key={view}>
        {!token ? (
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
                  IdeaForge turns a rough idea into an actionable, week-by-week build plan —
                  complete with milestones, a recommended tech stack, and a database schema.
                </p>
              </div>

              {authError && (
                <div className="auth-error-banner" role="alert">
                  <Icon name="warning" size={14} />
                  <span>{authError}</span>
                </div>
              )}

              <form onSubmit={handleAuthSubmit} className="auth-form" noValidate>
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
                    autoComplete={
                      authMode === 'login' ? 'current-password' : 'new-password'
                    }
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
                      <span className="btn-spinner"></span>
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
        ) : (
          <>
            {/* VIEW 1: Roadmap History View */}
        {view === 'history' && (
          <section className="history-section view-fade">
            <div className="history-header">
              <div className="history-title-block">
                <h2>Roadmap History</h2>
                <p>Browse previously generated technical roadmaps and review timelines.</p>
              </div>
              <button
                className="btn-primary btn-sm"
                onClick={handleReset}
                id="btn-history-new-idea"
              >
                <Icon name="zap" size={12} />
                New Idea
              </button>
            </div>

            {isLoadingHistory && (
              <div className="history-loading" aria-live="polite" aria-busy="true">
                <div className="skeleton-history-card skeleton-shimmer"></div>
                <div className="skeleton-history-card skeleton-shimmer"></div>
                <div className="skeleton-history-card skeleton-shimmer"></div>
              </div>
            )}

            {historyError && (
              <div className="error-banner">
                <div className="error-text">
                  <Icon name="warning" size={14} /> {historyError}
                </div>
                <button
                  className="btn-retry"
                  type="button"
                  onClick={fetchHistoryRoadmaps}
                >
                  Retry
                </button>
              </div>
            )}

            {!isLoadingHistory && !historyError && historyRoadmaps.length === 0 && (
              <div className="history-empty-state">
                <div className="empty-icon">
                  <Icon name="folder" size={36} />
                </div>
                <h3>No saved roadmaps yet</h3>
                <p>Generate your first technical roadmap to see it listed here.</p>
                <button className="btn-primary" onClick={handleReset}>
                  Generate Your First Roadmap →
                </button>
              </div>
            )}

            {!isLoadingHistory && !historyError && historyRoadmaps.length > 0 && (
              <div className="history-grid">
                {historyRoadmaps.map((item) => (
                  <div
                    key={item.id}
                    id={`history-card-${item.id}`}
                    className="history-card"
                    onClick={() => handleSelectRoadmap(item.id)}
                    tabIndex={0}
                    role="button"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleSelectRoadmap(item.id)
                      }
                    }}
                  >
                    <div className="history-card-top">
                      <span
                        className={`badge badge-feasibility feasibility-${(
                          item.summary?.feasibility || 'intermediate'
                        ).toLowerCase()}`}
                      >
                        {(item.summary?.feasibility || 'INTERMEDIATE').toUpperCase()}
                      </span>
                      <span className="history-card-date">
                        {formatDate(item.created_at)}
                      </span>
                    </div>

                    <h3 className="history-card-idea">{item.original_idea}</h3>

                    <div className="history-card-footer">
                      <span className="history-card-weeks">
                        <Icon name="clock" size={12} />
                        {item.summary?.estimated_weeks || 4}{' '}
                        {item.summary?.estimated_weeks === 1 ? 'Week' : 'Weeks'}
                      </span>
                      <span className="history-card-view-link">
                        View Roadmap →
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Skeleton while loading a saved roadmap */}
        {isLoadingSaved && (
          <div className="roadmap-loading-skeleton" aria-live="polite" aria-busy="true">
            <div className="skeleton-row">
              <div className="skeleton-bar skeleton-shimmer" style={{ width: '42%' }}></div>
              <div className="skeleton-bar skeleton-shimmer" style={{ width: '18%' }}></div>
            </div>
            <div className="skeleton-cards-row">
              <div className="skeleton-box skeleton-shimmer"></div>
              <div className="skeleton-box skeleton-shimmer"></div>
            </div>
            <div className="skeleton-block skeleton-shimmer"></div>
          </div>
        )}

        {/* VIEW 2: Roadmap Timeline View (Shared by fresh generation & saved roadmap) */}
        {!isLoadingSaved && isShowingRoadmap && (
          <section className="roadmap-section view-fade">
            {/* Back to History bar when viewing a saved roadmap */}
            {view === 'saved_roadmap' && (
              <div className="saved-roadmap-toolbar">
                <button
                  type="button"
                  className="btn-secondary btn-sm btn-back"
                  onClick={() => setView('history')}
                  id="btn-back-to-history"
                >
                  ← Back to History
                </button>
                <div className="toolbar-right-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-xs btn-generate-readme"
                    onClick={handleDownloadReadme}
                    id="btn-generate-readme-toolbar"
                    title="Generate and download README.md"
                  >
                    <Icon name="file" size={12} />
                    README
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-xs btn-download-pdf"
                    onClick={handleDownloadPdf}
                    id="btn-download-pdf-toolbar"
                    title="Download roadmap as PDF"
                  >
                    <Icon name="download" size={12} />
                    PDF
                  </button>
                  {roadmap.created_at && (
                    <span className="saved-date-tag">
                      Saved on {formatDate(roadmap.created_at)}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Progress Card at Top of Roadmap View */}
            {totalTasksCount > 0 && (
              <div className="roadmap-progress-card" id="roadmap-progress-card">
                <div className="progress-card-header">
                  <div className="progress-info">
                    <span className="progress-badge-icon">
                      <Icon name="target" size={22} />
                    </span>
                    <div>
                      <h3 className="progress-main-title">Roadmap Progress</h3>
                      <p className="progress-task-stats" id="progress-task-stats">
                        {completedTasksCount} of {totalTasksCount} tasks complete
                      </p>
                    </div>
                  </div>
                  <div className="progress-percentage-display">
                    <span
                      className="progress-percentage-num"
                      id="progress-percentage-num"
                    >
                      {progressPercentage}%
                    </span>
                  </div>
                </div>

                <div className="progress-bar-track">
                  <div
                    className="progress-bar-fill"
                    id="progress-bar-fill"
                    style={{ width: `${progressPercentage}%` }}
                    role="progressbar"
                    aria-valuenow={progressPercentage}
                    aria-valuemin="0"
                    aria-valuemax="100"
                  />
                </div>
              </div>
            )}

            {regenerateError && (
              <div className="error-banner">
                <div className="error-text">
                  <Icon name="warning" size={14} /> {regenerateError}
                </div>
                <button
                  className="btn-retry"
                  type="button"
                  onClick={() => setRegenerateError(null)}
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="roadmap-header">
              <div className="roadmap-title-row">
                <div>
                  <h2>Project Roadmap</h2>
                  {(roadmap.original_idea || idea) && (
                    <p className="roadmap-original-idea">
                      <strong>Target Project:</strong> &ldquo;{roadmap.original_idea || idea}&rdquo;
                    </p>
                  )}
                </div>
                <div className="roadmap-header-actions">
                  <button
                    type="button"
                    className="btn-secondary btn-sm btn-generate-readme"
                    onClick={handleDownloadReadme}
                    id="btn-generate-readme"
                    title="Generate and download README.md as a formatted file"
                  >
                    <Icon name="file" size={14} />
                    Generate README
                  </button>
                  <button
                    type="button"
                    className="btn-secondary btn-sm btn-download-pdf"
                    onClick={handleDownloadPdf}
                    id="btn-download-pdf"
                    title="Download roadmap as a formatted PDF"
                  >
                    <Icon name="download" size={14} />
                    Download as PDF
                  </button>
                  <button className="btn-secondary btn-sm" onClick={handleReset}>
                    Plan Another Project
                  </button>
                </div>
              </div>

              {/* Top Meta Summary: Feasibility, Weeks, Tech Stack */}
              <div className="roadmap-summary-cards">
                <div
                  className={`summary-card feasibility-summary-card ${
                    roadmap.difficulty_breakdown ? 'has-breakdown' : ''
                  }`}
                >
                  <div className="feasibility-main-col">
                    <span className="card-label">Feasibility</span>
                    <span
                      className={`badge badge-feasibility feasibility-${(
                        roadmap.feasibility || 'intermediate'
                      ).toLowerCase()}`}
                    >
                      {roadmap.feasibility
                        ? roadmap.feasibility.toUpperCase()
                        : 'INTERMEDIATE'}
                    </span>
                  </div>

                  {roadmap.difficulty_breakdown && (
                    <div className="difficulty-breakdown-col">
                      <span className="card-label">Difficulty Breakdown</span>
                      <div className="difficulty-grid">
                        {DIFFICULTY_CATEGORIES.map((cat) => {
                          const rawVal =
                            roadmap.difficulty_breakdown[cat.key] || 'not_applicable'
                          const cleanVal = String(rawVal)
                            .toLowerCase()
                            .replace('-', '_')
                          const badgeClass =
                            cleanVal === 'not_applicable' || cleanVal === 'na'
                              ? 'not-applicable'
                              : cleanVal
                          return (
                            <div
                              key={cat.key}
                              className="difficulty-badge-item"
                              title={`${cat.label} Complexity: ${formatDifficultyLabel(rawVal)}`}
                            >
                              <span className="difficulty-label">{cat.label}</span>
                              <span
                                className={`badge badge-difficulty difficulty-${badgeClass}`}
                              >
                                {formatDifficultyLabel(rawVal)}
                              </span>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

                <div className="summary-card">
                  <span className="card-label">Estimated Timeline</span>
                  <span className="summary-metric">
                    {roadmap.estimated_weeks || 4}{' '}
                    <span className="metric-unit">
                      {roadmap.estimated_weeks === 1 ? 'Week' : 'Weeks'}
                    </span>
                  </span>
                </div>

                <div className="summary-card stack-card">
                  <div className="section-card-header">
                    <span className="card-label">Recommended Tech Stack</span>
                    <button
                      type="button"
                      className="btn-regenerate-section"
                      id="btn-regenerate-stack"
                      onClick={() => handleRegenerateSection('stack')}
                      disabled={Boolean(regeneratingSection.stack)}
                      title="Regenerate Recommended Tech Stack"
                    >
                      {regeneratingSection.stack ? (
                        <>
                          <span className="btn-spinner"></span>
                          <span>Regenerating...</span>
                        </>
                      ) : (
                        <>
                          <Icon name="refresh" size={12} />
                          <span>Regenerate</span>
                        </>
                      )}
                    </button>
                  </div>
                  <div className="tech-stack-chips">
                    {(roadmap.recommended_stack || []).map((tech, idx) => (
                      <span key={idx} className="tech-chip">
                        {tech}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              {/* Feature Scopes: MVP & Stretch features */}
              <div className="features-grid">
                {roadmap.mvp_features && roadmap.mvp_features.length > 0 && (
                  <div className="feature-box mvp-box">
                    <div className="feature-header">
                      <span className="feature-icon">
                        <Icon name="target" size={16} />
                      </span>
                      <strong>Core MVP Scope</strong>
                    </div>
                    <ul>
                      {roadmap.mvp_features.map((feat, idx) => (
                        <li key={idx}>{feat}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {roadmap.stretch_features && roadmap.stretch_features.length > 0 && (
                  <div className="feature-box stretch-box">
                    <div className="feature-header">
                      <span className="feature-icon">
                        <Icon name="rocket" size={16} />
                      </span>
                      <strong>Stretch Features</strong>
                    </div>
                    <ul>
                      {roadmap.stretch_features.map((feat, idx) => (
                        <li key={idx}>{feat}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Setup Guide */}
            {roadmap.setup_guide && (
              <div className="setup-guide-container">
                <div className="setup-guide-header">
                  <div className="setup-guide-title">
                    <span className="setup-icon">
                      <Icon name="rocket" size={18} />
                    </span>
                    <h3>Developer Setup Guide</h3>
                  </div>
                  <div className="setup-header-actions">
                    <span className="setup-badge">Quick Start</span>
                    <button
                      type="button"
                      className="btn-regenerate-section"
                      id="btn-regenerate-setup-guide"
                      onClick={() => handleRegenerateSection('setup_guide')}
                      disabled={Boolean(regeneratingSection.setup_guide)}
                      title="Regenerate Developer Setup Guide"
                    >
                      {regeneratingSection.setup_guide ? (
                        <>
                          <span className="btn-spinner"></span>
                          <span>Regenerating...</span>
                        </>
                      ) : (
                        <>
                          <Icon name="refresh" size={12} />
                          <span>Regenerate</span>
                        </>
                      )}
                    </button>
                  </div>
                </div>

                {/* Getting Started Command (Copyable) */}
                {roadmap.setup_guide.getting_started_command && (
                  <div className="command-box">
                    <span className="command-label">Getting Started Command</span>
                    <div className="code-block">
                      <div className="code-content">
                        <span className="code-prompt">$</span>
                        <code>{roadmap.setup_guide.getting_started_command}</code>
                      </div>
                      <button
                        type="button"
                        className={`btn-copy ${copiedCommand ? 'copied' : ''}`}
                        onClick={() =>
                          handleCopyCommand(roadmap.setup_guide.getting_started_command)
                        }
                        title="Copy command to clipboard"
                      >
                        {copiedCommand ? (
                          <>
                            <Icon name="check" size={12} /> Copied!
                          </>
                        ) : (
                          <>
                            <Icon name="copy" size={12} /> Copy
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}

                {/* Meta Details: Primary Language & Editor */}
                <div className="setup-grid">
                  {roadmap.setup_guide.primary_language && (
                    <div className="setup-card">
                      <span className="setup-card-label">Primary Language</span>
                      <p className="setup-card-value">
                        {roadmap.setup_guide.primary_language}
                      </p>
                    </div>
                  )}
                  {roadmap.setup_guide.editor_recommendation && (
                    <div className="setup-card">
                      <span className="setup-card-label">Recommended Editor / IDE</span>
                      <p className="setup-card-value">
                        {roadmap.setup_guide.editor_recommendation}
                      </p>
                    </div>
                  )}
                </div>

                {/* Key Tools List */}
                {roadmap.setup_guide.key_tools &&
                  roadmap.setup_guide.key_tools.length > 0 && (
                    <div className="key-tools-section">
                      <h4 className="key-tools-title">Key Tools & Packages</h4>
                      <ul className="key-tools-list">
                        {roadmap.setup_guide.key_tools.map((tool, idx) => (
                          <li key={idx} className="tool-item">
                            <span className="tool-name-tag">{tool.name}</span>
                            <span className="tool-purpose">{tool.purpose}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
              </div>
            )}

            {/* Suggested Database Schema */}
            {roadmap.suggested_schema &&
              Array.isArray(roadmap.suggested_schema) &&
              roadmap.suggested_schema.length > 0 && (
                <div className="suggested-schema-container">
                  <div className="schema-header">
                    <div className="schema-title">
                      <span className="schema-icon">
                        <Icon name="database" size={18} />
                      </span>
                      <h3>Suggested Database Schema</h3>
                    </div>
                    <div className="schema-header-actions">
                      <span className="schema-badge">
                        {roadmap.suggested_schema.length}{' '}
                        {roadmap.suggested_schema.length === 1
                          ? 'Table'
                          : 'Tables'}
                      </span>
                      <button
                        type="button"
                        className="btn-regenerate-section"
                        id="btn-regenerate-schema"
                        onClick={() => handleRegenerateSection('suggested_schema')}
                        disabled={Boolean(regeneratingSection.suggested_schema)}
                        title="Regenerate Suggested Database Schema"
                      >
                      {regeneratingSection.suggested_schema ? (
                        <>
                          <span className="btn-spinner"></span>
                          <span>Regenerating...</span>
                        </>
                      ) : (
                        <>
                          <Icon name="refresh" size={12} />
                          <span>Regenerate</span>
                        </>
                      )}
                      </button>
                    </div>
                  </div>

                  <div className="schema-tables-grid">
                    {roadmap.suggested_schema.map((table, tIdx) => (
                      <div key={tIdx} className="schema-table-card">
                        <div className="schema-table-header">
                          <div className="schema-table-title-group">
                            <span className="schema-table-icon">
                              <Icon name="table" size={14} />
                            </span>
                            <h4 className="schema-table-name">
                              <code>{table.table_name}</code>
                            </h4>
                          </div>
                          <span className="schema-field-count">
                            {(table.fields || []).length}{' '}
                            {(table.fields || []).length === 1
                              ? 'field'
                              : 'fields'}
                          </span>
                        </div>

                        <div className="schema-fields-table">
                          <div className="schema-fields-thead">
                            <span className="th-name">Field</span>
                            <span className="th-type">Type</span>
                            <span className="th-notes">Notes</span>
                          </div>
                          <div className="schema-fields-tbody">
                            {(table.fields || []).map((field, fIdx) => (
                              <div key={fIdx} className="schema-field-row">
                                <span className="td-name">
                                  <code>{field.name}</code>
                                </span>
                                <span className="td-type">
                                  <span className="type-badge">
                                    {field.type}
                                  </span>
                                </span>
                                <span className="td-notes">
                                  {field.notes ? (
                                    <span className="notes-text">
                                      {field.notes}
                                    </span>
                                  ) : (
                                    <span className="notes-empty">—</span>
                                  )}
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Timeline Milestones with Interactive Progress Checkboxes */}
            <div className="timeline-container">
              <div className="timeline-header-row">
                <h3 className="timeline-title">Weekly Milestone Execution Plan</h3>
                <button
                  type="button"
                  className="btn-regenerate-section"
                  id="btn-regenerate-milestones"
                  onClick={() => handleRegenerateSection('milestones')}
                  disabled={Boolean(regeneratingSection.milestones)}
                  title="Regenerate Weekly Milestones"
                >
                  {regeneratingSection.milestones ? (
                    <>
                      <span className="btn-spinner"></span>
                      <span>Regenerating...</span>
                    </>
                  ) : (
                    <>
                      <Icon name="refresh" size={12} />
                      <span>Regenerate</span>
                    </>
                  )}
                </button>
              </div>
              <div className="timeline">
                {(roadmap.milestones || []).map((milestone, idx) => {
                  const tasks = Array.isArray(milestone.tasks)
                    ? milestone.tasks
                    : typeof milestone.tasks === 'string'
                    ? [milestone.tasks]
                    : []
                  return (
                    <div key={idx} className="timeline-item">
                      <div className="timeline-marker">
                        <span className="marker-number">
                          {milestone.week !== undefined ? milestone.week : idx + 1}
                        </span>
                      </div>

                      <div className="timeline-content">
                        <div className="milestone-badge">
                          Week {milestone.week !== undefined ? milestone.week : idx + 1}
                        </div>
                        <h4 className="milestone-goal">{milestone.goal}</h4>
                        {tasks.length > 0 && (
                          <ul className="milestone-tasks">
                            {tasks.map((task, tIdx) => {
                              const isChecked = Boolean(checkedTasks[task])
                              const checkboxId = `task-chk-${idx}-${tIdx}`
                              return (
                                <li
                                  key={tIdx}
                                  className={`task-item ${isChecked ? 'task-checked' : ''}`}
                                  onClick={() => handleToggleTask(task)}
                                >
                                  <input
                                    type="checkbox"
                                    id={checkboxId}
                                    className="task-checkbox-input"
                                    checked={isChecked}
                                    onChange={(e) => {
                                      e.stopPropagation()
                                      handleToggleTask(task)
                                    }}
                                    aria-label={`Mark task completed: ${task}`}
                                  />
                                  <span
                                    className="task-checkbox"
                                    aria-hidden="true"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    <Icon name="check" size={11} />
                                  </span>
                                  <label
                                    htmlFor={checkboxId}
                                    className="task-text"
                                    onClick={(e) => e.stopPropagation()}
                                  >
                                    {task}
                                  </label>
                                </li>
                              )
                            })}
                          </ul>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Follow-up Roadmap Chat & Adjustment Section */}
            <div className="roadmap-chat-container" id="roadmap-chat-container">
              <div className="roadmap-chat-header">
                <div className="roadmap-chat-title-group">
                  <span className="chat-section-icon">
                    <Icon name="message" size={20} />
                  </span>
                  <div>
                    <h3>Questions &amp; Roadmap Adjustments</h3>
                    <p className="chat-section-subtitle">
                      Ask questions about this plan or request adjustments (e.g. &ldquo;simplify week 3&rdquo; or &ldquo;can I use Vue instead of React?&rdquo;).
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat Conversation History */}
              <div className="roadmap-chat-box">
                {roadmapChatMessages.length === 0 ? (
                  <div className="roadmap-chat-empty">
                    <p className="empty-prompt">Have questions or want to modify your plan?</p>
                    <div className="roadmap-chat-suggestions">
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={(e) =>
                          handleSendRoadmapChat(e, 'why is week 2 focused on auth?')
                        }
                      >
                        <Icon name="help" size={12} />
                        Why is week 2 focused on auth?
                      </button>
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={(e) =>
                          handleSendRoadmapChat(e, 'simplify week 3')
                        }
                      >
                        <Icon name="zap" size={12} />
                        Simplify week 3
                      </button>
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={(e) =>
                          handleSendRoadmapChat(e, 'can I use Vue instead of React?')
                        }
                      >
                        <Icon name="refresh" size={12} />
                        Can I use Vue instead of React?
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="roadmap-chat-messages-list">
                    {roadmapChatMessages.map((msg) => (
                      <div
                        key={msg.id}
                        className={`roadmap-chat-row ${
                          msg.role === 'user' ? 'chat-row-user' : 'chat-row-assistant'
                        }`}
                      >
                        <div className="chat-avatar">
                          {msg.role === 'user' ? 'You' : 'AI'}
                        </div>
                        <div className="chat-bubble-wrapper">
                          <div className="chat-text-bubble">{msg.text}</div>

                          {/* Proposed Change Card if detected */}
                          {msg.proposed_change && (
                            <div
                              className="proposed-change-card"
                              id={`proposed-change-${msg.id}`}
                            >
                              <div className="proposed-change-top">
                                <span className="proposed-badge">
                                  Proposed Change:{' '}
                                  {msg.proposed_change.section
                                    .replace('_', ' ')
                                    .toUpperCase()}
                                </span>
                                {msg.applied ? (
                                  <span className="applied-pill">
                                    <Icon name="check" size={12} /> Applied to Roadmap
                                  </span>
                                ) : (
                                  <button
                                    type="button"
                                    className="btn-primary btn-sm btn-apply-change"
                                    onClick={() =>
                                      handleApplyRoadmapChange(
                                        msg.id,
                                        msg.proposed_change
                                      )
                                    }
                                    disabled={applyingChangeId === msg.id}
                                    id={`btn-apply-change-${msg.id}`}
                                  >
                                    {applyingChangeId === msg.id ? (
                                      <>
                                        <span className="btn-spinner"></span>
                                        <span>Applying...</span>
                                      </>
                                    ) : (
                                      <>
                                        <Icon name="zap" size={12} />
                                        Apply this change
                                      </>
                                    )}
                                  </button>
                                )}
                              </div>
                              {msg.proposed_change.summary && (
                                <p className="proposed-summary">
                                  <strong>Summary:</strong>{' '}
                                  {msg.proposed_change.summary}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {isAskingRoadmap && (
                  <div className="roadmap-chat-row chat-row-assistant">
                    <div className="chat-avatar">AI</div>
                    <div className="chat-text-bubble loading-bubble">
                      <span className="dot-pulse"></span>
                      <span>Analyzing roadmap and formulating response...</span>
                    </div>
                  </div>
                )}

                {roadmapChatError && (
                  <div className="error-banner">
                    <div className="error-text">
                      <Icon name="warning" size={14} /> {roadmapChatError}
                    </div>
                    <button
                      className="btn-retry"
                      type="button"
                      onClick={() => setRoadmapChatError(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                )}
              </div>

              {/* Chat Input Bar */}
              <form
                className="roadmap-chat-input-bar"
                onSubmit={handleSendRoadmapChat}
              >
                <input
                  type="text"
                  value={roadmapChatInput}
                  onChange={(e) => setRoadmapChatInput(e.target.value)}
                  placeholder="Ask a question or request a change (e.g. 'simplify week 3', 'can I use Vue instead?')..."
                  disabled={isAskingRoadmap}
                  id="roadmap-chat-input"
                />
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={!roadmapChatInput.trim() || isAskingRoadmap}
                  id="btn-send-roadmap-chat"
                >
                  Send
                </button>
              </form>
            </div>
          </section>
        )}

        {/* VIEW 3: Generator Views (Initial Input Form or Clarifying Chat) */}
        {!isShowingRoadmap && view === 'generator' && (
          <>
            {!hasStarted ? (
              /* Step 1: Initial Idea or Compare Ideas Form */
              <section className="initial-card">
                {/* Mode Selector Tabs: Single Idea vs Compare Ideas */}
                <div className="generator-mode-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    id="tab-single-idea"
                    aria-selected={generatorMode === 'single'}
                    className={`mode-tab-btn ${
                      generatorMode === 'single' ? 'active-mode-tab' : ''
                    }`}
                    onClick={() => {
                      setGeneratorMode('single')
                      setCompareError(null)
                    }}
                  >
                    <Icon name="bulb" size={14} />
                    Single Idea
                  </button>
                  <button
                    type="button"
                    role="tab"
                    id="tab-compare-ideas"
                    aria-selected={generatorMode === 'compare'}
                    className={`mode-tab-btn ${
                      generatorMode === 'compare' ? 'active-mode-tab' : ''
                    }`}
                    onClick={() => {
                      setGeneratorMode('compare')
                      setError(null)
                    }}
                  >
                    <Icon name="scale" size={14} />
                    Compare Ideas
                  </button>
                </div>

                {generatorMode === 'single' ? (
                  /* Single Idea Form */
                  <div className="single-idea-form">
                    <label htmlFor="idea-input" className="input-label">
                      What do you want to build?
                    </label>
                    <p className="input-hint">
                      Describe your idea in a few sentences. Don&apos;t worry about being perfect—our AI assistant will ask up to 4 quick clarifying questions to scope it.
                    </p>
                    <textarea
                      id="idea-input"
                      value={idea}
                      onChange={(e) => setIdea(e.target.value)}
                      placeholder="e.g. A micro-habits tracker for students that sends gentle Discord notifications and uses streaks..."
                      rows={4}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleStart(e)
                        }
                      }}
                    />

                    <div className="quick-suggestions">
                      <span className="suggestions-label">Try an example:</span>
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={() =>
                          handleQuickPrompt(
                            'A web app for students to find study groups on campus based on courses and schedule.'
                          )
                        }
                      >
                        <Icon name="cap" size={12} />
                        Campus Study Group Finder
                      </button>
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={() =>
                          handleQuickPrompt(
                            'A minimalist personal finance dashboard that tracks subscription expenses and alerts before renewals.'
                          )
                        }
                      >
                        <Icon name="card" size={12} />
                        Subscription Renewal Tracker
                      </button>
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={() =>
                          handleQuickPrompt(
                            'An AI flashcard generator that turns YouTube lecture transcripts into spaced repetition cards.'
                          )
                        }
                      >
                        <Icon name="book" size={12} />
                        YouTube Lecture Flashcards
                      </button>
                    </div>

                    {error && (
                      <div className="error-banner">
                        <div className="error-text">
                          <Icon name="warning" size={14} /> {error}
                        </div>
                        <button className="btn-retry" type="button" onClick={handleRetry}>
                          Retry
                        </button>
                      </div>
                    )}

                    <div className="form-actions">
                      <button
                        className="btn-primary"
                        onClick={handleStart}
                        disabled={!idea.trim() || isLoading}
                        id="btn-start-scoping"
                      >
                        {isLoading ? (
                          <>
                            <span className="btn-spinner"></span>
                            <span>Starting...</span>
                          </>
                        ) : (
                          'Start Scoping →'
                        )}
                      </button>
                    </div>
                  </div>
                ) : (
                  /* Compare Ideas Mode */
                  <div className="compare-ideas-container">
                    {!comparisonResult ? (
                      /* Input Stage for 2-3 Ideas */
                      <div className="compare-input-flow">
                        <div className="compare-intro">
                          <label className="input-label">Compare Candidate Projects</label>
                          <p className="input-hint">
                            Enter 2 to 3 project ideas to evaluate feasibility, estimated weeks, and pros &amp; cons side-by-side with an architectural recommendation.
                          </p>
                        </div>

                        <div className="compare-inputs-list">
                          {compareIdeas.map((ideaText, idx) => (
                            <div key={idx} className="compare-idea-box" id={`compare-idea-box-${idx}`}>
                              <div className="compare-box-header">
                                <span className="compare-index-badge">Idea {idx + 1}</span>
                                {compareIdeas.length > 2 && (
                                  <button
                                    type="button"
                                    className="btn-remove-idea"
                                    onClick={() => handleRemoveCompareIdea(idx)}
                                    title="Remove this idea"
                                    id={`btn-remove-idea-${idx}`}
                                  >
                                    <Icon name="logout" size={12} className="icon-x" />
                                    Remove
                                  </button>
                                )}
                              </div>
                              <textarea
                                className="compare-textarea"
                                value={ideaText}
                                onChange={(e) => handleUpdateCompareIdea(idx, e.target.value)}
                                placeholder={`e.g. ${
                                  idx === 0
                                    ? 'A simple command-line pomodoro timer in Python that beeps when time is up'
                                    : idx === 1
                                    ? 'A fullstack collaborative Kanban board web application with real-time updates'
                                    : 'A distributed event streaming analytics engine with Kafka'
                                }`}
                                rows={3}
                                disabled={isComparing}
                                id={`compare-input-${idx}`}
                              />
                            </div>
                          ))}
                        </div>

                        <div className="compare-inputs-controls">
                          {compareIdeas.length < 3 && (
                            <button
                              type="button"
                              className="btn-secondary btn-sm"
                              onClick={handleAddCompareIdea}
                              disabled={isComparing}
                              id="btn-add-idea"
                            >
                              + Add 3rd Idea
                            </button>
                          )}
                          <button
                            type="button"
                            className="chip-btn"
                            onClick={handleLoadCompareExamples}
                            disabled={isComparing}
                            id="btn-load-compare-examples"
                          >
                            <Icon name="zap" size={12} />
                            Load 3 Example Ideas
                          </button>
                        </div>

                        {isComparing && (
                          <div className="compare-loading-skeleton" aria-live="polite" aria-busy="true">
                            <div className="skeleton-cards-row">
                              <div className="skeleton-box skeleton-shimmer"></div>
                              <div className="skeleton-box skeleton-shimmer"></div>
                            </div>
                            <div className="skeleton-block skeleton-shimmer"></div>
                          </div>
                        )}

                        {compareError && (
                          <div className="error-banner">
                            <div className="error-text">
                            <Icon name="warning" size={14} /> {compareError}
                          </div>
                            <button
                              className="btn-retry"
                              type="button"
                              onClick={() => setCompareError(null)}
                            >
                              Dismiss
                            </button>
                          </div>
                        )}

                        <div className="form-actions">
                          <button
                            className="btn-primary"
                            onClick={handleCompareIdeas}
                            disabled={
                              isComparing ||
                              compareIdeas.filter((i) => i.trim()).length < 2
                            }
                            id="btn-submit-compare"
                          >
                            {isComparing ? (
                              <>
                                <span className="btn-spinner"></span>
                                <span>Evaluating &amp; Comparing Ideas...</span>
                              </>
                            ) : (
                              <>
                                <Icon name="scale" size={14} />
                                Compare Ideas →
                              </>
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
                      /* Results View: Side-by-side comparison table/cards + Highlighted Recommendation */
                      /* Results View: Side-by-side comparison table/cards + Highlighted Recommendation */
                      <div className="compare-results-view">
                        <div className="compare-results-header">
                          <div>
                            <h3>Project Comparison Analysis</h3>
                            <p className="input-hint">
                              Evaluated side-by-side across feasibility, estimated duration, advantages, and risks.
                            </p>
                          </div>
                          <button
                            type="button"
                            className="btn-secondary btn-sm"
                            onClick={() => setComparisonResult(null)}
                            id="btn-edit-compared-ideas"
                          >
                            ← Edit Ideas
                          </button>
                        </div>

                        {/* Side-by-side comparison cards */}
                        <div className="comparison-cards-grid">
                          {comparisonResult.comparisons.map((item, idx) => (
                            <div
                              key={idx}
                              className="comparison-card"
                              id={`comparison-card-${idx}`}
                            >
                              <div className="comp-card-top">
                                <span className="compare-index-badge">Idea {idx + 1}</span>
                                <span
                                  className={`badge badge-feasibility feasibility-${(
                                    item.feasibility || 'intermediate'
                                  ).toLowerCase()}`}
                                >
                                  {(item.feasibility || 'INTERMEDIATE').toUpperCase()}
                                </span>
                              </div>

                              <h4 className="comp-idea-title">{item.idea}</h4>

                              <div className="comp-metric-row">
                                <span className="comp-metric-label">Estimated Timeline</span>
                                <span className="comp-metric-val">
                                  <Icon name="clock" size={12} /> {item.estimated_weeks}{' '}
                                  {item.estimated_weeks === 1 ? 'Week' : 'Weeks'}
                                </span>
                              </div>

                              <div className="comp-factors">
                                <div className="comp-factor-block pros-block">
                                  <div className="factor-title">
                                    <span className="factor-icon">
                                      <Icon name="check" size={12} />
                                    </span>{' '}
                                    Pros &amp; Advantages
                                  </div>
                                  <ul className="factor-list">
                                    {(item.pros || []).map((pro, pIdx) => (
                                      <li key={pIdx}>{pro}</li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="comp-factor-block cons-block">
                                  <div className="factor-title">
                                    <span className="factor-icon">
                                      <Icon name="warning" size={12} />
                                    </span>{' '}
                                    Cons &amp; Challenges
                                  </div>
                                  <ul className="factor-list">
                                    {(item.cons || []).map((con, cIdx) => (
                                      <li key={cIdx}>{con}</li>
                                    ))}
                                  </ul>
                                </div>
                              </div>

                              <div className="comp-card-footer">
                                <button
                                  type="button"
                                  className="btn-primary btn-sm btn-pick-idea"
                                  onClick={() => handlePickIdeaForRoadmap(item.idea)}
                                  id={`btn-plan-idea-${idx}`}
                                  title="Create full roadmap for this idea"
                                >
                                  Plan This Idea →
                                </button>
                              </div>
                            </div>
                          ))}
                        </div>

                        {/* Highlighted Recommendation at bottom */}
                        <div
                          className="comparison-recommendation-card"
                          id="comparison-recommendation"
                        >
                          <div className="recommendation-header">
                            <span className="rec-icon">
                              <Icon name="bulb" size={22} />
                            </span>
                            <div>
                              <h4>Architect&apos;s Recommendation &amp; Trade-Offs</h4>
                              <span className="rec-subtitle">
                                Comparative assessment across your candidate projects
                              </span>
                            </div>
                          </div>
                          <div className="recommendation-content">
                            <p>{comparisonResult.recommendation}</p>
                          </div>
                        </div>

                        <div className="compare-results-footer-actions">
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={() => setComparisonResult(null)}
                          >
                            ← Compare Different Ideas
                          </button>
                          <button
                            type="button"
                            className="btn-secondary"
                            onClick={handleReset}
                          >
                            ↺ Back to Generator
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </section>
            ) : (
              /* Step 2: Conversation View */
              <section className="chat-section">
                <div className="chat-messages">
                  {messages.map((msg, index) => (
                    <div
                      key={index}
                      className={`message-row ${
                        msg.role === 'user' ? 'message-user' : 'message-assistant'
                      }`}
                    >
                      <div className="message-avatar">
                        {msg.role === 'user' ? 'You' : 'AI'}
                      </div>
                      <div className="message-bubble">{msg.text}</div>
                    </div>
                  ))}

                  {isLoading && (
                    <div className="message-row message-assistant">
                      <div className="message-avatar">AI</div>
                      {previousAnswers.length >= 3 ||
                      (messages.length > 0 &&
                        /just generate|generate it|skip/i.test(
                          messages[messages.length - 1]?.text || ''
                        )) ? (
                        <div
                          className="roadmap-generating-card"
                          aria-live="polite"
                          aria-busy="true"
                        >
                          <div className="roadmap-generating-header">
                            <span className="btn-spinner generating-spinner"></span>
                            <div className="generating-text-group">
                              <span className="generating-title">
                                Synthesizing your full project roadmap...
                              </span>
                              <span className="generating-subtitle">
                                Generating milestones, tech stack, and database schema
                              </span>
                            </div>
                          </div>
                          <div className="roadmap-generating-skeleton">
                            <div className="skeleton-row">
                              <div
                                className="skeleton-bar skeleton-shimmer"
                                style={{ width: '48%' }}
                              ></div>
                              <div
                                className="skeleton-bar skeleton-shimmer"
                                style={{ width: '22%' }}
                              ></div>
                            </div>
                            <div className="skeleton-cards-row">
                              <div className="skeleton-box skeleton-shimmer"></div>
                              <div className="skeleton-box skeleton-shimmer"></div>
                            </div>
                            <div className="skeleton-block skeleton-shimmer"></div>
                          </div>
                        </div>
                      ) : (
                        <div className="message-bubble loading-bubble">
                          <span className="btn-spinner" style={{ width: 14, height: 14 }}></span>
                          <span className="loading-text">
                            Analyzing your project idea and formulating questions...
                          </span>
                        </div>
                      )}
                    </div>
                  )}

                  {error && (
                    <div className="error-banner">
                      <div className="error-text">
                          <Icon name="warning" size={14} /> {error}
                        </div>
                      <button className="btn-retry" type="button" onClick={handleRetry}>
                        Retry
                      </button>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                {/* Chat Input Bar */}
                <form className="chat-input-bar" onSubmit={handleSendAnswer}>
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(e) => setInputValue(e.target.value)}
                    placeholder="Type your answer here... (or type 'just generate it')"
                    disabled={isLoading}
                  />
                  <button
                    type="submit"
                    className="btn-primary"
                    disabled={!inputValue.trim() || isLoading}
                  >
                    Send
                  </button>
                </form>
                <div className="chat-tips">
                  <span>
                    Tip: Answer simply, or type <em>&ldquo;just generate it&rdquo;</em> to skip ahead immediately.
                  </span>
                  <span className="progress-badge">
                    Question {previousAnswers.length} of 4 answered
                  </span>
                </div>
              </section>
            )}
          </>
        )}
          </>
        )}
      </main>
    </div>
  )
}

export default App
