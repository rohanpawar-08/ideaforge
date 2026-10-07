import React from 'react'
import { Icon } from './Icon'

export function EmptyState({
  icon = 'folder',
  title = 'No items found',
  description = '',
  actionLabel = '',
  onAction = null,
  className = '',
}) {
  return (
    <div className={`history-empty-state ${className}`.trim()}>
      <div className="empty-icon">
        <Icon name={icon} size={36} />
      </div>
      <h3>{title}</h3>
      {description && <p>{description}</p>}
      {actionLabel && onAction && (
        <button type="button" className="btn-primary" onClick={onAction}>
          {actionLabel}
        </button>
      )}
    </div>
  )
}
