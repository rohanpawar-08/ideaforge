import React, { useState, useEffect, useRef } from 'react'
import { Icon } from '../common/Icon'
import { Badge } from '../common/Badge'

export function BuildView({
  roadmap,
  progress,
  onSwitchToBlueprint,
}) {
  const [selectedPhaseKey, setSelectedPhaseKey] = useState('all')
  const [selectedTask, setSelectedTask] = useState(null)
  const [taskNoteInput, setTaskNoteInput] = useState('')
  const [isSavingNote, setIsSavingNote] = useState(false)
  const [noteSaveStatus, setNoteSaveStatus] = useState('') // 'saved', 'saving', ''
  const noteDebounceTimerRef = useRef(null)

  const workspace = progress?.workspace
  const isLoading = progress?.isLoading
  const error = progress?.error

  // Select first phase or 'all'
  const phases = workspace?.phases || []
  const totalTasks = workspace?.total_tasks || progress?.totalTasksCount || 0
  const doneTasks = workspace?.done_tasks || progress?.completedTasksCount || 0
  const completionPercent = workspace?.completion_percent ?? progress?.progressPercentage ?? 0
  const isCompleted = workspace?.is_completed || (totalTasks > 0 && doneTasks === totalTasks)
  const currentPhase = workspace?.current_phase
  const nextTask = workspace?.next_task

  const data = roadmap?.data || roadmap || {}
  const summary = data?.project_summary || {}
  const projectTitle = summary?.title || roadmap?.original_idea || 'Project Execution Workspace'

  // Sync selected task note input when a task is opened
  useEffect(() => {
    if (selectedTask) {
      setTaskNoteInput(selectedTask.note || progress?.notes?.[selectedTask.task_id] || '')
      setNoteSaveStatus('')
    }
  }, [selectedTask, progress?.notes])

  // Handle note debounced auto-save
  const handleNoteChange = (e) => {
    const val = e.target.value
    if (val.length > 2000) return
    setTaskNoteInput(val)
    setNoteSaveStatus('saving')

    if (noteDebounceTimerRef.current) {
      clearTimeout(noteDebounceTimerRef.current)
    }

    noteDebounceTimerRef.current = setTimeout(async () => {
      if (selectedTask && progress?.updateTaskNote) {
        setIsSavingNote(true)
        try {
          await progress.updateTaskNote(selectedTask.task_id, val)
          setNoteSaveStatus('saved')
          setTimeout(() => setNoteSaveStatus(''), 2500)
        } catch (err) {
          setNoteSaveStatus('error')
        } finally {
          setIsSavingNote(false)
        }
      }
    }, 600)
  }

  // Explicit save note
  const handleManualSaveNote = async () => {
    if (!selectedTask || !progress?.updateTaskNote) return
    if (noteDebounceTimerRef.current) {
      clearTimeout(noteDebounceTimerRef.current)
    }
    setIsSavingNote(true)
    setNoteSaveStatus('saving')
    try {
      await progress.updateTaskNote(selectedTask.task_id, taskNoteInput)
      setNoteSaveStatus('saved')
      setTimeout(() => setNoteSaveStatus(''), 2500)
    } catch (err) {
      setNoteSaveStatus('error')
    } finally {
      setIsSavingNote(false)
    }
  }

  // Scroll to Up Next card
  const handleContinueBuilding = () => {
    const el = document.getElementById('up-next-task-card')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    } else if (nextTask) {
      setSelectedTask(nextTask)
    }
  }

  // Filter tasks based on selected phase rail
  const displayedPhases = selectedPhaseKey === 'all'
    ? phases
    : phases.filter((p) => p.phase_key === selectedPhaseKey)

  if (isLoading && !workspace) {
    return (
      <div className="workspace-loading-state" id="workspace-loading">
        <div className="spinner-medium" />
        <p className="loading-text">Loading project workspace and progress...</p>
      </div>
    )
  }

  if (error && !workspace) {
    return (
      <div className="workspace-error-state" role="alert" id="workspace-error">
        <Icon name="warning" size={24} className="error-icon" />
        <h3>Failed to load workspace</h3>
        <p>{error}</p>
        <button
          type="button"
          className="btn-primary btn-sm"
          onClick={progress?.refreshWorkspace}
          id="btn-retry-workspace"
        >
          <Icon name="refresh" size={14} /> Retry
        </button>
      </div>
    )
  }

  return (
    <div className="project-build-workspace view-fade" id="project-build-workspace">
      {/* 1. Header with Title & Completion */}
      <header className="workspace-header-card">
        <div className="workspace-header-top">
          <div className="workspace-title-group">
            <span className="badge badge-primary">
              <Icon name="rocket" size={12} /> Build Workspace
            </span>
            <h1 className="workspace-project-title" id="workspace-project-title">
              {projectTitle}
            </h1>
          </div>

          {!isCompleted && nextTask && (
            <button
              type="button"
              className="btn-primary btn-md btn-continue-building"
              onClick={handleContinueBuilding}
              id="btn-continue-building"
            >
              <Icon name="zap" size={14} /> Continue Building
            </button>
          )}
        </div>

        <div className="workspace-progress-bar-container">
          <div className="progress-bar-track">
            <div
              className={`progress-bar-fill ${completionPercent === 100 ? 'fill-completed' : ''}`}
              style={{ width: `${completionPercent}%` }}
              role="progressbar"
              aria-valuenow={completionPercent}
              aria-valuemin="0"
              aria-valuemax="100"
            />
          </div>
          <div className="workspace-progress-meta">
            <span className="tasks-count-label" id="workspace-tasks-done-label">
              <strong>{doneTasks}</strong> of <strong>{totalTasks}</strong> tasks done
            </span>
            <span className="percent-label" id="workspace-completion-percent-label">
              {completionPercent}% complete
            </span>
          </div>
        </div>
      </header>

      {/* Project Completed State */}
      {isCompleted && (
        <section className="workspace-completed-banner" id="workspace-completed-banner">
          <div className="completed-badge-icon">
            <Icon name="check" size={28} />
          </div>
          <div className="completed-banner-content">
            <h2>Project Build Complete!</h2>
            <p>
              All {totalTasks} tasks in this execution blueprint are marked done.
              Verify your deployment checklist in the Blueprint tab before public launch.
            </p>
            {onSwitchToBlueprint && (
              <button
                type="button"
                className="btn-secondary btn-sm"
                onClick={onSwitchToBlueprint}
                id="btn-view-blueprint-completed"
              >
                <Icon name="file" size={14} /> View Blueprint & Launch Checklist
              </button>
            )}
          </div>
        </section>
      )}

      {/* 2. Current Phase & 3. Up Next Task Row */}
      {!isCompleted && (
        <div className="workspace-action-grid">
          {/* Current Phase Card */}
          {currentPhase && (
            <div className="card workspace-phase-highlight-card" id="current-phase-card">
              <div className="card-header-compact">
                <span className="label-kicker">CURRENT PHASE</span>
                <span className="badge badge-neutral">Phase {currentPhase.phase_order}</span>
              </div>
              <h3 className="current-phase-title">{currentPhase.name}</h3>
              {currentPhase.goal && (
                <p className="current-phase-goal">
                  <strong>Goal:</strong> {currentPhase.goal}
                </p>
              )}
              <div className="phase-mini-progress">
                <div className="progress-bar-track track-xs">
                  <div
                    className="progress-bar-fill"
                    style={{ width: `${currentPhase.completion_percent}%` }}
                  />
                </div>
                <div className="mini-meta">
                  <span>{currentPhase.done_tasks} / {currentPhase.total_tasks} done</span>
                  <span>{currentPhase.completion_percent}%</span>
                </div>
              </div>
            </div>
          )}

          {/* Up Next Card */}
          {nextTask && (
            <div className="card workspace-up-next-card" id="up-next-task-card">
              <div className="card-header-compact">
                <span className="label-kicker kicker-highlight">
                  <Icon name="zap" size={12} /> UP NEXT
                </span>
                <span className={`badge badge-status badge-${nextTask.status}`}>
                  {nextTask.status === 'in_progress' ? 'In Progress' : 'To Do'}
                </span>
              </div>

              <h3 className="up-next-task-title">{nextTask.task}</h3>
              {nextTask.description && (
                <p className="up-next-task-description">{nextTask.description}</p>
              )}

              {Array.isArray(nextTask.files_or_modules) && nextTask.files_or_modules.length > 0 && (
                <div className="files-chips-row">
                  <span className="files-label">Files:</span>
                  {nextTask.files_or_modules.map((f, i) => (
                    <code key={i} className="file-chip">{f}</code>
                  ))}
                </div>
              )}

              {nextTask.how_to_test && (
                <div className="task-sub-detail">
                  <span className="detail-tag">How to Test:</span>
                  <p>{nextTask.how_to_test}</p>
                </div>
              )}

              {nextTask.definition_of_done && (
                <div className="task-sub-detail">
                  <span className="detail-tag">Definition of Done:</span>
                  <p>{nextTask.definition_of_done}</p>
                </div>
              )}

              <div className="up-next-actions-row">
                {nextTask.status !== 'in_progress' && (
                  <button
                    type="button"
                    className="btn-primary btn-sm btn-start-task"
                    onClick={() => progress?.updateTaskStatus(nextTask.task_id, 'in_progress')}
                    id="btn-start-next-task"
                  >
                    Start Task
                  </button>
                )}
                {nextTask.status !== 'done' && (
                  <button
                    type="button"
                    className="btn-secondary btn-sm btn-mark-done"
                    onClick={() => progress?.updateTaskStatus(nextTask.task_id, 'done')}
                    id="btn-mark-next-task-done"
                  >
                    <Icon name="check" size={14} /> Mark Done
                  </button>
                )}
                <button
                  type="button"
                  className="btn-secondary btn-sm"
                  onClick={() => setSelectedTask(nextTask)}
                  id="btn-view-next-task-details"
                >
                  View Details
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* 4. Phase Navigation Rail & 5. Tasks List */}
      <div className="workspace-main-layout">
        {/* Phase Navigation Rail (Desktop) / Dropdown (Mobile) */}
        <aside className="workspace-phase-rail" id="workspace-phase-rail">
          <div className="phase-rail-header">
            <h4>Phases</h4>
          </div>

          {/* Mobile Phase Selector */}
          <div className="phase-mobile-select-wrap">
            <select
              className="select-input phase-mobile-select"
              value={selectedPhaseKey}
              onChange={(e) => setSelectedPhaseKey(e.target.value)}
              id="phase-mobile-select"
            >
              <option value="all">All Phases ({totalTasks} tasks)</option>
              {phases.map((p) => (
                <option key={p.phase_key} value={p.phase_key}>
                  Phase {p.phase_order}: {p.name} ({p.done_tasks}/{p.total_tasks})
                </option>
              ))}
            </select>
          </div>

          {/* Desktop Rail Buttons */}
          <div className="phase-rail-items">
            <button
              type="button"
              className={`phase-rail-btn ${selectedPhaseKey === 'all' ? 'active' : ''}`}
              onClick={() => setSelectedPhaseKey('all')}
            >
              <span className="phase-rail-name">All Phases</span>
              <span className="phase-rail-count">{doneTasks}/{totalTasks}</span>
            </button>
            {phases.map((p) => (
              <button
                key={p.phase_key}
                type="button"
                className={`phase-rail-btn ${selectedPhaseKey === p.phase_key ? 'active' : ''}`}
                onClick={() => setSelectedPhaseKey(p.phase_key)}
              >
                <div className="phase-rail-title-wrap">
                  <span className="phase-rail-order">P{p.phase_order}</span>
                  <span className="phase-rail-name" title={p.name}>{p.name}</span>
                </div>
                <span className="phase-rail-count">
                  {p.done_tasks}/{p.total_tasks}
                </span>
              </button>
            ))}
          </div>
        </aside>

        {/* Task List Grouped by Phase */}
        <main className="workspace-tasks-container" id="workspace-tasks-list">
          {displayedPhases.length === 0 ? (
            <div className="card empty-tasks-card">
              <Icon name="folder" size={24} />
              <p>No tasks found in this blueprint.</p>
            </div>
          ) : (
            displayedPhases.map((phase) => (
              <div key={phase.phase_key} className="phase-tasks-block card" id={`phase-block-${phase.phase_key}`}>
                <div className="phase-tasks-header">
                  <div className="phase-header-left">
                    <span className="badge badge-neutral">Phase {phase.phase_order}</span>
                    <h3 className="phase-block-title">{phase.name}</h3>
                  </div>
                  <div className="phase-header-right">
                    <span className="phase-stats-tag">
                      {phase.done_tasks} / {phase.total_tasks} done ({phase.completion_percent}%)
                    </span>
                  </div>
                </div>

                {phase.goal && (
                  <p className="phase-block-goal-text">
                    <strong>Goal:</strong> {phase.goal}
                  </p>
                )}

                <div className="tasks-items-list">
                  {(phase.tasks || []).map((t) => {
                    const isDone = t.status === 'done'
                    const isInProgress = t.status === 'in_progress'
                    const hasNote = Boolean(t.note || progress?.notes?.[t.task_id])

                    return (
                      <div
                        key={t.task_id}
                        className={`task-row ${isDone ? 'task-row-done' : ''} ${isInProgress ? 'task-row-progress' : ''}`}
                        onClick={() => setSelectedTask(t)}
                        id={`task-row-${t.task_id}`}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault()
                            setSelectedTask(t)
                          }
                        }}
                      >
                        <div
                          className="task-status-toggle-wrap"
                          onClick={(e) => {
                            e.stopPropagation()
                            const next = isDone ? 'todo' : 'done'
                            progress?.updateTaskStatus(t.task_id, next)
                          }}
                        >
                          <button
                            type="button"
                            className={`task-checkbox-btn ${isDone ? 'checked' : ''} ${isInProgress ? 'in-progress' : ''}`}
                            aria-label={`Toggle status for ${t.task}`}
                          >
                            {isDone ? <Icon name="check" size={12} /> : isInProgress ? <span className="dot-pulse" /> : null}
                          </button>
                        </div>

                        <div className="task-row-info">
                          <div className="task-row-title-line">
                            <span className={`task-text ${isDone ? 'text-strikethrough' : ''}`}>
                              {t.task}
                            </span>
                            {hasNote && (
                              <span className="has-note-badge" title="Has developer note">
                                <Icon name="message" size={11} /> Note
                              </span>
                            )}
                          </div>
                          {t.description && (
                            <p className="task-row-desc">{t.description}</p>
                          )}
                          {Array.isArray(t.files_or_modules) && t.files_or_modules.length > 0 && (
                            <div className="task-row-files">
                              {t.files_or_modules.slice(0, 3).map((f, fi) => (
                                <code key={fi} className="mini-file-tag">{f}</code>
                              ))}
                              {t.files_or_modules.length > 3 && (
                                <span className="more-files-tag">+{t.files_or_modules.length - 3}</span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="task-row-status-badge">
                          <span className={`badge badge-status badge-${t.status}`}>
                            {t.status === 'done' ? 'Done' : t.status === 'in_progress' ? 'In Progress' : 'To Do'}
                          </span>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))
          )}
        </main>
      </div>

      {/* 6. Task Detail Drawer / Modal */}
      {selectedTask && (
        <div className="task-drawer-overlay" onClick={() => setSelectedTask(null)}>
          <div
            className="task-drawer-panel"
            onClick={(e) => e.stopPropagation()}
            id="task-detail-drawer"
            role="dialog"
            aria-modal="true"
            aria-labelledby="task-drawer-title"
          >
            <div className="task-drawer-header">
              <div className="drawer-header-left">
                <span className="badge badge-neutral">
                  {selectedTask.phase_name || `Phase ${selectedTask.phase_key || ''}`}
                </span>
                <span className={`badge badge-status badge-${selectedTask.status}`}>
                  {selectedTask.status === 'done' ? 'Done' : selectedTask.status === 'in_progress' ? 'In Progress' : 'To Do'}
                </span>
              </div>
              <button
                type="button"
                className="btn-icon btn-drawer-close"
                onClick={() => setSelectedTask(null)}
                aria-label="Close task details"
                id="btn-close-task-drawer"
              >
                ✕
              </button>
            </div>

            <div className="task-drawer-body">
              <h2 className="task-drawer-title" id="task-drawer-title">
                {selectedTask.task}
              </h2>

              {/* Status Switcher Buttons */}
              <div className="task-status-switcher">
                <span className="drawer-section-label">STATUS</span>
                <div className="status-buttons-group">
                  <button
                    type="button"
                    className={`btn-status-option ${selectedTask.status === 'todo' ? 'active-todo' : ''}`}
                    onClick={async () => {
                      await progress?.updateTaskStatus(selectedTask.task_id, 'todo')
                      setSelectedTask((prev) => ({ ...prev, status: 'todo' }))
                    }}
                    id="btn-set-status-todo"
                  >
                    To Do
                  </button>
                  <button
                    type="button"
                    className={`btn-status-option ${selectedTask.status === 'in_progress' ? 'active-progress' : ''}`}
                    onClick={async () => {
                      await progress?.updateTaskStatus(selectedTask.task_id, 'in_progress')
                      setSelectedTask((prev) => ({ ...prev, status: 'in_progress' }))
                    }}
                    id="btn-set-status-in-progress"
                  >
                    In Progress
                  </button>
                  <button
                    type="button"
                    className={`btn-status-option ${selectedTask.status === 'done' ? 'active-done' : ''}`}
                    onClick={async () => {
                      await progress?.updateTaskStatus(selectedTask.task_id, 'done')
                      setSelectedTask((prev) => ({ ...prev, status: 'done' }))
                    }}
                    id="btn-set-status-done"
                  >
                    <Icon name="check" size={14} /> Done
                  </button>
                </div>
              </div>

              {selectedTask.description && (
                <div className="drawer-section">
                  <span className="drawer-section-label">DESCRIPTION</span>
                  <p className="drawer-text">{selectedTask.description}</p>
                </div>
              )}

              {Array.isArray(selectedTask.files_or_modules) && selectedTask.files_or_modules.length > 0 && (
                <div className="drawer-section">
                  <span className="drawer-section-label">FILES & MODULES</span>
                  <div className="drawer-files-list">
                    {selectedTask.files_or_modules.map((f, i) => (
                      <code key={i} className="drawer-file-chip">{f}</code>
                    ))}
                  </div>
                </div>
              )}

              {selectedTask.how_to_test && (
                <div className="drawer-section">
                  <span className="drawer-section-label">HOW TO TEST</span>
                  <div className="drawer-highlight-box">
                    <p>{selectedTask.how_to_test}</p>
                  </div>
                </div>
              )}

              {selectedTask.definition_of_done && (
                <div className="drawer-section">
                  <span className="drawer-section-label">DEFINITION OF DONE</span>
                  <div className="drawer-highlight-box box-success">
                    <p>{selectedTask.definition_of_done}</p>
                  </div>
                </div>
              )}

              {/* Developer Notes Section */}
              <div className="drawer-section drawer-notes-section">
                <div className="notes-header-row">
                  <span className="drawer-section-label">
                    <Icon name="message" size={12} /> DEVELOPER NOTES
                  </span>
                  <span className="char-count-label">
                    {taskNoteInput.length} / 2000
                  </span>
                </div>
                <textarea
                  className="notes-textarea"
                  value={taskNoteInput}
                  onChange={handleNoteChange}
                  placeholder="Record implementation findings, command outputs, decisions, or gotchas..."
                  rows={4}
                  maxLength={2000}
                  id="task-note-textarea"
                />
                <div className="notes-actions-row">
                  <div className="note-feedback-text">
                    {noteSaveStatus === 'saving' && <span className="saving-text">Saving changes...</span>}
                    {noteSaveStatus === 'saved' && <span className="saved-text">✓ Saved</span>}
                    {noteSaveStatus === 'error' && <span className="error-text">Failed to save note</span>}
                  </div>
                  <button
                    type="button"
                    className="btn-secondary btn-xs btn-save-note"
                    onClick={handleManualSaveNote}
                    disabled={isSavingNote}
                    id="btn-manual-save-note"
                  >
                    Save Note
                  </button>
                </div>
              </div>

              {/* Read-only metadata */}
              <div className="drawer-meta-footer">
                <span className="meta-text">Task ID: <code>{selectedTask.task_id}</code></span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
