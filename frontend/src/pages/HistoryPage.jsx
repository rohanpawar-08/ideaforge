import React from 'react'
import { Icon } from '../components/common/Icon'
import { SkeletonHistory } from '../components/common/Loader'
import { EmptyState } from '../components/common/EmptyState'

function formatDate(dateString) {
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

export function HistoryPage({
  roadmaps = [],
  isLoading = false,
  error = null,
  onSelectRoadmap,
  onReset,
  onRetry,
}) {
  return (
    <section className="history-section view-fade">
      <div className="history-header">
        <div className="history-title-block">
          <h2>Roadmap History</h2>
          <p>Browse previously generated technical roadmaps and review timelines.</p>
        </div>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={onReset}
          id="btn-history-new-idea"
        >
          <Icon name="zap" size={12} />
          New Idea
        </button>
      </div>

      {isLoading && <SkeletonHistory />}

      {error && (
        <div className="error-banner" role="alert">
          <div className="error-text">
            <Icon name="warning" size={14} /> {error}
          </div>
          {onRetry && (
            <button
              className="btn-retry"
              type="button"
              onClick={onRetry}
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!isLoading && !error && roadmaps.length === 0 && (
        <EmptyState
          icon="folder"
          title="No saved roadmaps yet"
          description="Generate your first technical roadmap to see it listed here."
          actionLabel="Generate Your First Roadmap →"
          onAction={onReset}
        />
      )}

      {!isLoading && !error && roadmaps.length > 0 && (
        <div className="history-grid">
          {roadmaps.map((item) => {
            const feasibility = (
              item.summary?.feasibility || 'intermediate'
            ).toLowerCase()
            const weeks = item.summary?.estimated_weeks || 4

            return (
              <div
                key={item.id}
                id={`history-card-${item.id}`}
                className="history-card"
                onClick={() => onSelectRoadmap(item.id)}
                tabIndex={0}
                role="button"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault()
                    onSelectRoadmap(item.id)
                  }
                }}
              >
                <div className="history-card-top">
                  <span
                    className={`badge badge-feasibility feasibility-${feasibility}`}
                  >
                    {feasibility.toUpperCase()}
                  </span>
                  <span className="history-card-date">
                    {formatDate(item.created_at)}
                  </span>
                </div>

                <h3 className="history-card-idea">{item.original_idea}</h3>

                <div className="history-card-footer">
                  <span className="history-card-weeks">
                    <Icon name="clock" size={12} />
                    {weeks} {weeks === 1 ? 'Week' : 'Weeks'}
                  </span>
                  <span className="history-card-view-link">
                    View Roadmap →
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
