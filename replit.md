# Workspace - Slack Clone PWA

## Overview
A modern Slack clone built as a Progressive Web App (PWA) with real-time messaging, channels, direct messages, and user presence tracking. This project also incorporates an Engineering Drawings Management System for technical document control in construction/engineering, including version control, approval workflows, and a Sheet Viewer. The platform aims to provide a comprehensive collaboration and document management solution.

## Recent Updates
**October 21, 2025 - Phase 2: Pins/Tickets System & Drawing Tools (Completed)**
- ✅ **Database Schemas**: Created `pins`, `tickets`, `layers` tables with proper relations
- ✅ **API Endpoints**: Full CRUD operations for pins, tickets, and layers
- ✅ **Pin Tool Enhanced**: Crosshair cursor, confirm/cancel buttons for temporary pin placement
- ✅ **Create Ticket Modal**: Uses real API data from `/api/disciplines` and `/api/users` (no mock data)
- ✅ **Layers Panel Reorganized**: Grouped by disciplines, displays pin counts per discipline
- ✅ **Drawing Tools UI**: Toolbar with Pen, Line, Rectangle, Circle, Text, Eraser + color/stroke pickers
- ✅ **Drawing Canvas Layer**: SVG overlay for rendering drawings
- ✅ **Pen Tool Working**: Full mouse event handlers for freehand drawing (down/move/up)
- ✅ **Save Layer Functional**: Mutation saves drawings via POST `/api/layers` with cache invalidation
- ⚠️ **Other Drawing Tools**: Line, Rectangle, Circle, Text, Eraser have UI but TODO event handlers
- 📝 **Next**: E2E testing, then optional enhancement of remaining drawing tools

## User Preferences
- Default theme: Dark mode
- Primary color: Aubergine/plum (#b968c7)
- Font family: Lato

## System Architecture

### UI/UX Decisions
- **ConstructFlow Design System**: Color scheme (dark teal, light blue, light/dark backgrounds).
- **Slack-inspired design**: Aubergine primary color, sidebar navigation, clean message composer.
- **Responsive Layouts**: Grid/List view toggle for plans, adapted for various screen sizes.
- **Arabic UI**: For the Access Code Gate.

### Technical Implementations
- **Frontend**: React, TypeScript, Tailwind CSS, Shadcn UI, Wouter (routing).
- **Backend**: Express.js, Node.js.
- **Database**: PostgreSQL (Neon) with Drizzle ORM.
- **Real-time**: WebSockets (ws library) for messaging, presence, and notifications.
- **Authentication**: Replit Auth (OpenID Connect), session-based.
- **State Management**: TanStack Query (React Query).
- **File Storage**: Replit Object Storage (Google Cloud Storage) for files and images.
- **PWA Features**: Service worker for offline support, install prompt, manifest.json.

### Feature Specifications
- **Real-time Messaging**: Channels (public/private), Direct Messages, Threading, Reactions, @Mentions & Notifications, Message Editing/Deletion.
- **File Sharing**: Upload and share files/images.
- **User Management**: Admin roles, member promotion/demotion, workspace settings.
- **Search**: Messages and channels (Cmd+K).
- **User Presence**: Online/offline status.
- **Starred Messages**: Quick access to important messages.
- **Access Code Gate**: Controlled access via a single secret code.
- **Engineering Drawings Management System**:
    - **Plans Management Page**: Grid/list view, filters (Building, Floor, Discipline, Status), plan cards, upload plans.
    - **Sheet Viewer**: Canvas viewer with plan image, pan, zoom, pin, ruler tools, layers, pins tabs, keyboard shortcuts.
    - **Database Schema**: `disciplines`, `floors`, `drawings`, `drawing_revisions` tables.
    - **API Endpoints**: CRUD for drawings and revisions, status updates, metadata.
    - **Workflow**: Upload drawings, revision control (Draft, Under Review, Approved/Rejected/Superseded), review system, PDF download.

### System Design Choices
- **Authentication**: Replit Auth handles user login, while internal session management secures API and WebSocket interactions.
- **Security**: Comprehensive access control for private channels, message ownership validation, server-side channel validation for reactions, role-based access for admin functions, and secure object storage access. WebSocket connections are session-authenticated to prevent impersonation.
- **Performance**: `useCallback`/`useEffect` optimizations in frontend, efficient database queries with Drizzle ORM.
- **Scalability**: PostgreSQL for data storage, WebSockets for real-time communication, and Replit Object Storage for file handling.

## External Dependencies
- **Replit Auth**: User authentication via OpenID Connect.
- **PostgreSQL (Neon)**: Primary database for all application data.
- **Replit Object Storage (Google Cloud Storage)**: For storing uploaded files and images.
- **ws library**: WebSocket server implementation.
- **Uppy**: File upload library.
- **Tailwind CSS**: Utility-first CSS framework.
- **Shadcn UI**: UI component library.
- **Wouter**: React router library.
- **TanStack Query (React Query)**: Data fetching and state management.