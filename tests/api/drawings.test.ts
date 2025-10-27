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
  validateDrawingResponse
} from '../helpers/api'
import { getTestData, getRandomDrawing } from '../helpers/db'

describe('Drawings APIs', () => {
  let testData: any
  let testDrawing: any

  beforeAll(async () => {
    testData = await getTestData()
    testDrawing = getRandomDrawing(testData)
  })

  describe('GET /api/drawings', () => {
    it('should return list of drawings with pagination', async () => {
      const response = await authenticatedGet('/api/drawings')
      
      expectSuccessResponse(response)
      expect(response.body).toHaveProperty('drawings')
      expect(response.body).toHaveProperty('total')
      expect(response.body).toHaveProperty('page')
      expect(response.body).toHaveProperty('limit')
      expect(response.body).toHaveProperty('totalPages')
      expect(Array.isArray(response.body.drawings)).toBe(true)
      
      if (response.body.drawings.length > 0) {
        validateDrawingResponse(response.body.drawings[0])
      }
    })

    it('should support pagination parameters', async () => {
      const response = await authenticatedGet('/api/drawings?page=1&limit=5')
      
      expectSuccessResponse(response)
      expect(response.body.page).toBe(1)
      expect(response.body.limit).toBe(5)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/drawings')
      expectUnauthorizedResponse(response)
    })
  })

  describe('POST /api/drawings', () => {
    it('should create new drawing', async () => {
      const drawingData = {
        sheetNo: `TEST-${Date.now()}`,
        title: `Test Drawing ${Date.now()}`,
        discipline: 'Architecture',
        floor: 'Ground Floor'
      }

      const response = await authenticatedPost('/api/drawings', drawingData)
      
      expectSuccessResponse(response, 201)
      validateDrawingResponse(response.body)
      expect(response.body.sheetNo).toBe(drawingData.sheetNo)
      expect(response.body.title).toBe(drawingData.title)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await authenticatedPost('/api/drawings', {
        title: 'Test Drawing'
        // Missing sheetNo
      })
      expectBadRequestResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost('/api/drawings', {
        sheetNo: 'TEST-001',
        title: 'Test Drawing'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/drawings/[id]', () => {
    it('should return specific drawing', async () => {
      if (!testDrawing) {
        console.log('⚠️ No test drawing available, skipping test')
        return
      }

      const response = await authenticatedGet(`/api/drawings/${testDrawing.id}`)
      
      expectSuccessResponse(response)
      validateDrawingResponse(response.body)
      expect(response.body.id).toBe(testDrawing.id)
    })

    it('should return 404 for non-existent drawing', async () => {
      const response = await authenticatedGet('/api/drawings/non-existent-id')
      expectNotFoundResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet(`/api/drawings/${testDrawing?.id || 'test-id'}`)
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/drawings/[id]/layers', () => {
    it('should return drawing layers', async () => {
      if (!testDrawing) {
        console.log('⚠️ No test drawing available, skipping test')
        return
      }

      const response = await authenticatedGet(`/api/drawings/${testDrawing.id}/layers`)
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet(`/api/drawings/${testDrawing?.id || 'test-id'}/layers`)
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/drawings/[id]/pins', () => {
    it('should return drawing pins', async () => {
      if (!testDrawing) {
        console.log('⚠️ No test drawing available, skipping test')
        return
      }

      const response = await authenticatedGet(`/api/drawings/${testDrawing.id}/pins`)
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet(`/api/drawings/${testDrawing?.id || 'test-id'}/pins`)
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/drawings/[id]/tickets', () => {
    it('should return drawing tickets', async () => {
      if (!testDrawing) {
        console.log('⚠️ No test drawing available, skipping test')
        return
      }

      const response = await authenticatedGet(`/api/drawings/${testDrawing.id}/tickets`)
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet(`/api/drawings/${testDrawing?.id || 'test-id'}/tickets`)
      expectUnauthorizedResponse(response)
    })
  })
})
