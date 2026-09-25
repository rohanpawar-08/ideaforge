import { jsPDF } from 'jspdf'

/**
 * Generates a clean, professionally formatted PDF of a project roadmap.
 * Includes: Original idea, Feasibility, Estimated weeks, Tech stack,
 * Setup guide (with getting started command and key tools),
 * MVP & Stretch features, and week-by-week Milestones with task breakdown.
 *
 * @param {Object} roadmap - The roadmap data object
 * @param {string} fallbackIdea - Fallback idea string if not in roadmap object
 * @returns {jsPDF} The generated jsPDF instance
 */
export function buildRoadmapPdf(roadmap, fallbackIdea = '') {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' })
  const pageWidth = doc.internal.pageSize.getWidth()
  const pageHeight = doc.internal.pageSize.getHeight()
  const margin = 44
  const contentWidth = pageWidth - margin * 2
  let y = margin

  const checkPageBreak = (needed = 24) => {
    if (y + needed > pageHeight - margin - 24) {
      doc.addPage()
      y = margin
      return true
    }
    return false
  }

  // --- Document Header ---
  doc.setFillColor(37, 99, 235) // IdeaForge Primary Blue
  doc.rect(margin, y, contentWidth, 4, 'F')
  y += 20

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(22)
  doc.setTextColor(15, 23, 42) // Slate 900
  doc.text('IdeaForge Roadmap', margin, y)
  y += 18

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10)
  doc.setTextColor(100, 116, 139) // Slate 500
  doc.text('Technical Project Scope & Milestone Execution Plan', margin, y)
  const dateStr = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  doc.text(`Generated: ${dateStr}`, pageWidth - margin, y, { align: 'right' })
  y += 14

  doc.setDrawColor(226, 232, 240)
  doc.line(margin, y, pageWidth - margin, y)
  y += 20

  // --- 1. Project Idea ---
  const ideaText = roadmap?.original_idea || fallbackIdea || 'Project Roadmap'
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(10.5)
  doc.setTextColor(37, 99, 235)
  doc.text('PROJECT IDEA', margin, y)
  y += 14

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(10.5)
  doc.setTextColor(15, 23, 42)
  const splitIdea = doc.splitTextToSize(ideaText, contentWidth)
  doc.text(splitIdea, margin, y)
  y += splitIdea.length * 15 + 10

  // --- 2. Overview Summary Box (Feasibility, Weeks, Stack) ---
  checkPageBreak(74)
  const boxTop = y
  doc.setFillColor(248, 250, 252) // Light slate surface
  doc.setDrawColor(226, 232, 240)
  doc.roundedRect(margin, boxTop, contentWidth, 56, 4, 4, 'FD')

  const col1 = margin + 14
  const col2 = margin + 160
  const col3 = margin + 295

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8.5)
  doc.setTextColor(100, 116, 139)
  doc.text('FEASIBILITY', col1, boxTop + 18)
  doc.text('ESTIMATED TIMELINE', col2, boxTop + 18)
  doc.text('RECOMMENDED STACK', col3, boxTop + 18)

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(11)
  doc.setTextColor(15, 23, 42)
  const feas = (roadmap?.feasibility || 'Intermediate').toUpperCase()
  doc.text(feas, col1, boxTop + 37)

  const weeks = `${roadmap?.estimated_weeks || 4} ${
    roadmap?.estimated_weeks === 1 ? 'Week' : 'Weeks'
  }`
  doc.text(weeks, col2, boxTop + 37)

  const stackList = Array.isArray(roadmap?.recommended_stack)
    ? roadmap.recommended_stack
    : typeof roadmap?.recommended_stack === 'string'
    ? [roadmap.recommended_stack]
    : []
  const stackStr = stackList.join(', ') || 'Standard Web Stack'
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9.5)
  const splitStack = doc.splitTextToSize(stackStr, contentWidth - 305)
  doc.text(splitStack, col3, boxTop + 37)

  y = boxTop + 66

  // Difficulty Breakdown line if present
  if (roadmap?.difficulty_breakdown) {
    checkPageBreak(30)
    const diff = roadmap.difficulty_breakdown
    const formatDiffVal = (v) => {
      if (!v) return 'N/A'
      const s = String(v).toLowerCase().replace('-', '_')
      if (s === 'not_applicable' || s === 'na') return 'N/A'
      return s.charAt(0).toUpperCase() + s.slice(1)
    }
    const diffParts = [
      `Frontend: ${formatDiffVal(diff.frontend_complexity)}`,
      `Backend: ${formatDiffVal(diff.backend_complexity)}`,
      `Database: ${formatDiffVal(diff.database_complexity)}`,
      `AI: ${formatDiffVal(diff.ai_complexity)}`,
      `Deployment: ${formatDiffVal(diff.deployment_complexity)}`,
    ]
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(8)
    doc.setTextColor(100, 116, 139)
    doc.text('DIFFICULTY BREAKDOWN: ', margin, y)
    const labelW = doc.getTextWidth('DIFFICULTY BREAKDOWN: ')
    doc.setFont('helvetica', 'normal')
    doc.setTextColor(51, 65, 85)
    doc.text(diffParts.join('   |   '), margin + labelW, y)
    y += 20
  } else {
    y = boxTop + 70
  }
  if (roadmap?.setup_guide) {
    checkPageBreak(85)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(37, 99, 235)
    doc.text('DEVELOPER SETUP GUIDE', margin, y)
    y += 16

    if (roadmap.setup_guide.primary_language) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(15, 23, 42)
      doc.text('Primary Language: ', margin, y)
      const labelW = doc.getTextWidth('Primary Language: ')
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(51, 65, 85)
      const splitLang = doc.splitTextToSize(
        roadmap.setup_guide.primary_language,
        contentWidth - labelW
      )
      doc.text(splitLang, margin + labelW, y)
      y += splitLang.length * 13 + 4
    }

    if (roadmap.setup_guide.editor_recommendation) {
      checkPageBreak(22)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(15, 23, 42)
      doc.text('Recommended Editor: ', margin, y)
      const labelW = doc.getTextWidth('Recommended Editor: ')
      doc.setFont('helvetica', 'normal')
      doc.setTextColor(51, 65, 85)
      const splitEd = doc.splitTextToSize(
        roadmap.setup_guide.editor_recommendation,
        contentWidth - labelW
      )
      doc.text(splitEd, margin + labelW, y)
      y += splitEd.length * 13 + 6
    }

    if (roadmap.setup_guide.getting_started_command) {
      checkPageBreak(34)
      doc.setFillColor(241, 245, 249)
      doc.roundedRect(margin, y, contentWidth, 24, 3, 3, 'F')
      doc.setFont('courier', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(15, 23, 42)
      doc.text(
        `$ ${roadmap.setup_guide.getting_started_command}`,
        margin + 10,
        y + 16
      )
      y += 32
    }

    if (
      roadmap.setup_guide.key_tools &&
      roadmap.setup_guide.key_tools.length > 0
    ) {
      checkPageBreak(30)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(100, 116, 139)
      doc.text('Key Tools & Packages:', margin, y)
      y += 13

      roadmap.setup_guide.key_tools.forEach((tool) => {
        checkPageBreak(18)
        doc.setFont('helvetica', 'bold')
        doc.setFontSize(9.5)
        doc.setTextColor(37, 99, 235)
        const nameText = `• ${tool.name || tool}: `
        doc.text(nameText, margin + 8, y)
        const nameW = doc.getTextWidth(nameText)

        doc.setFont('helvetica', 'normal')
        doc.setTextColor(51, 65, 85)
        const purposeText = tool.purpose || ''
        const splitPurpose = doc.splitTextToSize(
          purposeText,
          contentWidth - 8 - nameW
        )
        doc.text(splitPurpose, margin + 8 + nameW, y)
        y += splitPurpose.length * 13 + 3
      })
      y += 8
    }
  }

  // --- 4. Feature Scopes (MVP & Stretch) ---
  const hasMvp = roadmap?.mvp_features && roadmap.mvp_features.length > 0
  const hasStretch =
    roadmap?.stretch_features && roadmap.stretch_features.length > 0

  if (hasMvp || hasStretch) {
    checkPageBreak(80)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(37, 99, 235)
    doc.text('FEATURE SCOPES', margin, y)
    y += 16

    if (hasMvp) {
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text('Core MVP Scope:', margin, y)
      y += 12

      roadmap.mvp_features.forEach((feat) => {
        checkPageBreak(16)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(51, 65, 85)
        const splitFeat = doc.splitTextToSize(`✓  ${feat}`, contentWidth - 10)
        doc.text(splitFeat, margin + 8, y)
        y += splitFeat.length * 13 + 2
      })
      y += 8
    }

    if (hasStretch) {
      checkPageBreak(40)
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(10)
      doc.setTextColor(15, 23, 42)
      doc.text('Stretch Features:', margin, y)
      y += 12

      roadmap.stretch_features.forEach((feat) => {
        checkPageBreak(16)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(51, 65, 85)
        const splitFeat = doc.splitTextToSize(`★  ${feat}`, contentWidth - 10)
        doc.text(splitFeat, margin + 8, y)
        y += splitFeat.length * 13 + 2
      })
      y += 10
    }
  }

  // --- 5. Weekly Milestones Execution Plan ---
  const milestones = roadmap?.milestones || []
  if (milestones.length > 0) {
    checkPageBreak(70)
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.setTextColor(37, 99, 235)
    doc.text('WEEKLY MILESTONE EXECUTION PLAN', margin, y)
    y += 16

    milestones.forEach((m, idx) => {
      const weekNum = m.week !== undefined ? m.week : idx + 1
      const tasks = Array.isArray(m.tasks)
        ? m.tasks
        : typeof m.tasks === 'string'
        ? [m.tasks]
        : []
      checkPageBreak(tasks.length * 15 + 34)

      // Milestone Card header
      doc.setFillColor(241, 245, 249)
      doc.roundedRect(margin, y, contentWidth, 20, 3, 3, 'F')
      doc.setFont('helvetica', 'bold')
      doc.setFontSize(9.5)
      doc.setTextColor(37, 99, 235)
      doc.text(`Week ${weekNum}: `, margin + 8, y + 14)
      const weekLabelW = doc.getTextWidth(`Week ${weekNum}: `)

      doc.setFont('helvetica', 'bold')
      doc.setTextColor(15, 23, 42)
      doc.text(
        m.goal || `Milestone ${weekNum}`,
        margin + 8 + weekLabelW,
        y + 14
      )
      y += 28

      tasks.forEach((task) => {
        checkPageBreak(16)
        doc.setFont('helvetica', 'normal')
        doc.setFontSize(9.5)
        doc.setTextColor(51, 65, 85)
        const splitTask = doc.splitTextToSize(`[ ]  ${task}`, contentWidth - 16)
        doc.text(splitTask, margin + 12, y)
        y += splitTask.length * 13 + 3
      })

      y += 8
    })
  }

  // --- Running Footer with Page Numbers ---
  const totalPages = doc.internal.getNumberOfPages()
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i)
    doc.setDrawColor(226, 232, 240)
    doc.line(margin, pageHeight - 28, pageWidth - margin, pageHeight - 28)
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(8.5)
    doc.setTextColor(148, 163, 184)
    doc.text('IdeaForge - AI Technical Roadmap Generator', margin, pageHeight - 16)
    doc.text(
      `Page ${i} of ${totalPages}`,
      pageWidth - margin,
      pageHeight - 16,
      { align: 'right' }
    )
  }

  return doc
}

/**
 * Triggers the browser download of the roadmap PDF.
 */
export function downloadRoadmapPdf(roadmap, fallbackIdea = '') {
  const doc = buildRoadmapPdf(roadmap, fallbackIdea)
  const baseName = (roadmap?.original_idea || fallbackIdea || 'roadmap')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 35)

  doc.save(`ideaforge-roadmap-${baseName || 'export'}.pdf`)
}
