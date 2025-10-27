import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedPut,
  unauthenticatedPut,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectBadRequestResponse
} from '../helpers/api'
import { getTestData } from '../helpers/db'

describe('Attachments APIs', () => {
  let testData: any

  beforeAll(async () => {
    testData = await getTestData()
  })

  describe('PUT /api/attachments', () => {
    it('should upload attachment', async () => {
      const attachmentData = {
        filename: `test-attachment-${Date.now()}.txt`,
        contentType: 'text/plain',
        size: 1024,
        messageId: testData.messages?.[0]?.id || 'test-message-id',
        userId: 'dev-user-123'
      }

      const response = await authenticatedPut('/api/attachments', attachmentData)
      
      expectSuccessResponse(response)
      expect(response.body).toHaveProperty('id')
      expect(response.body).toHaveProperty('filename')
      expect(response.body).toHaveProperty('url')
      expect(response.body.filename).toBe(attachmentData.filename)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await authenticatedPut('/api/attachments', {
        contentType: 'text/plain'
        // Missing filename, size, etc.
      })
      expectBadRequestResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPut('/api/attachments', {
        filename: 'test.txt',
        contentType: 'text/plain',
        size: 1024
      })
      expectUnauthorizedResponse(response)
    })
  })
})
