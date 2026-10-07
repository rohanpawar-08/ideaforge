/**
 * IdeaForge API Service Layer
 * Centralizes all network interactions, Bearer token authorization,
 * error handling, and 401 session expiration handling.
 */

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000'

/**
 * Core authenticated fetch helper
 * @param {string} endpoint - Path or full URL
 * @param {RequestInit} [options={}] - Standard fetch options
 * @param {string} [token=''] - Current JWT Bearer token
 * @param {() => void} [onUnauthorized] - Callback when 401 response is received
 * @returns {Promise<Response>}
 */
export async function apiFetch(endpoint, options = {}, token = '', onUnauthorized = null) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`
  const currentToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('ideaforge_token') : '')

  const headers = {
    ...(options.headers || {}),
  }

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`
  }

  const res = await fetch(url, {
    ...options,
    headers,
  })

  if (res.status === 401) {
    if (typeof onUnauthorized === 'function') {
      onUnauthorized()
    }
    throw new Error('Your session has expired or is unauthorized. Please log in again.')
  }

  return res
}

/**
 * Authenticate existing user
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ access_token: string, token_type?: string }>}
 */
export async function login(email, password) {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password: password.trim() }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.detail || `Authentication failed (${res.status})`)
  }
  if (!data?.access_token) {
    throw new Error('No access token received from server.')
  }
  return data
}

/**
 * Register new user
 * @param {string} email
 * @param {string} password
 * @returns {Promise<{ access_token: string, token_type?: string }>}
 */
export async function signup(email, password) {
  const res = await fetch(`${API_URL}/auth/signup`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: email.trim(), password: password.trim() }),
  })

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(data?.detail || `Registration failed (${res.status})`)
  }
  if (!data?.access_token) {
    throw new Error('No access token received from server.')
  }
  return data
}

/**
 * Send idea & clarifications to get clarifying question or final roadmap
 * @param {string} idea
 * @param {string[]} previousAnswers
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 */
export async function generatePlan(idea, previousAnswers = [], token = '', onUnauthorized = null) {
  const res = await apiFetch(
    '/plan',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        idea: idea.trim(),
        previous_answers: previousAnswers,
      }),
    },
    token,
    onUnauthorized
  )

  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    console.error('generatePlan returned error:', res.status, errData)
    throw new Error('Something went wrong — please try again.')
  }

  const data = await res.json()
  if (data.error) {
    console.error('generatePlan business error:', data)
    throw new Error('Something went wrong — please try again.')
  }
  return data
}

/**
 * Fetch all saved roadmaps for the logged-in user
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 */
export async function getRoadmaps(token = '', onUnauthorized = null) {
  const res = await apiFetch('/roadmaps', { method: 'GET' }, token, onUnauthorized)
  if (!res.ok) {
    throw new Error(`Failed to load history (Status: ${res.status})`)
  }
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

/**
 * Fetch a specific saved roadmap by ID
 * @param {string|number} id
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 */
export async function getRoadmap(id, token = '', onUnauthorized = null) {
  const res = await apiFetch(`/roadmaps/${id}`, { method: 'GET' }, token, onUnauthorized)
  if (!res.ok) {
    throw new Error(`Failed to fetch roadmap ${id}`)
  }
  return res.json()
}

/**
 * Regenerate an individual section of a roadmap
 * @param {string|number} roadmapId
 * @param {string} sectionKey
 * @param {string[]} previousAnswers
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 */
export async function regenerateSection(roadmapId, sectionKey, previousAnswers = [], token = '', onUnauthorized = null) {
  const res = await apiFetch(
    `/roadmaps/${roadmapId}/regenerate`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        section: sectionKey,
        previous_answers: previousAnswers,
      }),
    },
    token,
    onUnauthorized
  )

  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    throw new Error(errData?.detail || `Server error (${res.status})`)
  }

  const result = await res.json()
  if (result.error) {
    throw new Error(result.message || 'Failed to regenerate section')
  }
  return result
}

/**
 * Ask follow-up question or request modification to an existing roadmap
 * @param {string|number} roadmapId
 * @param {string} message
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 */
export async function askRoadmap(roadmapId, message, token = '', onUnauthorized = null) {
  const res = await apiFetch(
    `/roadmaps/${roadmapId}/ask`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: message.trim() }),
    },
    token,
    onUnauthorized
  )

  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    throw new Error(errData?.detail || `Server returned ${res.status}`)
  }

  return res.json()
}

/**
 * Apply a proposed AI change to the roadmap
 * @param {string|number} roadmapId
 * @param {string} section
 * @param {any} data
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 */
export async function applyRoadmapChange(roadmapId, section, data, token = '', onUnauthorized = null) {
  const res = await apiFetch(
    `/roadmaps/${roadmapId}/apply-change`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ section, data }),
    },
    token,
    onUnauthorized
  )

  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    throw new Error(errData?.detail || 'Failed to apply change to database')
  }

  return res.json()
}

/**
 * Compare 2 to 3 candidate project ideas side-by-side
 * @param {string[]} ideas
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 */
export async function compareIdeas(ideas, token = '', onUnauthorized = null) {
  const validIdeas = ideas.map((i) => i.trim()).filter(Boolean)
  if (validIdeas.length < 2) {
    throw new Error('Please enter at least 2 ideas to compare.')
  }

  const res = await apiFetch(
    '/compare',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ideas: validIdeas }),
    },
    token,
    onUnauthorized
  )

  if (!res.ok) {
    const errData = await res.json().catch(() => null)
    throw new Error(errData?.detail || `Server returned status ${res.status}`)
  }

  const data = await res.json()
  if (data.error) {
    throw new Error(data.message || 'Failed to compare ideas.')
  }
  return data
}

/**
 * Request Viva questions from backend Groq LLM
 * @param {object} payload
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 */
export async function generateViva(payload, token = '', onUnauthorized = null) {
  const res = await apiFetch(
    '/roadmaps/viva',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    },
    token,
    onUnauthorized
  )

  if (!res.ok) {
    throw new Error(`Viva generation failed with status ${res.status}`)
  }
  return res.json()
}

export { API_URL }
