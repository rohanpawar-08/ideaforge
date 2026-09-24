import { useState, useRef, useEffect } from 'react'
import { downloadRoadmapPdf } from './pdfExport'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
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

  // Restore active roadmap across page reloads
  useEffect(() => {
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
  }, [])

  // Sync checked tasks state from localStorage whenever roadmap changes
  useEffect(() => {
    if (!roadmap?.id) {
      setCheckedTasks({})
      return
    }
    const roadmapId = roadmap.id
    const newChecked = {}
    const milestones = roadmap.milestones || []
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
    setCheckedTasks(newChecked)
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
      const res = await fetch(`${API_URL}/roadmaps`)
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
      const res = await fetch(`${API_URL}/roadmaps/${id}`)
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
      const res = await fetch(`${API_URL}/plan`, {
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
    setIdea('')
    setHasStarted(false)
    setMessages([])
    setPreviousAnswers([])
    setInputValue('')
    setRoadmap(null)
    setCheckedTasks({})
    setError(null)
    lastRequestRef.current = { ideaText: '', answers: [] }
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
        </div>
      </header>

      {/* Main Content Area */}
      <main className="main-content">
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
                <div className="summary-card">
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
                  <span className="card-label">Recommended Tech Stack</span>
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
                  <span className="setup-badge">Quick Start</span>
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

            {/* Timeline Milestones with Interactive Progress Checkboxes */}
            <div className="timeline-container">
              <h3 className="timeline-title">Weekly Milestone Execution Plan</h3>
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
          </section>
        )}

        {/* VIEW 3: Generator Views (Initial Input Form or Clarifying Chat) */}
        {!isShowingRoadmap && view === 'generator' && (
          <>
            {!hasStarted ? (
              /* Step 1: Initial Idea Form */
              <section className="initial-card">
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
                  >
                    {isLoading ? 'Starting...' : 'Start Scoping →'}
                  </button>
                </div>
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
      </main>
    </div>
  )
}

export default App
