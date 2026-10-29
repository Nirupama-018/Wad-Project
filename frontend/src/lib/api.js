const API_BASE_URL = import.meta.env.VITE_API_URL || ''

export async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...options.headers,
    },
  })

  let data

  try {
    data = await response.json()
  } catch {
    data = {}
  }

  if (!response.ok || data.success === false) {
    if (response.status === 401) {
      const error = new Error(data.message || 'Your session has expired. Please sign in again.')
      error.status = 401
      throw error
    }

    const error = new Error(data.message || `Request failed (${response.status}).`)
    error.status = response.status
    error.code = data.code
    throw error
  }

  return data
}