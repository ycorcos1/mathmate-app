## 2025-11-03 — PR #0 / Documentation Setup

**Goal:**
Establish core documentation artifacts (README, AI Log) prior to engineering work.

**Actions Taken:**

- Authored `README.md` covering overview, setup sequence, tech stack, structure, prompt guidance, example walkthroughs, contributing expectations, and licensing notes.
- Initialized `docs/AI_Log.md` with the agreed template and recorded the first entry.
- Linked the new AI Log from the README to complete the documentation set.

**Decisions & Insights:**

- Captured the final system prompt verbatim to anchor future prompt tuning efforts.
- Highlighted screenshot requirements for example walkthroughs to inform future documentation updates.

**Next Steps:**

- Populate prompt evaluation artifacts in `/docs/prompts` during PR #5.
- Expand the AI Log with substantive reasoning notes as major PRs progress.

## 2025-11-04 — PR #1 / Environment & Boilerplate Setup

**Goal:**
Create the foundational React/Firebase app scaffold with styling, routing, linting, and context plumbing.

**Actions Taken:**

- Bootstrapped a Vite + React + TypeScript workspace with scripts, tsconfig, and dependency manifest.
- Layered Tailwind CSS tokens that mirror the “Soft Academic” design system and imported project fonts globally.
- Initialized Firebase (Auth, Firestore, Storage) with runtime env validation and exported typed helpers.
- Authored Firestore and Storage security rules plus `firebase.json` emulator wiring for local testing.
- Implemented `AuthContext` (React) and Zustand-backed `SessionContext`/`UIContext`, then wrapped the app shell with providers.
- Established baseline routing, protected Tutor/Profile routes, and placeholder pages to align with later PRs.

**Decisions & Insights:**

- Selected Vite to align with the documented `src/` structure while keeping fast local DX.
- Added environment sanity checks to fail fast if Firebase secrets are missing, preventing silent misconfig.
- Stubbed chat/workspace UI with clear placeholders so later integrations can focus on data flow.

**Next Steps:**

- Wire Firebase Auth persistence and Firestore writes as part of PR #2.
- Connect chat, session autosave, and OpenAI hooks in PRs #4-5.
- Backfill automated rule tests via the Firebase emulator once the data layer is implemented.

## 2025-11-04 — Navigation & Dashboard UX Refinement

**Goal:**
Define and execute the navigation restructuring plan while scaffolding the dashboard and settings experiences requested for upcoming PRs.

**Actions Taken:**

- Planned distinct nav states (logged out vs. authenticated) including profile dropdown, dashboard entry point, and protected routes for new surfaces.
- Implemented the navbar update, removed the unauthenticated tutor CTA, and added `/dashboard` + `/settings` routes guarded by `ProtectedRoute`.
- Scaffolded `DashboardPage` with core stats plus placeholders for learning streak, progress chart, and achievement badges pending Firestore integrations.
- Built `SettingsPage` covering password changes and account deletion with Firebase reauthentication hooks and noted TODOs for cascade cleanup in PR #3.

**Decisions & Insights:**

- Kept dashboard metrics and streaks as mocked data until PR #2 wires Firestore session storage.
- Added guarded dropdown logic with click-outside handling to keep the header accessible and predictable.
- Required password re-entry for destructive actions to align with Firebase’s reauthentication constraints.

**Next Steps:**

- Connect dashboard metrics and session lists to Firestore once persistence lands in PR #2/#8.
- Implement full cascade deletion (Firestore + Storage) during PR #3 before exposing the action broadly.
- Replace mocked streak/chart/badge data with live analytics post session dataset availability.

## 2025-11-04 — PR #2 / Authentication System

**Goal:**
Deliver production-ready Firebase email/password authentication with guarded routing, first-login persistence, and user-facing recovery flows.

**Actions Taken:**

- Extended `AuthContext` to await Firebase auth state, atomically create `/users/{uid}` records, seed a placeholder `progress` subcollection, and refresh `lastLoginAt` timestamps on every session.
- Introduced a `PublicRoute` component and tightened router wiring so `/dashboard`, `/tutor`, `/profile`, and `/settings` are protected while `/login`, `/signup`, and the renamed `/forgot-password` route redirect authenticated visitors to `/tutor`.
- Rebuilt the login, signup, and forgot-password forms with client-side validation, nuanced Firebase error messaging, loading guards, and accessible inline feedback.
- Ran ESLint fixes (including Tailwind class ordering) to keep the workspace clean after the auth refactor.

**Decisions & Insights:**

- Used a Firestore `writeBatch` so the profile document and `progress/__init__` stub land together, preventing mismatched state if the app reads before writes settle.
- Chose to require an 8-character minimum password client-side, aligning with the mastery roadmap’s security posture and reducing weak Firebase credential errors.
- Held the auth context in a loading state until Firestore sync completes, eliminating race conditions between route guards and first-time profile creation.

**Next Steps:**

- Wire profile editing and settings management (PR #3) to the new `/users/{uid}` schema.
- Add integration tests around auth flows once the Firebase emulator harness is in place.
- Backfill onboarding copy with links to password hygiene guidance before launch.

## 2025-11-04 — PR #3 / Profile & Settings

**Goal:**
Implement user profile management with display name editing, voice mode toggle, and complete account deletion with cascade cleanup of Firestore data.

**Actions Taken:**

- Created `useUserDoc()` hook to subscribe to `/users/{uid}` Firestore document with real-time updates, loading states, and error handling.
- Built comprehensive Profile page (`/profile`) with:
  - Editable display name field that syncs to both Firestore and Firebase Auth profile
  - Voice mode toggle for future speech-assisted tutoring features
  - Live updates via Firestore snapshot subscription
- Enhanced Settings page (`/settings`) with:
  - Password change functionality requiring current password reauthentication
  - Complete account deletion with full cascade cleanup:
    - Deletes all documents in `/users/{uid}/progress` subcollection
    - Deletes all documents in `/users/{uid}/sessions` subcollection
    - Deletes the main `/users/{uid}` document
    - Deletes the Firebase Auth user
  - Step-by-step progress indicators during deletion
- Fixed navigation dropdown z-index layering to prevent transparency and overlap issues.
- Added auth loading state check in AppLayout to prevent showing logged-out navigation during Firebase auth restoration on page reload.
- Removed theme selector functionality (dark mode feature) as per requirements.
- Moved account deletion from Profile page to Settings page for better UX separation.

**Decisions & Insights:**

- Used Firestore `onSnapshot` for real-time profile updates, ensuring UI stays in sync with Firestore changes across tabs/devices.
- Implemented batch deletion with 450-document batching to handle Firestore's 500-operation limit per batch, supporting users with large session histories.
- Separated display name updates to both Firestore and Firebase Auth profile to ensure consistency across the app and Auth provider.
- Added proper error handling for `auth/requires-recent-login` errors during account deletion, prompting users to re-authenticate.
- Used `useUserDoc` hook pattern for reusable subscription logic that can be extended to other user-related data in future PRs.
- Removed theme selector entirely (not just dark mode) to simplify the UI and focus on core functionality.
- Placed account deletion in Settings page alongside password management for better logical grouping of security-related actions.

**Next Steps:**

- Implement session persistence (PR #8) to populate the sessions subcollection that deletion now cleans.
- Add voice mode implementation in future PRs when speech-assisted tutoring is ready.
- Consider adding profile picture upload functionality in future iterations.
- Add analytics tracking for profile updates and account deletions for product insights.

## 2025-11-04 — PR #4 / Chat Interface & AI Integration

**Goal:**
Build the conversational tutoring interface with AI integration, Firestore persistence, and KaTeX rendering for math output.

**Actions Taken:**

- Updated `SessionContext` to support role-based messages (`user` | `assistant`) with `topicId` metadata and `createdAt` timestamps for future mastery tracking.
- Created Firebase Cloud Function `generateResponse` (HTTPS) in `/functions/src/index.ts`:
  - Integrated OpenAI API with Socratic tutoring system prompt
  - Configured CORS for client access
  - Implemented request validation and error handling
  - Set temperature to 0.3 for consistent, focused responses
- Built client API utility (`src/api/generateResponse.ts`) to call the Cloud Function with message arrays.
- Implemented `MathText` component for KaTeX rendering of inline (`$...$`) and block (`$$...$$`) math expressions.
- Rebuilt `/tutor` page with:
  - Split layout: Chat on left (7 columns), Workspace/Sessions on right (5 columns)
  - Firestore session persistence: auto-creates sessions on first visit, stores messages under `/users/{uid}/sessions/{sid}/messages/{mid}`
  - Real-time message synchronization via Firestore snapshots
  - Chat input with Enter-to-send and Shift+Enter for newlines
  - Auto-scroll to latest messages
  - Session list with selection and last updated timestamps
  - Workspace placeholder for future PR #7 features (Frontier/Review tabs)
- Fixed layout alignment: Chat on left, Workspace on right (per design spec).
- Made chat expand to full width (12 columns) when workspace is hidden/collapsed.
- Fixed linter errors:
  - Tailwind CSS shorthand warning (`px-4 py-4` → `p-4`)
  - Created `.eslintignore` to exclude `functions` directory (separate project with its own dependencies)

**Decisions & Insights:**

- Used Cloud Functions instead of client-side OpenAI calls to keep API keys secure and avoid client-side exposure.
- Chose to store messages with `role`, `content`, `topicId`, and `createdAt` fields to align with future mastery tracking requirements (PR #14-17).
- Implemented session auto-creation on first visit to ensure users always have an active session, improving UX.
- Used Firestore real-time listeners (`onSnapshot`) for both sessions and messages to keep UI in sync across tabs/devices.
- Designed message structure to support future topic tagging without breaking existing functionality.
- Made chat responsive to workspace collapse state for better use of screen real estate.
- Separated Cloud Functions into its own directory with its own `package.json` and TypeScript config for proper dependency management.

**Next Steps:**

- Implement OCR/image input (PR #6) to enable problem uploads.
- Add streaming responses (PR #9) for better UX during long AI responses.
- Enhance Socratic prompting logic (PR #5) for better guidance and evaluation.
- Build workspace visualization (PR #7) to show step-by-step reasoning and hints.
- Implement session persistence expansion (PR #8) with completion state and stats tracking.

## 2025-11-04 — PR #5 / Socratic Prompt & Evaluation Logic

**Goal:**
Add reasoning structure to AI interactions so MathMate behaves like a true tutor—guiding users step by step rather than just giving answers.

**Actions Taken:**

- Enhanced Firebase Cloud Function `generateResponse` with a Socratic prompt template:
  - Updated system prompt to require JSON-structured responses with `content` and `stepType` metadata
  - Added `mode` parameter (`default` | `hint`) to control response style
  - Implemented `stepType` classification: `hint` (gentle nudge), `check` (follow-up question), `final` (summary after completion)
  - Configured OpenAI API with `response_format: { type: 'json_object' }` to enforce structured output
  - Added mode-specific directives to guide the AI's behavior (standard guidance vs. hint-only mode)
- Updated client API (`src/api/generateResponse.ts`):
  - Extended `callGenerateResponse` to accept `mode` parameter and return `GenerateResponseResult` with `content` and optional `stepType`
  - Added TypeScript types: `SocraticStepType`, `GenerateResponseMode`, `GenerateResponseResult`
- Extended `SessionContext` to include `stepType` field in `SessionMessage` interface
- Implemented client-side evaluation logic:
  - Created `evaluateStudentInput` function with pattern matching for correctness signals
  - Added numeric evaluation for simple arithmetic problems
  - Detects confusion signals ("I don't know", "stuck", etc.) and positive signals ("therefore", "equals", "x =", etc.)
  - Stores evaluation results in Firestore under `/users/{uid}/sessions/{sid}/evaluations/{eid}` with `messageId`, `result`, and `timestamp`
- Added evaluation feedback UI:
  - Created `evaluationFeedback` mapping with user-friendly messages and color-coded feedback
  - Displays evaluation results beneath each message in chat bubbles
  - Shows step type labels (Hint, Check-in, Summary) for assistant messages
- Implemented hint request flow:
  - Added "Hint" button in chat input footer
  - `handleRequestHint` function sends hint request to AI with `mode: 'hint'`
  - Automatically logs hint usage when AI responds with `stepType: 'hint'`
  - Hint requests skip evaluation to avoid false feedback
- Added real-time evaluation subscription:
  - Subscribes to `/users/{uid}/sessions/{sid}/evaluations` collection
  - Syncs evaluation results with messages for immediate feedback display
- Fixed Firebase Admin import issues:
  - Replaced `admin.apps.length` with `getApps().length` and `admin.initializeApp()` with `initializeApp()` from `firebase-admin/app`
  - Resolved ESLint namespace import errors

**Decisions & Insights:**

- Used JSON-structured responses from OpenAI to ensure consistent metadata extraction and better control over AI behavior.
- Chose lightweight pattern matching for evaluation rather than complex NLP to keep the system fast and predictable, with clear fallbacks for edge cases.
- Stored evaluations in a separate collection linked by `messageId` to maintain clean separation between message content and feedback data.
- Implemented hint logging at the assistant message level (when `stepType === 'hint'`) rather than user request level, ensuring accurate tracking of when hints are actually provided.
- Added `skipEvaluation` flag for hint requests to prevent false "incorrect" feedback when users are asking for help rather than submitting answers.
- Used mode-based prompting to give the AI clear context about when to provide hints vs. standard guidance, improving response quality.
- Fixed Firebase Admin v12+ API changes by using the new modular import pattern (`getApps`, `initializeApp` from `firebase-admin/app`).

**Next Steps:**

- Deploy updated Cloud Function to production (`firebase deploy --only functions`).
- Test Socratic prompting with various problem types to validate guidance quality.
- Refine evaluation patterns based on real user interactions (PR #9+).
- Consider adding more sophisticated evaluation logic for complex problems in future iterations.
- Implement mastery tracking integration (PR #14+) that will use evaluation results for progress calculation.

## 2025-11-04 — PR #6 / OCR / Image Input

**Goal:**
Implement image upload functionality with OCR background processing, Vision API integration, and improved equation rendering for better readability.

**Actions Taken:**

- Added `tesseract.js` dependency for client-side OCR processing (background logging only).
- Updated `SessionMessage` and `ChatMessagePayload` types to include optional `imageUrl` field.
- Enhanced Cloud Function (`functions/src/index.ts`) to support OpenAI Vision API:
  - Added image URL detection and formatting for Vision API message format
  - Implemented automatic model switching: `gpt-4o` for images, `gpt-4o-mini` for text-only
  - Strengthened system prompt with image-specific Socratic guidance
  - Added explicit instructions to prevent direct problem solving when images are present
- Implemented image upload flow in `/tutor` page:
  - Added `pendingImageUrl` and `pendingImageFile` state for preview before sending
  - Modified `handleFileChange` to upload to Firebase Storage and show preview (not auto-send)
  - Updated `handleSubmit` to include pending image when sending message
  - Added background OCR function (`runOcrInBackground`) that logs to Firestore after sending
  - Created image preview UI in input area with thumbnail and remove button
  - Updated Send button validation to allow sending with image even if no text
- Enhanced `MathText` component to support LaTeX formats:
  - Added support for `\[...\]` and `\(...\)` formats (in addition to `$$...$$` and `$...$`)
  - Improved block equation styling: white background, subtle border, shadow, centered alignment
  - Increased font sizes (1.1em inline, 1.2em block) for better readability
  - Added custom CSS for improved spacing between operators and numbers
- Updated Firebase Storage rules to allow public read access for uploaded images (required for Vision API).
- Fixed scroll-to-bottom behavior:
  - Added `activeSessionId` dependency to scroll effect
  - Added `onLoad` handler to images to re-scroll when images finish loading
  - Ensures messages scroll to bottom when navigating to tutor page or switching sessions

**Decisions & Insights:**

- Used client-side Tesseract.js for OCR instead of Cloud Function to reduce latency and costs, running OCR in background after message is sent (doesn't block UI).
- Implemented image preview pattern (user must click Send) instead of auto-sending to give users control and allow text input alongside images.
- Chose Firebase Storage signed URLs (`getDownloadURL()`) which should be publicly accessible, but updated Storage rules to allow public read as a fallback for Vision API access.
- Strengthened system prompt significantly for image messages because Vision API models (gpt-4o) were more likely to solve problems directly without explicit guidance.
- Updated equation rendering to improve readability: larger fonts, better spacing, and card-style presentation for block equations make math easier to read.
- Added comprehensive logging to debug Vision API flow: logs image URLs, model selection, and message formatting.
- Fixed scroll-to-bottom edge cases: images loading asynchronously can change container height, so added `onLoad` handler to re-scroll when images finish loading.

**Next Steps:**

- Deploy updated Cloud Function and Storage rules to production.
- Test Vision API integration with various math problem images to validate Socratic guidance quality.
- Monitor OCR accuracy and confidence scores in Firestore logs to identify improvements.
- Consider adding image preprocessing (crop, enhance) before OCR if accuracy is low.
- Add image compression/optimization before upload to reduce Storage costs and improve upload speed.

## 2025-11-04 — PR #7 / Workspace Panel

**Goal:**
Implement a tabbed workspace panel that provides session navigation, displays current topic and session statistics, and includes placeholder tabs for future mastery tracking features (Frontier and Review).

**Note:** The workspace panel was later removed in PR #9. Session management was moved to the dashboard page to simplify the Tutor interface.

**Actions Taken:**

- Enhanced `UIContext` (`src/context/UIContext.tsx`):
  - Added `WorkspaceTab` type union ('sessions' | 'frontier' | 'review')
  - Added `workspaceTab` state and `setWorkspaceTab` action to manage active tab
- Extended `SessionSummary` type in `Tutor.tsx`:
  - Added `title`, `topicId`, and `stats` fields to support enhanced session metadata
  - Updated Firestore query to fetch and normalize extended session data
- Implemented tabbed workspace interface:
  - Added three tabs: Sessions, Frontier, Review with navigation buttons
  - Created tab button styling using brand colors (Sky Blue for active, Slate Gray for inactive)
  - Added tab content areas with conditional rendering based on active tab
- Enhanced session list display:
  - Added session title display (with fallback to "Session")
  - Added topic badge display when `topicId` is present
  - Added "Active" indicator badge for currently selected session
  - Improved session card layout with better spacing and visual hierarchy
- Added session statistics panel:
  - Implemented real-time stats calculation from messages and evaluations
  - Displayed metrics: total messages, hints used, duration, and user turns
  - Added `formatDuration` utility function for human-readable time formatting
  - Stats panel appears at bottom of Sessions tab when active session exists
- Added current topic display:
  - Extracted `topicId` from active session messages or session metadata
  - Displayed in workspace header with "Topic to be assigned" fallback
  - Updates dynamically as session changes or topic is assigned
- Implemented placeholder tabs for future features:
  - Frontier tab: Shows roadmap placeholder with explanatory text about upcoming topics
  - Review tab: Shows spaced repetition placeholder with explanation of future review scheduler
  - Both tabs use centered layout with icons and descriptive content
- Added utility functions:
  - `formatDuration`: Converts milliseconds to human-readable format (e.g., "5m", "2h 30m")
  - `workspaceTabLabels`: Map of tab keys to display labels
  - `workspacePlaceholderCopy`: Placeholder content for Frontier and Review tabs
- Fixed TypeScript type issues:
  - Added `SessionRole` import and type assertion for Firestore message data
  - Used `satisfies SessionMessage` to ensure type safety

**Decisions & Insights:**

- Chose to store tab state in `UIContext` rather than component state to enable potential future cross-component access and persistence preferences.
- Implemented session stats calculation client-side from real-time data rather than storing in Firestore to avoid synchronization overhead and ensure accuracy.
- Used placeholder content for Frontier and Review tabs to set expectations for future PRs (#14–#17) while maintaining UI consistency.
- Enhanced session cards with topic badges and active indicators to improve navigation clarity and user awareness of current context.
- Displayed topic in workspace header to provide immediate context about current learning focus, even when topicId is null (shows "Topic to be assigned").
- Used `formatDuration` utility for consistent time formatting across the app, with fallback to "—" for invalid/missing durations.
- Maintained design spec compliance: used brand colors (#4C91F7 for active, #6B7280 for inactive), proper typography (Poppins for headings, Inter for body), and spacing consistent with design system.

**Next Steps:**

- Implement topic assignment system in future PRs (PR #4 or later) to populate `topicId` fields.
- Add session title auto-generation from first message or user input in PR #8.
- Implement mastery tracking engine (PR #14) to populate Frontier tab with upcoming topics.
- Implement review scheduler (PR #15) to populate Review tab with due review items.
- Consider adding session search/filter functionality as number of sessions grows.
- Add ability to delete or archive sessions in future enhancement.

## 2025-11-04 — PR #8 / Session Persistence

**Goal:**
Enable persistent session saving and retrieval with automatic stats tracking, completion state management, and topic synchronization to support future mastery tracking features.

**Actions Taken:**

- Added automatic stats synchronization to Firestore:
  - Created `useEffect` hook that syncs session stats when messages or evaluations change
  - Persists `totalTurns`, `hintsUsed`, and `durationSec` to session documents
  - Calculates duration in seconds based on current timestamp and session creation time
  - Only updates Firestore when stats values actually change to minimize writes
  - Updates `lastUpdated` timestamp alongside stats changes
- Implemented completion state tracking:
  - Added `completed` boolean field to `SessionSummary` type
  - Created `useEffect` hook that automatically marks sessions as completed when a message with `stepType: 'final'` is detected
  - Only updates completion state when it changes from false to true
  - Stores completion state in Firestore for session filtering and analytics
- Added topicId synchronization:
  - Created `useEffect` hook that syncs `topicId` to session document when it changes
  - Derives `topicId` from latest message with topicId or falls back to current session's topicId
  - Updates session document when topicId changes to support future mastery tracking
- Enhanced session document structure:
  - Extended `SessionSummary` type to include `completed?: boolean` field
  - Updated Firestore snapshot parsing to read and normalize completion state
  - Ensured all session metadata (stats, topicId, completion) persists across reloads

**Decisions & Insights:**

- Used current timestamp for duration calculation instead of `lastUpdated` to avoid infinite update loops when stats sync triggers `lastUpdated` changes.
- Implemented change detection before Firestore writes to minimize unnecessary database operations and reduce costs.
- Chose to mark sessions as completed automatically when final/summary messages are detected rather than requiring manual user action, improving UX and data accuracy.
- Synced topicId to session document level to support future mastery tracking queries and filtering by topic across all sessions.
- Separated stats, completion, and topicId sync into individual `useEffect` hooks for better maintainability and to prevent unnecessary re-renders.
- Added comprehensive error handling with console logging for Firestore update failures to aid debugging without disrupting user experience.
- Ensured all session persistence features work seamlessly with existing real-time Firestore listeners, maintaining UI sync across tabs/devices.

**Next Steps:**

- Implement session title auto-generation from first message or user input (extension of PR #8).
- Add session filtering and search functionality as number of sessions grows.
- Consider adding session archiving for completed sessions to reduce clutter.
- Implement analytics dashboard that aggregates stats across all sessions (PR #11).
- Add session export functionality for user data portability.
- Integrate session stats with mastery tracking engine (PR #14) to calculate progress.

## 2025-11-04 — PR #9 / AI Response Enhancement

**Goal:**
Improve conversational depth and rendering stability by enabling context retention, streaming long responses incrementally, and refining LaTeX rendering with error handling.

**Actions Taken:**

- Fixed session deletion bug that caused blank screen when deleting sessions:
  - Updated `handleDeleteSession` to properly handle session deletion without forcing loading states
  - Fixed subscription logic to ensure `isLoading` is always set to `false` when sessions are empty
  - Improved session state management during deletion transitions
- Phase 3: Enhanced LaTeX rendering with error handling:
  - Created `LaTeXErrorBoundary` React error boundary component to catch rendering errors
  - Added `validateLaTeX` function to check for balanced delimiters, null bytes, and empty expressions
  - Added `sanitizeLaTeX` function to clean input before rendering
  - Created `SafeBlockMath` and `SafeInlineMath` wrapper components with error boundaries
  - Added fallback UI for invalid LaTeX showing error indicator, raw LaTeX code, and error messages
- Phase 2: Implemented streaming responses:
  - Updated Firebase Cloud Function (`functions/src/index.ts`) to support Server-Sent Events (SSE):
    - Added `stream` parameter to request body
    - Implemented SSE response format with proper headers (`Content-Type: text/event-stream`)
    - Stream chunks as they arrive from OpenAI API
    - Accumulate JSON content incrementally until complete
    - Send final result with `done: true` flag
    - Maintained backward compatibility with non-streaming mode
  - Updated client API (`src/api/generateResponse.ts`):
    - Added `callGenerateResponseStream` function for streaming support
    - Implemented SSE parsing with `ReadableStream` and `TextDecoder`
    - Added chunk callback mechanism for real-time updates
    - Handled `[DONE]` event and error states
  - Updated Tutor page (`src/pages/Tutor.tsx`) for streaming UI:
    - Created temporary pending messages in local state during streaming
    - Updated message content incrementally as chunks arrive
    - Removed pending message when streaming completes
    - Integrated with `SessionContext` for real-time updates
    - Added error handling for streaming failures
- Phase 1: Improved context retention:
  - Added context size monitoring (logs when conversation exceeds 20 messages)
  - Added note for future summarization enhancement
  - All messages are included in context for full conversation history
- Removed workspace panel from Tutor page:
  - Removed all workspace-related UI components (sidebar, tabs, session list)
  - Removed workspace-related state and imports (`isWorkspaceCollapsed`, `toggleWorkspace`, `workspaceTab`, `setWorkspaceTab`)
  - Removed session management functions (`handleCreateNewSession`, `handleSelectSession`, `handleStartEditTitle`, `handleSaveTitle`, `handleDeleteSession`)
  - Removed unused state variables (`editingSessionId`, `editTitleValue`, `deleteConfirmId`, `isCreatingSession`)
  - Removed unused utility functions (`formatDate`, `formatDuration`)
  - Updated layout to full-width chat interface
  - Updated title from "Tutor Workspace" to "Tutor" with simplified description
  - Session management moved to dashboard (as per user requirement)

**Decisions & Insights:**

- Used React Error Boundaries for LaTeX rendering to prevent single LaTeX errors from crashing the entire message rendering.
- Implemented streaming using SSE (Server-Sent Events) for better UX during long AI responses, allowing users to see content appear incrementally.
- Maintained backward compatibility with non-streaming mode to ensure existing functionality continues to work.
- Used local state for pending messages during streaming to provide immediate UI feedback without blocking on Firestore writes.
- Fixed session deletion race condition by ensuring `isLoading` is always properly reset, even when session creation is already in progress.
- Removed workspace panel to simplify Tutor page and move session management to dashboard for better UX separation.
- LaTeX validation catches common errors before rendering, reducing KaTeX rendering failures.
- Streaming implementation uses callback pattern for incremental updates, providing smooth real-time experience.

**Next Steps:**

- Deploy updated Cloud Function with streaming support to production.
- Test streaming with various response lengths to ensure performance is optimal.
- Monitor context size in production to determine when summarization should be implemented.
- Consider adding more sophisticated LaTeX validation for edge cases.
- Add analytics for streaming performance and error rates.

## 2025-11-04 — PR #10 / Hints & Guided Explanations

**Goal:**
Provide AI-generated hints and guided explanations with context-aware responses, incremental hint reveals, and full explanation support.

**Actions Taken:**

- Verified hint request button implementation:
  - "Hint" button present in chat input footer (`Tutor.tsx` lines 1107-1113)
  - Button disabled during sending/uploading to prevent duplicate requests
  - Clear visual feedback with yellow border styling matching design spec
- Verified hint request flow:
  - `handleRequestHint` function (lines 892-904) sends requests with `mode: 'hint'`
  - Supports both standalone hint requests and hints with user context
  - Automatically logs hint usage when AI responds with `stepType: 'hint'`
  - Hint requests skip evaluation to avoid false feedback (`skipEvaluation: true`)
- Verified hint logging and tracking:
  - Hints logged to Firestore when `stepType === 'hint'` (lines 809-819)
  - Hint count tracked in session stats (`sessionStats.hintCount`)
  - Evaluation records stored in `/users/{uid}/sessions/{sid}/evaluations` collection
  - Real-time hint count updates via Firestore snapshot subscription
- Verified context-aware hint system:
  - Full conversation history passed to AI in message payload (lines 712-718)
  - Backend `mode: 'hint'` directive provides context-specific guidance (functions/src/index.ts line 52)
  - AI maintains full conversation context for coherent, progressive hints
  - Topic tags tracked and stored with messages for future mastery integration
- Verified guided explanation support:
  - Users can request full explanations via text input (e.g., "Can you explain this fully?")
  - `stepType: 'final'` triggers summary responses when explicitly requested (functions/src/index.ts line 45)
  - Full explanation support integrated through conversational flow
  - AI respects conversation history when providing comprehensive explanations

**Decisions & Insights:**

- Hint system works through conversational flow: Each hint request maintains full context, allowing for progressive, incremental reveals naturally through multiple hint requests rather than requiring explicit level tracking.
- Full explanations accessible via conversation: Users can request complete explanations naturally through text input, which aligns better with the Socratic tutoring approach than a dedicated button would.
- Context-aware hints leverage conversation history: The AI receives complete message history including all previous hints, allowing it to provide increasingly detailed guidance without explicit incremental hint tracking.
- Hint logging at response level ensures accuracy: Tracking hints when `stepType === 'hint'` (rather than at request level) ensures accurate metrics reflect when hints are actually provided, not just requested.
- Evaluation skip for hints prevents false feedback: `skipEvaluation: true` flag prevents hint requests from being incorrectly marked as "incorrect" responses, maintaining accurate evaluation metrics.
- Topic tag infrastructure ready for mastery: While `topicId` is tracked and stored, the full mastery integration (PR #14-17) will leverage this for targeted remediation and review scheduling.

**Next Steps:**

- Deploy hint system to production and monitor hint usage patterns.
- Test incremental hint reveals with various problem types to validate progressive guidance quality.
- Collect user feedback on hint effectiveness and adjust AI prompting if needed.
- Integrate hint data with mastery tracking system (PR #14+) for targeted remediation.
- Consider adding analytics for hint usage patterns (e.g., average hints per problem, hint effectiveness).

## 2025-11-04 — PR #11 / Analytics & Tracking

**Goal:**
Implement analytics and tracking system to aggregate user performance metrics from sessions, display real-time statistics in the dashboard, and enable session management functionality.

**Actions Taken:**

- Created statistics aggregation utilities (`src/utils/statsAggregator.ts`):
  - Implemented `aggregateStats()` to calculate total sessions, hints used, and average solve time from completed sessions
  - Created `calculateStreaks()` to compute current and longest consecutive day streaks from session dates
  - Built `generateChartData()` to generate weekly session counts for progress visualization
  - Handled edge cases (no sessions, missing data, invalid dates)
- Created formatting utilities (`src/utils/formatters.ts`):
  - Implemented `formatDuration()` to convert seconds to human-readable format (e.g., "2m 30s", "1h 15m")
  - Added `formatDate()`, `formatDateTime()`, and `formatRelativeTime()` for consistent date/time display
  - Handled null/undefined values gracefully with "—" fallback
- Created `useSessionStats` hook (`src/hooks/useSessionStats.ts`):
  - Fetches all user sessions from Firestore with real-time updates
  - Aggregates stats, streaks, and chart data using utility functions
  - Provides loading and error states for UI feedback
  - Handles empty states and missing data gracefully
- Created `useUserStatsSync` hook (`src/hooks/useUserStatsSync.ts`):
  - Automatically syncs aggregated statistics to user document in Firestore
  - Updates `sessionsCount`, `hintsUsed`, and `avgSolveSec` fields
  - Debounces updates (500ms) to avoid excessive Firestore writes
  - Only updates when stats actually change to minimize operations
- Updated Dashboard (`src/pages/Dashboard.tsx`) with real data:
  - Replaced all mock stats with real aggregated data from sessions
  - Displayed real total sessions count, hints used, and average solve time
  - Implemented real streak calculation (current and longest)
  - Added weekly progress chart with real session counts
  - Created dynamic badge system that unlocks based on actual achievements
  - Added "Recent Sessions" section with real session data
  - Implemented loading states with skeleton loaders
  - Added error handling with user-friendly messages
- Implemented session management features:
  - Added rename functionality with inline editing (Enter to save, Escape to cancel)
  - Implemented delete functionality with confirmation modal
  - Added "Rename" and "Delete" text buttons on each session card
  - Removed "Manage Sessions" button and modal (simplified UX)
  - Removed arrow icons from session cards
  - Replaced emoji icons (✏️, 🗑️) with text buttons for better accessibility
  - Made action buttons always visible (removed hover-only visibility)
- Enhanced session status indicators:
  - Replaced "In Progress" indicators with single "Active" indicator
  - "Active" badge shows only on the most recently used session (the one opened by "Continue Last Session")
  - "Active" indicator only appears if session is not completed
  - Kept "Completed" badges for finished sessions
  - Removed status indicators from sessions that are neither active nor completed

**Decisions & Insights:**

- Chose to aggregate stats from completed sessions only to ensure metrics reflect finished work rather than abandoned sessions.
- Implemented streak calculation using unique dates normalized to start of day to handle multiple sessions per day correctly.
- Used debouncing for user stats sync to prevent excessive Firestore writes when multiple sessions update simultaneously.
- Separated aggregation utilities from React hooks for better testability and reusability.
- Removed "Manage Sessions" modal to simplify UX - users can manage sessions directly from the Recent Sessions section.
- Replaced emoji icons with text buttons for better accessibility and clearer interaction affordances.
- Made action buttons always visible rather than hover-only to improve discoverability, especially on touch devices.
- Used "Active" indicator instead of "In Progress" to clearly distinguish the most recent session from other incomplete sessions.
- Chart scaling uses percentage-based height with minimum 5% visibility to ensure small values are still visible.
- Formatting utilities handle edge cases gracefully, returning "—" for invalid data to maintain UI consistency.

**Next Steps:**

- Monitor stats aggregation performance as number of sessions grows (consider pagination if needed).
- Add session filtering and search functionality as number of sessions increases.
- Consider adding session export functionality for user data portability.
- Integrate session stats with mastery tracking engine (PR #14) to calculate progress.
- Add analytics for session duration patterns and hint usage effectiveness.
- Consider adding session archiving for completed sessions to reduce clutter.

## 2025-01-XX — PR #12 / AI Question Generation

**Goal:**
Implement AI-powered question generation that creates diverse, contextually appropriate math problems based on topic selection and difficulty level.

**Actions Taken:**

- Created Firebase Cloud Function `generateProblem` (HTTPS) in `/functions/src/index.ts`:
  - Integrated OpenAI API with GPT-4o-mini for question generation
  - Implemented topic-specific guidance system with predefined topic prompts and subtopics
  - Added difficulty-based guidance (beginner, intermediate, advanced)
  - Configured CORS for client access
  - Implemented request validation and error handling
  - Set temperature to 0.85 for variety while maintaining quality
  - Added diversity checking to prevent duplicate problems
- Built client API utility (`src/api/generateProblem.ts`) to call the Cloud Function.
- Created problem types and utilities (`src/types/problem.ts`, `src/utils/problemGenerator.ts`):
  - Defined `ProblemTopic`, `ProblemDifficulty`, and `GeneratedProblem` types
  - Implemented `PROBLEM_TOPICS` array with 9 major math topics
  - Created `DIFFICULTY_OPTIONS` with descriptions for each level
  - Added `generateProblem` function that calls the Cloud Function
  - Implemented topic normalization and sanitization
- Integrated question generation into Tutor page:
  - Added topic and difficulty selectors to problem generation form
  - Implemented problem diversity tracking using recent problems list
  - Added automatic problem generation on topic/difficulty selection
  - Enhanced problem text post-processing:
    - Fixed angle formatting (e.g., "60 exto" → "60°")
    - Fixed missing spaces between words (e.g., "andshehas" → "and she has")
    - Fixed currency detection and dollar sign formatting
    - Fixed word splitting issues (e.g., "organizing" not split as "or ganizing")
- Implemented problem diversity enforcement:
  - Checks for 3 identical problems in a row
  - Checks for 6 identical problems in last 10
  - Provides diversity warnings in prompt to encourage variety
  - Uses recent problems list to avoid repetition

**Decisions & Insights:**

- Used OpenAI GPT-4o-mini for question generation to balance quality and cost-effectiveness.
- Implemented topic-specific guidance system with predefined prompts and subtopics to ensure contextually appropriate problems.
- Chose temperature of 0.85 to provide variety while maintaining problem quality and avoiding excessive randomness.
- Added diversity checking to prevent repetitive problems, improving user experience and learning value.
- Implemented comprehensive post-processing to fix common formatting issues (angles, spacing, currency, word splitting) that occur in AI-generated text.
- Separated topic guidance into predefined prompts rather than dynamically generating, ensuring consistency and reliability.
- Used Firestore to track recent problems for diversity checking, enabling cross-session problem variety.

**Next Steps:**

- Deploy `generateProblem` Cloud Function to production.
- Monitor problem quality and diversity in production to refine prompts.
- Add more topic-specific subtopics as needed for greater variety.
- Consider adding user feedback mechanism for problem quality.
- Implement problem difficulty calibration based on user performance.
- Add support for multi-part problems in future iterations.

## 2025-01-XX — PR #13 / Quiz Mode Feature

**Goal:**
Implement a comprehensive Quiz Mode feature that allows users to take timed quizzes, receive automatic evaluation, and review incorrect answers with AI-powered tutoring.

**Actions Taken:**

- Created Quiz page (`src/pages/Quiz.tsx`) with three phases:
  - **Setup Phase**: Topic selection, difficulty selection, and question count configuration
  - **Taking Phase**: Question interface with answer input, navigation between questions, and "Finish Quiz" button on last question
  - **Review Phase**: Quiz summary with score, incorrect questions list, and AI-powered review for each incorrect answer
- Implemented parallel question generation for faster loading:
  - Uses `Promise.all()` to generate all questions simultaneously
  - Significantly reduced quiz loading time compared to sequential generation
- Created Firebase Cloud Function `evaluateQuizAnswer` (HTTPS) in `/functions/src/index.ts`:
  - Integrated OpenAI API with GPT-4o-mini for answer evaluation
  - Implemented structured evaluation with `isCorrect`, `correctAnswer`, `explanation`, and `feedback` fields
  - Added fallback numerical validation to override OpenAI's judgment if numerical answers match
  - Configured CORS for client access
  - Set temperature to 0.1 for consistent, deterministic evaluation
- Created quiz evaluation API (`src/api/evaluateQuizAnswer.ts`) to call the Cloud Function.
- Implemented quiz statistics aggregation:
  - Created `quizStatsAggregator.ts` utility to calculate total quizzes, average score, and recent score
  - Created `useQuizStats` hook to fetch and aggregate quiz statistics from Firestore
  - Integrated quiz statistics into Dashboard alongside session statistics
- Added quiz mode parameter to problem generation:
  - Extended `ProblemGenerationParams` type with optional `mode?: 'quiz' | 'tutor'`
  - Updated `generateProblem` Cloud Function to accept mode parameter
  - Quiz mode generates problems that only ask for final numerical answers (no equations/work required)
  - Tutor mode maintains current behavior (can encourage thinking and showing work)
- Implemented quiz data persistence:
  - Stores quiz records in `/users/{uid}/quizzes` collection
  - Stores quiz questions and responses in Firestore
  - Tracks quiz metadata (topicId, difficulty, score, timestamp)
- Added quiz review chat functionality:
  - Similar to Tutor page chat interface
  - Includes evaluation context (correct answer, explanation) in initial prompt
  - Provides AI-powered step-by-step guidance for incorrect answers
- Enhanced evaluation system:
  - Extracts final numerical answer from equations (e.g., "25-8=17" → extracts "17")
  - Compares numerical answers mathematically with tolerance for floating-point
  - Overrides OpenAI's `isCorrect` judgment if numerical answers match
  - Logs when evaluation is overridden for debugging
- Fixed currency detection issues:
  - Prevents dollar signs from appearing in quantity contexts (e.g., "has 24 pencils" not "$24 pencils")
  - Handles "buy/buys" + number + quantity words correctly
  - Improved detection of currency vs. quantity contexts
- Fixed word splitting issues:
  - Prevents words like "organizing" from being split as "or ganizing"
  - Fixes concatenated words like "fictionbooksand9" → "fiction books and 9"
  - Removes markdown asterisks from concatenated words

**Decisions & Insights:**

- Used parallel question generation (`Promise.all()`) to significantly reduce quiz loading time from sequential to parallel execution.
- Implemented fallback numerical validation to ensure correct answers aren't marked wrong due to OpenAI inconsistencies, providing a safety net for evaluation accuracy.
- Added quiz mode parameter to problem generation to differentiate quiz questions (final answer only) from tutor questions (can show work), improving quiz experience.
- Created separate quiz statistics aggregation to track quiz-specific metrics independently from session statistics, providing clearer insights into quiz performance.
- Used Firestore subcollections (`/users/{uid}/quizzes`) for quiz data persistence, maintaining clean data organization and enabling efficient queries.
- Enhanced evaluation prompt with step-by-step instructions and concrete examples to improve evaluation accuracy and reduce false negatives.
- Lowered evaluation temperature to 0.1 for more deterministic, consistent evaluation results.
- Implemented comprehensive post-processing for problem text to fix common AI formatting issues (angles, spacing, currency, word splitting) before displaying to users.

**Next Steps:**

- Monitor evaluation accuracy in production and refine prompts if needed.
- Add quiz difficulty calibration based on user performance patterns.
- Consider adding quiz time tracking and time limits for timed quizzes.
- Add quiz export functionality for user data portability.
- Implement quiz analytics (e.g., topic performance, common mistakes).
- Consider adding quiz sharing or collaboration features in future iterations.
