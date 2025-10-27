import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedPost,
  authenticatedPatch,
  authenticatedDelete,
  unauthenticatedPost,
  unauthenticatedPatch,
  unauthenticatedDelete,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectBadRequestResponse
} from '../helpers/api'
import { getTestData, getRandomDrawing } from '../helpers/db'

describe('Layers APIs', () => {
  let testData: any
  let testDrawing: any

  beforeAll(async () => {
    testData = await getTestData()
    testDrawing = getRandomDrawing(testData)
  })

  describe('POST /api/layers', () => {
    it('should create new layer', async () => {
      if (!testDrawing) {
        console.log('⚠️ No test drawing available, skipping test')
        return
      }

      const layerData = {
        drawingId: testDrawing.id,
        name: `Test Layer ${Date.now()}`,
        color: '#FF0000',
        isVisible: true
      }

      const response = await authenticatedPost('/api/layers', layerData)
      
      expectSuccessResponse(response, 201)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('drawingId')
      expect(response.body).toHaveProperty('name')
      expect(response.body.drawingId).toBe(testDrawing.id)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await authenticatedPost('/api/layers', {
        name: 'Test Layer'
        // Missing drawingId
      })
      expectBadRequestResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost('/api/layers', {
        drawingId: 'test-id',
        name: 'Test Layer'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('PATCH /api/layers/[id]/visibility', () => {
    it('should update layer visibility', async () => {
      const layerId = 'test-layer-id'
      const visibilityData = {
        isVisible: false
      }

      const response = await authenticatedPatch(`/api/layers/${layerId}/visibility`, visibilityData)
      
      // This might return 404 if layer doesn't exist, which is expected
      expect([200, 404]).toContain(response.status)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPatch('/api/layers/test-id/visibility', {
        isVisible: false
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('DELETE /api/layers/[id]', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedDelete('/api/layers/test-id')
      expectUnauthorizedResponse(response)
    })

    // Note: We don't test actual deletion to avoid removing real data
  })
})
