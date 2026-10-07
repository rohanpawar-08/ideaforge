import React from 'react'

export function Spinner({ size = 16, className = '', label = '' }) {
  return (
    <div className={`spinner-wrapper ${className}`.trim()} role="status">
      <span
        className="btn-spinner"
        style={{ width: size, height: size }}
        aria-hidden="true"
      ></span>
      {label && <span className="spinner-label">{label}</span>}
    </div>
  )
}

export function SkeletonHistory() {
  return (
    <div className="history-loading" aria-live="polite" aria-busy="true">
      <div className="skeleton-history-card skeleton-shimmer"></div>
      <div className="skeleton-history-card skeleton-shimmer"></div>
      <div className="skeleton-history-card skeleton-shimmer"></div>
    </div>
  )
}

export function SkeletonRoadmap() {
  return (
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
  )
}

export function RoadmapGeneratingCard() {
  return (
    <div className="roadmap-generating-card" aria-live="polite" aria-busy="true">
      <div className="roadmap-generating-header">
        <span className="btn-spinner generating-spinner"></span>
        <div className="generating-text-group">
          <span className="generating-title">Synthesizing your full project roadmap...</span>
          <span className="generating-subtitle">
            Generating milestones, tech stack, and database schema
          </span>
        </div>
      </div>
      <div className="roadmap-generating-skeleton">
        <div className="skeleton-row">
          <div className="skeleton-bar skeleton-shimmer" style={{ width: '48%' }}></div>
          <div className="skeleton-bar skeleton-shimmer" style={{ width: '22%' }}></div>
        </div>
        <div className="skeleton-cards-row">
          <div className="skeleton-box skeleton-shimmer"></div>
          <div className="skeleton-box skeleton-shimmer"></div>
        </div>
        <div className="skeleton-block skeleton-shimmer"></div>
      </div>
    </div>
  )
}
