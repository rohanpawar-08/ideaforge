import React, { useState } from 'react'
import { Icon } from '../common/Icon'
import { DocumentActions } from '../documents/DocumentActions'

export function BlueprintViewer({
  blueprint,
  originalIdea,
  progress,
  regeneratingSection = {},
  onRegenerateSection,
  // Document action handlers
  onDownloadSrs,
  onDownloadSynopsis,
  onDownloadViva,
  isGeneratingViva = false,
  onDownloadReadme,
  onDownloadPdf,
  onPlanAnother,
}) {
  const [activeTab, setActiveTab] = useState('overview')
  const [copiedCommand, setCopiedCommand] = useState(null)
  const [expandedFlows, setExpandedFlows] = useState({})
  const [expandedPhases, setExpandedPhases] = useState({ 0: true }) // First phase open by default

  const data = blueprint?.data || blueprint || {}
  const summary = data.project_summary || {}
  const assumptions = Array.isArray(data.assumptions) ? data.assumptions : []
  const reqs = data.requirements || { functional: [], non_functional: [] }
  const roles = Array.isArray(data.user_roles) ? data.user_roles : []
  const features = data.features || { mvp: [], future: [] }
  const flows = Array.isArray(data.user_flows) ? data.user_flows : []
  const screens = Array.isArray(data.screens) ? data.screens : []
  const stack = Array.isArray(data.recommended_stack) ? data.recommended_stack : []
  const arch = data.architecture || { overview: '', components: [], data_flow: [] }
  const db = data.database || { needed: false, tables: [] }
  const apis = Array.isArray(data.api_design) ? data.api_design : []
  const folder = data.folder_structure || { description: '', tree: '' }
  const setup = data.setup_guide || { prerequisites: [], software_to_install: [], commands: [] }
  const buildPlan = Array.isArray(data.implementation_plan) ? data.implementation_plan : []
  const testing = data.testing_plan || { manual: [], unit: [], integration: [], security: [] }
  const security = Array.isArray(data.security_plan) ? data.security_plan : []
  const deployment = data.deployment_plan || { frontend: '', backend: '', database: '', environment_variables: [], steps: [] }
  const mistakes = Array.isArray(data.common_mistakes) ? data.common_mistakes : []
  const learning = Array.isArray(data.learning_path) ? data.learning_path : []
  const checklist = Array.isArray(data.launch_checklist) ? data.launch_checklist : []

  const copyToClipboard = (text, id) => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text)
      setCopiedCommand(id)
      setTimeout(() => setCopiedCommand(null), 2000)
    }
  }

  const toggleFlow = (idx) => {
    setExpandedFlows((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  const togglePhase = (idx) => {
    setExpandedPhases((prev) => ({ ...prev, [idx]: !prev[idx] }))
  }

  const navSections = [
    { id: 'overview', label: 'Overview', icon: 'bulb' },
    { id: 'requirements', label: 'Requirements & Roles', icon: 'user' },
    { id: 'features', label: 'Features & Flows', icon: 'target' },
    { id: 'screens', label: 'Screens & UI', icon: 'card' },
    { id: 'architecture', label: 'Stack & Architecture', icon: 'zap' },
    { id: 'database', label: 'Database & APIs', icon: 'database' },
    { id: 'setup', label: 'Setup & Structure', icon: 'folder' },
    { id: 'buildplan', label: 'Build Plan', icon: 'rocket', badge: buildPlan.length },
    { id: 'testing', label: 'Testing & Security', icon: 'shield' },
    { id: 'deployment', label: 'Deploy & Launch', icon: 'check' },
  ]

  const getMethodBadgeClass = (method = '') => {
    const m = method.toUpperCase()
    if (m === 'GET') return 'badge-method-get'
    if (m === 'POST') return 'badge-method-post'
    if (m === 'PUT' || m === 'PATCH') return 'badge-method-put'
    if (m === 'DELETE') return 'badge-method-delete'
    return 'badge-method-default'
  }

  return (
    <div className="blueprint-viewer view-fade" id="project-blueprint-root">
      {/* Blueprint Header */}
      <div className="blueprint-hero-header">
        <div className="hero-top-row">
          <div className="blueprint-badge-group">
            <span className="badge badge-primary">
              <Icon name="sparkles" size={12} /> Execution Blueprint v2
            </span>
            {summary.project_type && (
              <span className="badge badge-neutral">{summary.project_type}</span>
            )}
            {summary.difficulty && (
              <span className={`badge badge-feasibility feasibility-${summary.difficulty.toLowerCase()}`}>
                {summary.difficulty.toUpperCase()}
              </span>
            )}
            {summary.estimated_duration && (
              <span className="badge badge-neutral">
                <Icon name="clock" size={12} /> {summary.estimated_duration}
              </span>
            )}
          </div>
          <DocumentActions
            onDownloadSrs={onDownloadSrs}
            onDownloadSynopsis={onDownloadSynopsis}
            onDownloadViva={onDownloadViva}
            isGeneratingViva={isGeneratingViva}
            onDownloadReadme={onDownloadReadme}
            onDownloadPdf={onDownloadPdf}
            onPlanAnother={onPlanAnother}
          />
        </div>

        <h1 className="blueprint-title">{summary.title || 'Project Blueprint'}</h1>
        <p className="blueprint-subtitle">
          {summary.one_line_description || originalIdea || 'Comprehensive technical execution plan and architecture'}
        </p>
      </div>

      {/* Blueprint Navigation Pill Tabs */}
      <nav className="blueprint-nav-tabs" aria-label="Blueprint Navigation">
        {navSections.map((sec) => (
          <button
            key={sec.id}
            type="button"
            className={`blueprint-nav-tab-btn ${activeTab === sec.id ? 'active' : ''}`}
            onClick={() => setActiveTab(sec.id)}
            id={`tab-blueprint-${sec.id}`}
          >
            <Icon name={sec.icon} size={14} />
            <span>{sec.label}</span>
            {sec.badge !== undefined && <span className="tab-pill-badge">{sec.badge}</span>}
          </button>
        ))}
      </nav>

      {/* TAB CONTENT AREAS */}
      <div className="blueprint-tab-content">
        {/* ================= 1. OVERVIEW & ASSUMPTIONS ================= */}
        {activeTab === 'overview' && (
          <div className="blueprint-section-panel view-fade">
            <div className="blueprint-card">
              <div className="card-header-styled">
                <Icon name="bulb" size={18} />
                <h3>Problem Statement & Target Users</h3>
              </div>
              <div className="blueprint-card-body">
                <div className="problem-statement-box">
                  <p className="problem-text">
                    {summary.problem_statement || originalIdea || 'No problem statement provided.'}
                  </p>
                </div>

                {Array.isArray(summary.target_users) && summary.target_users.length > 0 && (
                  <div className="target-users-section">
                    <span className="meta-label">Target Audience &amp; Users:</span>
                    <div className="target-users-pills">
                      {summary.target_users.map((u, i) => (
                        <span key={i} className="target-user-pill">
                          <Icon name="user" size={12} /> {u}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {assumptions.length > 0 && (
              <div className="blueprint-card">
                <div className="card-header-styled">
                  <Icon name="sparkles" size={18} />
                  <h3>Architectural Decisions &amp; Assumptions Made</h3>
                </div>
                <div className="blueprint-card-body">
                  <p className="section-note">
                    To save you from technical decision fatigue, IdeaForge automatically made these professional architecture decisions:
                  </p>
                  <div className="assumptions-grid">
                    {assumptions.map((a, i) => (
                      <div key={i} className="assumption-item">
                        <strong className="assumption-title">{a.assumption}</strong>
                        <p className="assumption-reason">{a.reason}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 2. REQUIREMENTS & ROLES ================= */}
        {activeTab === 'requirements' && (
          <div className="blueprint-section-panel view-fade">
            <div className="blueprint-grid-2col">
              <div className="blueprint-card">
                <div className="card-header-styled">
                  <Icon name="check" size={18} />
                  <h3>Functional Requirements</h3>
                </div>
                <div className="blueprint-card-body">
                  <ul className="styled-requirements-list">
                    {(reqs.functional || []).map((r, i) => (
                      <li key={i}>
                        <span className="req-idx">FR-{String(i + 1).padStart(2, '0')}</span>
                        <span className="req-text">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="blueprint-card">
                <div className="card-header-styled">
                  <Icon name="shield" size={18} />
                  <h3>Non-Functional Requirements</h3>
                </div>
                <div className="blueprint-card-body">
                  <ul className="styled-requirements-list">
                    {(reqs.non_functional || []).map((r, i) => (
                      <li key={i}>
                        <span className="req-idx">NFR-{String(i + 1).padStart(2, '0')}</span>
                        <span className="req-text">{r}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {roles.length > 0 && (
              <div className="blueprint-card">
                <div className="card-header-styled">
                  <Icon name="user" size={18} />
                  <h3>User Roles &amp; Permissions</h3>
                </div>
                <div className="blueprint-card-body">
                  <div className="roles-grid">
                    {roles.map((role, i) => (
                      <div key={i} className="role-card">
                        <div className="role-header">
                          <span className="role-name">{role.role}</span>
                        </div>
                        <p className="role-desc">{role.description}</p>
                        {Array.isArray(role.permissions) && role.permissions.length > 0 && (
                          <div className="permissions-list">
                            <span className="perm-label">Permissions:</span>
                            <div className="perm-pills">
                              {role.permissions.map((p, pIdx) => (
                                <span key={pIdx} className="permission-pill">
                                  {p}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 3. FEATURES & FLOWS ================= */}
        {activeTab === 'features' && (
          <div className="blueprint-section-panel view-fade">
            <div className="blueprint-card">
              <div className="card-header-styled">
                <Icon name="target" size={18} />
                <h3>MVP Features &amp; Scope</h3>
                {onRegenerateSection && (
                  <button
                    type="button"
                    className="btn-secondary btn-xs regenerate-section-btn"
                    onClick={() => onRegenerateSection('features')}
                    disabled={Boolean(regeneratingSection.features)}
                  >
                    <Icon name="refresh" size={12} />
                    {regeneratingSection.features ? 'Regenerating...' : 'Regenerate'}
                  </button>
                )}
              </div>
              <div className="blueprint-card-body">
                <div className="features-grid">
                  {(features.mvp || []).map((feat, i) => {
                    const name = typeof feat === 'string' ? feat : feat.name
                    const desc = typeof feat === 'string' ? '' : feat.description
                    const priority = typeof feat === 'string' ? 'High' : (feat.priority || 'High')
                    const why = typeof feat === 'string' ? '' : feat.why_needed
                    return (
                      <div key={i} className="feature-item-card">
                        <div className="feature-top">
                          <strong className="feature-name">{name}</strong>
                          <span className={`badge badge-priority-${priority.toLowerCase()}`}>
                            {priority}
                          </span>
                        </div>
                        {desc && <p className="feature-desc">{desc}</p>}
                        {why && (
                          <div className="feature-why">
                            <span className="why-label">Why Needed:</span> {why}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {flows.length > 0 && (
              <div className="blueprint-card">
                <div className="card-header-styled">
                  <Icon name="rocket" size={18} />
                  <h3>Primary User Flows</h3>
                </div>
                <div className="blueprint-card-body">
                  <div className="user-flows-list">
                    {flows.map((flow, i) => (
                      <div key={i} className="flow-accordion-item">
                        <button
                          type="button"
                          className="flow-accordion-trigger"
                          onClick={() => toggleFlow(i)}
                          aria-expanded={Boolean(expandedFlows[i])}
                        >
                          <div className="flow-trigger-info">
                            <span className="flow-index">Flow {i + 1}</span>
                            <strong>{flow.name}</strong>
                          </div>
                          <Icon
                            name={expandedFlows[i] ? 'chevronUp' : 'chevronDown'}
                            size={16}
                          />
                        </button>
                        {expandedFlows[i] && Array.isArray(flow.steps) && (
                          <div className="flow-steps-body">
                            <ol className="flow-steps-ordered">
                              {flow.steps.map((step, sIdx) => (
                                <li key={sIdx} className="flow-step-item">
                                  <span className="step-num">{sIdx + 1}</span>
                                  <span className="step-text">{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 4. SCREENS & UI ================= */}
        {activeTab === 'screens' && (
          <div className="blueprint-section-panel view-fade">
            <div className="blueprint-card">
              <div className="card-header-styled">
                <Icon name="card" size={18} />
                <h3>Screen &amp; Interface Layout Plan</h3>
                {onRegenerateSection && (
                  <button
                    type="button"
                    className="btn-secondary btn-xs regenerate-section-btn"
                    onClick={() => onRegenerateSection('screens')}
                    disabled={Boolean(regeneratingSection.screens)}
                  >
                    <Icon name="refresh" size={12} />
                    {regeneratingSection.screens ? 'Regenerating...' : 'Regenerate'}
                  </button>
                )}
              </div>
              <div className="blueprint-card-body">
                <p className="section-note">
                  Build these screens to implement the full frontend scope:
                </p>
                <div className="screens-grid">
                  {screens.map((screen, i) => (
                    <div key={i} className="screen-card">
                      <div className="screen-header">
                        <span className="screen-name">{screen.name}</span>
                      </div>
                      <p className="screen-purpose">{screen.purpose}</p>

                      {Array.isArray(screen.elements) && screen.elements.length > 0 && (
                        <div className="screen-meta-block">
                          <span className="meta-subtitle">UI Elements:</span>
                          <div className="elements-pills">
                            {screen.elements.map((el, elIdx) => (
                              <span key={elIdx} className="ui-element-pill">
                                {el}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {Array.isArray(screen.actions) && screen.actions.length > 0 && (
                        <div className="screen-meta-block">
                          <span className="meta-subtitle">User Actions:</span>
                          <div className="actions-pills">
                            {screen.actions.map((act, actIdx) => (
                              <span key={actIdx} className="ui-action-pill">
                                {act}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 5. STACK & ARCHITECTURE ================= */}
        {activeTab === 'architecture' && (
          <div className="blueprint-section-panel view-fade">
            <div className="blueprint-card">
              <div className="card-header-styled">
                <Icon name="zap" size={18} />
                <h3>System Architecture &amp; Data Flow</h3>
                {onRegenerateSection && (
                  <button
                    type="button"
                    className="btn-secondary btn-xs regenerate-section-btn"
                    onClick={() => onRegenerateSection('architecture')}
                    disabled={Boolean(regeneratingSection.architecture)}
                  >
                    <Icon name="refresh" size={12} />
                    {regeneratingSection.architecture ? 'Regenerating...' : 'Regenerate'}
                  </button>
                )}
              </div>
              <div className="blueprint-card-body">
                {arch.overview && <p className="arch-overview-text">{arch.overview}</p>}

                {Array.isArray(arch.data_flow) && arch.data_flow.length > 0 && (
                  <div className="data-flow-container">
                    <span className="meta-label">Request &amp; Data Flow:</span>
                    <div className="data-flow-steps">
                      {arch.data_flow.map((flowStep, i) => (
                        <div key={i} className="data-flow-step-item">
                          <div className="step-circle">{i + 1}</div>
                          <div className="step-content">{flowStep}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="blueprint-card">
              <div className="card-header-styled">
                <Icon name="sparkles" size={18} />
                <h3>Recommended Technology Stack</h3>
                {onRegenerateSection && (
                  <button
                    type="button"
                    className="btn-secondary btn-xs regenerate-section-btn"
                    onClick={() => onRegenerateSection('stack')}
                    disabled={Boolean(regeneratingSection.stack)}
                  >
                    <Icon name="refresh" size={12} />
                    {regeneratingSection.stack ? 'Regenerating...' : 'Regenerate'}
                  </button>
                )}
              </div>
              <div className="blueprint-card-body">
                <div className="stack-cards-grid">
                  {stack.map((techItem, i) => {
                    const tech = typeof techItem === 'string' ? techItem : techItem.technology
                    const purpose = typeof techItem === 'string' ? 'Core Stack' : techItem.purpose
                    const why = typeof techItem === 'string' ? 'Recommended for high reliability' : techItem.why_recommended
                    const alts = typeof techItem === 'string' ? [] : (techItem.alternatives || [])

                    return (
                      <div key={i} className="tech-stack-card">
                        <div className="tech-card-header">
                          <span className="tech-purpose-tag">{purpose}</span>
                          <strong className="tech-name">{tech}</strong>
                        </div>
                        <p className="tech-why">{why}</p>
                        {alts.length > 0 && (
                          <div className="tech-alternatives">
                            <span className="alt-label">Alternatives:</span> {alts.join(', ')}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 6. DATABASE & APIS ================= */}
        {activeTab === 'database' && (
          <div className="blueprint-section-panel view-fade">
            <div className="blueprint-card">
              <div className="card-header-styled">
                <Icon name="database" size={18} />
                <h3>Database Design &amp; Schema</h3>
                {onRegenerateSection && (
                  <button
                    type="button"
                    className="btn-secondary btn-xs regenerate-section-btn"
                    onClick={() => onRegenerateSection('database')}
                    disabled={Boolean(regeneratingSection.database)}
                  >
                    <Icon name="refresh" size={12} />
                    {regeneratingSection.database ? 'Regenerating...' : 'Regenerate'}
                  </button>
                )}
              </div>
              <div className="blueprint-card-body">
                {db.tables && db.tables.length > 0 ? (
                  <div className="db-tables-list">
                    {db.tables.map((table, tIdx) => (
                      <div key={tIdx} className="db-table-card">
                        <div className="table-header-row">
                          <span className="table-name">Table: <code>{table.name}</code></span>
                          <span className="table-purpose">{table.purpose}</span>
                        </div>
                        <div className="table-fields-table-wrapper">
                          <table className="schema-table">
                            <thead>
                              <tr>
                                <th>Field Name</th>
                                <th>Type</th>
                                <th>Constraints</th>
                                <th>Description</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(table.fields || []).map((f, fIdx) => (
                                <tr key={fIdx}>
                                  <td><code>{f.name}</code></td>
                                  <td><span className="type-tag">{f.type}</span></td>
                                  <td><span className="constraint-tag">{f.constraints || '-'}</span></td>
                                  <td className="field-desc">{f.description || '-'}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-muted">This project does not require relational database persistence.</p>
                )}
              </div>
            </div>

            {apis.length > 0 && (
              <div className="blueprint-card">
                <div className="card-header-styled">
                  <Icon name="zap" size={18} />
                  <h3>API Design &amp; Endpoints</h3>
                  {onRegenerateSection && (
                    <button
                      type="button"
                      className="btn-secondary btn-xs regenerate-section-btn"
                      onClick={() => onRegenerateSection('api_design')}
                      disabled={Boolean(regeneratingSection.api_design)}
                    >
                      <Icon name="refresh" size={12} />
                      {regeneratingSection.api_design ? 'Regenerating...' : 'Regenerate'}
                    </button>
                  )}
                </div>
                <div className="blueprint-card-body">
                  <div className="api-endpoints-table-wrapper">
                    <table className="api-table">
                      <thead>
                        <tr>
                          <th>Method</th>
                          <th>Endpoint</th>
                          <th>Auth</th>
                          <th>Purpose</th>
                          <th>Request / Response</th>
                        </tr>
                      </thead>
                      <tbody>
                        {apis.map((api, aIdx) => (
                          <tr key={aIdx}>
                            <td>
                              <span className={`method-badge ${getMethodBadgeClass(api.method)}`}>
                                {api.method}
                              </span>
                            </td>
                            <td><code>{api.endpoint}</code></td>
                            <td>
                              {api.auth_required ? (
                                <span className="auth-badge required">Required</span>
                              ) : (
                                <span className="auth-badge public">Public</span>
                              )}
                            </td>
                            <td>{api.purpose}</td>
                            <td className="api-payloads">
                              {api.request_summary && <div><small>Req: {api.request_summary}</small></div>}
                              {api.response_summary && <div><small>Res: {api.response_summary}</small></div>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 7. SETUP & STRUCTURE ================= */}
        {activeTab === 'setup' && (
          <div className="blueprint-section-panel view-fade">
            <div className="blueprint-card">
              <div className="card-header-styled">
                <Icon name="folder" size={18} />
                <h3>Project Directory Structure</h3>
              </div>
              <div className="blueprint-card-body">
                {folder.description && <p className="section-note">{folder.description}</p>}
                <div className="code-block-container">
                  <div className="code-block-header">
                    <span>Folder Tree</span>
                    <button
                      type="button"
                      className="btn-copy-code"
                      onClick={() => copyToClipboard(folder.tree, 'tree')}
                    >
                      <Icon name={copiedCommand === 'tree' ? 'check' : 'copy'} size={12} />
                      {copiedCommand === 'tree' ? 'Copied' : 'Copy'}
                    </button>
                  </div>
                  <pre className="code-tree-block"><code>{folder.tree}</code></pre>
                </div>
              </div>
            </div>

            <div className="blueprint-card">
              <div className="card-header-styled">
                <Icon name="rocket" size={18} />
                <h3>Developer Setup Guide &amp; Terminal Commands</h3>
                {onRegenerateSection && (
                  <button
                    type="button"
                    className="btn-secondary btn-xs regenerate-section-btn"
                    onClick={() => onRegenerateSection('setup_guide')}
                    disabled={Boolean(regeneratingSection.setup_guide)}
                  >
                    <Icon name="refresh" size={12} />
                    {regeneratingSection.setup_guide ? 'Regenerating...' : 'Regenerate'}
                  </button>
                )}
              </div>
              <div className="blueprint-card-body">
                {Array.isArray(setup.prerequisites) && setup.prerequisites.length > 0 && (
                  <div className="setup-prereqs-block">
                    <span className="meta-label">Prerequisites to Install First:</span>
                    <div className="prereqs-pills">
                      {setup.prerequisites.map((p, i) => (
                        <span key={i} className="prereq-pill">
                          <Icon name="check" size={12} /> {p}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(setup.commands) && setup.commands.length > 0 && (
                  <div className="setup-commands-list">
                    <span className="meta-label">Exact Commands to Run in Order:</span>
                    {setup.commands.map((cmd, i) => {
                      const cmdStr = typeof cmd === 'string' ? cmd : cmd.command
                      const purpose = typeof cmd === 'string' ? '' : cmd.purpose
                      return (
                        <div key={i} className="terminal-command-row">
                          <div className="command-step-indicator">{i + 1}</div>
                          <div className="command-box">
                            <div className="command-text-bar">
                              <code>$ {cmdStr}</code>
                              <button
                                type="button"
                                className="btn-copy-mini"
                                onClick={() => copyToClipboard(cmdStr, `cmd-${i}`)}
                              >
                                <Icon name={copiedCommand === `cmd-${i}` ? 'check' : 'copy'} size={12} />
                              </button>
                            </div>
                            {purpose && <span className="command-purpose">{purpose}</span>}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= 8. ACTIONABLE BUILD PLAN ================= */}
        {activeTab === 'buildplan' && (
          <div className="blueprint-section-panel view-fade">
            <div className="blueprint-card">
              <div className="card-header-styled">
                <Icon name="rocket" size={18} />
                <h3>Actionable Implementation Phases &amp; Tasks</h3>
                {onRegenerateSection && (
                  <button
                    type="button"
                    className="btn-secondary btn-xs regenerate-section-btn"
                    onClick={() => onRegenerateSection('implementation_plan')}
                    disabled={Boolean(regeneratingSection.implementation_plan)}
                  >
                    <Icon name="refresh" size={12} />
                    {regeneratingSection.implementation_plan ? 'Regenerating...' : 'Regenerate'}
                  </button>
                )}
              </div>
              <div className="blueprint-card-body">
                <p className="section-note">
                  Each task gives precise files, how to verify correctness, and the definition of done. Check off tasks as you finish them:
                </p>

                <div className="phases-accordion-list">
                  {buildPlan.map((phase, pIdx) => {
                    const isExpanded = Boolean(expandedPhases[pIdx])
                    const tasks = Array.isArray(phase.tasks) ? phase.tasks : []
                    const phaseCheckedCount = tasks.filter((t) => {
                      const tText = typeof t === 'string' ? t : t.task
                      return progress?.checkedTasks?.[tText]
                    }).length

                    return (
                      <div key={pIdx} className="phase-card-item">
                        <div
                          className="phase-header-bar"
                          onClick={() => togglePhase(pIdx)}
                          role="button"
                          tabIndex={0}
                          aria-expanded={isExpanded}
                        >
                          <div className="phase-title-left">
                            <span className="phase-num-badge">Phase {phase.phase || pIdx + 1}</span>
                            <span className="phase-name">{phase.name}</span>
                            {phase.goal && <span className="phase-goal">Goal: {phase.goal}</span>}
                          </div>
                          <div className="phase-header-right">
                            <span className="phase-task-counter">
                              {phaseCheckedCount} / {tasks.length} done
                            </span>
                            <Icon name={isExpanded ? 'chevronUp' : 'chevronDown'} size={16} />
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="phase-tasks-body view-fade">
                            {tasks.map((taskItem, tIdx) => {
                              const tName = typeof taskItem === 'string' ? taskItem : taskItem.task
                              const isChecked = Boolean(progress?.checkedTasks?.[tName])
                              const desc = typeof taskItem === 'string' ? '' : taskItem.description
                              const files = typeof taskItem === 'string' ? [] : (taskItem.files_or_modules || [])
                              const test = typeof taskItem === 'string' ? '' : taskItem.how_to_test
                              const dod = typeof taskItem === 'string' ? '' : taskItem.definition_of_done

                              return (
                                <div
                                  key={tIdx}
                                  className={`actionable-task-item ${isChecked ? 'completed' : ''}`}
                                >
                                  <div className="task-checkbox-col">
                                    <input
                                      type="checkbox"
                                      id={`task-${pIdx}-${tIdx}`}
                                      checked={isChecked}
                                      onChange={() => progress?.handleToggleTask(tName)}
                                      className="task-checkbox"
                                    />
                                  </div>
                                  <div className="task-details-col">
                                    <label
                                      htmlFor={`task-${pIdx}-${tIdx}`}
                                      className="task-title-label"
                                    >
                                      {tName}
                                    </label>
                                    {desc && <p className="task-desc-text">{desc}</p>}

                                    {files.length > 0 && (
                                      <div className="task-files-row">
                                        <span className="files-tag-label">Files:</span>
                                        {files.map((f, fIdx) => (
                                          <code key={fIdx} className="file-chip">{f}</code>
                                        ))}
                                      </div>
                                    )}

                                    <div className="task-footer-metadata">
                                      {test && (
                                        <div className="meta-test">
                                          <Icon name="check" size={12} />
                                          <span><strong>How to test:</strong> {test}</span>
                                        </div>
                                      )}
                                      {dod && (
                                        <div className="meta-dod">
                                          <Icon name="target" size={12} />
                                          <span><strong>Done when:</strong> {dod}</span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ================= 9. TESTING & SECURITY ================= */}
        {activeTab === 'testing' && (
          <div className="blueprint-section-panel view-fade">
            <div className="blueprint-grid-2col">
              <div className="blueprint-card">
                <div className="card-header-styled">
                  <Icon name="check" size={18} />
                  <h3>Testing Strategy</h3>
                </div>
                <div className="blueprint-card-body">
                  {Array.isArray(testing.manual) && testing.manual.length > 0 && (
                    <div className="test-category-group">
                      <strong className="test-cat-title">Manual Acceptance Tests:</strong>
                      <ul>{testing.manual.map((t, i) => <li key={i}>{t}</li>)}</ul>
                    </div>
                  )}
                  {Array.isArray(testing.unit) && testing.unit.length > 0 && (
                    <div className="test-category-group">
                      <strong className="test-cat-title">Unit Tests:</strong>
                      <ul>{testing.unit.map((t, i) => <li key={i}>{t}</li>)}</ul>
                    </div>
                  )}
                  {Array.isArray(testing.integration) && testing.integration.length > 0 && (
                    <div className="test-category-group">
                      <strong className="test-cat-title">Integration &amp; API Tests:</strong>
                      <ul>{testing.integration.map((t, i) => <li key={i}>{t}</li>)}</ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="blueprint-card">
                <div className="card-header-styled">
                  <Icon name="shield" size={18} />
                  <h3>Security Controls &amp; Hardening</h3>
                </div>
                <div className="blueprint-card-body">
                  <ul className="security-controls-list">
                    {security.map((sec, i) => (
                      <li key={i}>
                        <Icon name="shield" size={14} className="sec-icon" />
                        <span>{sec}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>

            {mistakes.length > 0 && (
              <div className="blueprint-card">
                <div className="card-header-styled">
                  <Icon name="warning" size={18} />
                  <h3>Common Developer Pitfalls &amp; Solutions</h3>
                </div>
                <div className="blueprint-card-body">
                  <div className="mistakes-grid">
                    {mistakes.map((m, i) => (
                      <div key={i} className="mistake-item">
                        <div className="mistake-prob">
                          <Icon name="warning" size={14} />
                          <strong>{m.problem}</strong>
                        </div>
                        <div className="mistake-sol">
                          <Icon name="check" size={14} />
                          <span>{m.solution}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ================= 10. DEPLOY & LAUNCH ================= */}
        {activeTab === 'deployment' && (
          <div className="blueprint-section-panel view-fade">
            <div className="blueprint-card">
              <div className="card-header-styled">
                <Icon name="rocket" size={18} />
                <h3>Production Deployment Architecture</h3>
              </div>
              <div className="blueprint-card-body">
                <div className="deploy-services-row">
                  <div className="deploy-service-box">
                    <span className="deploy-label">Frontend Platform</span>
                    <strong>{deployment.frontend || 'Vercel / Netlify'}</strong>
                  </div>
                  <div className="deploy-service-box">
                    <span className="deploy-label">Backend Platform</span>
                    <strong>{deployment.backend || 'Render / Railway'}</strong>
                  </div>
                  <div className="deploy-service-box">
                    <span className="deploy-label">Database Engine</span>
                    <strong>{deployment.database || 'Neon PostgreSQL'}</strong>
                  </div>
                </div>

                {Array.isArray(deployment.environment_variables) && deployment.environment_variables.length > 0 && (
                  <div className="deploy-env-section">
                    <span className="meta-label">Required Environment Variables:</span>
                    <div className="env-pills">
                      {deployment.environment_variables.map((env, i) => (
                        <code key={i} className="env-code-pill">{env}</code>
                      ))}
                    </div>
                  </div>
                )}

                {Array.isArray(deployment.steps) && deployment.steps.length > 0 && (
                  <div className="deploy-steps-section">
                    <span className="meta-label">Deployment Sequence:</span>
                    <ol className="deploy-steps-list">
                      {deployment.steps.map((st, i) => (
                        <li key={i}>{st}</li>
                      ))}
                    </ol>
                  </div>
                )}
              </div>
            </div>

            {learning.length > 0 && (
              <div className="blueprint-card">
                <div className="card-header-styled">
                  <Icon name="book" size={18} />
                  <h3>Prerequisite Learning Path</h3>
                </div>
                <div className="blueprint-card-body">
                  <div className="learning-topics-grid">
                    {learning.map((l, i) => (
                      <div key={i} className="learning-card">
                        <strong className="learn-topic">{l.topic}</strong>
                        <p className="learn-why">{l.why_needed}</p>
                        {l.when_to_learn && (
                          <span className="learn-when">Learn when: {l.when_to_learn}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {checklist.length > 0 && (
              <div className="blueprint-card">
                <div className="card-header-styled">
                  <Icon name="check" size={18} />
                  <h3>Pre-Launch Checklist</h3>
                </div>
                <div className="blueprint-card-body">
                  <ul className="launch-checklist-items">
                    {checklist.map((item, i) => (
                      <li key={i}>
                        <Icon name="check" size={14} />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
