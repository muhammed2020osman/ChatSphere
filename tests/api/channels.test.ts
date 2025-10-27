import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  authenticatedPost,
  unauthenticatedGet, 
  unauthenticatedPost,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectBadRequestResponse,
  validateChannelResponse
} from '../helpers/api'
import { getTestData, getRandomChannel } from '../helpers/db'

describe('Channels APIs', () => {
  let testData: any
  let testChannel: any

  beforeAll(async () => {
    testData = await getTestData()
    testChannel = getRandomChannel(testData)
  })

  describe('GET /api/channels', () => {
    it('should return list of channels', async () => {
      const response = await authenticatedGet('/api/channels')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        validateChannelResponse(response.body[0])
      }
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/channels')
      expectUnauthorizedResponse(response)
    })
  })

  describe('POST /api/channels', () => {
    it('should create new channel', async () => {
      const channelData = {
        name: `Test Channel ${Date.now()}`,
        description: 'Test channel description',
        isPrivate: false
      }

      const response = await authenticatedPost('/api/channels', channelData)
      
      expectSuccessResponse(response, 201)
      validateChannelResponse(response.body)
      expect(response.body.name).toBe(channelData.name)
      expect(response.body.description).toBe(channelData.description)
    })

    it('should return 400 for missing channel name', async () => {
      const response = await authenticatedPost('/api/channels', {
        description: 'Test channel'
        // Missing name
      })
      expectBadRequestResponse(response, 'Channel name is required')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost('/api/channels', {
        name: 'Test Channel'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/channels/[id]', () => {
    it('should return specific channel', async () => {
      if (!testChannel) {
        console.log('⚠️ No test channel available, skipping test')
        return
      }

      const response = await authenticatedGet(`/api/channels/${testChannel.id}`)
      
      expectSuccessResponse(response)
      validateChannelResponse(response.body)
      expect(response.body.id).toBe(testChannel.id)
    })

    it('should return 404 for non-existent channel', async () => {
      const response = await authenticatedGet('/api/channels/non-existent-id')
      expectNotFoundResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet(`/api/channels/${testChannel?.id || 'test-id'}`)
      expectUnauthorizedResponse(response)
    })
  })

  describe('POST /api/channels/[id]/join', () => {
    it('should join channel', async () => {
      if (!testChannel) {
        console.log('⚠️ No test channel available, skipping test')
        return
      }

      const response = await authenticatedPost(`/api/channels/${testChannel.id}/join`)
      
      expectSuccessResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost(`/api/channels/${testChannel?.id || 'test-id'}/join`)
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/channels/[id]/messages', () => {
    it('should return channel messages', async () => {
      if (!testChannel) {
        console.log('⚠️ No test channel available, skipping test')
        return
      }

      const response = await authenticatedGet(`/api/channels/${testChannel.id}/messages`)
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet(`/api/channels/${testChannel?.id || 'test-id'}/messages`)
      expectUnauthorizedResponse(response)
    })
  })
})
