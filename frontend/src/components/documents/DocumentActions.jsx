import React, { useState, useRef, useEffect } from 'react'
import { Icon } from '../common/Icon'

export function DocumentActions({
  onDownloadSrs,
  onDownloadSynopsis,
  onDownloadViva,
  isGeneratingViva = false,
  onDownloadReadme,
  onDownloadPdf,
  onPlanAnother,
}) {
  const [docsMenuOpen, setDocsMenuOpen] = useState(false)
  const dropdownRef = useRef(null)

  // Close documents menu on outside click
  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDocsMenuOpen(false)
      }
    }
    if (docsMenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick)
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [docsMenuOpen])

  return (
    <div className="roadmap-header-actions">
      <div className="docs-dropdown-container" ref={dropdownRef}>
        <button
          type="button"
          className="btn-secondary btn-sm btn-generate-docs"
          onClick={() => setDocsMenuOpen((prev) => !prev)}
          id="btn-generate-docs"
          aria-haspopup="true"
          aria-expanded={docsMenuOpen}
          title="Generate project documents (SRS, Synopsis, Viva Questions)"
        >
          <Icon name="book" size={14} />
          <span>📚 Generate Documents</span>
          <span className={`docs-caret ${docsMenuOpen ? 'open' : ''}`}>▾</span>
        </button>
        {docsMenuOpen && (
          <div className="docs-dropdown-menu" role="menu">
            <button
              type="button"
              className="docs-dropdown-item"
              onClick={() => {
                setDocsMenuOpen(false)
                onDownloadSrs()
              }}
              id="btn-doc-srs"
              role="menuitem"
            >
              <span className="docs-item-badge">SRS</span>
              <div className="docs-item-content">
                <span className="docs-item-name">SRS Document</span>
                <span className="docs-item-desc">Academic IEEE-style specification</span>
              </div>
            </button>
            <button
              type="button"
              className="docs-dropdown-item"
              onClick={() => {
                setDocsMenuOpen(false)
                onDownloadSynopsis()
              }}
              id="btn-doc-synopsis"
              role="menuitem"
            >
              <span className="docs-item-badge">SYN</span>
              <div className="docs-item-content">
                <span className="docs-item-name">Synopsis</span>
                <span className="docs-item-desc">Concise 1-page executive summary</span>
              </div>
            </button>
            <button
              type="button"
              className="docs-dropdown-item"
              onClick={() => {
                setDocsMenuOpen(false)
                onDownloadViva()
              }}
              disabled={isGeneratingViva}
              id="btn-doc-viva"
              role="menuitem"
            >
              <span className="docs-item-badge">{isGeneratingViva ? '...' : 'Q&A'}</span>
              <div className="docs-item-content">
                <span className="docs-item-name">
                  {isGeneratingViva ? 'Generating with AI...' : 'Viva Questions'}
                </span>
                <span className="docs-item-desc">
                  {isGeneratingViva
                    ? 'Calling Groq LLM for 10-15 model Q&As'
                    : '10-15 interview Q&As with model answers'}
                </span>
              </div>
            </button>
          </div>
        )}
      </div>

      <button
        type="button"
        className="btn-secondary btn-sm btn-generate-readme"
        onClick={onDownloadReadme}
        id="btn-generate-readme"
        title="Generate and download README.md as a formatted file"
      >
        <Icon name="file" size={14} />
        Generate README
      </button>

      <button
        type="button"
        className="btn-secondary btn-sm btn-download-pdf"
        onClick={onDownloadPdf}
        id="btn-download-pdf"
        title="Download roadmap as a formatted PDF"
      >
        <Icon name="download" size={14} />
        Download as PDF
      </button>

      {onPlanAnother && (
        <button type="button" className="btn-secondary btn-sm" onClick={onPlanAnother}>
          Plan Another Project
        </button>
      )}
    </div>
  )
}
