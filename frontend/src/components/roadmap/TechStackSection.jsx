import React from 'react'
import { Icon } from '../common/Icon'

export function TechStackSection({
  stack = [],
  onRegenerate,
  isRegenerating = false,
}) {
  return (
    <div className="summary-card stack-card">
      <div className="section-card-header">
        <span className="card-label">Recommended Tech Stack</span>
        {onRegenerate && (
          <button
            type="button"
            className="btn-regenerate-section"
            id="btn-regenerate-stack"
            onClick={onRegenerate}
            disabled={isRegenerating}
            title="Regenerate Recommended Tech Stack"
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
      <div className="tech-stack-chips">
        {(stack || []).map((tech, idx) => (
          <span key={idx} className="tech-chip">
            {tech}
          </span>
        ))}
      </div>
    </div>
  )
}
