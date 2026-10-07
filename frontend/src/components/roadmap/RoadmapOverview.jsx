import React from 'react'
import { Icon } from '../common/Icon'
import { DifficultyBreakdown } from './DifficultyBreakdown'
import { TechStackSection } from './TechStackSection'

export function RoadmapOverview({
  roadmap,
  originalIdea,
  headerActions,
  onRegenerateStack,
  isRegeneratingStack,
}) {
  const targetIdea = roadmap?.original_idea || originalIdea || ''
  const feasibility = (roadmap?.feasibility || 'intermediate').toLowerCase()
  const weeks = roadmap?.estimated_weeks || 4

  return (
    <div className="roadmap-header">
      <div className="roadmap-title-row">
        <div>
          <h2>Project Roadmap</h2>
          {targetIdea && (
            <p className="roadmap-original-idea">
              <strong>Target Project:</strong> &ldquo;{targetIdea}&rdquo;
            </p>
          )}
        </div>
        {headerActions && (
          <div className="roadmap-header-actions">
            {headerActions}
          </div>
        )}
      </div>

      {/* Top Meta Summary: Feasibility, Weeks, Tech Stack */}
      <div className="roadmap-summary-cards">
        <div
          className={`summary-card feasibility-summary-card ${
            roadmap?.difficulty_breakdown ? 'has-breakdown' : ''
          }`}
        >
          <div className="feasibility-main-col">
            <span className="card-label">Feasibility</span>
            <span className={`badge badge-feasibility feasibility-${feasibility}`}>
              {feasibility.toUpperCase()}
            </span>
          </div>

          {roadmap?.difficulty_breakdown && (
            <DifficultyBreakdown breakdown={roadmap.difficulty_breakdown} />
          )}
        </div>

        <div className="summary-card">
          <span className="card-label">Estimated Timeline</span>
          <span className="summary-metric">
            {weeks}{' '}
            <span className="metric-unit">
              {weeks === 1 ? 'Week' : 'Weeks'}
            </span>
          </span>
        </div>

        <TechStackSection
          stack={roadmap?.recommended_stack}
          onRegenerate={onRegenerateStack}
          isRegenerating={isRegeneratingStack}
        />
      </div>

      {/* Feature Scopes: MVP & Stretch features */}
      <div className="features-grid">
        {roadmap?.mvp_features && roadmap.mvp_features.length > 0 && (
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

        {roadmap?.stretch_features && roadmap.stretch_features.length > 0 && (
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
  )
}
