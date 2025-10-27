import { describe, it, expect, beforeAll } from 'vitest'
import { 
  authenticatedGet, 
  authenticatedPost,
  authenticatedPatch,
  authenticatedDelete,
  unauthenticatedGet, 
  unauthenticatedPost,
  unauthenticatedPatch,
  unauthenticatedDelete,
  expectSuccessResponse, 
  expectUnauthorizedResponse,
  expectNotFoundResponse,
  expectBadRequestResponse,
  validateTicketResponse
} from '../helpers/api'
import { getTestData, getRandomDrawing } from '../helpers/db'

describe('Tickets APIs', () => {
  let testData: any
  let testDrawing: any

  beforeAll(async () => {
    testData = await getTestData()
    testDrawing = getRandomDrawing(testData)
  })

  describe('GET /api/tickets', () => {
    it('should return list of tickets', async () => {
      const response = await authenticatedGet('/api/tickets')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
      
      if (response.body.length > 0) {
        validateTicketResponse(response.body[0])
      }
    })

    it('should support status filter', async () => {
      const response = await authenticatedGet('/api/tickets?status=open')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should support priority filter', async () => {
      const response = await authenticatedGet('/api/tickets?priority=high')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should support assignedTo filter', async () => {
      const response = await authenticatedGet('/api/tickets?assignedTo=dev-user-123')
      
      expectSuccessResponse(response)
      expect(Array.isArray(response.body)).toBe(true)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/tickets')
      expectUnauthorizedResponse(response)
    })
  })

  describe('POST /api/tickets', () => {
    it('should create new ticket', async () => {
      if (!testDrawing) {
        console.log('⚠️ No test drawing available, skipping test')
        return
      }

      const ticketData = {
        drawingId: testDrawing.id,
        title: `Test Ticket ${Date.now()}`,
        description: 'Test ticket description',
        priority: 'medium',
        assignedTo: 'dev-user-123'
      }

      const response = await authenticatedPost('/api/tickets', ticketData)
      
      expectSuccessResponse(response, 201)
      validateTicketResponse(response.body)
      expect(response.body.drawingId).toBe(testDrawing.id)
      expect(response.body.title).toBe(ticketData.title)
    })

    it('should return 400 for missing required fields', async () => {
      const response = await authenticatedPost('/api/tickets', {
        description: 'Test ticket'
        // Missing drawingId and title
      })
      expectBadRequestResponse(response, 'Drawing ID and title are required')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPost('/api/tickets', {
        drawingId: 'test-id',
        title: 'Test Ticket'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('GET /api/tickets/[id]', () => {
    it('should return specific ticket', async () => {
      if (testData.tickets.length === 0) {
        console.log('⚠️ No test tickets available, skipping test')
        return
      }

      const ticket = testData.tickets[0]
      const response = await authenticatedGet(`/api/tickets/${ticket.id}`)
      
      expectSuccessResponse(response)
      validateTicketResponse(response.body)
      expect(response.body.id).toBe(ticket.id)
    })

    it('should return 404 for non-existent ticket', async () => {
      const response = await authenticatedGet('/api/tickets/non-existent-id')
      expectNotFoundResponse(response)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedGet('/api/tickets/test-id')
      expectUnauthorizedResponse(response)
    })
  })

  describe('PATCH /api/tickets/[id]', () => {
    it('should update ticket', async () => {
      if (testData.tickets.length === 0) {
        console.log('⚠️ No test tickets available, skipping test')
        return
      }

      const ticket = testData.tickets[0]
      const updateData = {
        title: `Updated Ticket ${Date.now()}`,
        description: 'Updated description'
      }

      const response = await authenticatedPatch(`/api/tickets/${ticket.id}`, updateData)
      
      expectSuccessResponse(response)
      validateTicketResponse(response.body)
      expect(response.body.title).toBe(updateData.title)
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPatch('/api/tickets/test-id', {
        title: 'Updated Ticket'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('PATCH /api/tickets/[id]/status', () => {
    it('should update ticket status', async () => {
      if (testData.tickets.length === 0) {
        console.log('⚠️ No test tickets available, skipping test')
        return
      }

      const ticket = testData.tickets[0]
      const statusData = {
        status: 'in-progress'
      }

      const response = await authenticatedPatch(`/api/tickets/${ticket.id}/status`, statusData)
      
      expectSuccessResponse(response)
      expect(response.body).toHaveProperty('status')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPatch('/api/tickets/test-id/status', {
        status: 'in-progress'
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('PATCH /api/tickets/bulk', () => {
    it('should update multiple tickets', async () => {
      if (testData.tickets.length === 0) {
        console.log('⚠️ No test tickets available, skipping test')
        return
      }

      const ticketIds = testData.tickets.slice(0, 2).map((t: any) => t.id)
      const bulkData = {
        ticketIds,
        updates: {
          status: 'closed'
        }
      }

      const response = await authenticatedPatch('/api/tickets/bulk', bulkData)
      
      expectSuccessResponse(response)
      expect(response.body).toHaveProperty('updated')
    })

    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedPatch('/api/tickets/bulk', {
        ticketIds: ['test-id'],
        updates: { status: 'closed' }
      })
      expectUnauthorizedResponse(response)
    })
  })

  describe('DELETE /api/tickets/[id]', () => {
    it('should return 401 for unauthenticated request', async () => {
      const response = await unauthenticatedDelete('/api/tickets/test-id')
      expectUnauthorizedResponse(response)
    })

    // Note: We don't test actual deletion to avoid removing real data
  })
})
