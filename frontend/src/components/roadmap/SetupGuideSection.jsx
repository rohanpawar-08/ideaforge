import React, { useState } from 'react'
import { Icon } from '../common/Icon'

export function SetupGuideSection({
  setupGuide,
  onRegenerate,
  isRegenerating = false,
}) {
  const [copiedCommand, setCopiedCommand] = useState(false)

  if (!setupGuide) return null

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

  return (
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
          {onRegenerate && (
            <button
              type="button"
              className="btn-regenerate-section"
              id="btn-regenerate-setup-guide"
              onClick={onRegenerate}
              disabled={isRegenerating}
              title="Regenerate Developer Setup Guide"
            >
              {isRegenerating ? (
                <>
                  <span className="btn-spinner" aria-hidden="true"></span>
                  <span>Regenerating...</span>
                </>
              ) : (
                <>
                  <Icon name="refresh" size={12} />
                  <span>Regenerate</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      {/* Getting Started Command (Copyable) */}
      {setupGuide.getting_started_command && (
        <div className="command-box">
          <span className="command-label">Getting Started Command</span>
          <div className="code-block">
            <div className="code-content">
              <span className="code-prompt">$</span>
              <code>{setupGuide.getting_started_command}</code>
            </div>
            <button
              type="button"
              className={`btn-copy ${copiedCommand ? 'copied' : ''}`}
              onClick={() => handleCopyCommand(setupGuide.getting_started_command)}
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
        {setupGuide.primary_language && (
          <div className="setup-card">
            <span className="setup-card-label">Primary Language</span>
            <p className="setup-card-value">{setupGuide.primary_language}</p>
          </div>
        )}
        {setupGuide.editor_recommendation && (
          <div className="setup-card">
            <span className="setup-card-label">Recommended Editor / IDE</span>
            <p className="setup-card-value">{setupGuide.editor_recommendation}</p>
          </div>
        )}
      </div>

      {/* Key Tools List */}
      {setupGuide.key_tools && setupGuide.key_tools.length > 0 && (
        <div className="key-tools-section">
          <h4 className="key-tools-title">Key Tools &amp; Packages</h4>
          <ul className="key-tools-list">
            {setupGuide.key_tools.map((tool, idx) => (
              <li key={idx} className="tool-item">
                <span className="tool-name-tag">{tool.name}</span>
                <span className="tool-purpose">{tool.purpose}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
