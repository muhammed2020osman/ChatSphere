import { CookieJar } from 'tough-cookie'

/**
 * Create authentication headers for development mode
 */
export function createAuthHeaders(): Record<string, string> {
  return {
    'Cookie': 'dev-session=dev-user-123',
    'Content-Type': 'application/json'
  }
}

/**
 * Create authentication headers with custom session
 */
export function createAuthHeadersWithSession(sessionId: string): Record<string, string> {
  return {
    'Cookie': `dev-session=${sessionId}`,
    'Content-Type': 'application/json'
  }
}

/**
 * Create headers without authentication (for testing unauthorized access)
 */
export function createUnauthHeaders(): Record<string, string> {
  return {
    'Content-Type': 'application/json'
  }
}

/**
 * Create headers for file upload
 */
export function createUploadHeaders(): Record<string, string> {
  return {
    'Cookie': 'dev-session=dev-user-123'
    // Don't set Content-Type for multipart/form-data
  }
}

/**
 * Development user data for testing
 */
export const DEV_USER = {
  id: 'dev-user-123',
  name: 'Development User',
  email: 'dev@localhost.com',
  image: null
}

/**
 * Mock authentication middleware for testing
 */
export function mockAuth() {
  return {
    user: DEV_USER,
    isAuthenticated: true
  }
}
