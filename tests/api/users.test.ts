import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  authenticatedPatch, 
  authenticatedDelete,
  unauthenticatedGet, 
  unauthenticatedPatch,
  unauthenticatedDelete,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  validateUserResponse 
} from '../helpers/api'
import { getTestData, getRandomUser } from '../helpers/db'

describe('Users APIs', () => {
  let testData: any
  let testUser: any

  beforeAll(async () => {
    testData = await getTestData()
    testUser = getRandomUser(testData)
  })

  describe('GET /api/users', () => {
    it('should return list of users', async () => {
      const response = await authenticatedGet('/api/users')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        validateUserResponse(response.body[0])
      }
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/users')
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/users/[id]', () => {
    it('should return specific user data', async () => {
      if (!testUser) {
        console.log('⚠️ No test user available, skipping test')
        return
      }

      const response = await authenticatedGet(`/api/users/${testUser.id}`)
      
      expectSuccessResponse(response)
      validateUserResponse(response.body)
      expect(response.body.id).toBe(testUser.id)
    })

    it('should return 404 for non-existent user', async () => {
      const response = await authenticatedGet('/api/users/non-existent-id')
      expectNotFoundResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet(`/api/users/${testUser?.id || 'test-id'}`)
      expectUnauthorizedResponse(response)
    })
  })

  describe('PATCH /api/users/[id]/role', () => {
    it('should update user role', async () => {
      if (!testUser) {
        console.log('⚠️ No test user available, skipping test')
        return
      }

      const newRole = 'admin'
      const response = await authenticatedPatch(`/api/users/${testUser.id}/role`, {
        role: newRole
      })
      
      expectSuccessResponse(response)
      validateUserResponse(response.body)
      expect(response.body.role).toBe(newRole)
    })

    it('should return 400 for invalid role', async () => {
      if (!testUser) {
        console.log('⚠️ No test user available, skipping test')
        return
      }

      const response = await authenticatedPatch(`/api/users/${testUser.id}/role`, {
        role: 'invalid-role'
      })
      
      expect(response.status).toBe(400)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPatch(`/api/users/${testUser?.id || 'test-id'}/role`, {
        role: 'admin'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('DELETE /api/users/[id]', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedDelete(`/api/users/${testUser?.id || 'test-id'}`)
      expectUnauthorizedResponse(response)
    })

    // Note: We don't test actual deletion to avoid removing real data
    // In a real test environment, you would create test users and clean them up
  })
})
