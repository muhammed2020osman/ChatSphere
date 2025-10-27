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
import { getTestData } from '../helpers/db'

describe('Disciplines APIs', () => {
  let testData: any

  beforeAll(async () => {
    testData = await getTestData()
  })

  describe('GET /api/disciplines', () => {
    it('should return list of disciplines', async () => {
      const response = await authenticatedGet('/api/disciplines')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        const discipline = response.body[0]
        expect(discipline).toHaveProperty('id')
        expect(discipline).toHaveProperty('name')
        expect(typeof discipline.id).toBe('string')
        expect(typeof discipline.name).toBe('string')
      }
    })

    it('should work without authentication (public endpoint)', async () => {
      const response = await unauthenticatedGet('/api/disciplines')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })
  })

  describe('POST /api/disciplines', () => {
    it('should create new discipline', async () => {
      const disciplineData = {
        name: `Test Discipline ${Date.now()}`
      }

      const response = await authenticatedPost('/api/disciplines', disciplineData)
      
      expectSuccessResponse(response, 201)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('name')
      expect(response.body.name).toBe(disciplineData.name)
    })

    it('should return 400 for missing name', async () => {
      const response = await authenticatedPost('/api/disciplines', {})
      expectBadRequestResponse(response, 'Name is required')
    })

    it('should return 400 for empty name', async () => {
      const response = await authenticatedPost('/api/disciplines', { name: '' })
      expectBadRequestResponse(response, 'Name is required')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost('/api/disciplines', {
        name: 'Test Discipline'
      })
      expectUnauthorizedResponse(response)
    })
  })
})
