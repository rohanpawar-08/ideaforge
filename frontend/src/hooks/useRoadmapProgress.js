import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { getWorkspace, patchTask, importProgress } from '../services/api'

export function useRoadmapProgress(roadmap, token = '', onUnauthorized = null) {
  const [workspace, setWorkspace] = useState(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState(null)
  const [checkedTasks, setCheckedTasks] = useState({})
  const [notes, setNotes] = useState({})
  const migrationAttemptedRef = useRef({})

  // Compute all tasks from implementation_plan (V2) or milestones (V1) for fallback
  const fallbackTasks = useMemo(() => {
    if (!roadmap) return []
    const data = roadmap.data || roadmap
    if (Array.isArray(data.implementation_plan) && data.implementation_plan.length > 0) {
      return data.implementation_plan.flatMap((phase) => {
        if (!Array.isArray(phase.tasks)) return []
        return phase.tasks.map((t) => (typeof t === 'string' ? t : t?.task || '')).filter(Boolean)
      })
    }
    if (Array.isArray(data.milestones) && data.milestones.length > 0) {
      return data.milestones.flatMap((m) =>
        Array.isArray(m.tasks) ? m.tasks : typeof m.tasks === 'string' ? [m.tasks] : []
      )
    }
    return []
  }, [roadmap])

  // Synchronize server workspace and perform one-time localStorage migration
  const fetchWorkspaceAndMigrate = useCallback(async () => {
    if (!roadmap?.id || !token) {
      setWorkspace(null)
      return
    }

    const roadmapId = roadmap.id
    setIsLoading(true)
    setError(null)

    try {
      // 1. Fetch current server workspace
      let serverWs = await getWorkspace(roadmapId, token, onUnauthorized)

      // 2. Check for legacy localStorage items to import (one-time)
      const migrationKey = `ideaforge_migrated_roadmap_${roadmapId}`
      const alreadyMigrated = localStorage.getItem(migrationKey) === 'true'

      if (!alreadyMigrated && !migrationAttemptedRef.current[roadmapId]) {
        migrationAttemptedRef.current[roadmapId] = true

        const legacyItems = []
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i)
            if (k && k.startsWith(`roadmap_${roadmapId}_`)) {
              const val = localStorage.getItem(k)
              if (val === 'true') {
                legacyItems.push({ legacy_task_key: k, completed: true })
              }
            }
          }
        } catch (e) {
          console.warn('Could not scan localStorage for migration:', e)
        }

        if (legacyItems.length > 0) {
          try {
            await importProgress(roadmapId, legacyItems, token, onUnauthorized)
            localStorage.setItem(migrationKey, 'true')
            // Re-fetch workspace after migration
            serverWs = await getWorkspace(roadmapId, token, onUnauthorized)
          } catch (migErr) {
            console.warn('Migration import failed:', migErr)
            migrationAttemptedRef.current[roadmapId] = false
          }
        } else {
          localStorage.setItem(migrationKey, 'true')
        }
      }

      setWorkspace(serverWs)

      // 3. Derive checkedTasks map and notes map from server workspace
      const newChecked = {}
      const newNotes = {}

      if (serverWs?.phases) {
        serverWs.phases.forEach((p) => {
          (p.tasks || []).forEach((t) => {
            const isDone = t.status === 'done'
            if (isDone) {
              newChecked[t.task_id] = true
              if (t.task) newChecked[t.task] = true
            }
            if (t.note) {
              newNotes[t.task_id] = t.note
            }
          })
        })
      }
      setCheckedTasks(newChecked)
      setNotes(newNotes)
    } catch (err) {
      console.error('Error fetching workspace:', err)
      setError(err?.message || 'Failed to load workspace progress.')
    } finally {
      setIsLoading(false)
    }
  }, [roadmap?.id, token, onUnauthorized])

  useEffect(() => {
    fetchWorkspaceAndMigrate()
  }, [fetchWorkspaceAndMigrate])

  // Update task status on server
  const updateTaskStatus = useCallback(
    async (taskId, newStatus) => {
      if (!roadmap?.id || !taskId || !token) return

      const roadmapId = roadmap.id
      const isDone = newStatus === 'done'

      // Optimistic update
      setCheckedTasks((prev) => {
        const next = { ...prev, [taskId]: isDone }
        if (!isDone) delete next[taskId]
        return next
      })

      try {
        await patchTask(roadmapId, taskId, { status: newStatus }, token, onUnauthorized)
        // Refresh workspace to recalculate metrics and next task
        const updatedWs = await getWorkspace(roadmapId, token, onUnauthorized)
        setWorkspace(updatedWs)
      } catch (err) {
        console.error('Error updating task status:', err)
        // Rollback on failure
        fetchWorkspaceAndMigrate()
      }
    },
    [roadmap?.id, token, onUnauthorized, fetchWorkspaceAndMigrate]
  )

  // Update task note on server
  const updateTaskNote = useCallback(
    async (taskId, newNote) => {
      if (!roadmap?.id || !taskId || !token) return

      const roadmapId = roadmap.id
      setNotes((prev) => ({ ...prev, [taskId]: newNote }))

      try {
        await patchTask(roadmapId, taskId, { note: newNote }, token, onUnauthorized)
        const updatedWs = await getWorkspace(roadmapId, token, onUnauthorized)
        setWorkspace(updatedWs)
      } catch (err) {
        console.error('Error saving task note:', err)
        fetchWorkspaceAndMigrate()
      }
    },
    [roadmap?.id, token, onUnauthorized, fetchWorkspaceAndMigrate]
  )

  // Toggle handler for compatibility with existing UI components
  const handleToggleTask = useCallback(
    (taskIdentifier) => {
      if (!roadmap?.id || !taskIdentifier) return

      // Look up task in workspace
      let targetTaskId = taskIdentifier
      let currentStatus = checkedTasks[taskIdentifier] ? 'done' : 'todo'

      if (workspace?.phases) {
        for (const phase of workspace.phases) {
          for (const t of phase.tasks || []) {
            if (t.task_id === taskIdentifier || t.task === taskIdentifier) {
              targetTaskId = t.task_id
              currentStatus = t.status
              break
            }
          }
        }
      }

      const nextStatus = currentStatus === 'done' ? 'todo' : 'done'
      updateTaskStatus(targetTaskId, nextStatus)
    },
    [roadmap?.id, workspace, checkedTasks, updateTaskStatus]
  )

  const totalTasksCount = workspace?.total_tasks ?? fallbackTasks.length
  const completedTasksCount =
    workspace?.done_tasks ?? fallbackTasks.filter((t) => Boolean(checkedTasks[t])).length
  const progressPercentage = workspace?.completion_percent ?? (
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0
  )

  return {
    workspace,
    isLoading,
    error,
    checkedTasks,
    setCheckedTasks,
    notes,
    updateTaskStatus,
    updateTaskNote,
    handleToggleTask,
    refreshWorkspace: fetchWorkspaceAndMigrate,
    allTasks: fallbackTasks,
    totalTasksCount,
    completedTasksCount,
    progressPercentage,
  }
}
