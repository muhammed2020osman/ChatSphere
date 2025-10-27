import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  authenticatedPost,
  authenticatedPut,
  authenticatedDelete,
  unauthenticatedGet, 
  unauthenticatedPost,
  unauthenticatedPut,
  unauthenticatedDelete,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectBadRequestResponse
} from '../helpers/api'
import { getTestData } from '../helpers/db'

describe('Saved Views APIs', () => {
  let testData: any

  beforeAll(async () => {
    testData = await getTestData()
  })

  describe('GET /api/saved-views', () => {
    it('should return list of saved views', async () => {
      const response = await authenticatedGet('/api/saved-views')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        const savedView = response.body[0]
        expect(savedView).toHaveProperty('id')
        expect(savedView).toHaveProperty('name')
        expect(savedView).toHaveProperty('userId')
        expect(typeof savedView.id).toBe('string')
        expect(typeof savedView.name).toBe('string')
      }
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/saved-views')
      expectUnauthorizedResponse(response)
    })
  })

  describe('POST /api/saved-views', () => {
    it('should create new saved view', async () => {
      const savedViewData = {
        name: `Test View ${Date.now()}`,
        description: 'Test saved view',
        filters: {
          status: 'open',
          priority: 'high'
        },
        viewType: 'tickets'
      }

      const response = await authenticatedPost('/api/saved-views', savedViewData)
      
      expectSuccessResponse(response, 201)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('name')
      expect(response.body).toHaveProperty('userId')
      expect(response.body.name).toBe(savedViewData.name)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await authenticatedPost('/api/saved-views', {
        description: 'Test view'
        // Missing name
      })
      expectBadRequestResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost('/api/saved-views', {
        name: 'Test View'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/saved-views/[id]', () => {
    it('should return specific saved view', async () => {
      if (testData.savedViews && testData.savedViews.length === 0) {
        console.log('⚠️ No test saved views available, skipping test')
        return
      }

      const savedView = testData.savedViews?.[0]
      if (!savedView) {
        console.log('⚠️ No test saved views available, skipping test')
        return
      }

      const response = await authenticatedGet(`/api/saved-views/${savedView.id}`)
      
      expectSuccessResponse(response)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('name')
      expect(response.body.id).toBe(savedView.id)
    })

    it('should return 404 for non-existent saved view', async () => {
      const response = await authenticatedGet('/api/saved-views/non-existent-id')
      expectNotFoundResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/saved-views/test-id')
      expectUnauthorizedResponse(response)
    })
  })

  describe('PUT /api/saved-views/[id]', () => {
    it('should update saved view', async () => {
      if (testData.savedViews && testData.savedViews.length === 0) {
        console.log('⚠️ No test saved views available, skipping test')
        return
      }

      const savedView = testData.savedViews?.[0]
      if (!savedView) {
        console.log('⚠️ No test saved views available, skipping test')
        return
      }

      const updateData = {
        name: `Updated View ${Date.now()}`,
        description: 'Updated description',
        filters: {
          status: 'closed'
        }
      }

      const response = await authenticatedPut(`/api/saved-views/${savedView.id}`, updateData)
      
      expectSuccessResponse(response)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('name')
      expect(response.body.name).toBe(updateData.name)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPut('/api/saved-views/test-id', {
        name: 'Updated View'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('DELETE /api/saved-views/[id]', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedDelete('/api/saved-views/test-id')
      expectUnauthorizedResponse(response)
    })

    // Note: We don't test actual deletion to avoid removing real data
  })
})
