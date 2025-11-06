# MathMate

## Overview

MathMate is a web-based AI math tutor that guides students through problems using the Socratic method. By combining conversational tutoring, visual reasoning, and persistent session history, MathMate focuses on teaching _why_ solutions work rather than revealing final answers. Guided by the PRD and Design Specification, the product supports typed and image-based problem entry, KaTeX-rendered reasoning steps, and patient, confidence-building dialogue.

MathMate features AI-powered question generation that creates diverse, contextually appropriate math problems based on topic and difficulty level. The Quiz Mode allows students to take timed quizzes with automatic evaluation, and review incorrect answers with AI-powered tutoring that provides step-by-step guidance.

## Setup Guide

Follow this high-level sequence to prepare the project locally:

1. Clone the `mathmate-app` repository.
2. Install project dependencies with your preferred package manager. (`npm install`)
3. Create an `.env.local` file and populate it with required Firebase and OpenAI credentials.
4. Launch the development server to verify the environment configuration.
5. Prepare a Vercel deployment once local validation is complete.

## Tech Stack

- React for the frontend experience and component architecture.
- Firebase (Auth, Firestore, Storage, Functions) for authentication, persistence, and secure API access.
- OpenAI API for Socratic dialogue, vision-powered OCR, and AI-powered question generation.
- KaTeX for accurate math rendering in chat and workspace views.
- Tailwind CSS for the "Soft Academic" design system implementation.
- Vercel for hosting and deployment workflows.

## Project Structure

- `src/` contains React application code, including components, pages, context providers, utilities, styling, and Firebase integration modules.
- `functions/` houses Firebase Cloud Functions responsible for secure OpenAI and OCR interactions.
- `docs/` provides supporting documentation: Project Overview, PRD, Design Specification, Task List, prompt artifacts, and the evolving AI Log.
- `vercel.json` captures hosting preferences for deployment.

Refer to the `docs/MathMate_Task_List.md` for the detailed PR breakdown and milestone plan.

## Prompt Engineering Notes

- MathMate enforces a strict Socratic dialogue: it asks guiding questions, validates reasoning, and withholds direct answers.
- The system detects “stuck” learners through conversational cues, injecting hints only after sustained difficulty.
- Evaluation requires ≥95% compliance across a curated prompt set, with ongoing prompt tuning tracked in `/docs/prompts`.

**Final System Prompt**

> You are a patient math tutor. NEVER give direct answers. Guide the student through questions such as “What information do we have?” or “What method might help here?” If the student remains stuck for more than two turns, provide a concrete hint. Use encouraging language and reinforce reasoning.

## Example Problem Walkthroughs

Each walkthrough aligns with the Socratic flow: clarify the goal, isolate key information, guide toward a method, validate intermediate steps, and summarize learning. Screenshots should capture both the chat dialogue and workspace evolution for each scenario.

1. **Linear Equation (Algebra I)** — Solve `2x + 5 = 13` using inverse operations; highlight question-driven isolation of the variable.
2. **Quadratic Factoring** — Factor `x² + 5x + 6 = 0`; demonstrate how the tutor nudges the student toward factoring pairs before confirming solutions.
3. **Systems of Equations (Substitution)** — Address `y = 2x + 3` and `3x - y = 9`; show the tutor eliciting the substitution strategy and validating each substitution.
4. **Geometry Word Problem** — Determine the area of a triangle given base and height from text; emphasize extracting knowns, choosing the correct formula, and unit awareness.
5. **Multi-Step Percentage Problem** — Calculate the final price after successive discounts and tax; illustrate how hints are triggered when the student hesitates on compounding percentages.
6. **Bonus (Phase 2 Preview)** — Outline how a whiteboard-assisted explanation would complement the workspace for a geometry proof, even if the feature remains in stretch scope.

## Contributing

- Review the current PR roadmap in `docs/MathMate_Task_List.md` and coordinate work by opening pull requests aligned with the numbered phases.
- Document meaningful architectural or prompt-related decisions in `docs/AI_Log.md` before merging.
- Adhere to established design patterns, accessibility guidelines, and security practices defined in the PRD and Design Specification.
- Request reviews focused on pedagogy, technical accuracy, and user experience before marking changes ready.

## License

MathMate is released under the MIT License. Include the full license text before the initial production release.

---

Further documentation:

- `docs/MathMate_Product_Requirements_Document.md`
- `docs/MathMate_Design_Specification_Sheet.md`
- `docs/MathMate_Task_List.md`
- `docs/AI_Log.md`
