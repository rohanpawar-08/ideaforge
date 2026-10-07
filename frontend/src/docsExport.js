/**
 * docsExport.js
 * 
 * Builds and downloads formatted Markdown documentation files for IdeaForge projects:
 * 1. SRS Document (Academic Software Requirements Specification)
 * 2. Synopsis (Concise 1-page project summary)
 * 3. Viva Questions (10-15 project-specific interview / viva voce Q&As with model answers)
 * 
 * Reuses the architecture, derivation logic, and browser Blob download pattern of readmeExport.js.
 */

import { deriveProjectTitle } from './readmeExport.js'

export { deriveProjectTitle }

/**
 * Capitalizes a string (e.g. "intermediate" -> "Intermediate").
 * @param {string} str 
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Normalizes title for safe filename usage.
 * @param {string} title 
 * @returns {string}
 */
function toFilenameSlug(title) {
  if (!title) return 'Project'
  return title
    .replace(/[^a-zA-Z0-9\s-_]/g, '')
    .trim()
    .replace(/\s+/g, '_')
    .slice(0, 40)
}

/**
 * Generic browser download trigger using Blob.
 * @param {string} markdown 
 * @param {string} filename 
 * @returns {string}
 */
export function downloadDocument(markdown, filename = 'document.md') {
  if (typeof window === 'undefined') return markdown

  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return markdown
}

/**
 * ============================================================================
 * 1. SRS DOCUMENT BUILDER
 * ============================================================================
 * Builds a comprehensive academic-standard Software Requirements Specification (SRS)
 * markdown document adhering to IEEE 830 style guidelines.
 * 
 * @param {Object} roadmap 
 * @param {string} fallbackIdea 
 * @returns {string} Markdown text
 */
function buildV2SrsDocument(data, fallbackIdea = '') {
  const summary = data.project_summary || {}
  const title = summary.title || deriveProjectTitle(fallbackIdea)
  const slug = toFilenameSlug(title).toUpperCase()
  const feasibility = capitalize(summary.difficulty || data.feasibility || 'intermediate')
  const weeks = summary.estimated_duration || `${data.estimated_weeks || 4} Weeks`
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const lines = []

  // Document Title & Academic Header
  lines.push(`# Software Requirements Specification (SRS)`)
  lines.push(`## ${title}`)
  lines.push('')
  lines.push(`> **Document Reference:** SRS-${slug}-V2.0  `)
  lines.push(`> **Status:** Final Project Execution Blueprint Draft  `)
  lines.push(`> **Target Timeline:** ${weeks} | **Project Feasibility:** ${feasibility}  `)
  lines.push(`> **Date Generated:** ${currentDate}  `)
  lines.push('')
  lines.push('---')
  lines.push('')

  // 1. Introduction & Executive Overview
  lines.push('## 1. Introduction & Executive Overview')
  lines.push('')
  lines.push('### 1.1 Purpose & Scope')
  lines.push(`The purpose of this Software Requirements Specification (SRS) is to establish a rigorous, formal specification for **${title}**. ${summary.one_line_description || ''}`)
  lines.push('')
  lines.push('### 1.2 Problem Statement')
  lines.push(summary.problem_statement || 'Users require an automated and reliable software system.')
  lines.push('')

  if (Array.isArray(summary.target_users) && summary.target_users.length > 0) {
    lines.push('### 1.3 Target Audience & Stakeholders')
    lines.push(summary.target_users.join(', '))
    lines.push('')
  }

  // User Roles
  if (Array.isArray(data.user_roles) && data.user_roles.length > 0) {
    lines.push('### 1.4 User Classes & Authorization Roles')
    lines.push('')
    lines.push('| User Role | Description | Assigned Permissions |')
    lines.push('| :--- | :--- | :--- |')
    data.user_roles.forEach((r) => {
      const perms = Array.isArray(r.permissions) ? r.permissions.join(', ') : 'standard access'
      lines.push(`| **${r.role}** | ${r.description} | \`${perms}\` |`)
    })
    lines.push('')
  }

  // 2. Functional Requirements
  lines.push('## 2. Functional Requirements')
  lines.push('')
  const reqs = data.requirements?.functional || []
  if (Array.isArray(reqs) && reqs.length > 0) {
    reqs.forEach((r, idx) => {
      lines.push(`- **FR-${String(idx + 1).padStart(2, '0')}:** ${r}`)
    })
    lines.push('')
  }

  const mvp = data.features?.mvp || []
  if (Array.isArray(mvp) && mvp.length > 0) {
    lines.push('### 2.1 Core MVP Capabilities')
    lines.push('')
    lines.push('| Capability | Priority | Justification & Requirement Detail |')
    lines.push('| :--- | :--- | :--- |')
    mvp.forEach((feat) => {
      const name = typeof feat === 'string' ? feat : feat.name
      const priority = typeof feat === 'string' ? 'High' : (feat.priority || 'High')
      const why = typeof feat === 'string' ? feat : (feat.why_needed || feat.description || '-')
      lines.push(`| **${name}** | \`${priority}\` | ${why} |`)
    })
    lines.push('')
  }

  if (Array.isArray(data.user_flows) && data.user_flows.length > 0) {
    lines.push('### 2.2 Primary User Flows')
    lines.push('')
    data.user_flows.forEach((flow) => {
      lines.push(`#### ${flow.name}`)
      if (Array.isArray(flow.steps)) {
        flow.steps.forEach((s, i) => lines.push(`${i + 1}. ${s}`))
      }
      lines.push('')
    })
  }

  if (Array.isArray(data.screens) && data.screens.length > 0) {
    lines.push('### 2.3 Screen & Interface Plan')
    lines.push('')
    lines.push('| Screen Name | Purpose | Visible UI Elements | User Actions |')
    lines.push('| :--- | :--- | :--- | :--- |')
    data.screens.forEach((s) => {
      const elements = Array.isArray(s.elements) ? s.elements.join(', ') : '-'
      const actions = Array.isArray(s.actions) ? s.actions.join(', ') : '-'
      lines.push(`| **${s.name}** | ${s.purpose} | ${elements} | ${actions} |`)
    })
    lines.push('')
  }

  // 3. Technical Stack & System Architecture
  lines.push('## 3. Technical Stack & System Architecture')
  lines.push('')
  if (data.architecture?.overview) {
    lines.push(data.architecture.overview)
    lines.push('')
  }

  if (Array.isArray(data.recommended_stack) && data.recommended_stack.length > 0) {
    lines.push('### 3.1 Recommended Architecture Components')
    lines.push('')
    lines.push('| Layer / Component | Technology | Rationale | Alternatives |')
    lines.push('| :--- | :--- | :--- | :--- |')
    data.recommended_stack.forEach((tech) => {
      if (typeof tech === 'string') {
        lines.push(`| Component | \`${tech}\` | Core library | - |`)
      } else {
        const alts = Array.isArray(tech.alternatives) && tech.alternatives.length > 0 ? tech.alternatives.join(', ') : 'None'
        lines.push(`| ${tech.purpose || 'Component'} | **${tech.technology}** | ${tech.why_recommended} | ${alts} |`)
      }
    })
    lines.push('')
  }

  // 4. Database Schema & Data Dictionary
  lines.push('## 4. Database Design & Data Dictionary')
  lines.push('')
  const tables = data.database?.tables || []
  if (Array.isArray(tables) && tables.length > 0) {
    tables.forEach((table) => {
      lines.push(`### Entity Table: \`${table.name}\``)
      lines.push(`*Purpose:* ${table.purpose || 'Stores operational records'}`)
      lines.push('')
      lines.push('| Field Name | Type | Key / Constraint | Description |')
      lines.push('| :--- | :--- | :--- | :--- |')
      if (Array.isArray(table.fields)) {
        table.fields.forEach((f) => {
          lines.push(`| \`${f.name}\` | \`${f.type}\` | ${f.constraints || '-'} | ${f.description || '-'} |`)
        })
      }
      lines.push('')
    })
  }

  // 5. API Design Contract
  if (Array.isArray(data.api_design) && data.api_design.length > 0) {
    lines.push('## 5. API Design Contract')
    lines.push('')
    lines.push('| Method | Endpoint | Auth | Purpose | Request Summary | Response Summary |')
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |')
    data.api_design.forEach((api) => {
      lines.push(`| \`${api.method}\` | \`${api.endpoint}\` | ${api.auth_required ? 'Required' : 'Public'} | ${api.purpose} | \`${api.request_summary || 'None'}\` | \`${api.response_summary || 'OK'}\` |`)
    })
    lines.push('')
  }

  // 6. Non-Functional Requirements
  lines.push('## 6. Non-Functional Requirements')
  lines.push('')
  const nonFunc = data.requirements?.non_functional || []
  if (Array.isArray(nonFunc) && nonFunc.length > 0) {
    nonFunc.forEach((nf, idx) => {
      lines.push(`- **NFR-${String(idx + 1).padStart(2, '0')}:** ${nf}`)
    })
    lines.push('')
  }

  // 7. Security & Deployment Plans
  if (Array.isArray(data.security_plan) && data.security_plan.length > 0) {
    lines.push('## 7. Security Strategy')
    lines.push('')
    data.security_plan.forEach((s) => lines.push(`- 🛡️ ${s}`))
    lines.push('')
  }

  if (data.deployment_plan) {
    lines.push('## 8. Deployment Architecture')
    lines.push('')
    lines.push(`- **Frontend:** ${data.deployment_plan.frontend || 'Vercel'}`)
    lines.push(`- **Backend:** ${data.deployment_plan.backend || 'Render'}`)
    lines.push(`- **Database:** ${data.deployment_plan.database || 'Neon PostgreSQL'}`)
    lines.push('')
  }

  lines.push('---')
  lines.push('*Generated with [IdeaForge](https://ideaforge-steel-alpha.vercel.app/) — AI Project Architect & Execution Planner.*')
  lines.push('')

  return lines.join('\n')
}

export function buildSrsDocument(roadmap, fallbackIdea = '') {
  if (!roadmap) return '# Software Requirements Specification (SRS)\n\nNo roadmap data available.\n'

  const data = roadmap.data || roadmap
  const ideaText = (roadmap.original_idea || fallbackIdea || data.original_idea || '').trim()

  // Route V2 blueprints to comprehensive V2 SRS generator
  if (data.schema_version === 2 || Boolean(data.project_summary) || Boolean(data.implementation_plan)) {
    return buildV2SrsDocument(data, ideaText)
  }

  const title = deriveProjectTitle(ideaText)
  const slug = toFilenameSlug(title).toUpperCase()
  const feasibility = capitalize(data.feasibility || 'intermediate')
  const weeks = data.estimated_weeks || 4
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const lines = []

  // Document Title & Academic Header
  lines.push(`# Software Requirements Specification (SRS)`)
  lines.push(`## ${title}`)
  lines.push('')
  lines.push(`> **Document Reference:** SRS-${slug}-V1.0  `)
  lines.push(`> **Status:** Final Proposed Draft  `)
  lines.push(`> **Target Timeline:** ${weeks} Weeks | **Project Feasibility:** ${feasibility}  `)
  lines.push(`> **Date Generated:** ${currentDate}  `)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Table of Contents
  lines.push('## Table of Contents')
  lines.push('1. [Introduction](#1-introduction)')
  lines.push('   - 1.1 Purpose')
  lines.push('   - 1.2 Document Conventions')
  lines.push('   - 1.3 Intended Audience & Reading Suggestions')
  lines.push('   - 1.4 Product Scope')
  lines.push('   - 1.5 References')
  lines.push('2. [Problem Statement & Project Objectives](#2-problem-statement--project-objectives)')
  lines.push('   - 2.1 Problem Statement')
  lines.push('   - 2.2 Project Objectives')
  lines.push('   - 2.3 Proposed Solution & System Overview')
  lines.push('   - 2.4 User Classes and Characteristics')
  lines.push('3. [System Requirements & Technical Stack](#3-system-requirements--technical-stack)')
  lines.push('   - 3.1 Software Requirements & Recommended Stack')
  lines.push('   - 3.2 Developer Environment & Hardware Requirements')
  lines.push('   - 3.3 Database Architecture & Data Dictionary')
  lines.push('4. [Functional Requirements](#4-functional-requirements)')
  lines.push('   - 4.1 Core MVP Functional Requirements')
  lines.push('   - 4.2 Extended / Stretch Functional Requirements')
  lines.push('   - 4.3 Feature-to-Milestone Traceability Matrix')
  lines.push('5. [Non-Functional Requirements](#5-non-functional-requirements)')
  lines.push('   - 5.1 Performance & Latency Requirements (NFR-1)')
  lines.push('   - 5.2 Security & Authentication (NFR-2)')
  lines.push('   - 5.3 Reliability & Fault Tolerance (NFR-3)')
  lines.push('   - 5.4 Usability & Accessibility (NFR-4)')
  lines.push('   - 5.5 Scalability & Maintainability (NFR-5)')
  lines.push('6. [Assumptions and Constraints](#6-assumptions-and-constraints)')
  lines.push('   - 6.1 Technical & Operational Assumptions')
  lines.push('   - 6.2 System & Project Constraints')
  lines.push('7. [Potential Pitfalls & Risk Mitigation](#7-potential-pitfalls--risk-mitigation)')
  lines.push('8. [Implementation Roadmap](#8-implementation-roadmap)')
  lines.push('9. [Future Scope & System Evolution](#9-future-scope--system-evolution)')
  lines.push('10. [Academic Verification & Sign-Off](#10-academic-verification--sign-off)')
  lines.push('')
  lines.push('---')
  lines.push('')

  // 1. Introduction
  lines.push('## 1. Introduction')
  lines.push('')
  lines.push('### 1.1 Purpose')
  lines.push(`The purpose of this Software Requirements Specification (SRS) is to establish a rigorous, formal specification of all functional, non-functional, and technical requirements for **${title}**. This document defines the architectural boundaries, system interactions, domain models, and development milestones intended for evaluators, software engineers, and academic defense examiners.`)
  lines.push('')
  lines.push('### 1.2 Document Conventions')
  lines.push('This document adopts standard IEEE 830 formatting conventions. Requirements are uniquely identified using identifiers (e.g., **FR-XX** for Functional Requirements, **NFR-XX** for Non-Functional Requirements). Typographical emphasis follows strict criteria: code elements, database attributes, and API methods are rendered in `monospace`, while critical constraints are emphasized in bold text.')
  lines.push('')
  lines.push('### 1.3 Intended Audience & Reading Suggestions')
  lines.push('This document is organized for:')
  lines.push('- **Academic Evaluators & Viva Examiners:** Review Sections 2, 4, 5, and 10 to inspect architectural design and project feasibility.')
  lines.push('- **Software Developers & Systems Engineers:** Review Sections 3, 4, 6, and 8 for technical stack configuration, database schema, and milestone tasks.')
  lines.push('- **Quality Assurance Engineers:** Reference Section 4 and 5 for test cases and acceptance criteria.')
  lines.push('')
  lines.push('### 1.4 Product Scope')
  lines.push(`The software product **${title}** delivers a modern, robust, and scalable software application addressing the operational requirements detailed below. The primary focus of the system is to solve domain challenges via structured automation, efficient state management, and reliable data persistence.`)
  lines.push('')
  lines.push('### 1.5 References')
  lines.push('- IEEE Std 830-1998: *Recommended Practice for Software Requirements Specifications*.')
  lines.push('- W3C Web Content Accessibility Guidelines (WCAG) 2.1.')
  lines.push('- OWASP Top 10 Application Security Vulnerabilities Standard.')
  lines.push('')

  // 2. Problem Statement & Objectives
  lines.push('## 2. Problem Statement & Project Objectives')
  lines.push('')
  lines.push('### 2.1 Problem Statement')
  if (ideaText) {
    lines.push(`> "${ideaText}"`)
    lines.push('')
  }
  lines.push(`Current manual, fragmented, or unoptimized solutions within this domain lack unified tracking, cohesive workflows, and dependable data visualization. Users frequently experience inefficiencies, communication friction, and elevated operational overhead due to the absence of an integrated, automated software solution.`)
  lines.push('')
  lines.push('### 2.2 Project Objectives')
  lines.push(`The primary objectives of **${title}** include:`)
  lines.push(`1. **Automate Core Workflow:** Streamline manual processes into intuitive, responsive digital interactions.`)
  lines.push(`2. **Data Integrity & Normalization:** Establish a normalized relational schema preventing duplicate records and anomalies.`)
  lines.push(`3. **High Developer Velocity:** Leverage modern full-stack libraries to deliver a production-ready MVP within an estimated **${weeks} weeks**.`)
  lines.push(`4. **Resilient User Experience:** Provide instantaneous visual feedback, descriptive error reporting, and defensive input validation.`)
  lines.push('')
  lines.push('### 2.3 Proposed Solution & System Overview')
  lines.push(`**${title}** delivers an end-to-end full-stack web application designed with a decoupled architecture. The presentation layer communicates via asynchronous HTTP REST calls with a modular backend API, while the persistence tier ensures transactional safety and referential integrity across all system entities.`)
  lines.push('')
  lines.push('### 2.4 User Classes and Characteristics')
  lines.push('| User Class | Access Level | Description & Responsibilities |')
  lines.push('| :--- | :--- | :--- |')
  lines.push('| **General User / Client** | Standard Authenticated | Interacts with primary MVP modules, manages personal entity records, and views analytical summaries. |')
  lines.push('| **System Administrator** | Elevated Privileges | Monitors health metrics, manages shared system categories, and oversees data integrity. |')
  lines.push('| **Anonymous / Guest** | Public / Restricted | Views landing pages, educational guides, and initiates account registration. |')
  lines.push('')

  // 3. System Requirements & Technical Stack
  lines.push('## 3. System Requirements & Technical Stack')
  lines.push('')
  lines.push('### 3.1 Software Requirements & Recommended Stack')
  if (Array.isArray(data.recommended_stack) && data.recommended_stack.length > 0) {
    lines.push('| Layer / Role | Selected Technology | Technical Justification |')
    lines.push('| :--- | :--- | :--- |')
    data.recommended_stack.forEach((tech, i) => {
      const parts = tech.split('(')
      const name = parts[0].trim()
      const role = parts[1] ? parts[1].replace(')', '').trim() : 'Core System Component'
      lines.push(`| **${role}** | \`${name}\` | Industry-standard solution ensuring rapid iteration, broad community support, and robust stability. |`)
    })
    lines.push('')
  } else {
    lines.push('- **Frontend & Backend:** Full-stack JavaScript/TypeScript or Python framework.')
    lines.push('- **Database:** Relational SQL persistence engine (e.g. PostgreSQL, SQLite).')
    lines.push('')
  }

  // Complexity Breakdown
  if (data.difficulty_breakdown && typeof data.difficulty_breakdown === 'object') {
    lines.push('#### Complexity Assessment')
    lines.push('')
    lines.push('| Engineering Domain | Evaluated Complexity |')
    lines.push('| :--- | :--- |')
    const breakdownLabels = {
      frontend_complexity: 'Frontend Layer',
      backend_complexity: 'Backend & Business Logic',
      database_complexity: 'Database & Relational Model',
      ai_complexity: 'AI / Machine Learning',
      deployment_complexity: 'DevOps & Deployment'
    }
    for (const [key, label] of Object.entries(breakdownLabels)) {
      const val = data.difficulty_breakdown[key]
      if (val) {
        lines.push(`| ${label} | \`${val === 'not_applicable' ? 'N/A' : capitalize(val)}\` |`)
      }
    }
    lines.push('')
  }

  // Developer Setup Guide
  if (data.setup_guide) {
    lines.push('### 3.2 Developer Environment & Hardware Requirements')
    lines.push('')
    if (data.setup_guide.primary_language) {
      lines.push(`- **Primary Programming Language:** ${data.setup_guide.primary_language}`)
    }
    if (data.setup_guide.editor_recommendation) {
      lines.push(`- **Recommended IDE / Editor:** ${data.setup_guide.editor_recommendation}`)
    }
    lines.push('- **Hardware Requirements:** Minimum dual-core CPU, 8 GB RAM, 10 GB free disk space.')
    lines.push('- **Network Requirements:** Broadband Internet connection for package resolution and API integrations.')
    lines.push('')

    if (data.setup_guide.getting_started_command) {
      lines.push('#### Workspace Initialization Command')
      lines.push('```bash')
      lines.push(data.setup_guide.getting_started_command)
      lines.push('```')
      lines.push('')
    }

    if (Array.isArray(data.setup_guide.key_tools) && data.setup_guide.key_tools.length > 0) {
      lines.push('#### Key Developer Tooling')
      data.setup_guide.key_tools.forEach((tool) => {
        const name = tool.name || tool
        const purpose = tool.purpose ? ` — ${tool.purpose}` : ''
        lines.push(`- **\`${name}\`**${purpose}`)
      })
      lines.push('')
    }
  }

  // Database Schema
  lines.push('### 3.3 Database Architecture & Data Dictionary')
  if (Array.isArray(data.suggested_schema) && data.suggested_schema.length > 0) {
    data.suggested_schema.forEach((table) => {
      const tableName = table.table_name || 'unnamed_table'
      lines.push(`#### Entity Table: \`${tableName}\``)
      lines.push('')
      lines.push('| Attribute Name | Data Type | Key / Constraints | Description & Semantics |')
      lines.push('| :--- | :--- | :--- | :--- |')
      if (Array.isArray(table.fields) && table.fields.length > 0) {
        table.fields.forEach((field) => {
          const fName = `\`${field.name || 'field'}\``
          const fType = `\`${field.type || 'text'}\``
          const fNotes = field.notes || '-'
          let keyType = 'Attribute'
          if (fNotes.toLowerCase().includes('primary')) keyType = '**Primary Key (PK)**'
          else if (fNotes.toLowerCase().includes('foreign')) keyType = '**Foreign Key (FK)**'
          else if (fNotes.toLowerCase().includes('unique')) keyType = 'Unique Constraint'
          
          lines.push(`| ${fName} | ${fType} | ${keyType} | ${fNotes.replace(/\|/g, '\\|')} |`)
        })
      } else {
        lines.push('| *(No fields specified)* | - | - | - |')
      }
      lines.push('')
    })
  } else {
    lines.push('*Standard normalized relational schema designed with primary, foreign key relationships and audit timestamps (`created_at`, `updated_at`).*')
    lines.push('')
  }

  // 4. Functional Requirements
  lines.push('## 4. Functional Requirements')
  lines.push('')
  lines.push('### 4.1 Core MVP Functional Requirements')
  if (Array.isArray(data.mvp_features) && data.mvp_features.length > 0) {
    data.mvp_features.forEach((feat, index) => {
      const reqId = `FR-${String(index + 1).padStart(2, '0')}`
      lines.push(`#### ${reqId}: ${feat}`)
      lines.push(`- **Requirement ID:** \`${reqId}\``)
      lines.push(`- **Category:** Core MVP Scope`)
      lines.push(`- **Priority:** High / Essential`)
      lines.push(`- **Functional Description:** The system shall provide reliable functionality for "${feat}". The implementation must handle input validation, provide responsive feedback to the user, and persist changes to the database.`)
      lines.push(`- **Acceptance Criteria:** Verified via unit/integration test cases with zero regression errors.`)
      lines.push('')
    })
  } else {
    lines.push('- **FR-01:** System shall provide secure user registration and login.')
    lines.push('- **FR-02:** System shall support core data manipulation and persistence.')
    lines.push('')
  }

  // Stretch Features
  lines.push('### 4.2 Extended / Stretch Functional Requirements')
  if (Array.isArray(data.stretch_features) && data.stretch_features.length > 0) {
    data.stretch_features.forEach((feat, index) => {
      const reqId = `FR-S${String(index + 1).padStart(2, '0')}`
      lines.push(`#### ${reqId}: ${feat}`)
      lines.push(`- **Requirement ID:** \`${reqId}\``)
      lines.push(`- **Category:** Post-MVP / Stretch Goal`)
      lines.push(`- **Priority:** Medium / Optional`)
      lines.push(`- **Functional Description:** As an extended capability, the application shall implement: "${feat}". This capability expands system reach and enhances user productivity.`)
      lines.push('')
    })
  } else {
    lines.push('*Extended automated reporting, third-party webhook integrations, and advanced analytics planned for future revisions.*')
    lines.push('')
  }

  // 4.3 Milestone Traceability Matrix
  if (Array.isArray(data.milestones) && data.milestones.length > 0) {
    lines.push('### 4.3 Feature-to-Milestone Traceability Matrix')
    lines.push('')
    lines.push('| Phase | Target Week | Implementation Milestone Goal | Verification Method |')
    lines.push('| :--- | :--- | :--- | :--- |')
    data.milestones.forEach((m) => {
      lines.push(`| Phase ${m.week} | Week ${m.week} | ${m.goal || 'Milestone Implementation'} | Integration Testing & Demo |`)
    })
    lines.push('')
  }

  // 5. Non-Functional Requirements
  lines.push('## 5. Non-Functional Requirements')
  lines.push('')
  lines.push('### 5.1 Performance & Latency Requirements (NFR-1)')
  lines.push('- **API Response Latency:** 95% of standard CRUD API requests shall resolve in under **250ms** under normal load conditions.')
  lines.push('- **Client Page Load:** Client-side initial render and First Contentful Paint (FCP) shall complete within **1.5 seconds**.')
  lines.push('- **Database Query Optimization:** All queries on foreign keys and frequently filtered columns shall utilize B-tree indexes to prevent table scans.')
  lines.push('')
  lines.push('### 5.2 Security & Authentication (NFR-2)')
  lines.push('- **Password Hashing:** All user passwords must be hashed using strong cryptographic hashing algorithms (e.g. bcrypt or Argon2) with appropriate work factors.')
  lines.push('- **Authentication Tokens:** Session management shall utilize signed JSON Web Tokens (JWT) or secure HTTP-only cookies with short expiration windows.')
  lines.push('- **Injection Protection:** SQL injection shall be completely mitigated through the mandatory use of parameterized queries and ORM query builders.')
  lines.push('- **Cross-Site Security:** Implement strict Cross-Origin Resource Sharing (CORS) rules and input sanitization to eliminate XSS risks.')
  lines.push('')
  lines.push('### 5.3 Reliability & Fault Tolerance (NFR-3)')
  lines.push('- **System Availability:** The web application shall target **99.5% uptime** during operational hours.')
  lines.push('- **Graceful Error Handling:** Unhandled exceptions must be intercepted by global error middleware, preventing stack trace leaks to client responses.')
  lines.push('- **Data Consistency:** Database transactions must enforce ACID compliance across multi-table writes.')
  lines.push('')
  lines.push('### 5.4 Usability & Accessibility (NFR-4)')
  lines.push('- **Responsive Design:** The UI shall render fluidly across mobile (<768px), tablet (768-1024px), and desktop (>1024px) viewports.')
  lines.push('- **Visual Accessibility:** Contrast ratios between text and background elements must adhere to WCAG 2.1 Level AA standards.')
  lines.push('- **Keyboard Navigability:** All interactive components (buttons, modals, forms) must be fully navigable via keyboard Tab and Enter controls.')
  lines.push('')
  lines.push('### 5.5 Scalability & Maintainability (NFR-5)')
  lines.push('- **Decoupled Architecture:** Clean separation between client presentation and server API logic allows independent scaling.')
  lines.push('- **Code Standards:** Codebase shall enforce linting (ESLint / Flake8) and modular directory conventions to facilitate collaborative engineering.')
  lines.push('')

  // 6. Assumptions and Constraints
  lines.push('## 6. Assumptions and Constraints')
  lines.push('')
  lines.push('### 6.1 Technical & Operational Assumptions')
  lines.push('1. End users possess modern web browsers (Chrome, Edge, Firefox, Safari) with JavaScript enabled.')
  lines.push('2. Persistent internet connectivity is available for cloud database access and third-party dependencies.')
  lines.push(`3. The development team has access to the primary execution stack (${data.recommended_stack ? data.recommended_stack.slice(0, 3).join(', ') : 'Node.js / Python'}).`)
  lines.push('')
  lines.push('### 6.2 System & Project Constraints')
  lines.push(`1. **Timeframe Limitation:** Project must be developed and demonstrated within the projected **${weeks}-week** academic timeline.`)
  lines.push('2. **Budget:** Built using open-source frameworks, zero-cost developer tiers, and community tooling.')
  lines.push('3. **Platform Agnostic:** The application must run without platform-specific binary dependencies outside standard runtime environments.')
  lines.push('')

  // 7. Potential Pitfalls
  lines.push('## 7. Potential Pitfalls & Risk Mitigation')
  lines.push('')
  if (Array.isArray(data.potential_pitfalls) && data.potential_pitfalls.length > 0) {
    lines.push('| Risk / Pitfall Identified | Potential Impact | Engineering Mitigation Strategy |')
    lines.push('| :--- | :--- | :--- |')
    data.potential_pitfalls.forEach((pitfall, i) => {
      lines.push(`| **Risk ${i + 1}:** ${pitfall} | Medium / High | Implement defensive validation, automated test suites, and robust fallback handlers. |`)
    })
    lines.push('')
  } else {
    lines.push('- **Data Race Conditions:** Prevented via transactional locking and idempotency keys.')
    lines.push('- **API Rate Limits:** Prevented through client-side caching and exponential backoff.')
    lines.push('')
  }

  // 8. Implementation Roadmap
  if (Array.isArray(data.milestones) && data.milestones.length > 0) {
    lines.push('## 8. Implementation Roadmap')
    lines.push('')
    data.milestones.forEach((m) => {
      lines.push(`### Week ${m.week}: ${m.goal || 'Milestone Execution'}`)
      lines.push('')
      if (Array.isArray(m.tasks) && m.tasks.length > 0) {
        m.tasks.forEach((t) => {
          const desc = typeof t === 'string' ? t : (t.description || t.task || '')
          lines.push(`- [ ] ${desc}`)
        })
      }
      lines.push('')
    })
  }

  // 9. Future Scope
  lines.push('## 9. Future Scope & System Evolution')
  lines.push('')
  lines.push(`The architectural design of **${title}** lays the groundwork for continuous iteration post initial deployment. Anticipated future enhancements include:`)
  lines.push('1. **Native Mobile Clients:** Packaging core modules for iOS and Android via React Native or progressive web app (PWA) standards.')
  lines.push('2. **Automated Analytics & AI Insights:** Integrating machine learning models for predictive analysis, anomaly detection, and automated user recommendations.')
  lines.push('3. **Enterprise Role-Based Access Control (RBAC):** Supporting granular organization workspaces, audit logs, and single sign-on (SSO) integrations.')
  lines.push('')

  // 10. Verification & Sign-Off
  lines.push('## 10. Academic Verification & Sign-Off')
  lines.push('')
  lines.push('| Role | Name & Title | Signature | Date |')
  lines.push('| :--- | :--- | :--- | :--- |')
  lines.push('| **Project Candidate / Lead** | _________________________ | ___________________ | ____________ |')
  lines.push('| **Faculty Guide / Mentor** | _________________________ | ___________________ | ____________ |')
  lines.push('| **Department Evaluator** | _________________________ | ___________________ | ____________ |')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('*Document generated automatically by [IdeaForge](https://ideaforge-steel-alpha.vercel.app/) — Technical Project Planning & Roadmap Engine.*')
  lines.push('')

  return lines.join('\n')
}

export function buildV2SynopsisDocument(data, ideaText = '') {
  const summary = data.project_summary || {}
  const title = summary.title || deriveProjectTitle(ideaText)
  const diff = capitalize(summary.difficulty || 'Intermediate')
  const duration = summary.estimated_duration || '4-6 weeks'
  const projectType = summary.project_type || 'Full-Stack Web Application'
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const lines = []
  lines.push(`# Project Synopsis: ${title}`)
  lines.push('')
  lines.push(`> **AI Project Architect & Execution Blueprint Synopsis**  `)
  lines.push(`> **Type:** ${projectType} | **Difficulty:** \`${diff}\` | **Timeline:** ${duration}  `)
  lines.push(`> **Date:** ${currentDate} | **Platform:** IdeaForge  `)
  lines.push('')
  lines.push('---')
  lines.push('')

  lines.push('## 1. Executive Summary')
  lines.push(summary.one_line_description || `A comprehensive ${projectType} designed to solve real-world operational challenges.`)
  lines.push('')

  lines.push('## 2. Problem Statement')
  lines.push(summary.problem_statement || (ideaText ? `"${ideaText}"` : 'Modern operational workflows lack structured automation, real-time coordination, and centralized persistence.'))
  lines.push('')

  if (Array.isArray(summary.target_users) && summary.target_users.length > 0) {
    lines.push('### Target Users')
    summary.target_users.forEach((u) => lines.push(`- 👤 ${u}`))
    lines.push('')
  }

  if (Array.isArray(data.assumptions) && data.assumptions.length > 0) {
    lines.push('## 3. Architecture Assumptions')
    data.assumptions.forEach((a) => {
      lines.push(`- **${a.assumption}:** ${a.reason}`)
    })
    lines.push('')
  }

  lines.push('## 4. Proposed Solution & Architecture Overview')
  if (data.architecture?.overview) {
    lines.push(data.architecture.overview)
    lines.push('')
  }

  if (Array.isArray(data.recommended_stack) && data.recommended_stack.length > 0) {
    lines.push('## 5. Technology Stack')
    lines.push('')
    lines.push('| Layer / Purpose | Technology | Justification |')
    lines.push('| :--- | :--- | :--- |')
    data.recommended_stack.forEach((tech) => {
      if (typeof tech === 'string') {
        lines.push(`| Core Component | \`${tech}\` | High reliability and developer velocity |`)
      } else {
        lines.push(`| ${tech.purpose || 'Component'} | **${tech.technology}** | ${tech.why_recommended} |`)
      }
    })
    lines.push('')
  }

  const mvp = data.features?.mvp || []
  if (Array.isArray(mvp) && mvp.length > 0) {
    lines.push('## 6. Core MVP Modules & Features')
    lines.push('')
    mvp.forEach((f) => {
      const name = typeof f === 'string' ? f : f.name
      const desc = typeof f === 'string' ? '' : (f.description ? ` — ${f.description}` : '')
      lines.push(`- **${name}**${desc}`)
    })
    lines.push('')
  }

  const tables = data.database?.tables || []
  if (Array.isArray(tables) && tables.length > 0) {
    lines.push('## 7. Database Entities')
    lines.push('')
    tables.forEach((t) => {
      const fields = (t.fields || []).map((f) => `\`${f.name}\``).slice(0, 5).join(', ')
      lines.push(`- **${t.name}:** ${t.purpose || 'Operational table'}${fields ? ` (Key fields: ${fields})` : ''}`)
    })
    lines.push('')
  }

  if (data.deployment_plan) {
    lines.push('## 8. Deployment Strategy')
    lines.push(`- **Frontend:** ${data.deployment_plan.frontend || 'Vercel'}`)
    lines.push(`- **Backend:** ${data.deployment_plan.backend || 'Render'}`)
    lines.push(`- **Database:** ${data.deployment_plan.database || 'PostgreSQL'}`)
    lines.push('')
  }

  lines.push('---')
  lines.push('*Generated with [IdeaForge](https://ideaforge-steel-alpha.vercel.app/) — AI Project Architect & Execution Planner.*')
  lines.push('')

  return lines.join('\n')
}

/**
 * ============================================================================
 * 2. SYNOPSIS DOCUMENT BUILDER
 * ============================================================================
 * Builds a concise 1-page style academic/executive project summary.
 * 
 * @param {Object} roadmap 
 * @param {string} fallbackIdea 
 * @returns {string} Markdown text
 */
export function buildSynopsisDocument(roadmap, fallbackIdea = '') {
  if (!roadmap) return '# Project Synopsis\n\nNo roadmap data available.\n'

  const data = roadmap.data || roadmap
  const ideaText = (roadmap.original_idea || fallbackIdea || data.original_idea || '').trim()

  // Route V2 blueprints to comprehensive V2 Synopsis generator
  if (data.schema_version === 2 || Boolean(data.project_summary) || Boolean(data.implementation_plan)) {
    return buildV2SynopsisDocument(data, ideaText)
  }

  const title = deriveProjectTitle(ideaText)
  const feasibility = capitalize(data.feasibility || 'intermediate')
  const weeks = data.estimated_weeks || 4
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })

  const lines = []

  // Header & Title
  lines.push(`# Project Synopsis: ${title}`)
  lines.push('')
  lines.push(`> **Project Evaluation Summary** | **Feasibility:** \`${feasibility}\` | **Timeline:** ${weeks} Weeks  `)
  lines.push(`> **Date:** ${currentDate} | **Engine:** IdeaForge Project Planner  `)
  lines.push('')
  lines.push('---')
  lines.push('')

  // 1. Project Title & Overview
  lines.push('## 1. Project Title & Meta Information')
  lines.push(`- **Project Title:** **${title}**`)
  lines.push(`- **Domain:** Web Application / Software Engineering`)
  lines.push(`- **Target Complexity:** \`${feasibility}\``)
  lines.push(`- **Estimated Development Duration:** **${weeks} Weeks**`)
  lines.push('')

  // 2. Problem Statement
  lines.push('## 2. Problem Statement')
  if (ideaText) {
    lines.push(`> "${ideaText}"`)
    lines.push('')
  }
  lines.push('Modern workflows frequently suffer from fragmented tools, redundant manual tracking, and high operational overhead. Without a centralized, responsive software platform, users encounter data loss, communication friction, and a lack of real-time insights.')
  lines.push('')

  // 3. Proposed Solution
  lines.push('## 3. Proposed Solution')
  lines.push(`**${title}** provides a cohesive, full-stack digital solution engineered with a modern user interface, robust REST API services, and relational persistence. The system automates routine interactions, delivers instantaneous analytics, and offers secure data storage with clean user experience standards.`)
  lines.push('')

  // 4. Objectives
  lines.push('## 4. Key Objectives')
  lines.push(`- Build a production-grade web application tailored to the project requirements within **${weeks} weeks**.`)
  lines.push('- Implement secure authentication and role-based data protection.')
  lines.push('- Establish a Third Normal Form (3NF) relational database schema ensuring data consistency.')
  lines.push('- Deliver responsive, accessible UI modules providing real-time user feedback.')
  lines.push('')

  // 5. Technology Used
  lines.push('## 5. Technology Used')
  lines.push('')
  if (Array.isArray(data.recommended_stack) && data.recommended_stack.length > 0) {
    lines.push('| Layer / Tier | Technology | Purpose & Architectural Justification |')
    lines.push('| :--- | :--- | :--- |')
    data.recommended_stack.forEach((tech) => {
      const parts = tech.split('(')
      const name = parts[0].trim()
      const role = parts[1] ? parts[1].replace(')', '').trim() : 'Core Stack Component'
      lines.push(`| **${role}** | \`${name}\` | Fast rendering, strong developer ecosystem, and production stability. |`)
    })
    lines.push('')
  } else {
    lines.push('- **Client:** React / Modern SPA Framework')
    lines.push('- **Server:** Node.js Express / Python FastAPI REST API')
    lines.push('- **Database:** Relational PostgreSQL / SQLite Engine')
    lines.push('')
  }

  // 6. Core Modules & Key Features
  lines.push('## 6. Functional Modules & Key Features')
  lines.push('')
  if (Array.isArray(data.mvp_features) && data.mvp_features.length > 0) {
    lines.push('### Core MVP Features')
    data.mvp_features.forEach((feat) => {
      lines.push(`- **${feat}**`)
    })
    lines.push('')
  }

  if (Array.isArray(data.stretch_features) && data.stretch_features.length > 0) {
    lines.push('### Extended & Post-MVP Enhancements')
    data.stretch_features.forEach((feat) => {
      lines.push(`- *${feat}*`)
    })
    lines.push('')
  }

  // 7. Database Entities
  if (Array.isArray(data.suggested_schema) && data.suggested_schema.length > 0) {
    lines.push('## 7. Database & System Design Summary')
    lines.push('')
    data.suggested_schema.forEach((table) => {
      const tName = table.table_name || 'entity'
      const fields = (table.fields || [])
        .map((f) => `\`${f.name}\``)
        .slice(0, 6)
        .join(', ')
      lines.push(`- **Entity \`${tName}\`:** Key attributes: ${fields || 'standard fields'}`)
    })
    lines.push('')
  }

  // 8. Expected Outcome & Deliverables
  lines.push('## 8. Expected Outcome & Deliverables')
  lines.push('Upon successful project completion, the following tangible deliverables will be produced:')
  lines.push('1. **Fully Functional Web Application:** Responsive, tested software product deployed to staging/production.')
  lines.push('2. **Structured Database Schema:** Normalized tables, foreign key constraints, and migration scripts.')
  lines.push('3. **Comprehensive Documentation:** Full Software Requirements Specification (SRS), API documentation, and User Setup Guide.')
  lines.push('4. **Source Code Repository:** Clean, version-controlled GitHub repository with automated continuous integration readiness.')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('*Generated with [IdeaForge](https://ideaforge-steel-alpha.vercel.app/) — Turn ideas into structured developer roadmaps.*')
  lines.push('')

  return lines.join('\n')
}

/**
 * ============================================================================
 * 3. VIVA QUESTIONS BUILDER
 * ============================================================================
 * Formats 10-15 project-specific Viva / Technical Interview questions with model answers.
 * 
 * @param {Object} roadmap 
 * @param {Object|Array} vivaData Either { questions: [...] } or array of questions
 * @param {string} fallbackIdea 
 * @returns {string} Markdown text
 */
export function buildVivaQuestionsDocument(roadmap, vivaData, fallbackIdea = '') {
  const data = roadmap ? (roadmap.data || roadmap) : {}
  const ideaText = (roadmap?.original_idea || fallbackIdea || data.original_idea || '').trim()
  const title = deriveProjectTitle(ideaText)
  const feasibility = capitalize(data.feasibility || 'intermediate')
  const weeks = data.estimated_weeks || 4
  const stack = Array.isArray(data.recommended_stack)
    ? data.recommended_stack
        .map((s) => (typeof s === 'string' ? s : s.technology || ''))
        .filter(Boolean)
        .join(', ')
    : 'Modern Full-Stack'

  // Extract question array
  let questions = []
  if (Array.isArray(vivaData)) {
    questions = vivaData
  } else if (vivaData && Array.isArray(vivaData.questions)) {
    questions = vivaData.questions
  }

  const lines = []

  // Header & Title
  lines.push(`# Viva Voce & Technical Defense Guide`)
  lines.push(`## ${title}`)
  lines.push('')
  lines.push(`> **Academic Viva Voce & Senior Technical Interview Defense**  `)
  lines.push(`> **Project Focus:** ${title} | **Complexity:** \`${feasibility}\` (${weeks} Weeks)  `)
  lines.push(`> **Primary Tech Stack:** ${stack}  `)
  lines.push('')
  lines.push('---')
  lines.push('')

  // Overview
  lines.push('## Executive Overview')
  lines.push(`This comprehensive guide provides **${questions.length || '10-15'} project-specific viva voce questions** designed to prepare candidates for final-year engineering defense, academic viva evaluations, and technical interviews. Every question tests fundamental architectural decisions, stack trade-offs, database modeling, and real-world edge cases specific to **${title}**.`)
  lines.push('')

  if (ideaText) {
    lines.push(`### Project Context`)
    lines.push(`> "${ideaText}"`)
    lines.push('')
  }

  lines.push('---')
  lines.push('')

  // Questions List
  lines.push('## Project Viva Questions & Model Answers')
  lines.push('')

  if (questions.length === 0) {
    lines.push('*No questions generated yet. Please generate questions using the AI Viva generator.*')
  } else {
    questions.forEach((q, index) => {
      const qNum = index + 1
      const category = q.category || 'Architecture & System Design'
      const questionText = q.question || `Question ${qNum}`
      const answer = q.model_answer || q.answer || 'Provide a technical explanation covering the rationale and trade-offs.'
      const tip = q.viva_tip || q.tip || 'Speak clearly, reference real code components, and explain why you chose this design.'

      lines.push(`### Q${qNum}. [${category}]`)
      lines.push(`**${questionText}**`)
      lines.push('')
      lines.push(`**Model Answer:**  `)
      lines.push(`${answer}`)
      lines.push('')
      lines.push(`> 💡 **Viva Defense Tip:** ${tip}`)
      lines.push('')
      lines.push('---')
      lines.push('')
    })
  }

  // Viva Voce Defense Strategy Checklist
  lines.push('## Viva Defense Strategy: General Tips for High Marks')
  lines.push('1. **Explain the "Why", Not Just the "What":** Examiners rarely ask you to recite syntax. They want to know *why* you chose this framework or database over alternatives.')
  lines.push('2. **Draw the Architecture:** Always be prepared to sketch the client-server flow, JWT lifecycle, and database entity relationships on a whiteboard or screen share.')
  lines.push('3. **Acknowledge Trade-offs Honestly:** No software system is perfect. Discussing performance bottlenecks or future scalability enhancements shows engineering maturity.')
  lines.push('4. **Know Your Data Schema:** Be intimately familiar with table names, foreign keys, and indexes. Database questions are among the most common in technical viva exams.')
  lines.push('')
  lines.push('---')
  lines.push('')
  lines.push('*Generated with [IdeaForge](https://ideaforge-steel-alpha.vercel.app/) — Turn ideas into structured developer roadmaps.*')
  lines.push('')

  return lines.join('\n')
}

/**
 * ============================================================================
 * EXPORT DOWNLOAD TRIGGERS
 * ============================================================================
 */

/**
 * Generates and downloads the SRS Document as Markdown.
 * @param {Object} roadmap 
 * @param {string} fallbackIdea 
 * @param {string} [customFilename] 
 * @returns {string} Markdown text
 */
export function downloadSrsDocument(roadmap, fallbackIdea = '', customFilename) {
  const ideaText = roadmap?.original_idea || fallbackIdea || roadmap?.data?.original_idea || ''
  const title = deriveProjectTitle(ideaText)
  const slug = toFilenameSlug(title)
  const filename = customFilename || `${slug}_SRS_Document.md`
  const markdown = buildSrsDocument(roadmap, fallbackIdea)
  return downloadDocument(markdown, filename)
}

/**
 * Generates and downloads the Project Synopsis as Markdown.
 * @param {Object} roadmap 
 * @param {string} fallbackIdea 
 * @param {string} [customFilename] 
 * @returns {string} Markdown text
 */
export function downloadSynopsisDocument(roadmap, fallbackIdea = '', customFilename) {
  const ideaText = roadmap?.original_idea || fallbackIdea || roadmap?.data?.original_idea || ''
  const title = deriveProjectTitle(ideaText)
  const slug = toFilenameSlug(title)
  const filename = customFilename || `${slug}_Synopsis.md`
  const markdown = buildSynopsisDocument(roadmap, fallbackIdea)
  return downloadDocument(markdown, filename)
}

/**
 * Generates and downloads the Viva Questions guide as Markdown.
 * @param {Object} roadmap 
 * @param {Object|Array} vivaData 
 * @param {string} fallbackIdea 
 * @param {string} [customFilename] 
 * @returns {string} Markdown text
 */
export function downloadVivaDocument(roadmap, vivaData, fallbackIdea = '', customFilename) {
  const ideaText = roadmap?.original_idea || fallbackIdea || roadmap?.data?.original_idea || ''
  const title = deriveProjectTitle(ideaText)
  const slug = toFilenameSlug(title)
  const filename = customFilename || `${slug}_Viva_Questions.md`
  const markdown = buildVivaQuestionsDocument(roadmap, vivaData, fallbackIdea)
  return downloadDocument(markdown, filename)
}

/**
 * ============================================================================
 * BEGINNER'S GUIDE GENERATOR & CATALOG
 * ============================================================================
 */

export const KNOWN_TECH_GUIDE = {
  react: {
    category: 'Frontend Library',
    explanation:
      "React is a popular, friendly toolkit for building interactive web pages out of reusable building blocks called components. In this project, it lets you create a smooth, responsive interface where buttons and data update instantaneously without reloading the page. Because it is so widely used, you will find thousands of beginner-friendly guides and community answers whenever you need help.",
    learning_resource: {
      name: 'Official React Interactive Tutorial (react.dev)',
      url: 'https://react.dev/learn',
      description: 'The official beginner guide with live interactive coding challenges right inside your browser.',
    },
  },
  next: {
    category: 'Full-Stack Framework',
    explanation:
      "Next.js is a full-stack framework built on top of React that handles both your frontend user pages and backend API routes in one single project. In this project, it makes your app load quickly and keeps all your files neatly organized in one place. It handles heavy lifting like page routing and server rendering automatically.",
    learning_resource: {
      name: 'Next.js Official Learn Course (nextjs.org/learn)',
      url: 'https://nextjs.org/learn',
      description: 'A step-by-step interactive course created by the Next.js team for building modern web apps from scratch.',
    },
  },
  vue: {
    category: 'Frontend Framework',
    explanation:
      "Vue is a gentle and approachable framework for building web user interfaces. In this project, it powers your dynamic views with clean, readable code that combines HTML, styling, and logic in one intuitive file. Many new developers love it because it has one of the easiest learning curves in modern web development.",
    learning_resource: {
      name: 'Vue.js Official Interactive Tutorial (vuejs.org/tutorial)',
      url: 'https://vuejs.org/tutorial/',
      description: 'An interactive tutorial directly in the official documentation guiding you through core concepts.',
    },
  },
  node: {
    category: 'Backend Runtime',
    explanation:
      "Node.js allows you to run JavaScript on your computer or server instead of only inside a web browser. In this project, it acts as the engine for your backend, listening for requests from your frontend and saving information to your database. It lets you write your entire application using one familiar language.",
    learning_resource: {
      name: 'freeCodeCamp Back End Development & APIs Certification',
      url: 'https://www.freecodecamp.org/learn/back-end-development-and-apis/',
      description: 'A completely free, accredited hands-on course covering Node.js and Express backend basics.',
    },
  },
  express: {
    category: 'Backend Framework',
    explanation:
      "Express is a lightweight web server library for Node.js that helps you build API endpoints. In this project, it sets up the digital pathways where your application sends and receives data like user accounts and project records. It keeps your server logic straightforward and easy to understand.",
    learning_resource: {
      name: 'MDN Web Docs: Express Web Framework Tutorial',
      url: 'https://developer.mozilla.org/en-US/docs/Learn/Server-side/Express_Nodejs',
      description: "Mozilla's structured, beginner-accessible guide to building server applications with Express.",
    },
  },
  python: {
    category: 'Programming Language',
    explanation:
      "Python is famous for its clean, English-like syntax that makes it one of the easiest programming languages to learn and read. In this project, it coordinates your application's logic and data processing without overwhelming you with complex symbols. It is backed by a massive community and rich libraries.",
    learning_resource: {
      name: 'Python.org Official Beginner\'s Guide',
      url: 'https://www.python.org/about/gettingstarted/',
      description: 'The official starting portal for newcomers, linking to hands-on interactive tutorials and guides.',
    },
  },
  fastapi: {
    category: 'Backend API Framework',
    explanation:
      "FastAPI is a modern Python framework for creating web APIs quickly with minimal boilerplate. In this project, it receives incoming requests from your user interface and returns responses with built-in data validation. A huge beginner perk is that it automatically generates a visual web page where you can test your APIs by clicking buttons.",
    learning_resource: {
      name: 'Official FastAPI Tutorial - User Guide',
      url: 'https://fastapi.tiangolo.com/tutorial/',
      description: 'An exceptionally clear, step-by-step documentation tutorial with complete code examples.',
    },
  },
  flask: {
    category: 'Backend Framework',
    explanation:
      "Flask is a lightweight Python web framework that gives you the essentials without dictating rigid rules. In this project, it runs your backend server and routes requests with minimal code. Because it is simple and unopinionated, you can easily understand every line of code you write.",
    learning_resource: {
      name: 'Flask Mega-Tutorial by Miguel Grinberg',
      url: 'https://blog.miguelgrinberg.com/post/the-flask-mega-tutorial-part-i-hello-world',
      description: "The internet's most widely praised free tutorial for learning web development with Flask.",
    },
  },
  django: {
    category: 'Full-Stack Framework',
    explanation:
      "Django is a 'batteries-included' Python web framework that includes authentication, database management, and an admin panel out of the box. In this project, it saves you weeks of work by providing ready-to-use security and database features. It helps beginners build robust web applications safely.",
    learning_resource: {
      name: 'Official Django Girls Tutorial',
      url: 'https://tutorial.djangogirls.org/',
      description: 'A renowned, beginner-friendly walkthrough that takes you from zero to a live deployed web app.',
    },
  },
  postgresql: {
    category: 'Relational Database',
    explanation:
      "PostgreSQL is a powerful, reliable database that stores your information in neatly structured tables, like linked spreadsheets. In this project, it safeguards your user data and records with strict rules so nothing gets lost or corrupted. It is the gold standard database used by companies worldwide.",
    learning_resource: {
      name: 'PostgreSQL Tutorial for Beginners (postgresqltutorial.com)',
      url: 'https://www.postgresqltutorial.com/',
      description: 'A beginner-focused website offering plain-language explanations of SQL queries and table design.',
    },
  },
  sqlite: {
    category: 'Embedded Database',
    explanation:
      "SQLite is a zero-configuration database that saves all your project data into a single simple file on your hard drive. In this project, it gives you full database capabilities without having to install, configure, or run a complex background server. It is the absolute easiest way for beginners to start with SQL.",
    learning_resource: {
      name: 'SQLite Tutorial (sqlitetutorial.net)',
      url: 'https://www.sqlitetutorial.net/',
      description: 'A beginner-friendly practical guide covering tables, inserts, queries, and joins.',
    },
  },
  mongodb: {
    category: 'NoSQL Database',
    explanation:
      "MongoDB is a database that stores data in flexible, document-like formats (similar to JSON) instead of rigid tables. In this project, it allows you to save and modify records quickly without having to run formal database migration steps. It is very intuitive if you are already comfortable with JavaScript objects.",
    learning_resource: {
      name: 'MongoDB University: Introduction to MongoDB',
      url: 'https://learn.mongodb.com/',
      description: "Free, self-paced courses and video lessons directly from MongoDB's official education team.",
    },
  },
  prisma: {
    category: 'Database ORM',
    explanation:
      "Prisma is an Object-Relational Mapper (ORM) that lets you read and write database records using plain JavaScript/TypeScript instead of raw SQL queries. In this project, it prevents typos and gives you helpful code autocomplete inside your editor for every database column. It also includes Prisma Studio, a visual web browser for clicking and editing database rows.",
    learning_resource: {
      name: 'Prisma Getting Started Quickstart',
      url: 'https://www.prisma.io/docs/getting-started',
      description: 'A 5-minute interactive tutorial showing how to connect Prisma to a database and query data.',
    },
  },
  tailwind: {
    category: 'Styling & CSS',
    explanation:
      "Tailwind CSS is a utility-first styling tool that lets you design attractive web pages directly inside your HTML or React code. In this project, it styles buttons, cards, and layouts cleanly without having to write separate complicated CSS files. It includes curated colors and spacing out of the box so your app looks modern right away.",
    learning_resource: {
      name: 'Tailwind CSS Official Documentation & Screencasts',
      url: 'https://tailwindcss.com/docs',
      description: 'Interactive documentation with live preview examples and official short video tutorials.',
    },
  },
  typescript: {
    category: 'Programming Language',
    explanation:
      "TypeScript is JavaScript with added type definitions that act as a safety net while you code. In this project, your code editor will immediately underline mistakes, missing properties, and typos before you even run your application. It dramatically reduces common beginner bugs.",
    learning_resource: {
      name: 'TypeScript for the New Programmer (typescriptlang.org)',
      url: 'https://www.typescriptlang.org/docs/handbook/typescript-from-scratch.html',
      description: 'The official guide written specifically for people new to programming and types.',
    },
  },
  docker: {
    category: 'DevOps & Containers',
    explanation:
      "Docker packages applications and databases into self-contained boxes called containers so they run identically on any computer. In this project, it lets you spin up a full local database instance with a single command without installing software directly onto your operating system. It eliminates 'it works on my machine' headaches.",
    learning_resource: {
      name: 'Docker 101 Tutorial & Interactive Desktop Guide',
      url: 'https://www.docker.com/101-tutorial/',
      description: 'A quick visual introduction to containers and how to run local services easily.',
    },
  },
}

/**
 * Builds a plain-language explanation and learning resource for any technology string.
 * @param {string} techString 
 * @param {string} [projectIdea] 
 * @returns {Object}
 */
export function buildBeginnerTechExplanation(techString, projectIdea = '') {
  if (!techString || typeof techString !== 'string') {
    return {
      technology: 'Web Development Tooling',
      category: 'Development Tool',
      explanation: 'This tool is part of the application stack to assist in building, styling, or managing the project.',
      learning_resource: {
        name: 'MDN Web Docs - Learn Web Development',
        url: 'https://developer.mozilla.org/en-US/docs/Learn',
        description: 'Comprehensive, accessible documentation covering web technologies and core programming principles.',
      },
    }
  }

  const raw = techString.trim()
  const match = raw.match(/^([^(]+)(?:\s*\(([^)]+)\))?/)
  const techName = (match && match[1] ? match[1] : raw).trim()
  const techRole = (match && match[2] ? match[2] : '').trim()

  const lower = techName.toLowerCase()

  for (const [key, data] of Object.entries(KNOWN_TECH_GUIDE)) {
    if (lower.includes(key)) {
      return {
        technology: raw,
        category: techRole || data.category,
        explanation: data.explanation,
        learning_resource: data.learning_resource,
      }
    }
  }

  return {
    technology: raw,
    category: techRole || 'Core System Tool',
    explanation: `${techName} is a widely adopted developer tool chosen for this project to handle ${techRole ? techRole.toLowerCase() : 'essential system features'}. In this project, it provides ready-to-use building blocks so you can build your application smoothly without having to write low-level code from scratch. It is well-documented and has an active global community to support new developers.`,
    learning_resource: {
      name: `Official ${techName} Documentation & Guides`,
      url: 'https://developer.mozilla.org/en-US/docs/Learn',
      description: `Official documentation and community learning guides to help you understand ${techName} from the ground up.`,
    },
  }
}

/**
 * Extracts or generates Beginner's Guide items for a roadmap.
 * @param {Object} roadmap 
 * @param {string} [fallbackIdea] 
 * @returns {Array<Object>}
 */
export function getBeginnerGuideItems(roadmap, fallbackIdea = '') {
  if (!roadmap) return []
  const data = roadmap.data || roadmap

  const existing = roadmap.beginner_guide || data.beginner_guide
  if (Array.isArray(existing) && existing.length > 0) {
    const validObjects = existing
      .filter((it) => it && typeof it === 'object' && !Array.isArray(it) && it.technology)
      .map((it) => ({
        technology: String(it.technology || ''),
        category: String(it.category || ''),
        explanation: String(it.explanation || ''),
        learning_resource:
          it.learning_resource && typeof it.learning_resource === 'object'
            ? {
                name: String(it.learning_resource.name || ''),
                url: String(it.learning_resource.url || ''),
                description: String(it.learning_resource.description || ''),
              }
            : {
                name: `Official ${it.technology} Guide`,
                url: 'https://developer.mozilla.org/en-US/docs/Learn',
                description: 'General recommended documentation and learning path.',
              },
      }))
    if (validObjects.length > 0) {
      return validObjects
    }
  }

  const stack = Array.isArray(data.recommended_stack) ? data.recommended_stack : []
  const idea = roadmap.original_idea || fallbackIdea || data.original_idea || ''

  return stack.map((tech) => buildBeginnerTechExplanation(tech, idea))
}


