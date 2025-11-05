# 🎨 MathMate Design Specification Sheet

## 🧩 1. Brand Identity Overview

**Product Name:** MathMate  
**Tagline:** “Think it through — together.”  
**Core Idea:** An AI-powered math tutor that teaches reasoning through guided conversation and visual understanding.

**Tone & Personality:**

- Encouraging, patient, supportive — like a real human tutor.
- Speaks in plain language, no jargon.
- Confidence-building: focuses on _why_ an answer works, not just _what_ it is.
- Emotionally intelligent — celebrates progress, not just completion.

---

## 🌿 2. Visual Style & Mood

### **Design Mood:** “Friendly Academic Minimalism”

Feels like studying in natural light: calm, bright, and mentally clear.

### **Primary Palette (Soft Academic)**

| Usage          | Color         | Hex       |
| -------------- | ------------- | --------- |
| Primary        | Sky Blue      | `#4C91F7` |
| Secondary      | Mint Green    | `#AEE8D1` |
| Accent         | Warm Yellow   | `#FFD85C` |
| Background     | Off-White     | `#FAFAFB` |
| Surface        | White         | `#FFFFFF` |
| Text Primary   | Deep Charcoal | `#1F2937` |
| Text Secondary | Slate Gray    | `#6B7280` |
| Line/Border    | Light Gray    | `#E5E7EB` |
| Error/Alert    | Coral         | `#F87171` |

---

## ✍️ 3. Typography System

| Element     | Font                           | Weight  | Usage                 |
| ----------- | ------------------------------ | ------- | --------------------- |
| Headings    | Poppins                        | 600–700 | Rounded, approachable |
| Body Text   | Inter                          | 400–500 | Legible for chat      |
| Code/Math   | JetBrains Mono / KaTeX default | Regular | Math rendering        |
| UI Elements | Inter                          | 500     | Buttons, labels       |

Font scale:

- H1: 32px
- H2: 24px
- H3: 20px
- Body: 16px
- Small: 14px

---

## 🧱 4. Layout Structure (Split Layout)

- **12-column grid**
- **Left Pane (Chat):** 7 columns (~60%)
- **Right Pane (Workspace):** 5 columns (~40%)
- Gutter: 24px
- Padding: 32px outer margin

### **Left Panel — Chat Zone**

- Socratic conversation flow
- File upload + text input
- Auto-scroll, smooth transitions
- Inline LaTeX/KaTeX math rendering

### **Right Panel — Workspace**

- Visual reasoning area (steps, diagrams, hints)
- Step cards with KaTeX math
- Collapsible hint boxes
- Step-by-step progression + summary view

---

## 💬 5. Core UI Components

### Chat Bubbles

- User: soft mint background (#E8FFF2)
- MathMate: soft blue background (#E6F0FF)
- Rounded corners, padding 12px/16px
- Shadow: `0 1px 2px rgba(0,0,0,0.05)`

### Input Bar

- Fixed bottom pill-shaped input
- File upload icon (📎), text field, send (➤)
- Background: white, soft drop shadow

### Hint Box

- Pale yellow background (#FFF9E6)
- Border accent: #FFD85C
- Light bulb icon 💡
- Slide-up fade animation

### Equation Box

- Card layout, KaTeX-rendered math
- Step indicator top-right
- Auto-updates with user progress

---

## 📈 6. Interaction Flow

1. User inputs or uploads problem
2. MathMate parses (OCR + text)
3. Chat-guided questioning (Socratic)
4. Workspace updates with steps
5. Hints appear dynamically
6. Final summary view upon completion

---

## 💡 7. Microinteractions

- Typing dots animation (0.8s loop)
- Bubble fade-in (150ms)
- Hint slide-up (200ms)
- Hover accent underline (#4C91F7)

---

## 🧠 8. Accessibility & Responsiveness

- Color contrast ≥ 4.5:1
- Focus outlines (#4C91F7)
- Scalable fonts
- Chat and workspace scroll independently
- Optimized for ≥1024px screens

---

## 🔖 9. Logo & Iconography

- Wordmark “MathMate” in Poppins Bold
- “M” stylized as interlocking chat bubbles or math graph vertex
- Primary color: #4C91F7
- Favicon: simplified M-shaped geometric symbol

---

## 🧩 10. Page Structure

1. **Home Page** – Overview, CTA, demo visuals
2. **Tutor Page** – Split layout (Chat + Workspace)
3. **Profile Page** – User info, saved sessions
4. **Auth Pages** – Login, Signup
5. **About Page** – Socratic learning philosophy

---

## ⚙️ 11. Backend / Integration Notes

- **Backend:** Firebase (Auth, Firestore, Storage)
- **AI Engine:** OpenAI API (ChatGPT model via API key)
- **Storage:** Firebase Firestore + Cloud Storage for images
- **Deployment:** Vercel or Firebase Hosting

---

## ✅ 12. Design Pillars Summary

| Pillar     | Decision                          |
| ---------- | --------------------------------- |
| Tone       | Friendly Tutor                    |
| Layout     | Split (Chat + Workspace)          |
| Palette    | Soft Academic                     |
| Typography | Poppins + Inter                   |
| Backend    | Firebase                          |
| AI         | OpenAI API                        |
| Core UX    | Conversational + Visual reasoning |
| Device     | Web (Desktop)                     |

---

**End of MathMate Design Specification Sheet**
