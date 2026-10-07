import React from 'react'
import { Icon } from '../common/Icon'

export function RoadmapChat({
  messages = [],
  chatInput = '',
  setChatInput,
  onSendMessage,
  isLoading = false,
  error = null,
  onClearError,
  onApplyChange,
  applyingChangeId = null,
}) {
  return (
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
        {messages.length === 0 ? (
          <div className="roadmap-chat-empty">
            <p className="empty-prompt">Have questions or want to modify your plan?</p>
            <div className="roadmap-chat-suggestions">
              <button
                type="button"
                className="chip-btn"
                onClick={(e) => onSendMessage(e, 'why is week 2 focused on auth?')}
              >
                <Icon name="help" size={12} />
                Why is week 2 focused on auth?
              </button>
              <button
                type="button"
                className="chip-btn"
                onClick={(e) => onSendMessage(e, 'simplify week 3')}
              >
                <Icon name="zap" size={12} />
                Simplify week 3
              </button>
              <button
                type="button"
                className="chip-btn"
                onClick={(e) => onSendMessage(e, 'can I use Vue instead of React?')}
              >
                <Icon name="refresh" size={12} />
                Can I use Vue instead of React?
              </button>
            </div>
          </div>
        ) : (
          <div className="roadmap-chat-messages-list">
            {messages.map((msg) => (
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
                            ? msg.proposed_change.section.replace('_', ' ').toUpperCase()
                            : 'ROADMAP'}
                        </span>
                        {msg.applied ? (
                          <span className="applied-pill">
                            <Icon name="check" size={12} /> Applied to Roadmap
                          </span>
                        ) : (
                          <button
                            type="button"
                            className="btn-primary btn-sm btn-apply-change"
                            onClick={() => onApplyChange(msg.id, msg.proposed_change)}
                            disabled={applyingChangeId === msg.id}
                            id={`btn-apply-change-${msg.id}`}
                          >
                            {applyingChangeId === msg.id ? (
                              <>
                                <span className="btn-spinner" aria-hidden="true"></span>
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
                          <strong>Summary:</strong> {msg.proposed_change.summary}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {isLoading && (
          <div className="roadmap-chat-row chat-row-assistant">
            <div className="chat-avatar">AI</div>
            <div className="chat-text-bubble loading-bubble">
              <span className="dot-pulse"></span>
              <span>Analyzing roadmap and formulating response...</span>
            </div>
          </div>
        )}

        {error && (
          <div className="error-banner">
            <div className="error-text">
              <Icon name="warning" size={14} /> {error}
            </div>
            {onClearError && (
              <button
                className="btn-retry"
                type="button"
                onClick={onClearError}
              >
                Dismiss
              </button>
            )}
          </div>
        )}
      </div>

      {/* Chat Input Bar */}
      <form className="roadmap-chat-input-bar" onSubmit={onSendMessage}>
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          placeholder="Ask a question or request a change (e.g. 'simplify week 3', 'can I use Vue instead?')..."
          disabled={isLoading}
          id="roadmap-chat-input"
        />
        <button
          type="submit"
          className="btn-primary"
          disabled={!chatInput.trim() || isLoading}
          id="btn-send-roadmap-chat"
        >
          Send
        </button>
      </form>
    </div>
  )
}
