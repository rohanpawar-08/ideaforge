import React from 'react'

export const DIFFICULTY_CATEGORIES = [
  { key: 'frontend_complexity', label: 'Frontend' },
  { key: 'backend_complexity', label: 'Backend' },
  { key: 'database_complexity', label: 'Database' },
  { key: 'ai_complexity', label: 'AI' },
  { key: 'deployment_complexity', label: 'Deployment' },
]

export function formatDifficultyLabel(val) {
  if (!val) return 'N/A'
  const normalized = String(val).toLowerCase().replace('-', '_')
  if (normalized === 'not_applicable' || normalized === 'na') return 'N/A'
  return normalized.charAt(0).toUpperCase() + normalized.slice(1)
}

export function DifficultyBreakdown({ breakdown }) {
  if (!breakdown) return null

  return (
    <div className="difficulty-breakdown-col">
      <span className="card-label">Difficulty Breakdown</span>
      <div className="difficulty-grid">
        {DIFFICULTY_CATEGORIES.map((cat) => {
          const rawVal = breakdown[cat.key] || 'not_applicable'
          const cleanVal = String(rawVal).toLowerCase().replace('-', '_')
          const badgeClass =
            cleanVal === 'not_applicable' || cleanVal === 'na'
              ? 'not-applicable'
              : cleanVal
          return (
            <div
              key={cat.key}
              className="difficulty-badge-item"
              title={`${cat.label} Complexity: ${formatDifficultyLabel(rawVal)}`}
            >
              <span className="difficulty-label">{cat.label}</span>
              <span className={`badge badge-difficulty difficulty-${badgeClass}`}>
                {formatDifficultyLabel(rawVal)}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
