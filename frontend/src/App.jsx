import { useState, useRef, useEffect } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

function App() {
  const [idea, setIdea] = useState('')
  const [hasStarted, setHasStarted] = useState(false)
  const [messages, setMessages] = useState([])
  const [previousAnswers, setPreviousAnswers] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [roadmap, setRoadmap] = useState(null)
  const [error, setError] = useState(null)
  const [copiedCommand, setCopiedCommand] = useState(false)

  const chatEndRef = useRef(null)
  const inputRef = useRef(null)
  const lastRequestRef = useRef({ ideaText: '', answers: [] })

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

  // Auto-scroll to bottom of chat when new messages or loading state change
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isLoading, roadmap, error])

  // Focus input field when ready for user response
  useEffect(() => {
    if (!isLoading && !roadmap) {
      inputRef.current?.focus()
    }
  }, [isLoading, roadmap, hasStarted])

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
        setRoadmap(roadmapData)
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
    setIdea('')
    setHasStarted(false)
    setMessages([])
    setPreviousAnswers([])
    setInputValue('')
    setRoadmap(null)
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

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <div className="brand-badge">⚡ IdeaForge</div>
          <h1>Technical Roadmap Generator</h1>
          <p>Turn a rough project idea into an actionable, week-by-week build plan.</p>
        </div>
        {hasStarted && (
          <button className="btn-secondary btn-sm" onClick={handleReset}>
            ↺ New Idea
          </button>
        )}
      </header>

      {/* Main Content Area */}
      <main className="main-content">
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

            {/* Chat Input Bar (only shown when roadmap is not yet finished) */}
            {!roadmap && (
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
            )}
            {!roadmap && (
              <div className="chat-tips">
                <span>
                  Tip: Answer simply, or type <em>&ldquo;just generate it&rdquo;</em> to skip ahead immediately.
                </span>
                <span className="progress-badge">
                  Question {previousAnswers.length} of 4 answered
                </span>
              </div>
            )}
          </section>
        )}

        {/* Step 3: Roadmap Timeline View */}
        {roadmap && (
          <section className="roadmap-section">
            <div className="roadmap-header">
              <div className="roadmap-title-row">
                <h2>Project Roadmap</h2>
                <button className="btn-secondary btn-sm" onClick={handleReset}>
                  Plan Another Project
                </button>
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

            {/* Timeline Milestones */}
            <div className="timeline-container">
              <h3 className="timeline-title">Weekly Milestone Execution Plan</h3>
              <div className="timeline">
                {(roadmap.milestones || []).map((milestone, idx) => (
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
                      {milestone.tasks && milestone.tasks.length > 0 && (
                        <ul className="milestone-tasks">
                          {milestone.tasks.map((task, tIdx) => (
                            <li key={tIdx} className="task-item">
                              <span className="task-checkbox">✓</span>
                              <span className="task-text">{task}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}

export default App
