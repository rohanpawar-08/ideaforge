import React, { useState } from 'react'
import { Icon } from '../common/Icon'
import { getBeginnerGuideItems } from '../../docsExport'

export function isBeginnerUser(roadmap, previousAnswers = [], messages = []) {
  if (!roadmap) return false
  // 1. Explicit skill level in roadmap response (set by backend or model)
  const rawSkill = roadmap.user_skill_level || roadmap.data?.user_skill_level
  if (rawSkill) {
    return String(rawSkill).toLowerCase().trim() === 'beginner'
  }
  // 2. Check previousAnswers / chat messages for explicit beginner statement
  const textPool = [
    ...(Array.isArray(previousAnswers) ? previousAnswers : []),
    ...(Array.isArray(messages) ? messages.map((m) => m.content || m.text || '') : []),
  ]
  for (const txt of textPool) {
    const lower = String(txt).toLowerCase()
    if (
      /\b(beginner|novice|starter|learning to code|new to programming|just started|zero experience|first project|newbie)\b/i.test(
        lower
      )
    ) {
      return true
    }
  }
  // 3. Fallback: feasibility is explicitly beginner
  const feas = (roadmap.feasibility || roadmap.data?.feasibility || '').toLowerCase()
  if (feas === 'beginner') return true

  return false
}

export function BeginnerGuideSection({
  roadmap,
  idea = '',
}) {
  const [expanded, setExpanded] = useState(true)

  const items = getBeginnerGuideItems(roadmap, idea)
  if (!items || items.length === 0) return null

  return (
    <div className="beginner-guide-container" id="beginner-guide-section">
      <div
        className="beginner-guide-header"
        onClick={() => setExpanded(!expanded)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault()
            setExpanded(!expanded)
          }
        }}
        aria-expanded={expanded}
        title="Click to toggle Beginner's Guide"
      >
        <div className="beginner-guide-title">
          <span className="beginner-icon">
            <Icon name="book" size={18} />
          </span>
          <div className="beginner-title-text">
            <h3>Beginner&apos;s Guide</h3>
            <p className="beginner-subtitle">
              Plain-language explanations and curated learning paths tailored for beginners
            </p>
          </div>
        </div>
        <div className="beginner-header-actions">
          <span className="beginner-level-badge">Skill Level: Beginner</span>
          <button
            type="button"
            className="btn-toggle-beginner"
            onClick={(e) => {
              e.stopPropagation()
              setExpanded(!expanded)
            }}
            aria-label={expanded ? 'Collapse Beginner Guide' : 'Expand Beginner Guide'}
          >
            <Icon name={expanded ? 'chevronUp' : 'chevronDown'} size={14} />
            <span>{expanded ? 'Collapse' : 'Expand'}</span>
          </button>
        </div>
      </div>

      {expanded && (
        <div className="beginner-guide-body">
          {/* General Suggestions Disclaimer Banner */}
          <div className="beginner-disclaimer-banner">
            <span className="disclaimer-icon">
              <Icon name="bulb" size={16} />
            </span>
            <div className="disclaimer-content">
              <strong>General Learning Suggestions:</strong> The resources below are specific,
              well-known, free learning paths (official documentation and recognized beginner
              courses) provided as general educational suggestions to kickstart your journey, not
              live-verified links. Feel free to explore other guides or tutorials that best fit
              your learning pace.
            </div>
          </div>

          {/* Cards Grid for Each Recommended Technology */}
          <div className="beginner-cards-grid">
            {items.map((item, idx) => (
              <div key={idx} className="beginner-card">
                <div className="beginner-card-header">
                  <div className="beginner-tech-badge-group">
                    <span className="beginner-tech-tag">{item.technology}</span>
                    {item.category && (
                      <span className="beginner-category-tag">{item.category}</span>
                    )}
                  </div>
                </div>

                <div className="beginner-explanation-block">
                  <h4 className="beginner-block-title">
                    What it is &amp; Why it&apos;s used in this project
                  </h4>
                  <p className="beginner-explanation-text">{item.explanation}</p>
                </div>

                {item.learning_resource && (
                  <div className="beginner-resource-box">
                    <div className="beginner-resource-header">
                      <span className="resource-icon">
                        <Icon name="cap" size={14} />
                      </span>
                      <span className="resource-label">Recommended Free Resource</span>
                    </div>
                    <p className="beginner-resource-name">
                      <strong>{item.learning_resource.name}</strong>
                    </p>
                    {item.learning_resource.description && (
                      <p className="beginner-resource-desc">
                        {item.learning_resource.description}
                      </p>
                    )}
                    {item.learning_resource.url && (
                      <p className="beginner-resource-url">
                        <span>Suggested link: </span>
                        <code>{item.learning_resource.url}</code>
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
