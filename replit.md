# Workspace - Slack Clone PWA

## Overview
A modern Slack clone built as a Progressive Web App (PWA) with real-time messaging, channels, direct messages, and user presence tracking. Built with React, Express, PostgreSQL, and WebSockets.

## Recent Changes
- **October 10, 2025**: Initial MVP implementation and security hardening
  - Implemented complete database schema with users, channels, messages, direct messages, and channel members
  - Built comprehensive UI with Slack-inspired design (aubergine primary color, sidebar navigation)
  - Integrated Replit Auth for authentication
  - Added WebSocket server for real-time messaging and presence tracking
  - Implemented PWA features with service worker and install prompt
  - Created all CRUD endpoints for channels, messages, and direct messages
  - **Security fixes applied**:
    - Channel membership verification for all channel operations
    - Private channel access control (cannot join without invite - returns 403)
    - Session-based WebSocket authentication (prevents impersonation)
    - WebSocket channel subscriptions (broadcasts only to authorized members)
    - Search results filtered by accessible channels (using inArray for proper SQL)
    - Private channel metadata protected from unauthorized disclosure
    - Fixed SQL array handling to use Drizzle's inArray() instead of raw ANY()

## Project Architecture

### Frontend (React + TypeScript)
- **Pages**:
  - Landing page for unauthenticated users
  - Home workspace with sidebar navigation and message views
- **Components**:
  - AppSidebar: Channels and DM list with online status indicators
  - ChannelView: Channel message feed with composer
  - DirectMessageView: 1-on-1 messaging interface
  - MessageItem: Message display with user info and timestamps
  - MessageComposer: Rich text message input with formatting toolbar
  - SearchOverlay: Search for channels and messages (Cmd+K)
  - CreateChannelModal: Create public/private channels
  - ThemeToggle: Dark/light mode switcher
- **Hooks**:
  - useAuth: Authentication state and user data
  - useWebSocket: Real-time WebSocket connection
- **Styling**: Tailwind CSS with Slack-inspired design tokens

### Backend (Express + PostgreSQL)
- **Database Tables**:
  - sessions: Session storage for Replit Auth
  - users: User profiles with online status
  - channels: Public and private channels
  - messages: Channel messages with threading support
  - direct_messages: 1-on-1 messages
  - channel_members: Channel membership tracking
- **API Endpoints**:
  - `/api/auth/user`: Get current user
  - `/api/users`: List all users
  - `/api/channels`: Channel CRUD operations
  - `/api/messages`: Message operations
  - `/api/direct-messages`: DM operations
  - `/api/search/:query`: Search messages
- **WebSocket Server** (`/ws`):
  - Real-time message broadcasting
  - User presence tracking
  - Typing indicators

### Authentication
- Replit Auth with OpenID Connect
- Session-based authentication with PostgreSQL storage
- Automatic token refresh

### Real-time Features
- WebSocket connection for live updates with session-based authentication
- Instant message delivery
- Online/offline status tracking
- Typing indicators
- **Security**: 
  - WebSocket connections authenticated via HTTP session (prevents impersonation)
  - Channel-based subscriptions ensure messages only reach authorized members
  - User identity derived from authenticated session, not client-supplied values

### PWA Features
- Service worker for offline support
- Install prompt for desktop/mobile
- Manifest.json for app metadata

## User Preferences
- Default theme: Dark mode
- Primary color: Aubergine/plum (#b968c7)
- Font family: Lato

## Key Features
1. **Channels**: Create public or private channels, organized by topic
2. **Direct Messages**: 1-on-1 conversations with team members
3. **Real-time Messaging**: Instant message delivery via WebSockets with session-based auth
4. **Search**: Find messages and channels quickly (Cmd+K) - filtered by membership
5. **User Presence**: See who's online/offline
6. **Threading**: Reply to messages in threads (UI ready, backend complete)
7. **PWA**: Install as desktop/mobile app
8. **Security**: Complete access control for private channels and membership verification

## Security Features
- **Session-Based WebSocket Authentication**: All WebSocket connections authenticate via HTTP session, preventing user impersonation
- **Channel Membership Enforcement**: Private channel messages only accessible to members
- **Join Protection**: Users cannot join private channels without invitation (403 Forbidden)
- **Search Privacy**: Search results filtered to only show messages from accessible channels
- **Broadcast Isolation**: Real-time messages only sent to authorized channel subscribers
- **Metadata Protection**: Private channel existence hidden from non-members

## Tech Stack
- Frontend: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter (routing)
- Backend: Express.js, Node.js
- Database: PostgreSQL (Neon), Drizzle ORM
- Real-time: WebSockets (ws library)
- Auth: Replit Auth (OpenID Connect)
- State Management: TanStack Query (React Query)

## Development
- Start server: `npm run dev` (runs both frontend and backend)
- Database migration: `npm run db:push`
- All endpoints prefixed with `/api`
- WebSocket server on `/ws` path
