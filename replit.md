# Workspace - Slack Clone PWA

## Overview
A modern Slack clone built as a Progressive Web App (PWA) with real-time messaging, channels, direct messages, and user presence tracking. This project also incorporates an Engineering Drawings Management System for technical document control in construction/engineering, including version control, approval workflows, and a Sheet Viewer. The platform aims to provide a comprehensive collaboration and document management solution, offering flexibility in drawing uploads (AI-assisted or manual) and direct PDF viewing.

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
    - **Sheet Viewer**: Canvas viewer with plan image, pan, zoom, pin, ruler tools, layers, pins tabs, keyboard shortcuts. Supports direct PDF viewing via `pdfjs-dist` with SVG overlay for annotations.
    - **Upload Workflow**: Dual paths for AI-assisted (Gemini Vision + pdf-parse for metadata, image conversion) and Manual (original PDF retained, user-provided metadata). Includes a selection screen and comprehensive manual upload form.
    - **Revision Control**: Auto-generated revision numbers, tracking of revision lineage, multi-page PDF support, and a floating revision selector in the viewer with old revision warnings.
    - **Database Schema**: `disciplines`, `floors`, `drawings`, `drawing_revisions` tables with fields for `uploadMethod` and `parentDrawingId`.
    - **API Endpoints**: CRUD for drawings and revisions, status updates, metadata.
- **Pins/Tickets System & Drawing Tools**: Database schemas and APIs for `pins`, `tickets`, `layers`. Includes pin placement, ticket creation (RFI, Issue, Clash, etc.), and drawing tools (Pen, Line, Rectangle, Circle, Text, Eraser).
- **Tickets Hub Module**: Centralized ticket management system with comprehensive features:
    - **Table View**: Sortable, paginated table with columns for ID, Title, Type, Status, Priority, Assignee, Drawing, and SLA tracking. Bulk selection and actions support.
    - **Map View**: Interactive sheet viewer showing filtered tickets as pins on engineering drawings. Sheet selector with filtering capabilities.
    - **Advanced Filtering**: Multi-select filters for Discipline, Floor, Drawing, Type, Status, Priority, Assignee, Layer, SLA Status, Tags, and Date Range.
    - **Right Preview Panel**: Detailed ticket view with quick actions, mini-map, recent activity, and tags.
    - **Left Pin Timeline Drawer**: Pin-focused view showing all linked tickets and chronological timeline of events.
    - **Saved Views**: User-defined filter configurations with save/load/edit/delete functionality. Set default views.
    - **Bulk Actions**: Mass update status, priority, assignee, and tags for multiple tickets simultaneously.
    - **Enhanced Schema**: Tickets now support SLA hours, due dates, reporter field, channel linking, layer reference, and tags array.
    - **API Endpoints**: GET /api/tickets (advanced filtering), PATCH /api/tickets/bulk, GET /api/pins/:id/timeline, saved views CRUD.

### System Design Choices
- **Authentication**: Replit Auth for user login, internal session management for API and WebSocket interactions. Reference data endpoints (`/api/disciplines`, `/api/floors`) are public (no auth required) for better accessibility.
- **Security**: Comprehensive access control, message ownership validation, server-side channel validation, role-based access, and secure object storage access. WebSocket connections are session-authenticated.
- **Performance**: 
  - Frontend optimizations: React.memo for components, useCallback/useMemo for functions and data, lazy loading for images
  - Plans Management page optimized with memoization and pagination (30 plans per page)
  - Backend optimizations: Eliminated N+1 queries using window functions and batch fetching (improved from 2000ms to ~77ms - 96% faster)
  - Database indexes on frequently queried columns (updatedAt, disciplineId, floorId, drawingId)
  - Efficient database queries with Drizzle ORM
  - Client-side PDF rendering with pdfjs-dist
  - PDF viewer improvements: 30-second timeout with retry logic (2 attempts), progress indicator, proper resource cleanup with loadingTask.destroy() to prevent memory leaks
- **Error Handling**: Global ErrorBoundary component wraps the entire app, loading states for all data fetches, proper error messages for failed API calls
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
- **Google Gemini 2.5 Pro**: AI analysis for extracting metadata from engineering drawings.
- **pdf-parse**: PDF text extraction.
- **pdfjs-dist**: Client-side PDF rendering library. Worker bundled via Vite using `?url` import to avoid CDN dependencies.