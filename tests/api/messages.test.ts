import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  authenticatedPost,
  authenticatedPatch,
  authenticatedDelete,
  unauthenticatedGet, 
  unauthenticatedPost,
  unauthenticatedPatch,
  unauthenticatedDelete,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectBadRequestResponse,
  validateMessageResponse
} from '../helpers/api'
import { getTestData, getRandomChannel } from '../helpers/db'

describe('Messages APIs', () => {
  let testData: any
  let testChannel: any

  beforeAll(async () => {
    testData = await getTestData()
    testChannel = getRandomChannel(testData)
  })

  describe('GET /api/messages', () => {
    it('should return list of messages', async () => {
      const response = await authenticatedGet('/api/messages')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        validateMessageResponse(response.body[0])
      }
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/messages')
      expectUnauthorizedResponse(response)
    })
  })

  describe('POST /api/messages', () => {
    it('should create new message', async () => {
      if (!testChannel) {
        console.log('⚠️ No test channel available, skipping test')
        return
      }

      const messageData = {
        content: `Test message ${Date.now()}`,
        channelId: testChannel.id,
        mentions: []
      }

      const response = await authenticatedPost('/api/messages', messageData)
      
      expectSuccessResponse(response, 201)
      validateMessageResponse(response.body)
      expect(response.body.content).toBe(messageData.content)
      expect(response.body.channelId).toBe(testChannel.id)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await authenticatedPost('/api/messages', {
        content: 'Test message'
        // Missing channelId
      })
      expectBadRequestResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost('/api/messages', {
        content: 'Test message',
        channelId: 'test-id'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/messages/[id]', () => {
    it('should return specific message', async () => {
      if (testData.messages.length === 0) {
        console.log('⚠️ No test messages available, skipping test')
        return
      }

      const message = testData.messages[0]
      const response = await authenticatedGet(`/api/messages/${message.id}`)
      
      expectSuccessResponse(response)
      validateMessageResponse(response.body)
      expect(response.body.id).toBe(message.id)
    })

    it('should return 404 for non-existent message', async () => {
      const response = await authenticatedGet('/api/messages/non-existent-id')
      expectNotFoundResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/messages/test-id')
      expectUnauthorizedResponse(response)
    })
  })

  describe('PATCH /api/messages/[id]', () => {
    it('should update message', async () => {
      if (testData.messages.length === 0) {
        console.log('⚠️ No test messages available, skipping test')
        return
      }

      const message = testData.messages[0]
      const updateData = {
        content: `Updated message ${Date.now()}`
      }

      const response = await authenticatedPatch(`/api/messages/${message.id}`, updateData)
      
      expectSuccessResponse(response)
      validateMessageResponse(response.body)
      expect(response.body.content).toBe(updateData.content)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPatch('/api/messages/test-id', {
        content: 'Updated message'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('DELETE /api/messages/[id]', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedDelete('/api/messages/test-id')
      expectUnauthorizedResponse(response)
    })

    // Note: We don't test actual deletion to avoid removing real data
  })

  describe('POST /api/messages/[id]/star', () => {
    it('should star message', async () => {
      if (testData.messages.length === 0) {
        console.log('⚠️ No test messages available, skipping test')
        return
      }

      const message = testData.messages[0]
      const response = await authenticatedPost(`/api/messages/${message.id}/star`)
      
      expectSuccessResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost('/api/messages/test-id/star')
      expectUnauthorizedResponse(response)
    })
  })

  describe('DELETE /api/messages/[id]/star', () => {
    it('should unstar message', async () => {
      if (testData.messages.length === 0) {
        console.log('⚠️ No test messages available, skipping test')
        return
      }

      const message = testData.messages[0]
      const response = await authenticatedDelete(`/api/messages/${message.id}/star`)
      
      expectSuccessResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedDelete('/api/messages/test-id/star')
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/messages/[id]/starred', () => {
    it('should return starred status', async () => {
      if (testData.messages.length === 0) {
        console.log('⚠️ No test messages available, skipping test')
        return
      }

      const message = testData.messages[0]
      const response = await authenticatedGet(`/api/messages/${message.id}/starred`)
      
      expectSuccessResponse(response)
      expect(response.body).toHaveProperty('isStarred')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/messages/test-id/starred')
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/messages/threads', () => {
    it('should return message threads', async () => {
      const response = await authenticatedGet('/api/messages/threads')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/messages/threads')
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/messages/poll', () => {
    it('should poll for new messages', async () => {
      const response = await authenticatedGet('/api/messages/poll')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/messages/poll')
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/messages/[messageId]/reactions', () => {
    it('should return message reactions', async () => {
      if (testData.messages.length === 0) {
        console.log('⚠️ No test messages available, skipping test')
        return
      }

      const message = testData.messages[0]
      const response = await authenticatedGet(`/api/messages/${message.id}/reactions`)
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/messages/test-id/reactions')
      expectUnauthorizedResponse(response)
    })
  })
})
