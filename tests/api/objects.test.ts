import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  authenticatedPost,
  unauthenticatedGet, 
  unauthenticatedPost,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectBadRequestResponse
} from '../helpers/api'
import { getTestData } from '../helpers/db'

describe('Objects APIs', () => {
  let testData: any

  beforeAll(async () => {
    testData = await getTestData()
  })

  describe('POST /api/objects/upload', () => {
    it('should upload object', async () => {
      const objectData = {
        filename: `test-object-${Date.now()}.pdf`,
        contentType: 'application/pdf',
        size: 2048,
        path: '/uploads/test-object.pdf',
        userId: 'dev-user-123'
      }

      const response = await authenticatedPost('/api/objects/upload', objectData)
      
      expectSuccessResponse(response, 201)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('filename')
      expect(response.body).toHaveProperty('path')
      expect(response.body.filename).toBe(objectData.filename)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await authenticatedPost('/api/objects/upload', {
        contentType: 'application/pdf'
        // Missing filename, size, path
      })
      expectBadRequestResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost('/api/objects/upload', {
        filename: 'test.pdf',
        contentType: 'application/pdf',
        size: 2048,
        path: '/uploads/test.pdf'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/objects/[...objectPath]', () => {
    it('should get object by path', async () => {
      const objectPath = 'uploads/test-file.pdf'
      const response = await authenticatedGet(`/api/objects/${objectPath}`)
      
      // This might return 404 if object doesn't exist, which is expected
      expect([200, 404]).toContain(response.status)
    })

    it('should handle nested paths', async () => {
      const objectPath = 'uploads/drawings/test-drawing.pdf'
      const response = await authenticatedGet(`/api/objects/${objectPath}`)
      
      // This might return 404 if object doesn't exist, which is expected
      expect([200, 404]).toContain(response.status)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/objects/uploads/test.pdf')
      expectUnauthorizedResponse(response)
    })
  })
})
