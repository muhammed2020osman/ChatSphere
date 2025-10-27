import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  unauthenticatedGet, 
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  validateUserResponse 
} from '../helpers/api'
import { getTestData } from '../helpers/db'

describe('Authentication APIs', () => {
  let testData: any

  beforeAll(async () => {
    testData = await getTestData()
  })

  describe('GET /api/auth/user', () => {
    it('should return authenticated user data', async () => {
      const response = await authenticatedGet('/api/auth/user')
      
      expectSuccessResponse(response)
      validateUserResponse(response.body)
      expect(response.body.id).toBe('dev-user-123')
      expect(response.body.name).toBe('Development User')
      expect(response.body.email).toBe('dev@localhost.com')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/auth/user')
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/login', () => {
    it('should redirect to home page in development mode', async () => {
      const response = await authenticatedGet('/api/login')
      
      // In development mode, login should redirect to /home
      expect([302, 307]).toContain(response.status)
      expect(response.headers.location).toContain('/home')
    })
  })

  describe('GET /api/logout', () => {
    it('should handle logout request', async () => {
      const response = await authenticatedGet('/api/logout')
      
      // Logout endpoint should return some response
      expect(response.status).toBeDefined()
    })
  })
})
