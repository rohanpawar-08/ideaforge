import React from 'react'
import { Icon } from '../common/Icon'

export function ProgressTracker({
  completedCount,
  totalCount,
  percentage,
}) {
  if (totalCount === 0) return null

  return (
    <div className="roadmap-progress-card" id="roadmap-progress-card">
      <div className="progress-card-header">
        <div className="progress-info">
          <span className="progress-badge-icon">
            <Icon name="target" size={22} />
          </span>
          <div>
            <h3 className="progress-main-title">Roadmap Progress</h3>
            <p className="progress-task-stats" id="progress-task-stats">
              {completedCount} of {totalCount} tasks complete
            </p>
          </div>
        </div>
        <div className="progress-percentage-display">
          <span className="progress-percentage-num" id="progress-percentage-num">
            {percentage}%
          </span>
        </div>
      </div>

      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          id="progress-bar-fill"
          style={{ width: `${percentage}%` }}
          role="progressbar"
          aria-valuenow={percentage}
          aria-valuemin="0"
          aria-valuemax="100"
        />
      </div>
    </div>
  )
}
