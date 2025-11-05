# MathMate Product Requirements Document (Updated 2025-11-04)

## 1. Overview

MathMate is an AI-powered web app that serves as an intelligent math tutor capable of understanding, generating, and guiding students through mathematical problem solving in a conversational interface. It uses OpenAI models for reasoning and Firebase for user management, persistence, and storage. The app includes OCR-based problem input, LaTeX rendering, user session tracking, and (later) mastery-based learning mechanics inspired by the Math Academy Way.

---

## 2. Project Goals

- Provide a user-friendly, tutor-like experience for learning and practicing math.
- Allow users to solve, discuss, and understand math problems interactively with AI.
- Track user progress and sessions persistently through Firebase.
- Support both text and image-based problem input.
- Implement mastery tracking and review scheduling post-launch (extension phase).

---

## 3. Core Features (PR #0–#13)

### PR #0 — Documentation Setup ✅

- README.md and AI_Log.md created.
- Linked all /docs references and project overview.

### PR #1 — Environment & Boilerplate Setup ✅

- Project scaffolded (Vite/React + Tailwind + Router + ESLint + Prettier + KaTeX).
- Firebase configured with Auth, Firestore, and Storage.
- .env.local added and connected to real Firebase project.
- Context scaffolding (AuthContext, SessionContext, UIContext) in place.

### PR #2–#13 — Active Development Phase

These PRs build core user features, chat functionality, AI logic, and deployment.

**New foundation updates incorporated:**

- `users/{uid}/progress/` path established starting PR #2.
- Each problem tagged with `topicId` from PR #4 onward.
- Placeholders for mastery UI (“Frontier” and “Review” tabs) introduced in PR #7.
- Session persistence expanded in PR #8.
- Problem generator assigns `topicId` in PR #12.

---

## 4. Learning Science Extension (PR #14–#17)

To be implemented after full production readiness.

| PR  | Feature                  | Description                                                                                                                                      |
| --- | ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| #14 | **Mastery Engine**       | Implements topic-level mastery state machine (`learning → practicing → mastered → automatic`). Adjusts based on accuracy streaks and hint usage. |
| #15 | **Review Scheduler**     | Adds spaced repetition and interleaving algorithm to serve due reviews.                                                                          |
| #16 | **Targeted Remediation** | Automatically queues prerequisite topics when a user struggles repeatedly.                                                                       |
| #17 | **Fluency & XP System**  | Introduces timed fluency drills, XP gain, and anti-gaming safeguards.                                                                            |

---

## 5. Technical Stack

- **Frontend:** React (Vite), Tailwind CSS, Zustand, KaTeX
- **Backend:** Firebase (Auth, Firestore, Storage, Functions)
- **AI Integration:** OpenAI GPT models via API key
- **Hosting:** Vercel (PR #13B)
- **Languages:** JavaScript, TypeScript (for future expansion)

---

## 6. Non-Functional Requirements

- Fast load (<3s initial).
- Smooth conversational UX.
- Error resilience across Firebase and API calls.
- Secure API key handling (no keys in client build).
- Responsive layout (desktop-first).

---

## 7. Testing & QA

- Unit and integration tests per PR (esp. PR #13A).
- Functional verification for Auth, Chat, and OCR.
- Manual testing before each merge.
- End-to-end QA after PR #13.

---

## 8. Documentation Deliverables

- `/docs/README.md`
- `/docs/AI_Log.md`
- `/docs/MathMate_Design_Specification_Sheet.md`
- `/docs/MathMate_Task_List_and_PR_Breakdown.md`
- Example problem walkthroughs (5 minimum)

---

## 9. Post-Launch Extensions

- Implement Learning Science Phase (PR #14–#17).
- Add gamified progression dashboard.
- Optimize AI prompts for Socratic explanation style.
- Add teacher/admin analytics mode.

---

# End of Document
