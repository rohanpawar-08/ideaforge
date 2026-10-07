import React from 'react'

export function Button({
  children,
  type = 'button',
  variant = 'secondary',
  size = '',
  loading = false,
  disabled = false,
  icon = null,
  className = '',
  onClick,
  id,
  title,
  'aria-label': ariaLabel,
  ...rest
}) {
  const variantClass = variant ? `btn-${variant}` : ''
  const sizeClass = size ? `btn-${size}` : ''
  const combinedClass = `${variantClass} ${sizeClass} ${className}`.trim()

  return (
    <button
      type={type}
      id={id}
      className={combinedClass}
      disabled={disabled || loading}
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      {...rest}
    >
      {loading ? (
        <>
          <span className="btn-spinner" aria-hidden="true"></span>
          <span>{children}</span>
        </>
      ) : (
        <>
          {icon}
          {children}
        </>
      )}
    </button>
  )
}
