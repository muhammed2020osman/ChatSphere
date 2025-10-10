# Slack Clone PWA Design Guidelines

## Design Approach: Reference-Based (Slack)

**Primary Reference**: Slack's workspace interface
**Justification**: User explicitly requested Slack clone; prioritize familiar patterns for productivity tool users who expect Slack-like experience

**Key Principles**:
- Instant recognizability through Slack's visual language
- Information density without clutter
- Real-time feedback and seamless interactions
- Professional yet approachable aesthetic

## Color Palette

**Dark Mode (Primary)**:
- Background layers: 18 15% 11% (deepest), 18 15% 15% (sidebar), 18 12% 18% (main)
- Primary brand: 282 83% 58% (aubergine/plum)
- Text primary: 0 0% 98%
- Text secondary: 0 0% 75%
- Interactive hover: 0 0% 25%
- Active channel: 217 91% 60% (sky blue)
- Success: 142 71% 45%
- Mention/alert: 25 95% 53% (warm orange)

**Light Mode**:
- Background: 0 0% 100% (white), 240 20% 97% (subtle gray)
- Primary brand: 282 83% 58%
- Text primary: 0 0% 13%
- Borders: 0 0% 88%

## Typography

**Font Stack**: 
- Primary: 'Lato', 'Helvetica Neue', sans-serif (via Google Fonts)
- Monospace: 'Monaco', 'Menlo', monospace (for code blocks)

**Hierarchy**:
- Channel names: 15px, font-semibold
- Message text: 15px, font-normal, leading-relaxed
- Timestamps: 12px, font-normal, text-secondary
- User names: 15px, font-semibold
- Section headers: 13px, font-semibold, uppercase, tracking-wide

## Layout System

**Three-Column Architecture**:
1. **Workspace Sidebar** (w-64): Workspace switcher, channels, DMs
2. **Channel/Thread List** (w-80, conditional): Thread sidebar when active
3. **Main Content** (flex-1): Message feed and composer

**Spacing Units**: Tailwind utilities - primarily 2, 3, 4, 6, 8 for consistent rhythm

**Breakpoints**:
- Mobile (<768px): Single column, collapsible sidebar
- Tablet (768px-1024px): Two columns
- Desktop (>1024px): Full three-column layout

## Component Library

### Navigation & Sidebar
- **Workspace Header**: Logo, workspace name, dropdown (h-12)
- **Channel List**: Grouped sections (Channels, Direct Messages), collapsible headers
- **Channel Items**: 32px height, hover bg-emphasis, bold when unread, blue dot for mentions
- **Create Channel Button**: Prominent + icon with "Add channel" text

### Message Feed
- **Message Container**: Grouped by user and time, 8px vertical padding
- **Message Structure**: 40px avatar (left), content (flex-1), timestamp (hover reveal actions)
- **Hover Actions**: Emoji react, reply thread, bookmark, more menu (absolute right)
- **Thread Indicator**: "X replies" link with blue accent, last reply time
- **Mentions**: Yellow/orange highlight background, @username in bold

### Message Composer
- **Input Area**: Fixed bottom, min-h-20, expandable textarea
- **Toolbar**: Format buttons (B, I, strikethrough), attachments, emoji, @mention
- **Rich Text**: Inline code (`text`), code blocks, bulleted lists
- **Send Button**: Primary brand color, bottom-right position

### Status & Presence
- **Online Indicator**: 10px green dot, positioned bottom-right of avatar
- **Away/Offline**: Gray dot
- **Status Text**: Below username in italics, text-sm

### Modal & Overlays
- **Channel Creation**: Center modal, w-full max-w-lg
- **User Profile**: Slide-in panel from right, w-96
- **Search Overlay**: Full-width dropdown from top navigation

## Interaction Patterns

**Real-time Updates**:
- New messages: Smooth append with subtle fade-in
- Typing indicators: "User is typing..." with animated dots
- Unread badges: Red dot with count on channels

**Keyboard Shortcuts**:
- Cmd/Ctrl + K: Quick switcher
- ↑/↓: Navigate channels
- Enter: Focus message composer

**Animations**: Minimal and purposeful only
- Channel switching: Instant, no transition
- Sidebar toggle: 200ms ease slide
- Message reactions: Scale bounce on add

## PWA Specific Elements

**Install Prompt**: Subtle banner at top, dismissible
**Offline Indicator**: Yellow banner when disconnected
**Service Worker**: Cache last viewed channels and messages

## Images

**Profile Avatars**: 
- Sizes: 40px (messages), 32px (sidebar), 80px (profiles)
- Fallback: Initials on colored background using primary brand hues
- Placement: Left-aligned in messages, consistent throughout

**File Attachments**:
- Image previews: Max 400px width, rounded corners, clickable lightbox
- Document icons: 48px generic file type icons

**No hero images** - This is a utility application focused on productivity and communication, not marketing.