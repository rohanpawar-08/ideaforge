import React from 'react'

export function Badge({
  children,
  type = 'default', // 'feasibility' | 'difficulty' | 'tag' | 'default'
  variant = '',
  className = '',
  title,
}) {
  let badgeClass = 'badge'

  if (type === 'feasibility') {
    const clean = String(variant || children || 'intermediate').toLowerCase()
    badgeClass = `badge badge-feasibility feasibility-${clean}`
  } else if (type === 'difficulty') {
    const clean = String(variant || 'intermediate').toLowerCase().replace('-', '_')
    const finalClass = clean === 'not_applicable' || clean === 'na' ? 'not-applicable' : clean
    badgeClass = `badge badge-difficulty difficulty-${finalClass}`
  } else if (variant) {
    badgeClass = `badge badge-${variant}`
  }

  return (
    <span className={`${badgeClass} ${className}`.trim()} title={title}>
      {children}
    </span>
  )
}
