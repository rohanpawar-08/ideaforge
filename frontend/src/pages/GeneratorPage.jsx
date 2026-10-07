import React, { useRef, useEffect } from 'react'
import { Icon } from '../components/common/Icon'
import { RoadmapGeneratingCard } from '../components/common/Loader'

export function GeneratorPage({
  idea,
  setIdea,
  hasStarted,
  messages,
  previousAnswers,
  inputValue,
  setInputValue,
  isLoading,
  error,
  generatorMode,
  setGeneratorMode,
  onStart,
  onSendAnswer,
  onQuickPrompt,
  onRetry,
}) {
  const chatEndRef = useRef(null)
  const inputRef = useRef(null)

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (hasStarted) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isLoading, hasStarted])

  // Focus input field when ready for response
  useEffect(() => {
    if (hasStarted && !isLoading) {
      inputRef.current?.focus()
    }
  }, [hasStarted, isLoading])

  return (
    <>
      {!hasStarted ? (
        /* Step 1: Initial Idea Form */
        <section className="initial-card view-fade">
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
              onClick={() => setGeneratorMode('single')}
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
              onClick={() => setGeneratorMode('compare')}
            >
              <Icon name="scale" size={14} />
              Compare Ideas
            </button>
          </div>

          <div className="single-idea-form">
            <label htmlFor="idea-input" className="input-label">
              What do you want to build?
            </label>
            <p className="input-hint">
              Describe your idea in a few sentences. Don&apos;t worry about being perfect—our AI
              assistant will ask up to 4 quick clarifying questions to scope it.
            </p>
            <textarea
              id="idea-input"
              value={idea}
              onChange={(e) => setIdea(e.target.value)}
              placeholder="e.g. A micro-habits tracker for students that sends gentle Discord notifications and uses streaks..."
              rows={4}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                  onStart(e)
                }
              }}
            />

            <div className="quick-suggestions">
              <span className="suggestions-label">Try an example:</span>
              <button
                type="button"
                className="chip-btn"
                onClick={() =>
                  onQuickPrompt(
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
                  onQuickPrompt(
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
                  onQuickPrompt(
                    'An AI flashcard generator that turns YouTube lecture transcripts into spaced repetition cards.'
                  )
                }
              >
                <Icon name="book" size={12} />
                YouTube Lecture Flashcards
              </button>
            </div>

            {error && (
              <div className="error-banner" role="alert">
                <div className="error-text">
                  <Icon name="warning" size={14} /> {error}
                </div>
                {onRetry && (
                  <button className="btn-retry" type="button" onClick={onRetry}>
                    Retry
                  </button>
                )}
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={onStart}
                disabled={!idea.trim() || isLoading}
                id="btn-start-scoping"
              >
                {isLoading ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true"></span>
                    <span>Starting...</span>
                  </>
                ) : (
                  'Start Scoping →'
                )}
              </button>
            </div>
          </div>
        </section>
      ) : (
        /* Step 2: Conversation View */
        <section className="chat-section view-fade">
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
                  <RoadmapGeneratingCard />
                ) : (
                  <div className="message-bubble loading-bubble">
                    <span
                      className="btn-spinner"
                      style={{ width: 14, height: 14 }}
                      aria-hidden="true"
                    ></span>
                    <span className="loading-text">
                      Analyzing your project idea and formulating questions...
                    </span>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div className="error-banner" role="alert">
                <div className="error-text">
                  <Icon name="warning" size={14} /> {error}
                </div>
                {onRetry && (
                  <button className="btn-retry" type="button" onClick={onRetry}>
                    Retry
                  </button>
                )}
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          {/* Chat Input Bar */}
          <form className="chat-input-bar" onSubmit={onSendAnswer}>
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
  )
}
