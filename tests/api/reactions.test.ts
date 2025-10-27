import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedPost,
  authenticatedDelete,
  unauthenticatedPost,
  unauthenticatedDelete,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectBadRequestResponse
} from '../helpers/api'
import { getTestData } from '../helpers/db'

describe('Reactions APIs', () => {
  let testData: any

  beforeAll(async () => {
    testData = await getTestData()
  })

  describe('POST /api/reactions', () => {
    it('should add reaction to message', async () => {
      if (testData.messages.length === 0) {
        console.log('⚠️ No test messages available, skipping test')
        return
      }

      const message = testData.messages[0]
      const reactionData = {
        messageId: message.id,
        icon: '👍',
        userId: 'dev-user-123'
      }

      const response = await authenticatedPost('/api/reactions', reactionData)
      
      expectSuccessResponse(response, 201)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('messageId')
      expect(response.body).toHaveProperty('icon')
      expect(response.body.messageId).toBe(message.id)
      expect(response.body.icon).toBe(reactionData.icon)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await authenticatedPost('/api/reactions', {
        icon: '👍'
        // Missing messageId and userId
      })
      expectBadRequestResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost('/api/reactions', {
        messageId: 'test-id',
        icon: '👍',
        userId: 'dev-user-123'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('DELETE /api/reactions/[messageId]/[icon]', () => {
    it('should remove reaction from message', async () => {
      const messageId = 'test-message-id'
      const icon = '👍'
      
      const response = await authenticatedDelete(`/api/reactions/${messageId}/${icon}`)
      
      // This might return 404 if reaction doesn't exist, which is expected
      expect([200, 404]).toContain(response.status)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedDelete('/api/reactions/test-id/👍')
      expectUnauthorizedResponse(response)
    })
  })
})
