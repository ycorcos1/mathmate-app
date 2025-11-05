# AI Math Tutor \- Socratic Learning Assistant

Timeline: 3-5 days core \+ optional stretch features | Date: November 3, 2025

## Objective

Build an AI tutor that guides students through math problems using Socratic questioning (like the OpenAI x Khan Academy demo: [https://www.youtube.com/watch?v=IvXZCocyU_M](https://www.youtube.com/watch?v=IvXZCocyU_M)). System accepts problems via screenshot or text and helps students discover solutions through guided dialogue.

Success Criteria: Guides students through 5+ problem types without giving direct answers; maintains conversation context; adapts to student understanding level.

## Core Features (Days 1-5)

1. Problem Input: Text entry \+ image upload with OCR/Vision LLM parsing
2. Socratic Dialogue: Multi-turn conversation that asks guiding questions, validates responses, provides hints (never direct answers)
3. Math Rendering: Display equations properly (LaTeX/KaTeX)
4. Web Interface: Clean chat UI with image upload and conversation history

## Stretch Features (If Time Permits)

High Value:

- Interactive Whiteboard: Shared canvas for visual explanations and diagrams
- Step Visualization: Animated breakdown of solution steps
- Voice Interface: Text-to-speech responses \+ speech-to-text input

Polish:

- Animated Avatar: 2D/3D tutor character with expressions
- Difficulty Modes: Adjust scaffolding by grade level
- Problem Generation: Create similar practice problems

## Socratic Approach

System Prompt: "You are a patient math tutor. NEVER give direct answers. Guide through questions: 'What information do we have?' 'What method might help?' If stuck \>2 turns, provide concrete hint. Use encouraging language."

Flow: Parse problem → Inventory knowns → Identify goal → Guide method selection → Step through solution → Validate answer

## Example Interaction

Student: \[uploads "2x \+ 5 \= 13"\] Tutor: "What are we trying to find?" Student: "x" Tutor: "Right\! To get x alone, we need to undo the \+5 and ×2. Which should we undo first?" Student: "the \+5?" Tutor: "Exactly\! How do we undo adding 5?"

## Example Timeline

Day 1: Image parsing working, can extract problem text Day 2: Basic chat \+ LLM integration with hardcoded problem Day 3: Socratic logic (questions not answers), response validation Day 4: UI polish \+ math rendering, tested on 5+ problems Day 5: Documentation, demo video, deployment Day 6-7 (Optional): Whiteboard/avatar/voice features

## Deliverables

1. Deployed App (or local with clear setup)
2. GitHub Repo with clean code structure
3. Documentation: README with setup, 5+ example problem walkthroughs, prompt engineering notes
4. 5-Min Demo Video: Text input, image upload, Socratic dialogue, stretch feature (if built)

Test with: Simple arithmetic, algebra, geometry, word problems, multi-step problems

## Evaluation

Pedagogical Quality (35%): Genuine guidance without giving answers Technical Implementation (30%): Parsing works, context maintained User Experience (20%): Intuitive interface, responsive Innovation (15%): Creative stretch features

## Quick Start Guide

1. Day 1: Build basic chat with hardcoded problem \+ LLM
2. Validate Socratic prompting works before building full UI
3. Start image parsing with printed text (easier than handwritten)
4. Stretch Priority: Whiteboard \> Voice \> Avatar for maximum impact

## Contact:

John Chen  
john.chen@superbuilders.school
