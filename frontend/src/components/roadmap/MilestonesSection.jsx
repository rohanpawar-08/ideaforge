import React from 'react'
import { Icon } from '../common/Icon'

export function MilestonesSection({
  milestones = [],
  checkedTasks = {},
  onToggleTask,
  onRegenerate,
  isRegenerating = false,
}) {
  if (!milestones || milestones.length === 0) return null

  return (
    <div className="timeline-container">
      <div className="timeline-header-row">
        <h3 className="timeline-title">Weekly Milestone Execution Plan</h3>
        {onRegenerate && (
          <button
            type="button"
            className="btn-regenerate-section"
            id="btn-regenerate-milestones"
            onClick={onRegenerate}
            disabled={isRegenerating}
            title="Regenerate Weekly Milestones"
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

      <div className="timeline">
        {milestones.map((milestone, idx) => {
          const tasks = Array.isArray(milestone.tasks)
            ? milestone.tasks
            : typeof milestone.tasks === 'string'
            ? [milestone.tasks]
            : []
          const weekNum = milestone.week !== undefined ? milestone.week : idx + 1

          return (
            <div key={idx} className="timeline-item">
              <div className="timeline-marker">
                <span className="marker-number">{weekNum}</span>
              </div>

              <div className="timeline-content">
                <div className="milestone-badge">Week {weekNum}</div>
                <h4 className="milestone-goal">{milestone.goal}</h4>

                {tasks.length > 0 && (
                  <ul className="milestone-tasks">
                    {tasks.map((task, tIdx) => {
                      const isChecked = Boolean(checkedTasks[task])
                      const checkboxId = `task-chk-${idx}-${tIdx}`

                      return (
                        <li
                          key={tIdx}
                          className={`task-item ${isChecked ? 'task-checked' : ''}`}
                          onClick={() => onToggleTask(task)}
                        >
                          <input
                            type="checkbox"
                            id={checkboxId}
                            className="task-checkbox-input"
                            checked={isChecked}
                            onChange={(e) => {
                              e.stopPropagation()
                              onToggleTask(task)
                            }}
                            aria-label={`Mark task completed: ${task}`}
                          />
                          <span
                            className="task-checkbox"
                            aria-hidden="true"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <Icon name="check" size={11} />
                          </span>
                          <label
                            htmlFor={checkboxId}
                            className="task-text"
                            onClick={(e) => e.stopPropagation()}
                          >
                            {task}
                          </label>
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
