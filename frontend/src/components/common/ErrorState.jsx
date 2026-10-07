import React from 'react'
import { Icon } from './Icon'

export function ErrorState({
  message = 'An unexpected error occurred.',
  onRetry = null,
  retryLabel = 'Retry',
  onDismiss = null,
  dismissLabel = 'Dismiss',
  className = '',
}) {
  if (!message) return null

  return (
    <div className={`error-banner ${className}`.trim()} role="alert">
      <div className="error-text">
        <Icon name="warning" size={14} />
        <span>{message}</span>
      </div>
      {onRetry && (
        <button className="btn-retry" type="button" onClick={onRetry}>
          {retryLabel}
        </button>
      )}
      {onDismiss && !onRetry && (
        <button className="btn-retry" type="button" onClick={onDismiss}>
          {dismissLabel}
        </button>
      )}
    </div>
  )
}
