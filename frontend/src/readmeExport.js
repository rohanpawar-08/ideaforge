/**
 * Formats roadmap data into a GitHub-style markdown README.md and triggers browser download.
 */

/**
 * Derives a clean project title from the project idea text.
 * @param {string} ideaText 
 * @returns {string}
 */
export function deriveProjectTitle(ideaText) {
  if (!ideaText || typeof ideaText !== 'string') {
    return 'Project Roadmap'
  }

  const clean = ideaText.trim().replace(/^["']|["']$/g, '').trim()
  if (!clean) return 'Project Roadmap'

  // Extract first sentence
  const firstSentence = clean.split(/[.!?\n]/)[0].trim()

  // Match leading clause before words like "where", "that", "which", "designed to", "to help"
  const clauseMatch = firstSentence.match(
    /^(?:a |an |the )?(.*?)(?:\s+(?:where|that|which|to help|designed to|for tracking|for managing)\b)/i
  )
  if (clauseMatch && clauseMatch[1] && clauseMatch[1].trim().length >= 4 && clauseMatch[1].trim().length <= 60) {
    const raw = clauseMatch[1].trim()
    return raw.charAt(0).toUpperCase() + raw.slice(1)
  }

  // If the first sentence itself is reasonable length
  if (firstSentence.length <= 50) {
    const title = firstSentence.replace(/^(?:a |an |the )\s*/i, '')
    return title.charAt(0).toUpperCase() + title.slice(1)
  }

  // Word-boundary truncate under 45 chars
  const words = firstSentence.replace(/^(?:a |an |the )\s*/i, '').split(' ')
  let title = ''
  for (const word of words) {
    if ((title + ' ' + word).trim().length > 45) break
    title = (title + ' ' + word).trim()
  }
  return title ? title.charAt(0).toUpperCase() + title.slice(1) : 'Project Roadmap'
}

/**
 * Capitalizes a string (e.g., "intermediate" -> "Intermediate").
 * @param {string} str 
 * @returns {string}
 */
function capitalize(str) {
  if (!str) return ''
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase()
}

/**
 * Builds a complete GitHub-style markdown README.md string from roadmap data.
 * 
 * @param {Object} roadmap The roadmap object or roadmap.data
 * @param {string} fallbackIdea Original idea prompt
 * @returns {string} The markdown text
 */
function buildV2BlueprintReadme(data, ideaText) {
  const summary = data.project_summary || {}
  const title = summary.title || deriveProjectTitle(ideaText)
  const lines = []

  lines.push(`# ${title}`)
  lines.push('')
  if (summary.one_line_description || ideaText) {
    lines.push(`> ${summary.one_line_description || ideaText.trim()}`)
    lines.push('')
  }

  lines.push('## Executive Summary')
  lines.push('')
  if (summary.problem_statement) {
    lines.push(`**Problem Statement:** ${summary.problem_statement}`)
    lines.push('')
  }
  lines.push(`- **Project Type:** ${summary.project_type || 'Full-Stack Web App'}`)
  lines.push(`- **Estimated Duration:** ${summary.estimated_duration || '4 Weeks'}`)
  lines.push(`- **Target Difficulty:** \`${capitalize(summary.difficulty || data.feasibility || 'intermediate')}\``)
  if (Array.isArray(summary.target_users) && summary.target_users.length > 0) {
    lines.push(`- **Target Users:** ${summary.target_users.join(', ')}`)
  }
  lines.push('')

  if (Array.isArray(data.assumptions) && data.assumptions.length > 0) {
    lines.push('## Architectural Assumptions')
    lines.push('')
    data.assumptions.forEach((a) => {
      const text = typeof a === 'string' ? a : `${a.assumption} (${a.reason})`
      lines.push(`- ${text}`)
    })
    lines.push('')
  }

  if (Array.isArray(data.recommended_stack) && data.recommended_stack.length > 0) {
    lines.push('## Recommended Tech Stack')
    lines.push('')
    lines.push('| Technology | Purpose | Why Recommended | Alternatives |')
    lines.push('| :--- | :--- | :--- | :--- |')
    data.recommended_stack.forEach((tech) => {
      if (typeof tech === 'string') {
        lines.push(`| **${tech}** | Core component | Recommended choice | - |`)
      } else {
        const alts = Array.isArray(tech.alternatives) && tech.alternatives.length > 0 ? tech.alternatives.join(', ') : 'None'
        lines.push(`| **${tech.technology}** | ${tech.purpose || '-'} | ${tech.why_recommended || '-'} | ${alts} |`)
      }
    })
    lines.push('')
  }

  if (data.architecture) {
    lines.push('## System Architecture')
    lines.push('')
    if (data.architecture.overview) {
      lines.push(data.architecture.overview)
      lines.push('')
    }
    if (Array.isArray(data.architecture.data_flow) && data.architecture.data_flow.length > 0) {
      lines.push('### End-to-End Data Flow')
      lines.push('')
      data.architecture.data_flow.forEach((step, idx) => {
        lines.push(`${idx + 1}. ${step.replace(/^\\d+\\.\\s*/, '')}`)
      })
      lines.push('')
    }
  }

  if (data.database?.tables && Array.isArray(data.database.tables) && data.database.tables.length > 0) {
    lines.push('## Database Design & Data Dictionary')
    lines.push('')
    data.database.tables.forEach((table) => {
      lines.push(`### Entity Table: \`${table.name}\``)
      if (table.purpose) lines.push(`*Purpose:* ${table.purpose}`)
      lines.push('')
      lines.push('| Field | Type | Constraints | Description |')
      lines.push('| :--- | :--- | :--- | :--- |')
      if (Array.isArray(table.fields)) {
        table.fields.forEach((f) => {
          lines.push(`| \`${f.name}\` | \`${f.type}\` | ${f.constraints || '-'} | ${f.description || '-'} |`)
        })
      }
      lines.push('')
    })
  }

  if (Array.isArray(data.api_design) && data.api_design.length > 0) {
    lines.push('## API Design Contract')
    lines.push('')
    lines.push('| Method | Endpoint | Auth | Purpose | Request | Response |')
    lines.push('| :--- | :--- | :--- | :--- | :--- | :--- |')
    data.api_design.forEach((api) => {
      lines.push(`| \`${api.method}\` | \`${api.endpoint}\` | ${api.auth_required ? 'Required' : 'Public'} | ${api.purpose} | \`${api.request_summary || '-'}\` | \`${api.response_summary || '-'}\` |`)
    })
    lines.push('')
  }

  if (data.folder_structure) {
    lines.push('## Project Structure')
    lines.push('')
    if (data.folder_structure.description) {
      lines.push(data.folder_structure.description)
      lines.push('')
    }
    if (data.folder_structure.tree) {
      lines.push('```text')
      lines.push(data.folder_structure.tree)
      lines.push('```')
      lines.push('')
    }
  }

  if (data.setup_guide) {
    lines.push('## Setup & Installation')
    lines.push('')
    if (Array.isArray(data.setup_guide.prerequisites) && data.setup_guide.prerequisites.length > 0) {
      lines.push('### Prerequisites')
      lines.push('')
      data.setup_guide.prerequisites.forEach((p) => lines.push(`- ${p}`))
      lines.push('')
    }
    if (Array.isArray(data.setup_guide.software_to_install) && data.setup_guide.software_to_install.length > 0) {
      lines.push('### Software to Install')
      lines.push('')
      data.setup_guide.software_to_install.forEach((s) => {
        lines.push(`- **${s.name}**: ${s.purpose} *(Install: ${s.install_url_or_command || 'official website'})*`)
      })
      lines.push('')
    }
    if (Array.isArray(data.setup_guide.commands) && data.setup_guide.commands.length > 0) {
      lines.push('### Quickstart Commands')
      lines.push('')
      data.setup_guide.commands.forEach((cmd) => {
        lines.push(`**Step ${cmd.step}:** ${cmd.purpose}`)
        lines.push('```bash')
        lines.push(cmd.command)
        lines.push('```')
        lines.push('')
      })
    }
  }

  if (Array.isArray(data.implementation_plan) && data.implementation_plan.length > 0) {
    lines.push('## Actionable Implementation Plan')
    lines.push('')
    data.implementation_plan.forEach((phase) => {
      lines.push(`### Phase ${phase.phase}: ${phase.name}`)
      lines.push(`> **Goal:** ${phase.goal}`)
      lines.push('')
      if (Array.isArray(phase.tasks) && phase.tasks.length > 0) {
        phase.tasks.forEach((t) => {
          if (typeof t === 'string') {
            lines.push(`- [ ] **${t}**`)
          } else {
            lines.push(`- [ ] **${t.task}**`)
            if (t.description) lines.push(`  - *Description:* ${t.description}`)
            if (Array.isArray(t.files_or_modules) && t.files_or_modules.length > 0) {
              lines.push(`  - *Files:* \`${t.files_or_modules.join('`, `')}\``)
            }
            if (t.how_to_test) lines.push(`  - *How to test:* ${t.how_to_test}`)
            if (t.definition_of_done) lines.push(`  - *Definition of Done:* ${t.definition_of_done}`)
          }
        })
      }
      lines.push('')
    })
  }

  if (data.testing_plan || data.security_plan) {
    lines.push('## Testing & Security Strategy')
    lines.push('')
    if (data.testing_plan) {
      lines.push('### Testing Plan')
      lines.push('')
      for (const [suite, tests] of Object.entries(data.testing_plan)) {
        if (Array.isArray(tests) && tests.length > 0) {
          lines.push(`**${capitalize(suite)} Tests:**`)
          tests.forEach((test) => lines.push(`- [ ] ${test}`))
          lines.push('')
        }
      }
    }
    if (Array.isArray(data.security_plan) && data.security_plan.length > 0) {
      lines.push('### Security Safeguards')
      lines.push('')
      data.security_plan.forEach((sec) => lines.push(`- 🛡️ ${sec}`))
      lines.push('')
    }
  }

  if (data.deployment_plan) {
    lines.push('## Deployment & Production Plan')
    lines.push('')
    lines.push(`- **Frontend Target:** ${data.deployment_plan.frontend || 'Vercel'}`)
    lines.push(`- **Backend Target:** ${data.deployment_plan.backend || 'Render'}`)
    lines.push(`- **Database Target:** ${data.deployment_plan.database || 'Neon PostgreSQL'}`)
    lines.push('')
    if (Array.isArray(data.deployment_plan.steps) && data.deployment_plan.steps.length > 0) {
      lines.push('### Deployment Steps')
      lines.push('')
      data.deployment_plan.steps.forEach((step) => lines.push(`- ${step}`))
      lines.push('')
    }
  }

  if (Array.isArray(data.launch_checklist) && data.launch_checklist.length > 0) {
    lines.push('## Launch Checklist')
    lines.push('')
    data.launch_checklist.forEach((item) => lines.push(`- [ ] ${item}`))
    lines.push('')
  }

  lines.push('---')
  lines.push('')
  lines.push('*Generated with [IdeaForge](https://ideaforge-steel-alpha.vercel.app/) — AI Project Architect & Execution Planner.*')
  lines.push('')

  return lines.join('\n')
}

export function buildRoadmapReadme(roadmap, fallbackIdea = '') {
  if (!roadmap) return '# Project Roadmap\n\nNo roadmap data available.\n'

  const data = roadmap.data || roadmap
  const ideaText = roadmap.original_idea || fallbackIdea || data.original_idea || ''

  // If V2 blueprint, render rich execution blueprint README
  if (data.schema_version === 2 || Boolean(data.project_summary) || Boolean(data.implementation_plan)) {
    return buildV2BlueprintReadme(data, ideaText)
  }

  const title = deriveProjectTitle(ideaText)
  const lines = []

  // 1. Header & Title
  lines.push(`# ${title}`)
  lines.push('')

  // 2. Project Description
  if (ideaText) {
    lines.push(`> ${ideaText.trim()}`)
    lines.push('')
  }

  // 3. Quick Overview / Meta
  lines.push('## Project Overview')
  lines.push('')
  const overviewRows = []
  if (data.feasibility) {
    overviewRows.push(`- **Feasibility:** \`${capitalize(data.feasibility)}\``)
  }
  if (data.estimated_weeks) {
    overviewRows.push(`- **Estimated Timeline:** ${data.estimated_weeks} Weeks`)
  }
  if (overviewRows.length > 0) {
    lines.push(...overviewRows)
    lines.push('')
  }

  // Difficulty Breakdown Table
  if (data.difficulty_breakdown && typeof data.difficulty_breakdown === 'object') {
    lines.push('### Complexity Breakdown')
    lines.push('')
    lines.push('| Area | Level |')
    lines.push('| :--- | :--- |')
    const breakdownLabels = {
      frontend_complexity: 'Frontend',
      backend_complexity: 'Backend',
      database_complexity: 'Database',
      ai_complexity: 'AI / Machine Learning',
      deployment_complexity: 'Deployment'
    }
    for (const [key, label] of Object.entries(breakdownLabels)) {
      const val = data.difficulty_breakdown[key]
      if (val) {
        const formattedVal = val === 'not_applicable' ? 'N/A' : capitalize(val)
        lines.push(`| ${label} | \`${formattedVal}\` |`)
      }
    }
    lines.push('')
  }

  // 4. Tech Stack
  if (data.recommended_stack && Array.isArray(data.recommended_stack) && data.recommended_stack.length > 0) {
    lines.push('## Recommended Tech Stack')
    lines.push('')
    data.recommended_stack.forEach((tech) => {
      lines.push(`- **${tech}**`)
    })
    lines.push('')
  }

  // 5. Developer Setup Guide
  if (data.setup_guide) {
    lines.push('## Developer Setup Guide')
    lines.push('')

    if (data.setup_guide.primary_language) {
      lines.push(`- **Primary Language:** ${data.setup_guide.primary_language}`)
    }
    if (data.setup_guide.editor_recommendation) {
      lines.push(`- **Recommended Editor:** ${data.setup_guide.editor_recommendation}`)
    }
    lines.push('')

    if (data.setup_guide.getting_started_command) {
      lines.push('### Getting Started')
      lines.push('')
      lines.push('Run the following command to initialize your workspace:')
      lines.push('')
      lines.push('```bash')
      lines.push(data.setup_guide.getting_started_command)
      lines.push('```')
      lines.push('')
    }

    if (Array.isArray(data.setup_guide.key_tools) && data.setup_guide.key_tools.length > 0) {
      lines.push('### Key Tools & Packages')
      lines.push('')
      data.setup_guide.key_tools.forEach((tool) => {
        const name = tool.name || tool
        const purpose = tool.purpose ? ` — ${tool.purpose}` : ''
        lines.push(`- **\`${name}\`**${purpose}`)
      })
      lines.push('')
    }
  }

  // 6. Suggested Database Schema
  if (Array.isArray(data.suggested_schema) && data.suggested_schema.length > 0) {
    lines.push('## Suggested Database Schema')
    lines.push('')
    data.suggested_schema.forEach((table) => {
      const tableName = table.table_name || 'unnamed_table'
      lines.push(`### Table: \`${tableName}\``)
      lines.push('')
      lines.push('| Field | Type | Notes |')
      lines.push('| :--- | :--- | :--- |')
      if (Array.isArray(table.fields) && table.fields.length > 0) {
        table.fields.forEach((field) => {
          const fieldName = `\`${field.name || 'field'}\``
          const fieldType = `\`${field.type || 'text'}\``
          const fieldNotes = field.notes ? field.notes.replace(/\|/g, '\\|') : '-'
          lines.push(`| ${fieldName} | ${fieldType} | ${fieldNotes} |`)
        })
      } else {
        lines.push('| *(No fields specified)* | - | - |')
      }
      lines.push('')
    })
  }

  // 7. MVP Features
  if (Array.isArray(data.mvp_features) && data.mvp_features.length > 0) {
    lines.push('## Core MVP Scope')
    lines.push('')
    data.mvp_features.forEach((feat) => {
      lines.push(`- [ ] ${feat}`)
    })
    lines.push('')
  }

  // 8. Stretch Features
  if (Array.isArray(data.stretch_features) && data.stretch_features.length > 0) {
    lines.push('## Stretch Features (Post-MVP)')
    lines.push('')
    data.stretch_features.forEach((feat) => {
      lines.push(`- [ ] ${feat}`)
    })
    lines.push('')
  }

  // 9. Week-by-Week Implementation Roadmap
  if (Array.isArray(data.milestones) && data.milestones.length > 0) {
    lines.push('## Implementation Roadmap')
    lines.push('')
    data.milestones.forEach((m) => {
      lines.push(`### Week ${m.week}: ${m.goal || 'Milestone Goal'}`)
      lines.push('')
      if (Array.isArray(m.tasks) && m.tasks.length > 0) {
        m.tasks.forEach((t) => {
          const isDone = Boolean(t.completed)
          const desc = typeof t === 'string' ? t : (t.description || t.task || '')
          lines.push(`- [${isDone ? 'x' : ' '}] ${desc}`)
        })
      }
      lines.push('')
    })
  }

  // 10. Potential Pitfalls
  if (Array.isArray(data.potential_pitfalls) && data.potential_pitfalls.length > 0) {
    lines.push('## Potential Pitfalls & Mitigations')
    lines.push('')
    data.potential_pitfalls.forEach((pitfall) => {
      lines.push(`- ⚠️ ${pitfall}`)
    })
    lines.push('')
  }

  // 11. Footer
  lines.push('---')
  lines.push('')
  lines.push('*Generated with [IdeaForge](https://ideaforge-steel-alpha.vercel.app/) — Turn ideas into structured developer roadmaps.*')
  lines.push('')

  return lines.join('\n')
}

/**
 * Triggers a browser download of the roadmap as README.md using a Blob.
 * 
 * @param {Object} roadmap The roadmap object or roadmap.data
 * @param {string} fallbackIdea Original idea prompt
 * @param {string} filename Name of the downloaded file (default: "README.md")
 */
export function downloadRoadmapReadme(roadmap, fallbackIdea = '', filename = 'README.md') {
  const markdown = buildRoadmapReadme(roadmap, fallbackIdea)
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
