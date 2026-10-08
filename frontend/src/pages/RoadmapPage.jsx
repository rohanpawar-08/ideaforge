import React, { useState } from 'react'
import { Icon } from '../components/common/Icon'
import { ProgressTracker } from '../components/roadmap/ProgressTracker'
import { RoadmapOverview } from '../components/roadmap/RoadmapOverview'
import { SetupGuideSection } from '../components/roadmap/SetupGuideSection'
import { BeginnerGuideSection, isBeginnerUser } from '../components/roadmap/BeginnerGuideSection'
import { DatabaseSchemaSection } from '../components/roadmap/DatabaseSchemaSection'
import { MilestonesSection } from '../components/roadmap/MilestonesSection'
import { RoadmapChat } from '../components/chat/RoadmapChat'
import { BlueprintViewer } from '../components/blueprint/BlueprintViewer'
import { DocumentActions } from '../components/documents/DocumentActions'
import { BuildView } from '../components/workspace/BuildView'

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
  const [activeProjectTab, setActiveProjectTab] = useState('build') // 'build' | 'blueprint' | 'assistant' | 'documents'

  if (!roadmap) return null

  const data = roadmap.data || roadmap
  const isV2 = data.schema_version === 2 || Boolean(data.project_summary) || Boolean(data.implementation_plan)
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

      {/* Project Navigation Bar: Build | Blueprint | AI Assistant | Documents */}
      <nav className="project-view-navigation-bar" aria-label="Project Navigation">
        <div className="project-tabs-group">
          <button
            type="button"
            className={`project-tab-btn ${activeProjectTab === 'build' ? 'active' : ''}`}
            onClick={() => setActiveProjectTab('build')}
            id="tab-project-build"
          >
            <Icon name="rocket" size={14} />
            <span>Build</span>
            {progress?.workspace && (
              <span className="tab-badge">
                {progress.workspace.done_tasks}/{progress.workspace.total_tasks}
              </span>
            )}
          </button>
          <button
            type="button"
            className={`project-tab-btn ${activeProjectTab === 'blueprint' ? 'active' : ''}`}
            onClick={() => setActiveProjectTab('blueprint')}
            id="tab-project-blueprint"
          >
            <Icon name="file" size={14} />
            <span>Blueprint</span>
          </button>
          <button
            type="button"
            className={`project-tab-btn ${activeProjectTab === 'assistant' ? 'active' : ''}`}
            onClick={() => setActiveProjectTab('assistant')}
            id="tab-project-assistant"
          >
            <Icon name="message" size={14} />
            <span>AI Assistant</span>
            {chatMessages.length > 0 && (
              <span className="tab-badge">{chatMessages.length}</span>
            )}
          </button>
          <button
            type="button"
            className={`project-tab-btn ${activeProjectTab === 'documents' ? 'active' : ''}`}
            onClick={() => setActiveProjectTab('documents')}
            id="tab-project-documents"
          >
            <Icon name="download" size={14} />
            <span>Documents</span>
          </button>
        </div>
      </nav>

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

      {/* TAB 1: BUILD VIEW (Primary Persistent Execution Workspace) */}
      {activeProjectTab === 'build' && (
        <BuildView
          roadmap={roadmap}
          progress={progress}
          onSwitchToBlueprint={() => setActiveProjectTab('blueprint')}
        />
      )}

      {/* TAB 2: BLUEPRINT (Architectural Specification & Reference) */}
      {activeProjectTab === 'blueprint' && (
        <>
          {/* Progress Tracker bar in Blueprint reference view */}
          {progress && (
            <ProgressTracker
              completedCount={progress.completedTasksCount}
              totalCount={progress.totalTasksCount}
              percentage={progress.progressPercentage}
            />
          )}

          {isV2 ? (
            <BlueprintViewer
              blueprint={roadmap}
              originalIdea={originalIdea}
              progress={progress}
              regeneratingSection={regeneratingSection}
              onRegenerateSection={onRegenerateSection}
              onDownloadSrs={onDownloadSrs}
              onDownloadSynopsis={onDownloadSynopsis}
              onDownloadViva={onDownloadViva}
              isGeneratingViva={isGeneratingViva}
              onDownloadReadme={onDownloadReadme}
              onDownloadPdf={onDownloadPdf}
              onPlanAnother={onPlanAnother}
            />
          ) : (
            <>
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

              {roadmap.setup_guide && (
                <SetupGuideSection
                  setupGuide={roadmap.setup_guide}
                  onRegenerate={() => onRegenerateSection('setup_guide')}
                  isRegenerating={Boolean(regeneratingSection.setup_guide)}
                />
              )}

              {isBeginner && (
                <BeginnerGuideSection
                  roadmap={roadmap}
                  idea={roadmap.original_idea || originalIdea}
                />
              )}

              {roadmap.suggested_schema && (
                <DatabaseSchemaSection
                  schema={roadmap.suggested_schema}
                  onRegenerate={() => onRegenerateSection('suggested_schema')}
                  isRegenerating={Boolean(regeneratingSection.suggested_schema)}
                />
              )}

              {roadmap.milestones && (
                <MilestonesSection
                  milestones={roadmap.milestones}
                  checkedTasks={progress ? progress.checkedTasks : {}}
                  onToggleTask={progress ? progress.handleToggleTask : () => {}}
                  onRegenerate={() => onRegenerateSection('milestones')}
                  isRegenerating={Boolean(regeneratingSection.milestones)}
                />
              )}
            </>
          )}
        </>
      )}

      {/* TAB 3: AI ASSISTANT (Chat & Adjustments) */}
      {activeProjectTab === 'assistant' && (
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
      )}

      {/* TAB 4: DOCUMENTS (SRS, Synopsis, Viva, Readme, PDF Exports) */}
      {activeProjectTab === 'documents' && (
        <div className="card documents-page-card" id="project-documents-panel">
          <div className="card-header">
            <div>
              <span className="card-label">PROJECT DOCUMENTATION & EXPORTS</span>
              <h2 className="card-title">Academic & Developer Deliverables</h2>
            </div>
          </div>
          <p className="card-description" style={{ marginBottom: 'var(--space-5)', color: 'var(--color-text-muted)' }}>
            Export comprehensive SRS specifications, project synopsis reports, exam viva guides, developer READMEs, and printable PDF roadmaps.
          </p>
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
      )}
    </section>
  )
}
