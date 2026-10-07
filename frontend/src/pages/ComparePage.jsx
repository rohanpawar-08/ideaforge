import React from 'react'
import { Icon } from '../components/common/Icon'

export function ComparePage({
  compareIdeas,
  onAddIdea,
  onRemoveIdea,
  onUpdateIdea,
  onLoadExamples,
  onCompare,
  isComparing,
  compareError,
  onClearError,
  comparisonResult,
  onResetComparison,
  onPickIdeaForRoadmap,
  generatorMode,
  setGeneratorMode,
  onBackToGenerator,
}) {
  return (
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

      <div className="compare-ideas-container">
        {!comparisonResult ? (
          /* Input Stage for 2-3 Ideas */
          <div className="compare-input-flow">
            <div className="compare-intro">
              <label className="input-label">Compare Candidate Projects</label>
              <p className="input-hint">
                Enter 2 to 3 project ideas to evaluate feasibility, estimated weeks, and pros
                &amp; cons side-by-side with an architectural recommendation.
              </p>
            </div>

            <div className="compare-inputs-list">
              {compareIdeas.map((ideaText, idx) => (
                <div
                  key={idx}
                  className="compare-idea-box"
                  id={`compare-idea-box-${idx}`}
                >
                  <div className="compare-box-header">
                    <span className="compare-index-badge">Idea {idx + 1}</span>
                    {compareIdeas.length > 2 && (
                      <button
                        type="button"
                        className="btn-remove-idea"
                        onClick={() => onRemoveIdea(idx)}
                        title="Remove this idea"
                        id={`btn-remove-idea-${idx}`}
                      >
                        <Icon name="logout" size={12} className="icon-x" />
                        Remove
                      </button>
                    )}
                  </div>
                  <textarea
                    className="compare-textarea"
                    value={ideaText}
                    onChange={(e) => onUpdateIdea(idx, e.target.value)}
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
                  onClick={onAddIdea}
                  disabled={isComparing}
                  id="btn-add-idea"
                >
                  + Add 3rd Idea
                </button>
              )}
              <button
                type="button"
                className="chip-btn"
                onClick={onLoadExamples}
                disabled={isComparing}
                id="btn-load-compare-examples"
              >
                <Icon name="zap" size={12} />
                Load 3 Example Ideas
              </button>
            </div>

            {isComparing && (
              <div
                className="compare-loading-skeleton"
                aria-live="polite"
                aria-busy="true"
              >
                <div className="skeleton-cards-row">
                  <div className="skeleton-box skeleton-shimmer"></div>
                  <div className="skeleton-box skeleton-shimmer"></div>
                </div>
                <div className="skeleton-block skeleton-shimmer"></div>
              </div>
            )}

            {compareError && (
              <div className="error-banner" role="alert">
                <div className="error-text">
                  <Icon name="warning" size={14} /> {compareError}
                </div>
                <button
                  className="btn-retry"
                  type="button"
                  onClick={onClearError}
                >
                  Dismiss
                </button>
              </div>
            )}

            <div className="form-actions">
              <button
                type="button"
                className="btn-primary"
                onClick={onCompare}
                disabled={
                  isComparing ||
                  compareIdeas.filter((i) => i.trim()).length < 2
                }
                id="btn-submit-compare"
              >
                {isComparing ? (
                  <>
                    <span className="btn-spinner" aria-hidden="true"></span>
                    <span>Evaluating &amp; Comparing Ideas...</span>
                  </>
                ) : (
                  <>
                    <Icon name="scale" size={14} />
                    Compare Ideas →
                  </>
                )}
              </button>
            </div>
          </div>
        ) : (
          /* Results View: Side-by-side comparison cards + Highlighted Recommendation */
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
                onClick={onResetComparison}
                id="btn-edit-compared-ideas"
              >
                ← Edit Ideas
              </button>
            </div>

            {/* Side-by-side comparison cards */}
            <div className="comparison-cards-grid">
              {(comparisonResult.comparisons || []).map((item, idx) => (
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
                      <Icon name="clock" size={12} /> {item.estimated_weeks}{' '}
                      {item.estimated_weeks === 1 ? 'Week' : 'Weeks'}
                    </span>
                  </div>

                  <div className="comp-factors">
                    <div className="comp-factor-block pros-block">
                      <div className="factor-title">
                        <span className="factor-icon">
                          <Icon name="check" size={12} />
                        </span>{' '}
                        Pros &amp; Advantages
                      </div>
                      <ul className="factor-list">
                        {(item.pros || []).map((pro, pIdx) => (
                          <li key={pIdx}>{pro}</li>
                        ))}
                      </ul>
                    </div>

                    <div className="comp-factor-block cons-block">
                      <div className="factor-title">
                        <span className="factor-icon">
                          <Icon name="warning" size={12} />
                        </span>{' '}
                        Cons &amp; Challenges
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
                      onClick={() => onPickIdeaForRoadmap(item.idea)}
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
            {comparisonResult.recommendation && (
              <div
                className="comparison-recommendation-card"
                id="comparison-recommendation"
              >
                <div className="recommendation-header">
                  <span className="rec-icon">
                    <Icon name="bulb" size={22} />
                  </span>
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
            )}

            <div className="compare-results-footer-actions">
              <button
                type="button"
                className="btn-secondary"
                onClick={onResetComparison}
              >
                ← Compare Different Ideas
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={onBackToGenerator}
              >
                ↺ Back to Generator
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
