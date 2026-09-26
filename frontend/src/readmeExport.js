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
export function buildRoadmapReadme(roadmap, fallbackIdea = '') {
  if (!roadmap) return '# Project Roadmap\n\nNo roadmap data available.\n'

  const data = roadmap.data || roadmap
  const ideaText = roadmap.original_idea || fallbackIdea || data.original_idea || ''
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
