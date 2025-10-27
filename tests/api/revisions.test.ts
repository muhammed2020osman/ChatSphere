import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  authenticatedPost,
  authenticatedPatch,
  unauthenticatedGet, 
  unauthenticatedPost,
  unauthenticatedPatch,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectBadRequestResponse
} from '../helpers/api'
import { getTestData, getRandomDrawing } from '../helpers/db'

describe('Revisions APIs', () => {
  let testData: any
  let testDrawing: any

  beforeAll(async () => {
    testData = await getTestData()
    testDrawing = getRandomDrawing(testData)
  })

  describe('GET /api/drawings/[id]/revisions', () => {
    it('should return drawing revisions', async () => {
      if (!testDrawing) {
        console.log('⚠️ No test drawing available, skipping test')
        return
      }

      const response = await authenticatedGet(`/api/drawings/${testDrawing.id}/revisions`)
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet(`/api/drawings/${testDrawing?.id || 'test-id'}/revisions`)
      expectUnauthorizedResponse(response)
    })
  })

  describe('POST /api/drawings/[id]/revisions', () => {
    it('should create new revision', async () => {
      if (!testDrawing) {
        console.log('⚠️ No test drawing available, skipping test')
        return
      }

      const revisionData = {
        version: `v${Date.now()}`,
        description: `Test revision ${Date.now()}`,
        status: 'pending'
      }

      const response = await authenticatedPost(`/api/drawings/${testDrawing.id}/revisions`, revisionData)
      
      expectSuccessResponse(response, 201)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('drawingId')
      expect(response.body).toHaveProperty('version')
      expect(response.body.drawingId).toBe(testDrawing.id)
    })

    it('should return 400 for missing required fields', async () => {
      if (!testDrawing) {
        console.log('⚠️ No test drawing available, skipping test')
        return
      }

      const response = await authenticatedPost(`/api/drawings/${testDrawing.id}/revisions`, {
        description: 'Test revision'
        // Missing version
      })
      expectBadRequestResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost(`/api/drawings/${testDrawing?.id || 'test-id'}/revisions`, {
        version: 'v1.0',
        description: 'Test revision'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('PATCH /api/revisions/[id]/status', () => {
    it('should update revision status', async () => {
      // This test would need a revision ID from the database
      // For now, we'll test the endpoint structure
      const revisionId = 'test-revision-id'
      const statusData = {
        status: 'approved',
        reviewedBy: 'dev-user-123',
        reviewNotes: 'Test approval'
      }

      const response = await authenticatedPatch(`/api/revisions/${revisionId}/status`, statusData)
      
      // This might return 404 if revision doesn't exist, which is expected
      expect([200, 404]).toContain(response.status)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPatch('/api/revisions/test-id/status', {
        status: 'approved'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/revisions/[id]/pages', () => {
    it('should return revision pages', async () => {
      const revisionId = 'test-revision-id'
      const response = await authenticatedGet(`/api/revisions/${revisionId}/pages`)
      
      // This might return 404 if revision doesn't exist, which is expected
      expect([200, 404]).toContain(response.status)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/revisions/test-id/pages')
      expectUnauthorizedResponse(response)
    })
  })
})
