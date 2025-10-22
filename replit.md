# Workspace - Slack Clone PWA

## Overview
A modern Slack clone built as a Progressive Web App (PWA) with real-time messaging, channels, direct messages, and user presence tracking. This project also incorporates an Engineering Drawings Management System for technical document control in construction/engineering, including version control, approval workflows, and a Sheet Viewer. The platform aims to provide a comprehensive collaboration and document management solution.

## Recent Updates
**October 22, 2025 - Phase 5: Multi-Page PDF Processing & Hybrid AI Analysis (In Progress)**
- ✅ **Multi-Page PDF Support**: Complete pipeline for processing PDFs with multiple pages
  - `convertPDFPagesToImages()` processes ALL pages (not just first page)
  - Each page converted to PNG at 300 DPI with metadata
  - Original PDF saved alongside individual page images
  - Database schema: `drawing_pages` table with page-specific data
- ✅ **PDF Text Extraction Service**: Hybrid approach combining text + vision AI
  - Service: `server/services/pdfTextExtractor.ts` using pdf-parse library
  - Extracts: sheet numbers (A-101, S-202), room names, dimensions, notes
  - Metadata extraction: Arabic/English room keywords, measurement patterns
  - Complements Gemini Vision AI analysis for maximum accuracy
- ✅ **Enhanced Upload Endpoint**: POST `/api/drawings/:id/upload`
  - Step 1: Extract text from entire PDF (all pages)
  - Step 2: Convert all pages to PNG images
  - Step 3: Upload original PDF with signed URL
  - Step 4: Process each page individually (upload image + AI analysis)
  - Creates drawing_pages records for each page with extracted metadata
  - Returns page count and extracted text metadata
- ✅ **Drawing Pages API Endpoints**:
  - GET `/api/revisions/:id/pages` - Fetch all pages for a revision
  - GET `/api/pages/:id` - Fetch single page details
  - Storage methods: createDrawingPage, getRevisionPages, getDrawingPage
- 📝 **Next**: Update Upload Modal UI to show pages, Sheet Viewer sidebar for page navigation

**October 22, 2025 - Phase 4: PDF Support & Signed URLs (Completed)**
- ✅ **PDF File Support**: Full PDF upload and processing pipeline
- ✅ **System Dependencies**: Installed canvas rendering libraries
- ✅ **Signed URLs for Object Storage**: Enhanced security (7-day expiration)
- ✅ **API Schema Alignment**: Fixed sheetNo/drawingNo mismatch
- ✅ **Plans Management Page**: Browser-tested and functional

**October 21, 2025 - Phase 3: AI Integration & Real Backend (Completed)**
- ✅ **Google Gemini 2.5 Pro Integration**: Complete AI analysis service for engineering drawings
  - Extracts title block info (sheet no, revision, discipline, etc.)
  - Identifies layers, dimensions, elements (walls, doors, windows)
  - Extracts annotations and generates technical summary
  - Structured JSON schema with confidence scores
- ✅ **Database Schema Enhanced**: Added `thumbnailUrl` and `aiExtractedData` (JSONB) to drawing_revisions
- ✅ **File Upload Endpoint**: POST `/api/drawings/:id/upload`
  - Uploads to Replit Object Storage with proper path parsing
  - Supports both PDF and image formats (PNG/JPG)
  - Performs AI analysis via Gemini Vision API
  - Creates drawing revision with extracted metadata
  - Graceful fallback if AI analysis fails
- ✅ **Sheet Viewer Backend Integration**:
  - Fetches real drawing data from `/api/drawings/:id`
  - Loads latest revision with file URL
  - Displays real images from Object Storage
  - Resolves discipline/floor names from lookup dictionaries
  - Shows saved pins and layers from database
- 🔐 **Security**: GEMINI_API_KEY managed via Replit Secrets

**October 21, 2025 - Phase 2: Pins/Tickets System & Drawing Tools**
- ✅ Database Schemas: `pins`, `tickets`, `layers` tables
- ✅ API Endpoints: Full CRUD for pins, tickets, layers
- ✅ Pin Tool: Crosshair cursor, confirm/cancel placement
- ✅ Create Ticket Modal: 7 construction ticket types (RFI, Issue, Clash, etc.)
- ✅ Layers Panel: Grouped by disciplines with pin counts
- ✅ Drawing Tools UI: Pen, Line, Rectangle, Circle, Text, Eraser (Pen tool functional)
- ✅ Save Layer: POST `/api/layers` with cache invalidation

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