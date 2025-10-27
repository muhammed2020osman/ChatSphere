import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  unauthenticatedGet, 
  expectSuccessResponse
} from '../helpers/api'
import { getTestData } from '../helpers/db'

describe('Floors APIs', () => {
  let testData: any

  beforeAll(async () => {
    testData = await getTestData()
  })

  describe('GET /api/floors', () => {
    it('should return list of floors', async () => {
      const response = await authenticatedGet('/api/floors')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        const floor = response.body[0]
        expect(floor).toHaveProperty('id')
        expect(floor).toHaveProperty('name')
        expect(typeof floor.id).toBe('string')
        expect(typeof floor.name).toBe('string')
      }
    })

    it('should work without authentication (public endpoint)', async () => {
      const response = await unauthenticatedGet('/api/floors')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })
  })
})
