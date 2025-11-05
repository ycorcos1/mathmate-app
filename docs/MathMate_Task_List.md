# MathMate Task List and PR Breakdown (Structured Update — 2025-11-04)

---

## ✅ PR #0 — Documentation Setup

**Objective:** Establish project documentation foundation.  
**Tasks:**

- Create `README.md` with Overview, Setup, Tech Stack, Structure, Prompt Engineering Notes, and 5 Example Problem Walkthrough stubs.
- Create `/docs/AI_Log.md` for continuous project logging.
- Cross-link all documentation (`Overview`, `PRD`, `Design Spec`, `Task List`).
  **Acceptance Criteria:**
- Clean, production-ready Markdown files.
- Proper cross-references between all docs.
- Initial log entry recorded.

---

## ✅ PR #1 — Environment & Boilerplate Setup

**Objective:** Scaffold and configure the MathMate project environment.  
**Tasks:**

- Initialize React (Vite) app with Tailwind, React Router, ESLint, Prettier, and KaTeX.
- Configure Firebase (Auth, Firestore, Storage) using `.env.local` credentials.
- Set up Context providers (`AuthContext`, `SessionContext`, `UIContext`).
- Add `firebase.js` or equivalent config file.
- Connect Firebase to real project (no emulators).
  **Acceptance Criteria:**
- Project runs locally without errors.
- Firebase successfully initialized and linked.
- App directory structure follows design spec.

---

## 🧩 PR #2 — Authentication System

**Objective:** Implement secure authentication using Firebase Email/Password only.  
**Tasks:**

- Build pages: `/login`, `/signup`, `/forgot-password`.
- Implement client-side validation and UX feedback.
- Implement `AuthContext` with methods: `signUp`, `signIn`, `signOut`, `sendPasswordResetEmail`.
- Add route protection (`ProtectedRoute` / HOC).
- On first login, create Firestore document at `/users/{uid}`:
  ```json
  {
    "displayName": "",
    "email": "",
    "createdAt": "",
    "lastLoginAt": "",
    "stats": { "sessionsCount": 0, "hintsUsed": 0, "avgSolveSec": 0 },
    "settings": { "theme": "system", "voiceMode": false }
  }
  ```
- Create empty `/users/{uid}/progress` subcollection (for future mastery tracking).
  **Acceptance Criteria:**
- Auth flows (signup, login, logout, password reset) fully functional.
- Auth state persists on refresh.
- Unauthorized users redirected to `/login`; authorized users to `/tutor`.
- User doc and subcollection created on first login.

---

## PR #3 — Profile & Settings

**Objective:** Build user profile management and preferences system.  
**Tasks:**

- Add `/profile` page with editable `displayName`
- Implement account deletion (cascade Firestore cleanup).
- Add settings toggles for `voiceMode`.
- Update user doc on save.
  **Acceptance Criteria:**
- Profile updates persist.
- Account deletion removes user data and sessions.
- voiceMode sync with global state.

---

## PR #4 — Chat Interface & AI Integration

**Objective:** Build the conversational tutoring interface.  
**Tasks:**

- Create `/tutor` chat page with AI chat layout.
- Add message bubbles for user and AI.
- Implement LaTeX rendering (KaTeX).
- Connect to OpenAI API for responses.
- Tag messages with `topicId` metadata (foundation for mastery tracking).
- Maintain message history per session.
  **Acceptance Criteria:**
- AI responds coherently and formats math output correctly.
- Each message saved with topic metadata.
- UI responsive and stable.

---

## PR #5 — Socratic Prompt & Evaluation Logic

**Objective:** Introduce multi-step, Socratic AI reasoning flow.  
**Tasks:**

- Refine AI prompt templates for stepwise problem solving.
- Add logic to evaluate correctness and detect misconceptions.
- Log hint usage per message.
  **Acceptance Criteria:**
- AI responses structured step-by-step.
- Evaluation feedback consistent and explainable.

---

## PR #6 — OCR / Image Input

**Objective:** Allow users to upload or capture math problems via images.  
**Tasks:**

- Integrate OCR (Vision API or Tesseract).
- Convert recognized text into editable math input.
- Handle errors gracefully and show preview before submission.
  **Acceptance Criteria:**
- OCR extraction accurate for printed and handwritten text.
- Fallback mechanism functional (manual input).

---

## PR #7 — Workspace Panel

**Objective:** Provide a user workspace to navigate sessions and learning tabs.  
**Tasks:**

- Add sidebar showing session list and history.
- Include placeholders for “Frontier” and “Review” tabs (mastery foundation).
- Display current topic and session stats.
  **Acceptance Criteria:**
- Sidebar fully navigable.
- Frontier/Review placeholders visible and persistent.

---

## PR #8 — Session Persistence

**Objective:** Enable persistent session saving and retrieval.  
**Tasks:**

- Store sessions in Firestore under `/users/{uid}/sessions`.
- Include message history, topics, and completion state.
- Track session stats (duration, accuracy, hints used).
- Sync progress doc stubs from earlier PRs.
  **Acceptance Criteria:**
- Sessions persist across reloads.
- Progress data stored correctly under user ID.

---

## PR #9 — AI Response Enhancement

**Objective:** Improve conversational depth and rendering stability.  
**Tasks:**

- Enable context retention for follow-up questions.
- Stream long responses incrementally.
- Refine LaTeX rendering and error handling.
  **Acceptance Criteria:**
- Long AI explanations stream without lag.
- No rendering or duplication errors.

---

## PR #10 — Hints & Guided Explanations

**Objective:** Provide AI-generated hints and explanations.  
**Tasks:**

- Add hint request button per problem.
- Implement incremental hint reveal.
- Allow user to request full explanation.
  **Acceptance Criteria:**
- Hints coherent and context-aware.
- AI respects conversation history and topic tags.

---

## PR #11 — Analytics & Tracking

**Objective:** Track user performance metrics.  
**Tasks:**

- Aggregate stats from sessions (`hintsUsed`, `avgSolveSec`, etc.).
- Display analytics in `/dashboard`.
- Prepare for future XP and mastery integration.
  **Acceptance Criteria:**
- Stats update accurately.
- Data persists per user.

---

## PR #12 — Problem Generation System

**Objective:** Generate new problems using AI based on topic and difficulty.  
**Tasks:**

- Add problem generator utility (`/utils/problemGenerator.js`).
- Tag problems with `topicId` and `difficulty`.
- Include option for user-selected difficulty or topic.
  **Acceptance Criteria:**
- Generated problems valid and solvable.
- Topic tagging consistent.

---

## PR #13A — QA, Testing, and Pre-Deployment

**Objective:** Ensure stability and readiness for deployment.  
**Tasks:**

- Conduct full functionality test sweep.
- Fix console warnings and lint issues.
- Write unit tests for core components (Auth, Chat, OCR).
  **Acceptance Criteria:**
- 0 critical bugs.
- Coverage >85% for core components.

## PR #13B — Deployment

**Objective:** Deploy to Vercel (production).  
**Tasks:**

- Configure build and environment variables.
- Finalize Firebase + OpenAI credentials for production.
- Deploy to Vercel.
- Validate live environment end-to-end.
  **Acceptance Criteria:**
- Production build stable.
- Firebase functions callable from deployed app.

---

# 📘 Phase 2: Learning Science Extension (Post-Launch)

## PR #14 — Mastery Engine

Implements mastery state machine (`learning → practicing → mastered → automatic`) using `progress` collection.  
Promotion/demotion based on streaks and hint usage.

## PR #15 — Review Scheduler

Introduces spaced repetition and interleaved review queues.  
Schedules `reviewDueAt` per topic.

## PR #16 — Targeted Remediation

Auto-enqueues prerequisite topics upon repeated failures.  
Pulls dependencies from `topicGraph.json`.

## PR #17 — Fluency & XP System

Adds timed fluency drills and XP progression system.  
Implements anti-gaming safeguards and a progression dashboard.

---

# End of Document
