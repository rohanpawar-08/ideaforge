import { useState, useRef, useEffect, useCallback } from 'react'
import { useAuth } from './hooks/useAuth'
import { useTheme } from './hooks/useTheme'
import { useRoadmapProgress } from './hooks/useRoadmapProgress'
import { AppShell } from './components/layout/AppShell'
import { AuthPage } from './pages/AuthPage'
import { GeneratorPage } from './pages/GeneratorPage'
import { ComparePage } from './pages/ComparePage'
import { HistoryPage } from './pages/HistoryPage'
import { RoadmapPage } from './pages/RoadmapPage'
import { AccountPage } from './pages/AccountPage'
import {
  generatePlan,
  getRoadmaps,
  getRoadmap,
  regenerateSection,
  askRoadmap,
  applyRoadmapChange,
  compareIdeas,
  generateViva,
} from './services/api'
import { downloadRoadmapPdf } from './utils/exportPdf'
import { downloadRoadmapReadme } from './utils/generateReadme'
import {
  downloadSrsDocument,
  downloadSynopsisDocument,
  downloadVivaDocument,
} from './docsExport'
import './App.css'

function App() {
  // Centralized Theme & Auth
  const { theme, toggleTheme } = useTheme()
  const {
    token,
    currentUserEmail,
    authMode,
    setAuthMode,
    authEmail,
    setAuthEmail,
    authPassword,
    setAuthPassword,
    authLoading,
    authError,
    setAuthError,
    handleSubmit: handleAuthSubmit,
    logout: rawLogout,
  } = useAuth()

  // Navigation view state: 'generator' | 'history' | 'saved_roadmap'
  const [view, setView] = useState('generator')

  // Generator states
  const [idea, setIdea] = useState('')
  const [hasStarted, setHasStarted] = useState(false)
  const [messages, setMessages] = useState([])
  const [previousAnswers, setPreviousAnswers] = useState([])
  const [inputValue, setInputValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [roadmap, setRoadmap] = useState(null)
  const [error, setError] = useState(null)

  // Section regeneration states
  const [regeneratingSection, setRegeneratingSection] = useState({})
  const [regenerateError, setRegenerateError] = useState(null)

  // History states
  const [historyRoadmaps, setHistoryRoadmaps] = useState([])
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [historyError, setHistoryError] = useState(null)

  // Idea comparison states
  const [generatorMode, setGeneratorMode] = useState('single') // 'single' | 'compare'
  const [compareIdeasState, setCompareIdeasState] = useState(['', ''])
  const [isComparing, setIsComparing] = useState(false)
  const [compareError, setCompareError] = useState(null)
  const [comparisonResult, setComparisonResult] = useState(null)

  // Follow-Up Roadmap Chat states
  const [roadmapChatMessages, setRoadmapChatMessages] = useState([])
  const [roadmapChatInput, setRoadmapChatInput] = useState('')
  const [isAskingRoadmap, setIsAskingRoadmap] = useState(false)
  const [roadmapChatError, setRoadmapChatError] = useState(null)
  const [applyingChangeId, setApplyingChangeId] = useState(null)

  // Document action loading
  const [isGeneratingViva, setIsGeneratingViva] = useState(false)

  // Task Progress hook
  const progress = useRoadmapProgress(roadmap)
  const lastRequestRef = useRef({ ideaText: '', answers: [] })

  // Logout callback
  const handleLogout = useCallback(() => {
    rawLogout(() => {
      setRoadmap(null)
      progress.setCheckedTasks({})
      setHistoryRoadmaps([])
      setHasStarted(false)
      setMessages([])
      setPreviousAnswers([])
      setIdea('')
      setInputValue('')
      setError(null)
      setComparisonResult(null)
      setCompareError(null)
      setRoadmapChatMessages([])
      setRoadmapChatInput('')
      setRoadmapChatError(null)
      setView('generator')
    })
  }, [rawLogout, progress])

  // Restore active roadmap from localStorage if authenticated
  useEffect(() => {
    if (!token) return
    try {
      const savedRoadmap = localStorage.getItem('ideaforge_active_roadmap')
      const savedRoadmapId = localStorage.getItem('ideaforge_active_roadmap_id')
      const savedView = localStorage.getItem('ideaforge_active_view')
      if (savedRoadmap && savedRoadmapId) {
        const parsed = JSON.parse(savedRoadmap)
        setRoadmap(parsed)
        setView(savedView === 'saved_roadmap' ? 'saved_roadmap' : 'generator')
      }
    } catch (err) {
      console.warn('Could not restore active roadmap from localStorage:', err)
    }
  }, [token])

  // Reset to initial generator state
  const handleReset = () => {
    try {
      localStorage.removeItem('ideaforge_active_roadmap')
      localStorage.removeItem('ideaforge_active_roadmap_id')
      localStorage.removeItem('ideaforge_active_view')
    } catch (e) {
      console.warn(e)
    }
    setView('generator')
    setGeneratorMode('single')
    setIdea('')
    setHasStarted(false)
    setMessages([])
    setPreviousAnswers([])
    setInputValue('')
    setRoadmap(null)
    progress.setCheckedTasks({})
    setError(null)
    setComparisonResult(null)
    setCompareError(null)
    setRoadmapChatMessages([])
    setRoadmapChatInput('')
    setRoadmapChatError(null)
    lastRequestRef.current = { ideaText: '', answers: [] }
  }

  // Load history roadmaps
  const fetchHistoryRoadmaps = async () => {
    setIsLoadingHistory(true)
    setHistoryError(null)
    try {
      const data = await getRoadmaps(token, handleLogout)
      setHistoryRoadmaps(data)
    } catch (err) {
      console.error('Error fetching roadmaps history:', err)
      setHistoryError('Could not load past roadmaps. Please try again.')
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const handleOpenHistory = async () => {
    setView('history')
    await fetchHistoryRoadmaps()
  }

  // Select roadmap from history
  const handleSelectRoadmap = async (id) => {
    setHistoryError(null)
    try {
      const data = await getRoadmap(id, token, handleLogout)
      const innerData = data.data || data
      const fullRoadmap = {
        ...innerData,
        id: data.id,
        original_idea: data.original_idea,
        created_at: data.created_at,
      }
      setRoadmap(fullRoadmap)
      setView('saved_roadmap')
      try {
        localStorage.setItem('ideaforge_active_roadmap_id', String(data.id))
        localStorage.setItem('ideaforge_active_roadmap', JSON.stringify(fullRoadmap))
        localStorage.setItem('ideaforge_active_view', 'saved_roadmap')
      } catch (e) {
        console.warn('Could not save active roadmap to localStorage:', e)
      }
    } catch (err) {
      console.error('Failed to load roadmap details:', err)
      setHistoryError('Could not open the selected roadmap. Please try again.')
    }
  }

  // Send idea / answer to backend
  const sendToBackend = async (ideaText, answers) => {
    setIsLoading(true)
    setError(null)
    lastRequestRef.current = { ideaText, answers }

    try {
      const data = await generatePlan(ideaText, answers, token, handleLogout)

      if (data.type === 'question') {
        setMessages((prev) => [...prev, { role: 'assistant', text: data.text }])
      } else if (data.type === 'roadmap') {
        const roadmapData = data.data || data
        const fullRoadmap = {
          ...roadmapData,
          id: data.id || roadmapData.id,
          original_idea: ideaText,
        }
        setRoadmap(fullRoadmap)
        try {
          if (fullRoadmap.id) {
            localStorage.setItem('ideaforge_active_roadmap_id', String(fullRoadmap.id))
          }
          localStorage.setItem('ideaforge_active_roadmap', JSON.stringify(fullRoadmap))
          localStorage.setItem('ideaforge_active_view', 'generator')
        } catch (e) {
          console.warn('Could not save active roadmap to localStorage:', e)
        }

        setMessages((prev) => [
          ...prev,
          {
            role: 'assistant',
            text: 'Your project roadmap is ready! Review your customized timeline below.',
          },
        ])
      } else {
        throw new Error('Something went wrong — please try again.')
      }
    } catch (err) {
      console.error('Request failed:', err)
      setError('Something went wrong — please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleStart = async (e) => {
    e?.preventDefault()
    const trimmed = idea.trim()
    if (!trimmed || isLoading) return

    setView('generator')
    setHasStarted(true)
    setMessages([{ role: 'user', text: trimmed }])
    await sendToBackend(trimmed, [])
  }

  const handleSendAnswer = async (e) => {
    e?.preventDefault()
    const trimmed = inputValue.trim()
    if (!trimmed || isLoading || roadmap) return

    const updatedAnswers = [...previousAnswers, trimmed]
    setPreviousAnswers(updatedAnswers)
    setMessages((prev) => [...prev, { role: 'user', text: trimmed }])
    setInputValue('')
    await sendToBackend(idea, updatedAnswers)
  }

  const handleRetry = () => {
    setError(null)
    if (lastRequestRef.current.ideaText) {
      sendToBackend(lastRequestRef.current.ideaText, lastRequestRef.current.answers)
    } else if (idea.trim()) {
      handleStart()
    }
  }

  // Section Regeneration
  const handleRegenerateSection = async (sectionKey) => {
    if (!roadmap?.id || regeneratingSection[sectionKey]) return

    setRegeneratingSection((prev) => ({ ...prev, [sectionKey]: true }))
    setRegenerateError(null)

    try {
      const result = await regenerateSection(
        roadmap.id,
        sectionKey,
        previousAnswers,
        token,
        handleLogout
      )
      const targetKey = result.target_key
      const updatedSectionData = result.data

      setRoadmap((prev) => {
        if (!prev) return prev
        const updated = { ...prev, [targetKey]: updatedSectionData }
        try {
          localStorage.setItem('ideaforge_active_roadmap', JSON.stringify(updated))
        } catch (e) {
          console.warn('Could not save updated roadmap to localStorage:', e)
        }
        return updated
      })
    } catch (err) {
      console.error(`Failed to regenerate section ${sectionKey}:`, err)
      setRegenerateError(
        `Failed to regenerate ${sectionKey.replace('_', ' ')}. Please try again.`
      )
    } finally {
      setRegeneratingSection((prev) => ({ ...prev, [sectionKey]: false }))
    }
  }

  // Compare ideas handlers
  const handleAddCompareIdea = () => {
    if (compareIdeasState.length < 3) {
      setCompareIdeasState((prev) => [...prev, ''])
    }
  }

  const handleRemoveCompareIdea = (index) => {
    if (compareIdeasState.length > 2) {
      setCompareIdeasState((prev) => prev.filter((_, idx) => idx !== index))
    }
  }

  const handleUpdateCompareIdea = (index, value) => {
    setCompareIdeasState((prev) => {
      const updated = [...prev]
      updated[index] = value
      return updated
    })
  }

  const handleLoadCompareExamples = () => {
    setCompareIdeasState([
      'A simple command-line pomodoro timer in Python that beeps when time is up',
      'A fullstack collaborative Kanban board web application with real-time updates and user auth',
      'A distributed real-time event streaming analytics engine with Apache Kafka and Raft consensus',
    ])
    setCompareError(null)
  }

  const handleCompareIdeas = async () => {
    const validIdeas = compareIdeasState.map((i) => i.trim()).filter(Boolean)
    if (validIdeas.length < 2) {
      setCompareError('Please enter at least 2 ideas to compare.')
      return
    }

    setIsComparing(true)
    setCompareError(null)

    try {
      const data = await compareIdeas(validIdeas, token, handleLogout)
      setComparisonResult(data)
    } catch (err) {
      console.error('Idea comparison failed:', err)
      setCompareError('Failed to compare ideas. Please check your connection and try again.')
    } finally {
      setIsComparing(false)
    }
  }

  const handlePickIdeaForRoadmap = (chosenIdea) => {
    setGeneratorMode('single')
    setComparisonResult(null)
    setIdea(chosenIdea)
    setHasStarted(true)
    setMessages([{ role: 'user', text: chosenIdea }])
    sendToBackend(chosenIdea, [])
  }

  // Roadmap Chat Handlers
  const handleSendRoadmapChat = async (e, directText = null) => {
    e?.preventDefault()
    const textToSend = (directText || roadmapChatInput).trim()
    if (!textToSend || !roadmap?.id || isAskingRoadmap) return

    const userMsg = { id: Date.now(), role: 'user', text: textToSend }
    setRoadmapChatMessages((prev) => [...prev, userMsg])
    setRoadmapChatInput('')
    setIsAskingRoadmap(true)
    setRoadmapChatError(null)

    try {
      const data = await askRoadmap(roadmap.id, textToSend, token, handleLogout)
      const assistantMsg = {
        id: Date.now() + 1,
        role: 'assistant',
        text: data.reply || 'Here is my evaluation of your roadmap question.',
        proposed_change: data.proposed_change || null,
        applied: false,
      }
      setRoadmapChatMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      console.error('Roadmap ask failed:', err)
      setRoadmapChatError('Could not process your question. Please try again.')
    } finally {
      setIsAskingRoadmap(false)
    }
  }

  const handleApplyRoadmapChange = async (msgId, proposedChange) => {
    if (!roadmap?.id || !proposedChange || applyingChangeId) return

    setApplyingChangeId(msgId)
    setRoadmapChatError(null)

    try {
      await applyRoadmapChange(
        roadmap.id,
        proposedChange.section,
        proposedChange.data,
        token,
        handleLogout
      )

      const targetKey =
        proposedChange.target_key ||
        (proposedChange.section === 'stack'
          ? 'recommended_stack'
          : proposedChange.section === 'setup_guide'
          ? 'setup_guide'
          : proposedChange.section === 'suggested_schema' ||
            proposedChange.section === 'schema'
          ? 'suggested_schema'
          : 'milestones')

      setRoadmap((prev) => {
        if (!prev) return prev
        const updated = { ...prev, [targetKey]: proposedChange.data }
        try {
          localStorage.setItem('ideaforge_active_roadmap', JSON.stringify(updated))
        } catch (e) {
          console.warn('Could not save updated roadmap to localStorage:', e)
        }
        return updated
      })

      setRoadmapChatMessages((prev) =>
        prev.map((m) => (m.id === msgId ? { ...m, applied: true } : m))
      )
    } catch (err) {
      console.error('Failed to apply change:', err)
      setRoadmapChatError('Failed to apply this change to the roadmap. Please try again.')
    } finally {
      setApplyingChangeId(null)
    }
  }

  // Document Export Handlers
  const handleDownloadPdf = () => {
    if (!roadmap) return
    try {
      downloadRoadmapPdf(roadmap, roadmap.original_idea || idea)
    } catch (err) {
      console.error('Failed to export roadmap as PDF:', err)
      alert('Failed to generate PDF. Please try again.')
    }
  }

  const handleDownloadReadme = () => {
    if (!roadmap) return
    try {
      const md = downloadRoadmapReadme(roadmap, roadmap.original_idea || idea)
      if (typeof window !== 'undefined') {
        window.__lastGeneratedReadme = md
      }
    } catch (err) {
      console.error('Failed to export roadmap as README.md:', err)
      alert('Failed to generate README. Please try again.')
    }
  }

  const handleDownloadSrs = () => {
    if (!roadmap) return
    try {
      const md = downloadSrsDocument(roadmap, roadmap.original_idea || idea)
      if (typeof window !== 'undefined') {
        window.__lastGeneratedSrs = md
      }
    } catch (err) {
      console.error('Failed to export SRS Document:', err)
      alert('Failed to generate SRS document. Please try again.')
    }
  }

  const handleDownloadSynopsis = () => {
    if (!roadmap) return
    try {
      const md = downloadSynopsisDocument(roadmap, roadmap.original_idea || idea)
      if (typeof window !== 'undefined') {
        window.__lastGeneratedSynopsis = md
      }
    } catch (err) {
      console.error('Failed to export Synopsis:', err)
      alert('Failed to generate Synopsis document. Please try again.')
    }
  }

  const handleDownloadViva = async () => {
    if (!roadmap || isGeneratingViva) return
    setIsGeneratingViva(true)
    try {
      const roadmapId = roadmap.id || (roadmap.data && roadmap.data.id)
      const payload = {
        idea: roadmap.original_idea || idea,
        roadmap_data: roadmap.data || roadmap,
        roadmap_id: roadmapId || undefined,
      }

      let vivaData = null
      try {
        vivaData = await generateViva(payload, token, handleLogout)
      } catch (fetchErr) {
        console.warn('Network call for viva questions failed; using fallback:', fetchErr)
      }

      const md = downloadVivaDocument(roadmap, vivaData, roadmap.original_idea || idea)
      if (typeof window !== 'undefined') {
        window.__lastGeneratedViva = md
      }
    } catch (err) {
      console.error('Failed to export Viva Questions:', err)
      alert('Failed to generate Viva questions. Please try again.')
    } finally {
      setIsGeneratingViva(false)
    }
  }

  const handleOpenAccount = () => {
    setView('account')
  }

  const isShowingRoadmap =
    (view === 'generator' && Boolean(roadmap)) || view === 'saved_roadmap'

  return (
    <AppShell
      currentView={view}
      navbarProps={{
        token,
        currentUserEmail,
        theme,
        onToggleTheme: toggleTheme,
        view,
        hasStarted,
        onOpenHistory: handleOpenHistory,
        onOpenAccount: handleOpenAccount,
        onReset: handleReset,
        onLogout: handleLogout,
      }}
    >
      {!token ? (
        <AuthPage
          authMode={authMode}
          setAuthMode={setAuthMode}
          authEmail={authEmail}
          setAuthEmail={setAuthEmail}
          authPassword={authPassword}
          setAuthPassword={setAuthPassword}
          authLoading={authLoading}
          authError={authError}
          setAuthError={setAuthError}
          onSubmit={handleAuthSubmit}
        />
      ) : view === 'account' ? (
        <AccountPage
          token={token}
          currentUserEmail={currentUserEmail}
          onBack={handleReset}
          onLogout={handleLogout}
        />
      ) : view === 'history' ? (
        <HistoryPage
          roadmaps={historyRoadmaps}
          isLoading={isLoadingHistory}
          error={historyError}
          onSelectRoadmap={handleSelectRoadmap}
          onReset={handleReset}
          onRetry={fetchHistoryRoadmaps}
        />
      ) : isShowingRoadmap ? (
        <RoadmapPage
          roadmap={roadmap}
          originalIdea={idea}
          isSavedView={view === 'saved_roadmap'}
          onBackToHistory={() => setView('history')}
          progress={progress}
          regeneratingSection={regeneratingSection}
          onRegenerateSection={handleRegenerateSection}
          regenerateError={regenerateError}
          onClearRegenerateError={() => setRegenerateError(null)}
          onDownloadSrs={handleDownloadSrs}
          onDownloadSynopsis={handleDownloadSynopsis}
          onDownloadViva={handleDownloadViva}
          isGeneratingViva={isGeneratingViva}
          onDownloadReadme={handleDownloadReadme}
          onDownloadPdf={handleDownloadPdf}
          onPlanAnother={handleReset}
          chatMessages={roadmapChatMessages}
          chatInput={roadmapChatInput}
          setChatInput={setRoadmapChatInput}
          onSendChatMessage={handleSendRoadmapChat}
          isAskingRoadmap={isAskingRoadmap}
          roadmapChatError={roadmapChatError}
          onClearChatError={() => setRoadmapChatError(null)}
          onApplyRoadmapChange={handleApplyRoadmapChange}
          applyingChangeId={applyingChangeId}
          previousAnswers={previousAnswers}
          chatLog={messages}
        />
      ) : generatorMode === 'compare' ? (
        <ComparePage
          compareIdeas={compareIdeasState}
          onAddIdea={handleAddCompareIdea}
          onRemoveIdea={handleRemoveCompareIdea}
          onUpdateIdea={handleUpdateCompareIdea}
          onLoadExamples={handleLoadCompareExamples}
          onCompare={handleCompareIdeas}
          isComparing={isComparing}
          compareError={compareError}
          onClearError={() => setCompareError(null)}
          comparisonResult={comparisonResult}
          onResetComparison={() => setComparisonResult(null)}
          onPickIdeaForRoadmap={handlePickIdeaForRoadmap}
          generatorMode={generatorMode}
          setGeneratorMode={setGeneratorMode}
          onBackToGenerator={handleReset}
        />
      ) : (
        <GeneratorPage
          idea={idea}
          setIdea={setIdea}
          hasStarted={hasStarted}
          messages={messages}
          previousAnswers={previousAnswers}
          inputValue={inputValue}
          setInputValue={setInputValue}
          isLoading={isLoading}
          error={error}
          generatorMode={generatorMode}
          setGeneratorMode={setGeneratorMode}
          onStart={handleStart}
          onSendAnswer={handleSendAnswer}
          onQuickPrompt={(prompt) => setIdea(prompt)}
          onRetry={handleRetry}
        />
      )}
    </AppShell>
  )
}

export default App
