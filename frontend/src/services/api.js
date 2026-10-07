/**
 * IdeaForge API Service Layer
 * Centralizes all network interactions, Bearer token authorization,
 * error handling, and 401 session expiration handling.
 */

const DEFAULT_PRODUCTION_API_URL = 'https://ideaforge-senx.onrender.com'

const API_URL = (() => {
  if (
    typeof window !== 'undefined' &&
    (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
  ) {
    return import.meta.env.VITE_API_URL || 'http://localhost:8000'
  }
  return import.meta.env.VITE_API_URL || DEFAULT_PRODUCTION_API_URL
})()

/**
 * Core authenticated fetch helper
 * @param {string} endpoint - Path or full URL
 * @param {RequestInit} [options={}] - Standard fetch options
 * @param {string} [token=''] - Current JWT Bearer token
 * @param {() => void} [onUnauthorized] - Callback when 401 response is received
 * @returns {Promise<Response>}
 */
/**
 * Safely parse API error responses into user-friendly messages.
 * Includes Reference ID when provided by unexpected 500 errors.
 *
 * @param {Response|null} res
 * @param {object|null} data
 * @param {string} [defaultMsg]
 * @returns {string}
 */
export function formatApiError(res, data, defaultMsg = 'An unexpected server error occurred.') {
  if (!res) {
    return 'Backend service is currently unavailable. Please check your network connection and try again.'
  }
  let msg = data?.detail || data?.message
  if (!msg) {
    if (res.status === 401) {
      msg = 'Your session has expired or is unauthorized. Please log in again.'
    } else if (res.status === 429) {
      msg = 'Request limit or AI daily quota reached. Please try again later.'
    } else if (res.status === 502 || res.status === 503 || res.status === 504) {
      msg = 'AI service is temporarily unavailable. Please try again shortly.'
    } else {
      msg = defaultMsg
    }
  }
  // Include reference ID for unexpected server errors (500) if available
  if (res.status >= 500 && data?.request_id) {
    msg += ` (Reference ID: ${data.request_id})`
  }
  return msg
}

export async function apiFetch(endpoint, options = {}, token = '', onUnauthorized = null) {
  const url = endpoint.startsWith('http') ? endpoint : `${API_URL}${endpoint}`
  const currentToken = token || (typeof localStorage !== 'undefined' ? localStorage.getItem('ideaforge_token') : '')

  const headers = {
    ...(options.headers || {}),
  }

  if (currentToken) {
    headers['Authorization'] = `Bearer ${currentToken}`
  }

  let res
  try {
    res = await fetch(url, {
      ...options,
      headers,
    })
  } catch {
    throw new Error('Backend service is currently unavailable. Please check your network connection or try again shortly.')
  }

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
  let res
  try {
    res = await fetch(`${API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password: password.trim() }),
    })
  } catch {
    throw new Error('Backend service is currently unavailable. Please check your network connection.')
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(formatApiError(res, data, `Authentication failed (${res.status})`))
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
  let res
  try {
    res = await fetch(`${API_URL}/auth/signup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password: password.trim() }),
    })
  } catch {
    throw new Error('Backend service is currently unavailable. Please check your network connection.')
  }

  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(formatApiError(res, data, `Registration failed (${res.status})`))
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
    const friendlyMsg = formatApiError(
      res,
      errData,
      res.status === 429
        ? 'Daily AI blueprint generation limit reached. Please try again tomorrow.'
        : res.status === 502 || res.status === 504
        ? 'AI generation is temporarily unavailable. Please try again.'
        : 'Something went wrong — please try again.'
    )
    throw new Error(friendlyMsg)
  }

  const data = await res.json()
  if (data.error) {
    console.error('generatePlan business error:', data)
    throw new Error(data.message || 'Something went wrong — please try again.')
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
    const errData = await res.json().catch(() => null)
    throw new Error(formatApiError(res, errData, `Failed to load history (Status: ${res.status})`))
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
    const errData = await res.json().catch(() => null)
    throw new Error(formatApiError(res, errData, `Failed to fetch roadmap ${id}`))
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
    const msg = formatApiError(
      res,
      errData,
      res.status === 429
        ? 'Daily AI regeneration limit reached. Please try again tomorrow.'
        : res.status === 502 || res.status === 504
        ? 'AI generation is temporarily unavailable. Please try again.'
        : `Server error (${res.status})`
    )
    throw new Error(msg)
  }

  const result = await res.json()
  if (result.error) {
    throw new Error(result.message || 'AI generation is temporarily unavailable. Please try again.')
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
    const msg = formatApiError(
      res,
      errData,
      res.status === 429
        ? 'Daily AI chat limit reached. Please try again tomorrow.'
        : res.status === 502 || res.status === 504
        ? 'AI service is temporarily unavailable. Please try again.'
        : `Server returned ${res.status}`
    )
    throw new Error(msg)
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
    throw new Error(formatApiError(res, errData, 'Failed to apply change to database'))
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
    throw new Error(formatApiError(res, errData, `Server returned status ${res.status}`))
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
    const errData = await res.json().catch(() => null)
    throw new Error(formatApiError(res, errData, `Viva generation failed with status ${res.status}`))
  }
  return res.json()
}

/**
 * Request password reset instructions
 * @param {string} email
 * @returns {Promise<{ message: string }>}
 */
export async function forgotPassword(email) {
  let res
  try {
    res = await fetch(`${API_URL}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: (email || '').trim() }),
    })
  } catch {
    throw new Error('Backend service is currently unavailable. Please check your network connection.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(formatApiError(res, data, `Request failed (${res.status})`))
  }
  return data
}

/**
 * Reset password using a reset token
 * @param {string} token
 * @param {string} newPassword
 * @returns {Promise<{ message: string }>}
 */
export async function resetPassword(token, newPassword) {
  let res
  try {
    res = await fetch(`${API_URL}/auth/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: (token || '').trim(), new_password: newPassword }),
    })
  } catch {
    throw new Error('Backend service is currently unavailable. Please check your network connection.')
  }
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(formatApiError(res, data, `Reset failed (${res.status})`))
  }
  return data
}

/**
 * Change account password for authenticated user
 * @param {string} currentPassword
 * @param {string} newPassword
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 * @returns {Promise<{ message: string }>}
 */
export async function changePassword(currentPassword, newPassword, token = '', onUnauthorized = null) {
  const res = await apiFetch(
    '/auth/change-password',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    },
    token,
    onUnauthorized
  )
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(formatApiError(res, data, `Password change failed (${res.status})`))
  }
  return data
}

/**
 * Fetch authenticated user profile
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 * @returns {Promise<{ id: number, email: string, created_at: string }>}
 */
export async function getAccount(token = '', onUnauthorized = null) {
  const res = await apiFetch('/account', { method: 'GET' }, token, onUnauthorized)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(formatApiError(res, data, `Failed to fetch account info (${res.status})`))
  }
  return data
}

/**
 * Export authenticated user profile and all saved roadmaps
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 * @returns {Promise<{ account: object, roadmaps: Array }>}
 */
export async function exportAccountData(token = '', onUnauthorized = null) {
  const res = await apiFetch('/account/export', { method: 'GET' }, token, onUnauthorized)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(formatApiError(res, data, `Data export failed (${res.status})`))
  }
  return data
}

/**
 * Delete account and all associated roadmaps permanently
 * @param {string} password
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 * @returns {Promise<{ message: string }>}
 */
export async function deleteAccount(password, token = '', onUnauthorized = null) {
  const res = await apiFetch(
    '/account',
    {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    },
    token,
    onUnauthorized
  )
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(formatApiError(res, data, `Account deletion failed (${res.status})`))
  }
  return data
}

/**
 * Fetch daily AI usage quotas and consumption
 * @param {string} token
 * @param {() => void} [onUnauthorized]
 * @returns {Promise<{ date: string, usage: object }>}
 */
export async function getAIUsage(token = '', onUnauthorized = null) {
  const res = await apiFetch('/account/ai-usage', { method: 'GET' }, token, onUnauthorized)
  const data = await res.json().catch(() => null)
  if (!res.ok) {
    throw new Error(formatApiError(res, data, `Failed to fetch AI usage (${res.status})`))
  }
  return data
}

export { API_URL }

