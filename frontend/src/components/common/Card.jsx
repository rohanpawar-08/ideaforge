import React from 'react'

export function Card({
  children,
  className = '',
  id,
  onClick,
  tabIndex,
  role,
  onKeyDown,
  ...rest
}) {
  return (
    <div
      id={id}
      className={`card ${className}`.trim()}
      onClick={onClick}
      tabIndex={tabIndex}
      role={role}
      onKeyDown={onKeyDown}
      {...rest}
    >
      {children}
    </div>
  )
}
