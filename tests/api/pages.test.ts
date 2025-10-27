import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  unauthenticatedGet, 
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectNotFoundResponse
} from '../helpers/api'
import { getTestData } from '../helpers/db'

describe('Pages APIs', () => {
  let testData: any

  beforeAll(async () => {
    testData = await getTestData()
  })

  describe('GET /api/pages/[id]', () => {
    it('should return specific page', async () => {
      if (testData.pages && testData.pages.length === 0) {
        console.log('⚠️ No test pages available, skipping test')
        return
      }

      const page = testData.pages?.[0]
      if (!page) {
        console.log('⚠️ No test pages available, skipping test')
        return
      }

      const response = await authenticatedGet(`/api/pages/${page.id}`)
      
      expectSuccessResponse(response)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('pageNumber')
      expect(response.body).toHaveProperty('revisionId')
      expect(response.body.id).toBe(page.id)
    })

    it('should return 404 for non-existent page', async () => {
      const response = await authenticatedGet('/api/pages/non-existent-id')
      expectNotFoundResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/pages/test-id')
      expectUnauthorizedResponse(response)
    })
  })
})
