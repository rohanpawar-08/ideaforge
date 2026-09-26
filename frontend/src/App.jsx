import { useState, useRef, useEffect } from 'react'
import { downloadRoadmapPdf } from './pdfExport'
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
          style={{ cursor: 'pointer' }}
          title="Back to Generator"
        >
          <div className="brand-badge">⚡ IdeaForge</div>
          <h1>Technical Roadmap Generator</h1>
          <p>Turn a rough project idea into an actionable, week-by-week build plan.</p>
        </div>
        <div className="header-actions">
          {token && currentUserEmail && (
            <span className="user-badge" title={`Signed in as ${currentUserEmail}`}>
              👤 {currentUserEmail}
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
            {theme === 'dark' ? '☀️' : '🌙'}
          </button>
          {token && (
            <>
              <button
                className={`btn-secondary btn-sm ${view === 'history' ? 'active-nav-tab' : ''}`}
                onClick={handleOpenHistory}
                id="btn-history"
              >
                📜 History
              </button>
              <button
                className={`btn-secondary btn-sm ${view === 'generator' && !hasStarted ? 'active-nav-tab' : ''}`}
                onClick={handleReset}
                id="btn-new-idea"
              >
                ↺ New Idea
              </button>
              <button
                className="btn-secondary btn-sm btn-logout"
                onClick={handleLogout}
                id="btn-logout"
                title="Log out of IdeaForge"
              >
                🚪 Log out
              </button>
            </>
          )}
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
        {!token ? (
          <section className="auth-card-container">
            <div className="auth-card">
              <div className="auth-header">
                <div className="auth-icon-badge">
                  {authMode === 'login' ? '🔐' : '✨'}
                </div>
                <h2>{authMode === 'login' ? 'Welcome Back' : 'Create an Account'}</h2>
                <p>
                  {authMode === 'login'
                    ? 'Sign in to access and manage your personalized project roadmaps.'
                    : 'Join IdeaForge to turn rough project ideas into structured timelines.'}
                </p>
              </div>

              {authError && (
                <div className="auth-error-banner" role="alert">
                  <span className="error-icon">⚠️</span>
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
                    <span className="spinner-inline">Processing...</span>
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
            </div>
          </section>
        ) : (
          <>
            {/* VIEW 1: Roadmap History View */}
        {view === 'history' && (
          <section className="history-section">
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
                + New Idea
              </button>
            </div>

            {isLoadingHistory && (
              <div className="history-loading">
                <span className="dot-pulse"></span>
                <span>Loading saved roadmaps...</span>
              </div>
            )}

            {historyError && (
              <div className="error-banner">
                <div className="error-text">⚠️ {historyError}</div>
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
                <div className="empty-icon">📂</div>
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
                        ⏱️ {item.summary?.estimated_weeks || 4}{' '}
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

        {/* Loading overlay when loading saved roadmap */}
        {isLoadingSaved && (
          <div className="history-loading">
            <span className="dot-pulse"></span>
            <span>Loading roadmap details...</span>
          </div>
        )}

        {/* VIEW 2: Roadmap Timeline View (Shared by fresh generation & saved roadmap) */}
        {!isLoadingSaved && isShowingRoadmap && (
          <section className="roadmap-section">
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
                    className="btn-secondary btn-xs btn-download-pdf"
                    onClick={handleDownloadPdf}
                    id="btn-download-pdf-toolbar"
                    title="Download roadmap as PDF"
                  >
                    📥 PDF
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
                    <span className="progress-badge-icon">🎯</span>
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
              <div className="error-banner" style={{ marginBottom: '1.25rem' }}>
                <div className="error-text">⚠️ {regenerateError}</div>
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
                    className="btn-secondary btn-sm btn-download-pdf"
                    onClick={handleDownloadPdf}
                    id="btn-download-pdf"
                    title="Download roadmap as a formatted PDF"
                  >
                    📥 Download as PDF
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
                        '↻ Regenerate'
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
                      <span className="feature-icon">🎯</span>
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
                      <span className="feature-icon">🚀</span>
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
                    <span className="setup-icon">🚀</span>
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
                        '↻ Regenerate'
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
                            <span className="copy-icon">✓</span> Copied!
                          </>
                        ) : (
                          <>
                            <span className="copy-icon">📋</span> Copy
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
                      <span className="schema-icon">🗄️</span>
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
                          '↻ Regenerate'
                        )}
                      </button>
                    </div>
                  </div>

                  <div className="schema-tables-grid">
                    {roadmap.suggested_schema.map((table, tIdx) => (
                      <div key={tIdx} className="schema-table-card">
                        <div className="schema-table-header">
                          <div className="schema-table-title-group">
                            <span className="schema-table-icon">📋</span>
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
                    '↻ Regenerate'
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
                  <span className="chat-section-icon">💬</span>
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
                        ❓ Why is week 2 focused on auth?
                      </button>
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={(e) =>
                          handleSendRoadmapChat(e, 'simplify week 3')
                        }
                      >
                        ⚡ Simplify week 3
                      </button>
                      <button
                        type="button"
                        className="chip-btn"
                        onClick={(e) =>
                          handleSendRoadmapChat(e, 'can I use Vue instead of React?')
                        }
                      >
                        🔄 Can I use Vue instead of React?
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
                                    ✓ Applied to Roadmap
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
                                      '⚡ Apply this change'
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
                  <div className="error-banner" style={{ margin: '12px 0 0 0' }}>
                    <div className="error-text">⚠️ {roadmapChatError}</div>
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
                    💡 Single Idea
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
                    ⚖️ Compare Ideas
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
                        🎓 Campus Study Group Finder
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
                        💳 Subscription Renewal Tracker
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
                        🧠 YouTube Lecture Flashcards
                      </button>
                    </div>

                    {error && (
                      <div className="error-banner">
                        <div className="error-text">⚠️ {error}</div>
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
                        {isLoading ? 'Starting...' : 'Start Scoping →'}
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
                                    ✕ Remove
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
                            ⚡ Load 3 Example Ideas
                          </button>
                        </div>

                        {compareError && (
                          <div className="error-banner">
                            <div className="error-text">⚠️ {compareError}</div>
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
                              '⚖️ Compare Ideas →'
                            )}
                          </button>
                        </div>
                      </div>
                    ) : (
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
                                  ⏱️ {item.estimated_weeks}{' '}
                                  {item.estimated_weeks === 1 ? 'Week' : 'Weeks'}
                                </span>
                              </div>

                              <div className="comp-factors">
                                <div className="comp-factor-block pros-block">
                                  <div className="factor-title">
                                    <span className="factor-icon">✓</span> Pros &amp; Advantages
                                  </div>
                                  <ul className="factor-list">
                                    {(item.pros || []).map((pro, pIdx) => (
                                      <li key={pIdx}>{pro}</li>
                                    ))}
                                  </ul>
                                </div>

                                <div className="comp-factor-block cons-block">
                                  <div className="factor-title">
                                    <span className="factor-icon">⚠️</span> Cons &amp; Challenges
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
                            <span className="rec-icon">💡</span>
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
                      <div className="message-bubble loading-bubble">
                        <span className="dot-pulse"></span>
                        <span className="loading-text">
                          {previousAnswers.length >= 3
                            ? 'Synthesizing your full project roadmap...'
                            : 'Thinking of clarifying questions...'}
                        </span>
                      </div>
                    </div>
                  )}

                  {error && (
                    <div className="error-banner">
                      <div className="error-text">⚠️ {error}</div>
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
