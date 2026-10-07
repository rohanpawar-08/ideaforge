import React from 'react'
import { Icon } from '../common/Icon'

export function DatabaseSchemaSection({
  schema = [],
  onRegenerate,
  isRegenerating = false,
}) {
  if (!schema || !Array.isArray(schema) || schema.length === 0) return null

  return (
    <div className="suggested-schema-container">
      <div className="schema-header">
        <div className="schema-title">
          <span className="schema-icon">
            <Icon name="database" size={18} />
          </span>
          <h3>Suggested Database Schema</h3>
        </div>
        <div className="schema-header-actions">
          <span className="schema-badge">
            {schema.length} {schema.length === 1 ? 'Table' : 'Tables'}
          </span>
          {onRegenerate && (
            <button
              type="button"
              className="btn-regenerate-section"
              id="btn-regenerate-schema"
              onClick={onRegenerate}
              disabled={isRegenerating}
              title="Regenerate Suggested Database Schema"
            >
              {isRegenerating ? (
                <>
                  <span className="btn-spinner" aria-hidden="true"></span>
                  <span>Regenerating...</span>
                </>
              ) : (
                <>
                  <Icon name="refresh" size={12} />
                  <span>Regenerate</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="schema-tables-grid">
        {schema.map((table, tIdx) => (
          <div key={tIdx} className="schema-table-card">
            <div className="schema-table-header">
              <div className="schema-table-title-group">
                <span className="schema-table-icon">
                  <Icon name="table" size={14} />
                </span>
                <h4 className="schema-table-name">
                  <code>{table.table_name}</code>
                </h4>
              </div>
              <span className="schema-field-count">
                {(table.fields || []).length}{' '}
                {(table.fields || []).length === 1 ? 'field' : 'fields'}
              </span>
            </div>

            <div className="schema-fields-table">
              <div className="schema-fields-thead">
                <span className="th-name">Field</span>
                <span className="th-type">Type</span>
                <span className="th-notes">Notes</span>
              </div>
              <div className="schema-fields-tbody">
                {(table.fields || []).map((field, fIdx) => (
                  <div key={fIdx} className="schema-field-row">
                    <span className="td-name">
                      <code>{field.name}</code>
                    </span>
                    <span className="td-type">
                      <span className="type-badge">{field.type}</span>
                    </span>
                    <span className="td-notes">
                      {field.notes ? (
                        <span className="notes-text">{field.notes}</span>
                      ) : (
                        <span className="notes-empty">—</span>
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
