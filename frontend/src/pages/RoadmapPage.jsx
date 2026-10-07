import React from 'react'
import { Icon } from '../components/common/Icon'
import { ProgressTracker } from '../components/roadmap/ProgressTracker'
import { RoadmapOverview } from '../components/roadmap/RoadmapOverview'
import { SetupGuideSection } from '../components/roadmap/SetupGuideSection'
import { BeginnerGuideSection, isBeginnerUser } from '../components/roadmap/BeginnerGuideSection'
import { DatabaseSchemaSection } from '../components/roadmap/DatabaseSchemaSection'
import { MilestonesSection } from '../components/roadmap/MilestonesSection'
import { RoadmapChat } from '../components/chat/RoadmapChat'
import { DocumentActions } from '../components/documents/DocumentActions'

function formatDate(dateString) {
  if (!dateString) return ''
  try {
    const d = new Date(dateString)
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return dateString
  }
}

export function RoadmapPage({
  roadmap,
  originalIdea,
  isSavedView = false,
  onBackToHistory,
  progress,
  regeneratingSection = {},
  onRegenerateSection,
  regenerateError,
  onClearRegenerateError,
  // Document action handlers
  onDownloadSrs,
  onDownloadSynopsis,
  onDownloadViva,
  isGeneratingViva = false,
  onDownloadReadme,
  onDownloadPdf,
  onPlanAnother,
  // Chat props
  chatMessages = [],
  chatInput = '',
  setChatInput,
  onSendChatMessage,
  isAskingRoadmap = false,
  roadmapChatError = null,
  onClearChatError,
  onApplyRoadmapChange,
  applyingChangeId = null,
  // Additional context for beginner detection
  previousAnswers = [],
  chatLog = [],
}) {
  if (!roadmap) return null

  const isBeginner = isBeginnerUser(roadmap, previousAnswers, chatLog)

  return (
    <section className="roadmap-section view-fade">
      {/* Back to History bar when viewing a saved roadmap */}
      {isSavedView && (
        <div className="saved-roadmap-toolbar">
          <button
            type="button"
            className="btn-secondary btn-sm btn-back"
            onClick={onBackToHistory}
            id="btn-back-to-history"
          >
            ← Back to History
          </button>
          <div className="toolbar-right-actions">
            <button
              type="button"
              className="btn-secondary btn-xs btn-generate-readme"
              onClick={onDownloadReadme}
              id="btn-generate-readme-toolbar"
              title="Generate and download README.md"
            >
              <Icon name="file" size={12} />
              README
            </button>
            <button
              type="button"
              className="btn-secondary btn-xs btn-download-pdf"
              onClick={onDownloadPdf}
              id="btn-download-pdf-toolbar"
              title="Download roadmap as PDF"
            >
              <Icon name="download" size={12} />
              PDF
            </button>
            {roadmap.created_at && (
              <span className="saved-date-tag">
                Saved on {formatDate(roadmap.created_at)}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Progress Card at Top of Roadmap View */}
      {progress && (
        <ProgressTracker
          completedCount={progress.completedTasksCount}
          totalCount={progress.totalTasksCount}
          percentage={progress.progressPercentage}
        />
      )}

      {regenerateError && (
        <div className="error-banner" role="alert">
          <div className="error-text">
            <Icon name="warning" size={14} /> {regenerateError}
          </div>
          <button
            className="btn-retry"
            type="button"
            onClick={onClearRegenerateError}
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Overview with Feasibility, Timeline, Stack & Features */}
      <RoadmapOverview
        roadmap={roadmap}
        originalIdea={originalIdea}
        headerActions={
          <DocumentActions
            onDownloadSrs={onDownloadSrs}
            onDownloadSynopsis={onDownloadSynopsis}
            onDownloadViva={onDownloadViva}
            isGeneratingViva={isGeneratingViva}
            onDownloadReadme={onDownloadReadme}
            onDownloadPdf={onDownloadPdf}
            onPlanAnother={onPlanAnother}
          />
        }
        onRegenerateStack={() => onRegenerateSection('stack')}
        isRegeneratingStack={Boolean(regeneratingSection.stack)}
      />

      {/* Developer Setup Guide */}
      {roadmap.setup_guide && (
        <SetupGuideSection
          setupGuide={roadmap.setup_guide}
          onRegenerate={() => onRegenerateSection('setup_guide')}
          isRegenerating={Boolean(regeneratingSection.setup_guide)}
        />
      )}

      {/* Beginner's Guide (Only shown if beginner user) */}
      {isBeginner && (
        <BeginnerGuideSection
          roadmap={roadmap}
          idea={roadmap.original_idea || originalIdea}
        />
      )}

      {/* Suggested Database Schema */}
      {roadmap.suggested_schema && (
        <DatabaseSchemaSection
          schema={roadmap.suggested_schema}
          onRegenerate={() => onRegenerateSection('suggested_schema')}
          isRegenerating={Boolean(regeneratingSection.suggested_schema)}
        />
      )}

      {/* Milestones Timeline */}
      {roadmap.milestones && (
        <MilestonesSection
          milestones={roadmap.milestones}
          checkedTasks={progress ? progress.checkedTasks : {}}
          onToggleTask={progress ? progress.handleToggleTask : () => {}}
          onRegenerate={() => onRegenerateSection('milestones')}
          isRegenerating={Boolean(regeneratingSection.milestones)}
        />
      )}

      {/* Follow-up Roadmap Chat & Adjustments */}
      <RoadmapChat
        messages={chatMessages}
        chatInput={chatInput}
        setChatInput={setChatInput}
        onSendMessage={onSendChatMessage}
        isLoading={isAskingRoadmap}
        error={roadmapChatError}
        onClearError={onClearChatError}
        onApplyChange={onApplyRoadmapChange}
        applyingChangeId={applyingChangeId}
      />
    </section>
  )
}
