# Workspace - Slack Clone PWA

## Overview
A modern Slack clone built as a Progressive Web App (PWA) with real-time messaging, channels, direct messages, and user presence tracking. This project also incorporates an Engineering Drawings Management System for technical document control in construction/engineering, including version control, approval workflows, and a Sheet Viewer. The platform aims to provide a comprehensive collaboration and document management solution.

## Recent Updates
**October 23, 2025 - Phase 8: Object Storage Signed URL Fix (Completed)**
- ✅ **Fixed "Cannot sign data without client_email" Error**: Complete solution
  - Root cause: Using Google Cloud Storage's `blob.getSignedUrl()` directly
  - Replit Object Storage requires Sidecar API for signing URLs
  - Exported `signObjectURL()` function from `server/objectStorage.ts`
  - Replaced all 3 instances of `blob.getSignedUrl()` in upload endpoint:
    - PDF file signing (line 1196)
    - Page images signing (line 1228)
    - Thumbnail signing (line 1306)
  - New pattern: `signObjectURL({ bucketName, objectName, method: "GET", ttlSec: 7*24*60*60 })`
  - Uses Replit Sidecar endpoint: `http://127.0.0.1:1106/object-storage/signed-object-url`
  - All signed URLs now have 7-day expiration (604,800 seconds)
- ✅ **PDF Text Extractor v2 API Migration**: Fixed pdf-parse integration
  - Migrated from v1 function-based to v2 class-based API
  - Pattern: `new PDFParse({ data: buffer })` → `await parser.getText()` → `await parser.getInfo()`
  - Fixed metadata extraction: `infoResult.info` contains PDF metadata
  - Fixed page count: `result.pages.length`

**October 22, 2025 - Phase 7: Revision Number Auto-Generation (Completed)**
- ✅ **Fixed "Revision number is required" Error**: Auto-generates revision numbers
  - Frontend doesn't send revisionNo → Backend generates it automatically
  - Pattern: `R1_a1b2c3d4` (counter + UUID for uniqueness)
  - Prevents race conditions even with concurrent uploads
  - Uses `randomUUID()` from Node.js crypto module

**October 22, 2025 - Phase 6: Upload Flow Fixes & AI Display Enhancement (Completed)**
- ✅ **Fixed Duplicate Drawing Bug**: Complete solution for duplicate prevention
  - Added `createdDrawingId` state tracking (frontend session-level)
  - Added `getDrawingBySheetNo()` storage method (backend database-level)
  - Backend now checks for existing drawing before creation:
    - If exists without revisions (draft) → reuses it
    - If exists with revisions → returns 409 error with clear message
    - If doesn't exist → creates new one
  - Cleaned database from orphaned draft drawings
  - No more "duplicate key" errors!
- ✅ **Enhanced Upload Response**: Complete AI analysis data in response
  - Returns: `drawingId`, `revisionId`, `pageCount`, `extractedText`, `aiAnalysis`
  - AI analysis includes: title, titleBlock (discipline, floor), elements, dimensions, summary
  - PDF text extraction separate: sheet numbers, room names, dimensions
- ✅ **Improved Success Screen**: Beautiful display of extracted data
  - **AI Analysis Section**: Shows summary, discipline, floor, sheet number, title, detected elements
  - **PDF Text Extraction Section**: Shows extracted sheet numbers and room names
  - **Visual Elements Display**: Cards showing building elements with quantities
  - Clean separation between AI-detected and text-extracted data
- ✅ **Fixed API Request Function**: Corrected `apiRequest` signature
  - Changed from `(method, url, data)` to `(url, options)` pattern
  - Handles empty responses (204/205) safely
  - Updated 11 files across the codebase

**October 22, 2025 - Phase 5: Multi-Page PDF Processing & Hybrid AI Analysis (Completed)**
- ✅ **Multi-Page PDF Support**: Complete end-to-end pipeline
- ✅ **PDF Text Extraction Service**: Hybrid AI approach
- ✅ **Enhanced Upload Endpoint**: Complete workflow
- ✅ **Drawing Pages API Endpoints**: Full CRUD operations
- ✅ **Upload Modal - Real API Integration**: Live data display
- ✅ **Sheet Viewer - Page Navigation**: Multi-page support

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