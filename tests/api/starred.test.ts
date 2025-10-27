import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  unauthenticatedGet, 
  expectSuccessResponse, 
  expectUnauthorizedResponse
} from '../helpers/api'
import { getTestData } from '../helpers/db'

describe('Starred APIs', () => {
  let testData: any

  beforeAll(async () => {
    testData = await getTestData()
  })

  describe('GET /api/starred', () => {
    it('should return starred messages', async () => {
      const response = await authenticatedGet('/api/starred')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        const starredMessage = response.body[0]
        expect(starredMessage).toHaveProperty('id')
        expect(starredMessage).toHaveProperty('content')
        expect(starredMessage).toHaveProperty('userId')
        expect(starredMessage).toHaveProperty('channelId')
        expect(typeof starredMessage.id).toBe('string')
        expect(typeof starredMessage.content).toBe('string')
      }
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/starred')
      expectUnauthorizedResponse(response)
    })
  })
})
