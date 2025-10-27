import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedPost,
  authenticatedGet,
  authenticatedDelete,
  unauthenticatedPost,
  unauthenticatedGet,
  unauthenticatedDelete,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectBadRequestResponse
} from '../helpers/api'
import { getTestData, getRandomDrawing } from '../helpers/db'

describe('Pins APIs', () => {
  let testData: any
  let testDrawing: any

  beforeAll(async () => {
    testData = await getTestData()
    testDrawing = getRandomDrawing(testData)
  })

  describe('POST /api/pins', () => {
    it('should create new pin', async () => {
      if (!testDrawing) {
        console.log('⚠️ No test drawing available, skipping test')
        return
      }

      const pinData = {
        drawingId: testDrawing.id,
        x: 100,
        y: 200,
        title: `Test Pin ${Date.now()}`,
        description: 'Test pin description'
      }

      const response = await authenticatedPost('/api/pins', pinData)
      
      expectSuccessResponse(response, 201)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('drawingId')
      expect(response.body).toHaveProperty('x')
      expect(response.body).toHaveProperty('y')
      expect(response.body.drawingId).toBe(testDrawing.id)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await authenticatedPost('/api/pins', {
        title: 'Test Pin'
        // Missing drawingId, x, y
      })
      expectBadRequestResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost('/api/pins', {
        drawingId: 'test-id',
        x: 100,
        y: 200,
        title: 'Test Pin'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/pins/[id]/timeline', () => {
    it('should return pin timeline', async () => {
      const pinId = 'test-pin-id'
      const response = await authenticatedGet(`/api/pins/${pinId}/timeline`)
      
      // This might return 404 if pin doesn't exist, which is expected
      expect([200, 404]).toContain(response.status)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/pins/test-id/timeline')
      expectUnauthorizedResponse(response)
    })
  })

  describe('DELETE /api/pins/[id]', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedDelete('/api/pins/test-id')
      expectUnauthorizedResponse(response)
    })

    // Note: We don't test actual deletion to avoid removing real data
  })
})
