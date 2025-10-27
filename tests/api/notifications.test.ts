import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  authenticatedPatch,
  unauthenticatedGet, 
  unauthenticatedPatch,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectNotFoundResponse
} from '../helpers/api'
import { getTestData } from '../helpers/db'

describe('Notifications APIs', () => {
  let testData: any

  beforeAll(async () => {
    testData = await getTestData()
  })

  describe('GET /api/notifications', () => {
    it('should return list of notifications', async () => {
      const response = await authenticatedGet('/api/notifications')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        const notification = response.body[0]
        expect(notification).toHaveProperty('id')
        expect(notification).toHaveProperty('userId')
        expect(notification).toHaveProperty('type')
        expect(notification).toHaveProperty('message')
        expect(typeof notification.id).toBe('string')
        expect(typeof notification.userId).toBe('string')
      }
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/notifications')
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/notifications/unread-count', () => {
    it('should return unread notification count', async () => {
      const response = await authenticatedGet('/api/notifications/unread-count')
      
      expectSuccessResponse(response)
      expect(response.body).toHaveProperty('count')
      expect(typeof response.body.count).toBe('number')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/notifications/unread-count')
      expectUnauthorizedResponse(response)
    })
  })

  describe('PATCH /api/notifications/[id]/read', () => {
    it('should mark notification as read', async () => {
      if (testData.notifications.length === 0) {
        console.log('⚠️ No test notifications available, skipping test')
        return
      }

      const notification = testData.notifications[0]
      const response = await authenticatedPatch(`/api/notifications/${notification.id}/read`)
      
      expectSuccessResponse(response)
    })

    it('should return 404 for non-existent notification', async () => {
      const response = await authenticatedPatch('/api/notifications/non-existent-id/read')
      expectNotFoundResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPatch('/api/notifications/test-id/read')
      expectUnauthorizedResponse(response)
    })
  })

  describe('PATCH /api/notifications/mark-all-read', () => {
    it('should mark all notifications as read', async () => {
      const response = await authenticatedPatch('/api/notifications/mark-all-read')
      
      expectSuccessResponse(response)
      expect(response.body).toHaveProperty('updated')
      expect(typeof response.body.updated).toBe('number')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPatch('/api/notifications/mark-all-read')
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/notifications/poll', () => {
    it('should poll for new notifications', async () => {
      const response = await authenticatedGet('/api/notifications/poll')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/notifications/poll')
      expectUnauthorizedResponse(response)
    })
  })
})
