# Workspace - Slack Clone PWA

## Overview
A modern Slack clone built as a Progressive Web App (PWA) with real-time messaging, channels, direct messages, and user presence tracking. Built with React, Express, PostgreSQL, and WebSockets.

## Recent Changes
- **October 11, 2025**: Access Code Gate for Controlled Access
  - **Purpose**: Simple invitation system - share a single secret code with team members
  - **Implementation**:
    - AccessCodeGate component wraps entire app
    - POST `/api/verify-access-code` endpoint (no auth required)
    - localStorage persistence prevents re-prompting
    - Arabic UI with error/success toasts
  - **Workflow**:
    - User visits app → prompted for access code
    - Wrong code → 401 error, stays on gate page
    - Correct code → localStorage saved, app unlocked
    - Page refresh → localStorage checked, gate skipped if verified
  - **Configuration**: ACCESS_CODE environment variable (change anytime in Secrets)

- **October 11, 2025**: Engineering Drawings Management System
  - **Database Schema**: 
    - `disciplines` table: Engineering disciplines (ARCH, STR, MEP, GEN)
    - `floors` table: Building floor levels with sort order
    - `drawings` table: Technical drawings with sheet numbers and metadata
    - `drawing_revisions` table: Version control with approval workflow
  - **API Endpoints**:
    - GET/POST `/api/drawings` - Drawing management
    - GET `/api/drawings/:id` - Get drawing with all revisions
    - POST `/api/drawings/:id/revisions` - Upload new revision
    - PATCH `/api/revisions/:id/status` - Approve/reject revisions
    - GET `/api/disciplines`, `/api/floors` - Metadata endpoints
  - **UI Components**:
    - Drawings Index Page: Table with filters (Status, Discipline, Floor, Search)
    - Upload Drawing Dialog: Multi-field form with file upload to object storage
    - Drawing Viewer Dialog: Full drawing details with revision history
    - Upload Revision Dialog: Quick revision upload with automatic versioning
    - Review System: Inline approve/reject with review notes
  - **Workflow**:
    - Upload drawing with first revision (status: Draft)
    - View drawing details and revision history
    - Upload new revisions (auto-supersedes previous approved revisions)
    - Review revisions: Approve/Reject with optional notes
    - Download PDF files from object storage
    - Filter drawings by status, discipline, floor, or search

- **October 11, 2025**: UI/UX improvements + Messaging features
  - **MessageComposer Redesign**: Replaced ObjectUploader with simple hidden file input for cleaner layout
    - No more "Drop your files here" overlay
    - Buttons organized in single toolbar row: [📎] [B] [I] _____ [Send]
    - Direct file upload via fetch to object storage
    - Clean, Slack-like design inside message composer box
  - **Starred Messages System**: Database table, API endpoints with authorization, UI star button, /starred page
  - **@Mentions Autocomplete**: Real-time user filtering dropdown when typing @ in message composer
  - **Threads Page Functionality**: Fixed getUserThreads() to show threads user created OR replied to
  - **Security Enhancements**:
    - Starred messages authorization: verify channel access before star/unstar/check
    - getUserStarredMessages() explicitly checks membership for each private channel
    - Comprehensive security test: users can't see starred messages from private channels after removal
    - Added getMessage() method for authorization validation

- **October 10, 2025**: Complete MVP implementation with all core features
  - Implemented complete database schema with users, channels, messages, direct messages, channel members, and reactions
  - Built comprehensive UI with Slack-inspired design (aubergine primary color, sidebar navigation)
  - Integrated Replit Auth for authentication
  - Added WebSocket server for real-time messaging and presence tracking
  - Implemented PWA features with service worker and install prompt
  - Created all CRUD endpoints for channels, messages, and direct messages
  - **File & Image Sharing**: Full object storage integration with upload/download
  - **Message Threading**: Side panel UI for threaded conversations with parent + replies
  - **Message Reactions**: 6 common emoji reactions (thumbs-up, heart, laugh, party, check, smile) with real-time updates
  - **@Mentions & Notifications**: Extract mentions from messages, create notifications, real-time delivery via WebSocket
  - **Message Editing & Deletion**: Owner-only controls with inline edit mode, "(edited)" indicator, and mention re-derivation
  - **Admin Role System**: First user becomes admin automatically, role-based access control for workspace management
  - **Workspace Settings**: Admin-only page displaying member statistics and management options
  - **Member Management**: Admin interface for promoting/demoting users and removing members
  - **Security fixes applied**:
    - Channel membership verification for all channel operations
    - Private channel access control (cannot join without invite - returns 403)
    - Session-based WebSocket authentication (prevents impersonation)
    - WebSocket channel subscriptions (broadcasts only to authorized members)
    - Search results filtered by accessible channels (using inArray for proper SQL)
    - Private channel metadata protected from unauthorized disclosure
    - Fixed SQL array handling to use Drizzle's inArray() instead of raw ANY()
    - **Reactions security**: Server-side channel validation, no client-supplied channelId accepted
    - **Admin-only endpoints**: Role verification for user management operations

## Project Architecture

### Frontend (React + TypeScript)
- **Pages**:
  - Landing page for unauthenticated users
  - Home workspace with sidebar navigation and message views
  - /starred - Starred messages page
  - /threads - Threads user participated in
  - /drawings - Engineering drawings management (table view with filters)
  - /settings - Workspace settings (admin only)
- **Components**:
  - AppSidebar: Channels and DM list with online status indicators
  - ChannelView: Channel message feed with composer and thread panel
  - DirectMessageView: 1-on-1 messaging interface
  - MessageItem: Message display with reactions, threading, and file attachments
  - MessageComposer: Clean message input with simple file upload (no overlay/modal)
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
  - users: User profiles with online status and role (admin/member)
  - channels: Public and private channels
  - messages: Channel messages with threading, file attachments, mentions, and editedAt
  - direct_messages: 1-on-1 messages
  - channel_members: Channel membership tracking
  - reactions: Message reactions with unique user-icon constraints
  - notifications: @mention notifications with read status
  - starred_messages: Starred messages with unique user-message constraint
  - disciplines: Engineering disciplines (ARCH, STR, MEP, GEN)
  - floors: Building floor levels with sort order
  - drawings: Technical drawings with sheet numbers, discipline, floor, package
  - drawing_revisions: Version control with status tracking and approval workflow
- **API Endpoints**:
  - `/api/verify-access-code`: Verify access code (no auth required)
  - `/api/auth/user`: Get current user
  - `/api/users`: List all users
  - `/api/users/:id/role`: Update user role (admin only)
  - `/api/users/:id`: Delete user (admin only)
  - `/api/channels`: Channel CRUD operations
  - `/api/messages`: Message operations with file attachments
  - `/api/messages/:id`: Update/delete message (owner only)
  - `/api/messages/:id/star`: Star/unstar message (requires channel access)
  - `/api/messages/:id/starred`: Check if message is starred
  - `/api/messages/threads`: Get user's threads (created or replied to)
  - `/api/starred`: Get user's starred messages (filtered by accessible channels)
  - `/api/direct-messages`: DM operations
  - `/api/search/:query`: Search messages
  - `/api/reactions`: Add/remove/get message reactions
  - `/api/notifications`: Get notifications, mark as read
  - `/objects/:objectPath`: Download files from object storage
  - `/api/disciplines`: Get all engineering disciplines
  - `/api/floors`: Get all building floors
  - `/api/drawings`: Get all drawings, create new drawing
  - `/api/drawings/:id`: Get drawing with all revisions
  - `/api/drawings/:id/revisions`: Create new revision for drawing
  - `/api/revisions/:id/status`: Update revision status (approve/reject)
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
4. **File Sharing**: Upload and share images/files using Replit Object Storage
5. **Message Threading**: Reply to messages in dedicated thread panel with parent context
6. **Message Reactions**: React with 6 emoji options (thumbs-up, heart, laugh, party, check, smile)
7. **@Mentions & Notifications**: Mention users in messages, receive real-time notifications with autocomplete
8. **Message Edit/Delete**: Edit or delete your own messages with visual indicators
9. **Starred Messages**: Star important messages for quick access, with secure channel-based filtering
10. **Threads View**: See all threads you've participated in (created or replied to) in one place
11. **Admin Workspace Controls**: First user becomes admin, manage member roles and permissions
12. **Search**: Find messages and channels quickly (Cmd+K) - filtered by membership
13. **User Presence**: See who's online/offline
14. **PWA**: Install as desktop/mobile app
15. **Security**: Complete access control for private channels, membership verification, and admin-only operations
16. **Engineering Drawings Management**: Technical document control for construction/engineering companies
    - Upload drawings with metadata (sheet number, title, discipline, floor, package)
    - Version control with revision tracking (Draft → Under Review → Approved/Rejected/Superseded)
    - Approval workflow with review notes
    - Filter and search drawings by status, discipline, floor
    - Download PDF files from secure object storage
    - Full revision history with uploader and reviewer information
17. **Access Code Gate**: Simple invitation system for controlled access
    - Single secret code shared with team members
    - localStorage-based persistence (no re-prompting)
    - Clean Arabic UI with error handling
    - Easy code rotation via environment variables

## Security Features
- **Session-Based WebSocket Authentication**: All WebSocket connections authenticate via HTTP session, preventing user impersonation
- **Channel Membership Enforcement**: Private channel messages only accessible to members
- **Join Protection**: Users cannot join private channels without invitation (403 Forbidden)
- **Search Privacy**: Search results filtered to only show messages from accessible channels
- **Broadcast Isolation**: Real-time messages only sent to authorized channel subscribers
- **Metadata Protection**: Private channel existence hidden from non-members
- **Reactions Access Control**: Server validates channel membership before allowing reactions, preventing cross-channel spoofing
- **File Access Control**: Object storage files served only to authenticated users with proper ACL policies
- **Message Ownership**: Only message owners can edit or delete their messages
- **Admin Role Protection**: Role-based access control for user management, prevent self-deletion and self-demotion
- **First User Admin**: First user to sign in automatically becomes workspace administrator
- **Starred Messages Security**: Channel access verification before star/unstar/check, explicit membership validation for starred message retrieval

## Tech Stack
- Frontend: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter (routing)
- Backend: Express.js, Node.js
- Database: PostgreSQL (Neon), Drizzle ORM
- Real-time: WebSockets (ws library)
- Auth: Replit Auth (OpenID Connect)
- State Management: TanStack Query (React Query)
- File Storage: Replit Object Storage (Google Cloud Storage)
- File Uploads: Uppy (with AWS S3-compatible adapter)

## Development
- Start server: `npm run dev` (runs both frontend and backend)
- Database migration: `npm run db:push`
- All endpoints prefixed with `/api`
- WebSocket server on `/ws` path
