import { useState, useEffect, useCallback, useMemo } from 'react'

export function useRoadmapProgress(roadmap) {
  const [checkedTasks, setCheckedTasks] = useState({})

  // Compute all tasks from milestones
  const allMilestones = useMemo(() => roadmap?.milestones || [], [roadmap?.milestones])
  const allTasks = useMemo(() => {
    return allMilestones.flatMap((m) =>
      Array.isArray(m.tasks) ? m.tasks : typeof m.tasks === 'string' ? [m.tasks] : []
    )
  }, [allMilestones])

  // Sync checked tasks state from localStorage whenever roadmap changes
  useEffect(() => {
    if (!roadmap?.id) {
      setCheckedTasks({})
      return
    }

    const roadmapId = roadmap.id
    const newChecked = {}
    allTasks.forEach((t) => {
      try {
        const isChecked =
          localStorage.getItem(`roadmap_${roadmapId}_task_${t}`) === 'true' ||
          localStorage.getItem(`roadmap_${roadmapId}_${t}`) === 'true'
        if (isChecked) {
          newChecked[t] = true
        }
      } catch (err) {
        console.warn('Error reading task progress from localStorage:', err)
      }
    })
    setCheckedTasks(newChecked)
  }, [roadmap?.id, allTasks])

  // Toggle task completion and persist in localStorage keyed by roadmap id and task text
  const handleToggleTask = useCallback(
    (taskText) => {
      if (!roadmap?.id || !taskText) return
      const roadmapId = roadmap.id
      const isCurrentlyChecked = Boolean(checkedTasks[taskText])
      const nextState = !isCurrentlyChecked

      const keyWithTask = `roadmap_${roadmapId}_task_${taskText}`
      const keySimple = `roadmap_${roadmapId}_${taskText}`

      try {
        if (nextState) {
          localStorage.setItem(keyWithTask, 'true')
          localStorage.setItem(keySimple, 'true')
        } else {
          localStorage.removeItem(keyWithTask)
          localStorage.removeItem(keySimple)
        }
      } catch (err) {
        console.warn('Error saving task progress to localStorage:', err)
      }

      setCheckedTasks((prev) => {
        const updated = { ...prev, [taskText]: nextState }
        if (!nextState) {
          delete updated[taskText]
        }
        return updated
      })
    },
    [roadmap?.id, checkedTasks]
  )

  const totalTasksCount = allTasks.length
  const completedTasksCount = allTasks.filter((t) => Boolean(checkedTasks[t])).length
  const progressPercentage =
    totalTasksCount > 0 ? Math.round((completedTasksCount / totalTasksCount) * 100) : 0

  return {
    checkedTasks,
    setCheckedTasks,
    handleToggleTask,
    allTasks,
    totalTasksCount,
    completedTasksCount,
    progressPercentage,
  }
}
