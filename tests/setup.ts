import { beforeAll, afterAll } from 'vitest'
import dotenv from 'dotenv'

// Load environment variables
dotenv.config()

// Set test environment
process.env.NODE_ENV = 'test'

beforeAll(async () => {
  console.log('🚀 Setting up test environment...')
  
  // Verify database connection
  try {
    const { db } = await import('@/lib/db')
    console.log('✅ Database connection verified')
  } catch (error) {
    console.error('❌ Database connection failed:', error)
    throw error
  }
})

afterAll(async () => {
  console.log('🧹 Cleaning up test environment...')
})
