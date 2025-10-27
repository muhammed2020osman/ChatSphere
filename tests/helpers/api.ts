import request from 'supertest'
import { NextRequest } from 'next/server'
import { createAuthHeaders, createUnauthHeaders, createUploadHeaders } from './auth'

const BASE_URL = process.env.TEST_BASE_URL || 'http://localhost:3000'

/**
 * Make authenticated GET request
 */
export async function authenticatedGet(endpoint: string, headers: Record<string, string> = {}) {
  return request(BASE_URL)
    .get(endpoint)
    .set({ ...createAuthHeaders(), ...headers })
}

/**
 * Make authenticated POST request
 */
export async function authenticatedPost(endpoint: string, data: any = {}, headers: Record<string, string> = {}) {
  return request(BASE_URL)
    .post(endpoint)
    .set({ ...createAuthHeaders(), ...headers })
    .send(data)
}

/**
 * Make authenticated PUT request
 */
export async function authenticatedPut(endpoint: string, data: any = {}, headers: Record<string, string> = {}) {
  return request(BASE_URL)
    .put(endpoint)
    .set({ ...createAuthHeaders(), ...headers })
    .send(data)
}

/**
 * Make authenticated PATCH request
 */
export async function authenticatedPatch(endpoint: string, data: any = {}, headers: Record<string, string> = {}) {
  return request(BASE_URL)
    .patch(endpoint)
    .set({ ...createAuthHeaders(), ...headers })
    .send(data)
}

/**
 * Make authenticated DELETE request
 */
export async function authenticatedDelete(endpoint: string, headers: Record<string, string> = {}) {
  return request(BASE_URL)
    .delete(endpoint)
    .set({ ...createAuthHeaders(), ...headers })
}

/**
 * Make unauthenticated GET request (for testing 401 responses)
 */
export async function unauthenticatedGet(endpoint: string, headers: Record<string, string> = {}) {
  return request(BASE_URL)
    .get(endpoint)
    .set({ ...createUnauthHeaders(), ...headers })
}

/**
 * Make unauthenticated POST request (for testing 401 responses)
 */
export async function unauthenticatedPost(endpoint: string, data: any = {}, headers: Record<string, string> = {}) {
  return request(BASE_URL)
    .post(endpoint)
    .set({ ...createUnauthHeaders(), ...headers })
    .send(data)
}

/**
 * Make file upload request
 */
export async function uploadFile(endpoint: string, filePath: string, fields: Record<string, any> = {}) {
  return request(BASE_URL)
    .post(endpoint)
    .set(createUploadHeaders())
    .attach('file', filePath)
    .field(fields)
}

/**
 * Common response assertions
 */
export function expectSuccessResponse(response: any, expectedStatus: number = 200) {
  expect(response.status).toBe(expectedStatus)
  expect(response.body).toBeDefined()
}

export function expectErrorResponse(response: any, expectedStatus: number, expectedMessage?: string) {
  expect(response.status).toBe(expectedStatus)
  expect(response.body).toBeDefined()
  expect(response.body.message).toBeDefined()
  
  if (expectedMessage) {
    expect(response.body.message).toContain(expectedMessage)
  }
}

export function expectUnauthorizedResponse(response: any) {
  expectErrorResponse(response, 401, 'Unauthorized')
}

export function expectNotFoundResponse(response: any) {
  expectErrorResponse(response, 404)
}

export function expectBadRequestResponse(response: any, expectedMessage?: string) {
  expectErrorResponse(response, 400, expectedMessage)
}

/**
 * Validate response structure
 */
export function validateUserResponse(user: any) {
  expect(user).toHaveProperty('id')
  expect(user).toHaveProperty('name')
  expect(user).toHaveProperty('email')
  expect(typeof user.id).toBe('string')
  expect(typeof user.name).toBe('string')
  expect(typeof user.email).toBe('string')
}

export function validateChannelResponse(channel: any) {
  expect(channel).toHaveProperty('id')
  expect(channel).toHaveProperty('name')
  expect(channel).toHaveProperty('createdBy')
  expect(typeof channel.id).toBe('string')
  expect(typeof channel.name).toBe('string')
}

export function validateMessageResponse(message: any) {
  expect(message).toHaveProperty('id')
  expect(message).toHaveProperty('content')
  expect(message).toHaveProperty('userId')
  expect(message).toHaveProperty('channelId')
  expect(typeof message.id).toBe('string')
  expect(typeof message.content).toBe('string')
}

export function validateDrawingResponse(drawing: any) {
  expect(drawing).toHaveProperty('id')
  expect(drawing).toHaveProperty('sheetNo')
  expect(drawing).toHaveProperty('title')
  expect(typeof drawing.id).toBe('string')
  expect(typeof drawing.sheetNo).toBe('string')
}

export function validateTicketResponse(ticket: any) {
  expect(ticket).toHaveProperty('id')
  expect(ticket).toHaveProperty('title')
  expect(ticket).toHaveProperty('drawingId')
  expect(ticket).toHaveProperty('createdBy')
  expect(typeof ticket.id).toBe('string')
  expect(typeof ticket.title).toBe('string')
}
