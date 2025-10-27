import { db } from '@/lib/db'
import { users, channels, messages, drawings, tickets } from '@/lib/db/schema'
import { eq } from 'drizzle-orm'

export interface TestData {
  users: any[]
  channels: any[]
  messages: any[]
  drawings: any[]
  tickets: any[]
}

/**
 * Get existing data from database for testing
 */
export async function getTestData(): Promise<TestData> {
  try {
    console.log('📊 Fetching test data from database...')
    
    // Initialize with empty arrays in case of errors
    let usersList: any[] = []
    let channelsList: any[] = []
    let messagesList: any[] = []
    let drawingsList: any[] = []
    let ticketsList: any[] = []

    // Try to fetch each table separately to handle individual errors
    try {
      usersList = await db.select().from(users).limit(5)
    } catch (error) {
      console.warn('⚠️ Could not fetch users:', error)
    }

    try {
      channelsList = await db.select().from(channels).limit(5)
    } catch (error) {
      console.warn('⚠️ Could not fetch channels:', error)
    }

    try {
      messagesList = await db.select().from(messages).limit(10)
    } catch (error) {
      console.warn('⚠️ Could not fetch messages:', error)
    }

    try {
      drawingsList = await db.select().from(drawings).limit(5)
    } catch (error) {
      console.warn('⚠️ Could not fetch drawings:', error)
    }

    try {
      ticketsList = await db.select().from(tickets).limit(5)
    } catch (error) {
      console.warn('⚠️ Could not fetch tickets:', error)
    }

    const testData: TestData = {
      users: usersList,
      channels: channelsList,
      messages: messagesList,
      drawings: drawingsList,
      tickets: ticketsList
    }

    console.log(`✅ Test data loaded: ${usersList.length} users, ${channelsList.length} channels, ${messagesList.length} messages, ${drawingsList.length} drawings, ${ticketsList.length} tickets`)
    
    return testData
  } catch (error) {
    console.error('❌ Error fetching test data:', error)
    // Return empty test data instead of throwing
    return {
      users: [],
      channels: [],
      messages: [],
      drawings: [],
      tickets: []
    }
  }
}

/**
 * Get a random user from test data
 */
export function getRandomUser(testData: TestData): any {
  if (testData.users.length === 0) {
    throw new Error('No users available in test data')
  }
  return testData.users[Math.floor(Math.random() * testData.users.length)]
}

/**
 * Get a random channel from test data
 */
export function getRandomChannel(testData: TestData): any {
  if (testData.channels.length === 0) {
    throw new Error('No channels available in test data')
  }
  return testData.channels[Math.floor(Math.random() * testData.channels.length)]
}

/**
 * Get a random drawing from test data
 */
export function getRandomDrawing(testData: TestData): any {
  if (testData.drawings.length === 0) {
    throw new Error('No drawings available in test data')
  }
  return testData.drawings[Math.floor(Math.random() * testData.drawings.length)]
}

/**
 * Verify database connection
 */
export async function verifyDatabaseConnection(): Promise<boolean> {
  try {
    await db.execute('SELECT 1')
    return true
  } catch (error) {
    console.error('Database connection failed:', error)
    return false
  }
}
