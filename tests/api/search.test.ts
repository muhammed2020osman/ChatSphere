import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  unauthenticatedGet, 
  expectSuccessResponse, 
  expectUnauthorizedResponse
} from '../helpers/api'
import { getTestData } from '../helpers/db'

describe('Search APIs', () => {
  let testData: any

  beforeAll(async () => {
    testData = await getTestData()
  })

  describe('GET /api/search/[query]', () => {
    it('should search messages', async () => {
      const query = 'test'
      const response = await authenticatedGet(`/api/search/${encodeURIComponent(query)}`)
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        const result = response.body[0]
        expect(result).toHaveProperty('id')
        expect(result).toHaveProperty('content')
        expect(typeof result.id).toBe('string')
        expect(typeof result.content).toBe('string')
      }
    })

    it('should handle empty search query', async () => {
      const response = await authenticatedGet('/api/search/')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should handle special characters in search', async () => {
      const query = 'test@#$%'
      const response = await authenticatedGet(`/api/search/${encodeURIComponent(query)}`)
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/search/test')
      expectUnauthorizedResponse(response)
    })
  })
})
