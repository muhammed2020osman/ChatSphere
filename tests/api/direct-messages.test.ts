import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  authenticatedPost,
  unauthenticatedGet, 
  unauthenticatedPost,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectBadRequestResponse
} from '../helpers/api'
import { getTestData, getRandomUser } from '../helpers/db'

describe('Direct Messages APIs', () => {
  let testData: any
  let testUser: any

  beforeAll(async () => {
    testData = await getTestData()
    testUser = getRandomUser(testData)
  })

  describe('GET /api/direct-messages/[userId]', () => {
    it('should return direct messages with user', async () => {
      if (!testUser) {
        console.log('⚠️ No test user available, skipping test')
        return
      }

      const response = await authenticatedGet(`/api/direct-messages/${testUser.id}`)
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/direct-messages/test-user-id')
      expectUnauthorizedResponse(response)
    })
  })

  describe('POST /api/direct-messages/[userId]', () => {
    it('should send direct message', async () => {
      if (!testUser) {
        console.log('⚠️ No test user available, skipping test')
        return
      }

      const messageData = {
        content: `Direct message ${Date.now()}`,
        mentions: []
      }

      const response = await authenticatedPost(`/api/direct-messages/${testUser.id}`, messageData)
      
      expectSuccessResponse(response, 201)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('content')
      expect(response.body.content).toBe(messageData.content)
    })

    it('should return 400 for missing content', async () => {
      const response = await authenticatedPost('/api/direct-messages/test-user-id', {
        mentions: []
        // Missing content
      })
      expectBadRequestResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost('/api/direct-messages/test-user-id', {
        content: 'Test direct message'
      })
      expectUnauthorizedResponse(response)
    })
  })
})
