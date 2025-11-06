import cors from 'cors';
import { config as loadEnv } from 'dotenv';
import { getApps, initializeApp } from 'firebase-admin/app';
import * as functions from 'firebase-functions';
import { OpenAI } from 'openai';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

loadEnv();

if (!getApps().length) {
  initializeApp();
}

const corsOptions = {
  origin: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true,
};

const corsHandler = cors(corsOptions);

type StepType = 'hint' | 'check' | 'final';
type ResponseMode = 'default' | 'hint';
type ProblemDifficulty = 'beginner' | 'intermediate' | 'advanced';
type QuizEvaluationResponse = {
  isCorrect: boolean;
  correctAnswer?: string | null;
  explanation?: string | null;
  feedback?: string | null;
};

const DEFAULT_PROBLEM_DIFFICULTY: ProblemDifficulty = 'intermediate';

const PROBLEM_DIFFICULTY_GUIDANCE: Record<ProblemDifficulty, string> = {
  beginner:
    'Design an accessible problem with concrete numbers, explicit structure, and a clear question suitable for students building foundational skills.',
  intermediate:
    'Create a multi-step problem that blends conceptual reasoning and computation, appropriate for typical Algebra I/II or Geometry learners.',
  advanced:
    'Craft a challenging problem that requires synthesizing multiple ideas or deeper abstraction, fitting for precalculus, calculus, or contest-style thinking.',
};

const PROBLEM_TOPIC_GUIDANCE: Record<
  string,
  { label: string; guidance: string; subtopics: string[] }
> = {
  foundations: {
    label: 'Foundations',
    guidance:
      'Focus on foundational math concepts. Embed the situation in a real-world or story context when possible. Vary the problem types to include different subtopics.',
    subtopics: [
      'Arithmetic',
      'Order of Operations (PEMDAS)',
      'Factors & Multiples',
      'Prime Numbers',
      'Fractions',
      'Decimals',
      'Percentages',
      'Ratios & Proportions',
      'Exponents & Roots',
    ],
  },
  'pre-algebra': {
    label: 'Pre-Algebra',
    guidance:
      'Center the problem on pre-algebra concepts with clear reasoning steps and opportunities to check work. Vary the problem types to include different subtopics.',
    subtopics: [
      'Integers & Absolute Value',
      'Expressions & Variables',
      'Simplifying Expressions',
      'Linear Equations (1 variable)',
      'Inequalities',
      'Coordinate Plane & Graphing',
      'Functions & Relations',
      'Word Problems & Translating Expressions',
    ],
  },
  algebra: {
    label: 'Algebra I & II',
    guidance:
      'Highlight algebra concepts and encourage analyzing the structure before proceeding. Vary the problem types to include different subtopics.',
    subtopics: [
      'Systems of Equations',
      'Quadratic Equations',
      'Factoring',
      'Polynomials',
      'Rational Expressions',
      'Radical Expressions',
      'Exponential & Logarithmic Functions',
      'Sequences & Series',
      'Complex Numbers',
    ],
  },
  geometry: {
    label: 'Geometry',
    guidance:
      'Use geometric concepts and invite the learner to diagram or reference geometric relationships. Vary the problem types to include different subtopics.',
    subtopics: [
      'Points, Lines, Planes, Angles',
      'Triangles (Types, Congruence, Similarity)',
      'Pythagorean Theorem',
      'Circles (Arcs, Chords, Tangents)',
      'Polygons',
      'Coordinate Geometry',
      'Perimeter, Area, and Volume',
      'Transformations (Translation, Reflection, Rotation, Dilation)',
      'Proofs & Theorems',
    ],
  },
  trigonometry: {
    label: 'Trigonometry',
    guidance:
      'Work with trigonometric concepts and provide enough detail for reasoning without giving the answer. Vary the problem types to include different subtopics.',
    subtopics: [
      'Unit Circle',
      'Sine, Cosine, Tangent Functions',
      'Graphing Trig Functions',
      'Inverse Trig Functions',
      'Trig Identities & Equations',
      'Law of Sines & Cosines',
      'Radians & Degrees',
      'Applications (Heights, Distances, Periodic Motion)',
    ],
  },
  'pre-calculus-calculus': {
    label: 'Pre-Calculus & Calculus',
    guidance:
      'Ask for calculus concepts, emphasizing intuitive understanding within a contextual scenario. Vary the problem types to include different subtopics.',
    subtopics: [
      'Limits & Continuity',
      'Derivatives & Applications',
      'Integrals & Applications',
      'Differential Equations (Intro)',
      'Parametric & Polar Equations',
      'Infinite Series & Convergence',
    ],
  },
  'statistics-probability': {
    label: 'Statistics & Probability',
    guidance:
      'Focus on statistical and probability concepts with real-world applications. Vary the problem types to include different subtopics.',
    subtopics: [
      'Mean, Median, Mode',
      'Range, Variance, Standard Deviation',
      'Probability Rules (Addition, Multiplication)',
      'Conditional Probability',
      'Combinations & Permutations',
      'Random Variables & Distributions',
      'Normal Distribution',
      'Hypothesis Testing (Intro)',
      'Correlation & Regression',
    ],
  },
  'discrete-math-logic': {
    label: 'Discrete Math & Logic',
    guidance:
      'Work with discrete math and logic concepts, emphasizing structured reasoning. Vary the problem types to include different subtopics.',
    subtopics: [
      'Logic & Truth Tables',
      'Set Theory',
      'Combinatorics',
      'Graph Theory',
      'Counting Principles',
      'Matrices',
      'Recursion',
    ],
  },
  'applied-math': {
    label: 'Applied Math',
    guidance:
      'Create real-world applied math problems that connect mathematical concepts to practical situations. Vary the problem types to include different subtopics.',
    subtopics: [
      'Word Problems',
      'Financial Math (Interest, Loans, Investments)',
      'Rate, Time, Distance Problems',
      'Geometry in Real Life (Area, Volume Applications)',
      'Data Interpretation & Graphs',
      'Unit Conversions',
    ],
  },
};

const DEFAULT_TOPIC_GUIDANCE =
  'Select a meaningful concept from algebra, geometry, or calculus and pose a problem that invites step-by-step reasoning without revealing the answer.';

const PROBLEM_GENERATOR_PROMPT = `You are MathMate, an AI tutor content designer. Generate a single math problem aligned with the requested topic and difficulty. The problem must invite reasoning and avoid giving away the solution.

Always respond with a single JSON object using this exact shape:
{
  "problemText": "<full problem statement with LaTeX where helpful>",
  "topicId": "<kebab-case topic identifier>",
  "difficulty": "beginner" | "intermediate" | "advanced",
  "suggestedHint": "<optional nudge that unlocks the first step>",
  "title": "<short descriptive title for dashboards>"
}

CRITICAL FORMATTING RULES:
1. NEVER include the final answer or full worked solution.
2. Encourage the learner to think or explain their steps.
3. Use LaTeX delimiters ($...$ or $$...$$) ONLY for mathematical expressions - NOT for currency symbols.
4. For currency amounts, use regular text like "$7" or "7 dollars" - DO NOT use LaTeX delimiters around currency.
5. ALWAYS include proper spaces between words - text must be readable and well-formatted.
6. Use proper punctuation and sentence structure.
7. If showing equations, use LaTeX: $n + m = 10$ for inline or $$n + m = 10$$ for block equations.
8. For angles, use the degree symbol "°" directly (e.g., "60°" or "45°") or write "degrees" (e.g., "60 degrees"). NEVER use "exto" or other variations.
9. Omit suggestedHint if it is not necessary.

FORMATTING EXAMPLES:
- CORRECT: "A book costs $7 each and magazines cost $3 each."
- CORRECT: "The equation is $n + m = 10$ and $7n + 3m = 54$."
- CORRECT: "A ladder leans against a wall, forming an angle of 60° with the ground."
- CORRECT: "The angle measures 45 degrees."
- INCORRECT: "A book costs 7eachandmagazines" (missing spaces)
- INCORRECT: "The total is 54$$" (malformed LaTeX)
- INCORRECT: "60exto" or "60 exto" (use "60°" or "60 degrees" instead)
`;

const isValidProblemDifficulty = (value: unknown): value is ProblemDifficulty =>
  typeof value === 'string' && ['beginner', 'intermediate', 'advanced'].includes(value);

const normalizeTopicId = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const sanitizeTopicId = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'general';

const sanitizeEvaluationField = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const BASE_SYSTEM_PROMPT = `You are MathMate, a Socratic math tutor. Your role is to GUIDE learners to discover solutions themselves, NEVER to solve problems for them.

CRITICAL RULES:
1. NEVER provide the final answer or complete solution directly
2. NEVER show all steps at once - scaffold one step at a time
3. ALWAYS ask questions to guide thinking (e.g., "What do we know?", "What should we find first?", "What operation would help here?")
4. When the learner shares their reasoning, validate it and ask the next guiding question
5. Only give hints when the learner is truly stuck (after 2+ attempts)
6. Use encouraging, patient language - celebrate partial progress

Always reply with a single JSON object using this shape:
{
  "content": "<your Socratic reply>",
  "stepType": "hint" | "check" | "final"
}

Rules for stepType:
- Use "hint" when offering a gentle nudge or partial insight (only after learner is stuck)
- Use "check" when validating the student's reasoning or asking a follow-up question (MOST COMMON)
- Use "final" only when summarizing the full solution after the learner has successfully completed the problem or explicitly asks for a wrap-up

Remember: Your goal is to help the learner THINK through the problem, not to solve it for them. Use LaTeX delimiters for math: $$...$$ for block equations, $...$ for inline.`;

const MODE_DIRECTIVES: Record<ResponseMode, string> = {
  default:
    'Current mode: standard guidance. Continue the dialogue by referencing the learner\'s latest response. IMPORTANT: Ask guiding questions, do NOT solve the problem. Do NOT provide complete solutions or final answers. Guide the learner to discover the solution themselves. Prefer "check" (guiding questions) unless the learner is stuck and needs a hint.',
  hint: 'Current mode: hint requested. Provide a concise hint that unlocks the next idea without solving the entire problem. Do not share the final answer. Set stepType to "hint" for this reply.',
};

const QUIZ_EVALUATION_SYSTEM_PROMPT = `You are MathMate, an expert math evaluator and tutor. Your job is to review a learner's answer and provide:

1. Whether the answer is correct (true/false)
2. The correct answer or final expression (succinctly)
3. A brief explanation highlighting the key idea or mistake
4. Friendly feedback encouraging the learner and pointing to the next step

RESPOND STRICTLY WITH A JSON OBJECT USING THIS EXACT SHAPE:
{
  "isCorrect": true | false,
  "correctAnswer": "<succinct final answer>",
  "explanation": "<short explanation of the correct reasoning>",
  "feedback": "<supportive coaching feedback>"
}

🚨 CRITICAL EVALUATION RULES FOR QUIZ MODE - READ THIS CAREFULLY:

RULE 1: Calculate the problem yourself first to determine the correct numerical answer.
  Example: "25 balloons, give away 8" → Correct answer is 17 (25 - 8 = 17)

RULE 2: Extract ONLY the final numerical answer from the learner's response.
  - If learner writes "17" → extracted answer = 17
  - If learner writes "25-8=17" → extracted answer = 17 (number after =)
  - If learner writes "25 - 8 = 17" → extracted answer = 17 (number after =)
  - If learner writes "17." → extracted answer = 17
  - Ignore everything else (equations, work, formatting) - only extract the final number

RULE 3: Compare mathematically:
  - If extracted answer = correct answer → mark isCorrect = TRUE
  - If extracted answer ≠ correct answer → mark isCorrect = FALSE
  - That's it. No other criteria.

RULE 4: Examples showing CORRECT answers:
  * Question: "25 balloons, give away 8, how many left?" (Correct: 17)
    - Learner writes "17" → isCorrect = TRUE ✓
    - Learner writes "25-8=17" → isCorrect = TRUE ✓
    - Learner writes "25 - 8 = 17" → isCorrect = TRUE ✓
    - Learner writes "16" → isCorrect = FALSE ✗

RULE 5: Default to CORRECT if you're unsure.
  - When in doubt, mark as CORRECT
  - Only mark FALSE if you're absolutely certain the numerical answer is wrong
  - Do NOT mark as incorrect for formatting, showing work, or any reason other than wrong numerical answer

IMPORTANT: The ONLY thing that matters is whether the final numerical answer matches the correct answer. Everything else is irrelevant.

Rules:
- Keep explanations concise (2-4 sentences)
- Provide the correct answer even if the learner was correct (for confirmation)
- Feedback should be encouraging and actionable.
- Do NOT include Markdown or LaTeX delimiters; plain text is fine.
- If the question has multiple parts, summarize the correct resolution for each part.`;

const isValidStepType = (value: unknown): value is StepType =>
  typeof value === 'string' && ['hint', 'check', 'final'].includes(value);

const createOpenAIClient = () => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error(
      'OPENAI_API_KEY is not configured. Please set it as a Firebase Functions secret.',
    );
  }

  return new OpenAI({ apiKey });
};

let openaiClient: OpenAI | null = null;

const getOpenAIClient = () => {
  if (!openaiClient) {
    try {
      openaiClient = createOpenAIClient();
    } catch (error) {
      console.error('Failed to create OpenAI client:', error);
      throw error;
    }
  }
  return openaiClient;
};

export const generateResponse = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: ['OPENAI_API_KEY'],
  })
  .https.onRequest((req, res) => {
    corsHandler(req, res, () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const { messages, mode, stream } = req.body as {
        messages?: Array<{ role: string; content: string; imageUrl?: string | null }>;
        mode?: ResponseMode;
        stream?: boolean;
      };

      if (!Array.isArray(messages) || messages.length === 0) {
        res.status(400).json({ error: 'Body must include a non-empty messages array.' });
        return;
      }

      const responseMode: ResponseMode = mode === 'hint' ? 'hint' : 'default';
      const shouldStream = stream === true;

      const sanitizedMessages: ChatCompletionMessageParam[] = [
        {
          role: 'system',
          content: `${BASE_SYSTEM_PROMPT}\n\n${MODE_DIRECTIVES[responseMode]}`,
        },
      ];

      for (const message of messages) {
        if (!message || typeof message.role !== 'string') {
          res.status(400).json({ error: 'Each message requires a role string.' });
          return;
        }

        // Allow empty content if there's an imageUrl
        const content = typeof message.content === 'string' ? message.content : '';
        const imageUrl =
          message.imageUrl && typeof message.imageUrl === 'string' ? message.imageUrl : null;

        const role = message.role === 'assistant' ? 'assistant' : 'user';

        // If message has an image, format it for Vision API
        if (imageUrl && role === 'user') {
          sanitizedMessages.push({
            role: 'user',
            content: [
              {
                type: 'text',
                text:
                  content.trim() ||
                  'I have a math problem in this image. Please help me understand it and guide me through solving it step by step using questions, not by giving me the answer directly.',
              },
              {
                type: 'image_url',
                image_url: {
                  url: imageUrl,
                },
              },
            ],
          });
        } else {
          sanitizedMessages.push({
            role,
            content: content.trim(),
          });
        }
      }

      try {
        const client = getOpenAIClient();

        // Use gpt-4o for vision support, fallback to gpt-4o-mini if no images
        const hasImages = sanitizedMessages.some(
          (msg) =>
            msg.role === 'user' &&
            Array.isArray(msg.content) &&
            msg.content.some((item) => typeof item === 'object' && 'image_url' in item),
        );

        // Strengthen system prompt for image messages to emphasize Socratic method
        const systemPromptWithImage = hasImages
          ? `${BASE_SYSTEM_PROMPT}\n\n${MODE_DIRECTIVES[responseMode]}\n\nSPECIAL NOTE FOR IMAGE PROBLEMS: When you see a math problem in an image, you must guide the learner through understanding and solving it using questions. DO NOT solve it for them. Start by asking what they understand about the problem, then guide them step by step with questions.`
          : `${BASE_SYSTEM_PROMPT}\n\n${MODE_DIRECTIVES[responseMode]}`;

        // Update system message with image-specific guidance if needed
        sanitizedMessages[0] = {
          role: 'system',
          content: systemPromptWithImage,
        };

        if (shouldStream) {
          // Streaming mode: use Server-Sent Events (SSE)
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          let parsedContent = ''; // Only store parsed content, never raw JSON
          let accumulatedStepType: StepType | undefined = undefined;
          let jsonBuffer = ''; // Buffer for raw JSON during streaming

          const streamPromise = client.chat.completions.create({
            model: hasImages ? 'gpt-4o' : 'gpt-4o-mini',
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: sanitizedMessages,
            stream: true,
          });

          // Handle streaming asynchronously
          (async () => {
            try {
              const stream = await streamPromise;
              for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content;
                if (delta) {
                  jsonBuffer += delta;

                  // Try to parse complete JSON if we have it
                  try {
                    const parsed = JSON.parse(jsonBuffer);
                    if (
                      parsed &&
                      typeof parsed === 'object' &&
                      typeof parsed.content === 'string'
                    ) {
                      // Only update parsedContent with the actual content, never raw JSON
                      parsedContent = parsed.content.trim();
                      if (isValidStepType(parsed.stepType)) {
                        accumulatedStepType = parsed.stepType;
                      }

                      // Send incremental content update (only if we have parsed content)
                      res.write(
                        `data: ${JSON.stringify({ content: parsedContent, stepType: accumulatedStepType })}\n\n`,
                      );
                    }
                  } catch {
                    // JSON not complete yet, continue accumulating
                    // Don't send anything until we have valid parsed content
                  }
                }
              }

              // Finalize: parse complete JSON and send final result
              try {
                const parsed = JSON.parse(jsonBuffer);
                const finalContent =
                  parsed && typeof parsed === 'object' && typeof parsed.content === 'string'
                    ? parsed.content.trim()
                    : parsedContent.trim();

                const finalStepType =
                  parsed && typeof parsed === 'object' && isValidStepType(parsed.stepType)
                    ? parsed.stepType
                    : accumulatedStepType;

                res.write(
                  `data: ${JSON.stringify({ content: finalContent, stepType: finalStepType, done: true })}\n\n`,
                );
                res.write('data: [DONE]\n\n');
                res.end();
              } catch (parseError) {
                console.error('Failed to parse final JSON:', parseError, jsonBuffer);
                // Send parsed content as fallback (never raw JSON)
                res.write(
                  `data: ${JSON.stringify({ content: parsedContent.trim(), done: true })}\n\n`,
                );
                res.write('data: [DONE]\n\n');
                res.end();
              }
            } catch (error) {
              console.error('Streaming error:', error);
              res.write(`data: ${JSON.stringify({ error: 'Streaming failed' })}\n\n`);
              res.write('data: [DONE]\n\n');
              res.end();
            }
          })();
        } else {
          // Non-streaming mode: original behavior
          client.chat.completions
            .create({
              model: hasImages ? 'gpt-4o' : 'gpt-4o-mini',
              temperature: 0.3,
              response_format: { type: 'json_object' },
              messages: sanitizedMessages,
            })
            .then((completion) => {
              const assistantMessage = completion.choices[0]?.message?.content?.trim();

              if (!assistantMessage) {
                res.status(500).json({ error: 'No response returned from OpenAI.' });
                return;
              }

              let parsed: unknown;

              try {
                parsed = JSON.parse(assistantMessage);
              } catch (parseError) {
                console.error(
                  'Failed to parse assistant response JSON',
                  parseError,
                  assistantMessage,
                );
                res.status(500).json({ error: 'Malformed response returned from OpenAI.' });
                return;
              }

              const content =
                parsed &&
                typeof parsed === 'object' &&
                typeof (parsed as { content?: unknown }).content === 'string'
                  ? ((parsed as { content: string }).content || '').trim()
                  : '';

              if (!content) {
                res.status(500).json({ error: 'OpenAI returned an empty content payload.' });
                return;
              }

              const maybeStepType =
                parsed && typeof parsed === 'object'
                  ? (parsed as { stepType?: unknown }).stepType
                  : undefined;

              const stepType = isValidStepType(maybeStepType) ? maybeStepType : undefined;

              res.status(200).json({ content, stepType });
            })
            .catch((error) => {
              console.error('generateResponse failed', error);
              res.status(500).json({ error: 'Failed to generate response.' });
            });
        }
      } catch (error) {
        console.error('Failed to get OpenAI client:', error);
        res.status(500).json({
          error: 'Failed to initialize OpenAI client. Check logs for details.',
        });
      }
    });
  });

export const generateProblem = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,
    memory: '512MB',
    secrets: ['OPENAI_API_KEY'],
  })
  .https.onRequest((req, res) => {
    corsHandler(req, res, async () => {
      if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
      }

      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const { topic, difficulty, recentProblems, mode } = req.body as {
        topic?: unknown;
        difficulty?: unknown;
        recentProblems?: Array<{ topicId: string; problemText: string; timestamp: number }> | null;
        mode?: 'quiz' | 'tutor';
      };

      const problemMode = mode === 'quiz' ? 'quiz' : 'tutor';

      const requestedTopic = normalizeTopicId(topic);
      const requestedDifficulty: ProblemDifficulty = isValidProblemDifficulty(difficulty)
        ? (difficulty as ProblemDifficulty)
        : DEFAULT_PROBLEM_DIFFICULTY;

      const topicGuidance = requestedTopic ? PROBLEM_TOPIC_GUIDANCE[requestedTopic] : undefined;
      const topicGuidanceText = topicGuidance?.guidance ?? DEFAULT_TOPIC_GUIDANCE;
      const subtopicsText = topicGuidance?.subtopics
        ? `\n\nAvailable subtopics for variety: ${topicGuidance.subtopics.join(', ')}`
        : '';

      // Check for problem diversity violations
      const recentProblemsList = Array.isArray(recentProblems) ? recentProblems : [];

      // When topic is specified, filter by that topic. When not specified, use ALL problems.
      const relevantProblems = requestedTopic
        ? recentProblemsList.filter((p) => p.topicId === requestedTopic)
        : recentProblemsList;

      // Check for 3 in a row (same problem text)
      const lastThree = relevantProblems.slice(-3);
      const threeInARow =
        lastThree.length === 3 &&
        lastThree.every((p) => p.problemText === lastThree[0].problemText);

      // Check for 6 in last 10 (same problem text)
      const lastTen = relevantProblems.slice(-10);
      const sameProblemCount = lastTen.filter(
        (p) => p.problemText === lastTen[lastTen.length - 1]?.problemText,
      ).length;
      const sixInTen = sameProblemCount >= 6;

      // When no topic is specified, check for topic diversity
      let topicDiversityWarning = '';
      if (!requestedTopic && recentProblemsList.length > 0) {
        const recentTopics = recentProblemsList.slice(-5).map((p) => p.topicId);
        const uniqueTopics = new Set(recentTopics);
        if (uniqueTopics.size === 1 && recentTopics.length >= 3) {
          const repeatedTopic = recentTopics[0] || 'unknown';
          topicDiversityWarning = `\n\n🚨 TOPIC DIVERSITY WARNING: The last ${recentTopics.length} problems all used the topic "${repeatedTopic}". You MUST choose a DIFFERENT topic from the available topics (foundations, pre-algebra, algebra, geometry, trigonometry, pre-calculus, statistics, discrete-math, applied-math). DO NOT use "${repeatedTopic}" again.`;
        }
      }

      const diversityWarning =
        threeInARow || sixInTen
          ? `\n\n⚠️ DIVERSITY WARNING: ${threeInARow ? 'The same problem has appeared 3 times in a row. ' : ''}${sixInTen ? 'The same problem has appeared 6 times in the last 10 generations. ' : ''}You MUST generate a DIFFERENT problem with different content, context, and/or subtopic. DO NOT repeat the same problem.`
          : '';

      // Build recent problems text with stronger diversity rules
      const recentProblemsText =
        relevantProblems.length > 0
          ? `\n\n🚨 RECENT PROBLEMS (CRITICAL: Avoid ALL conceptual similarity, not just exact text):
${relevantProblems
  .slice(-10) // Show last 10
  .map(
    (p, i) =>
      `${i + 1}. [${p.topicId || 'unknown'}] ${p.problemText.substring(0, 150)}${p.problemText.length > 150 ? '...' : ''}`,
  )
  .join('\n')}

⚠️ MANDATORY DIVERSITY RULES (YOU MUST FOLLOW THESE):
1. DO NOT use the same numbers or similar numerical values (e.g., if you see "12 apples, 4 friends", NEVER use 12 and 4 again - use completely different numbers like 15, 8, 20, 3, etc.)
2. DO NOT use the same problem structure or setup (e.g., if you see "dividing X among Y friends", use a TOTALLY different scenario like "calculating area", "solving equations", "measuring angles", etc.)
3. DO NOT use the same operation repeatedly (if recent problems used division, use addition, subtraction, multiplication, or a completely different operation)
4. DO NOT just change names or wording - the problem must be MATHEMATICALLY different (different numbers, different operations, different contexts, different subtopic)
5. Vary the subtopic significantly - choose a DIFFERENT subtopic from the available list that hasn't been used recently
6. Use completely different real-world contexts (NOT "apples" repeatedly - use different objects like books, money, distance, time, shapes, etc.)
7. Ensure each problem teaches a DIFFERENT aspect or variation of the topic${requestedTopic ? '' : '\n8. If no topic was specified, choose a DIFFERENT topic from recent problems'}`
          : '';

      // Add mode-specific instructions
      const modeInstructions =
        problemMode === 'quiz'
          ? `

🚨 QUIZ MODE REQUIREMENTS:
- The problem should ONLY ask for the FINAL NUMERICAL ANSWER
- DO NOT ask the learner to "write an equation", "show your work", "explain your steps", or "set up an equation"
- DO NOT ask them to "calculate this by finding the difference" or similar instructions
- Simply ask "How many...?" or "What is...?" or similar direct questions
- The learner will only provide the final answer (e.g., "5" or "8"), not work or equations
- Example GOOD question: "Emma has 15 pencils. She gives away 7. How many pencils does she have left?"
- Example BAD question: "Emma has 15 pencils. She gives away 7. Write an equation and solve to find how many pencils she has left."
- Example BAD question: "Emma has 15 pencils. She gives away 7. Calculate this by finding the difference."
- Keep the question focused on the mathematical scenario and the final answer needed`
          : `
🚨 TUTOR MODE (default):
- You can encourage thinking and reasoning
- The learner may show work or explain steps`;

      // Put diversity requirements FIRST in the system prompt
      const systemContent = `${PROBLEM_GENERATOR_PROMPT}${modeInstructions}

🚨 CRITICAL DIVERSITY REQUIREMENTS (READ THIS FIRST):
- Each problem must be MATHEMATICALLY and CONCEPTUALLY different from recent problems
- Vary the subtopic, numbers, operations, and real-world contexts significantly
- Do NOT create problems that are just reworded versions of recent problems
- Use different subtopics from the available list to ensure true variety
- If you see similar problems in the recent list, you MUST create something completely different
- Return the JSON exactly as specified.

Difficulty focus: ${PROBLEM_DIFFICULTY_GUIDANCE[requestedDifficulty]}
Topic focus: ${topicGuidanceText}${subtopicsText}${topicDiversityWarning}${diversityWarning}${recentProblemsText}`;

      const quizModeReminder =
        problemMode === 'quiz'
          ? `\n\n🚨 REMEMBER: This is QUIZ MODE - only ask for the final numerical answer. Do NOT ask for equations or work. Just ask "How many...?" or "What is...?"`
          : '';

      const userContent = topicGuidance
        ? `Generate one ${requestedDifficulty} problem about ${topicGuidance.label}. 

🚨 CRITICAL REQUIREMENTS:
1. This problem MUST be MATHEMATICALLY DIFFERENT from any recent problems
2. Choose a DIFFERENT subtopic from the available list (not one used recently)
3. Use DIFFERENT numbers (if you see 12 and 4, use different numbers like 15, 8, 20, 3, etc.)
4. Use a DIFFERENT operation (if recent problems used division, use addition, subtraction, multiplication, etc.)
5. Use a COMPLETELY DIFFERENT real-world context (not "apples" again - use books, money, distance, time, shapes, etc.)
6. Do NOT create variations of the same problem - create a genuinely new problem that explores a different aspect of ${topicGuidance.label}
7. The problem structure must be DIFFERENT from recent problems${quizModeReminder}

If you select a different but related topic, set topicId to a descriptive kebab-case label.`
        : `Generate one ${requestedDifficulty} math problem. 

🚨 CRITICAL REQUIREMENTS:
1. Choose a topic that is DIFFERENT from recently used topics (if recent problems used "foundations", choose "algebra", "geometry", "statistics", etc.)
2. This problem MUST be MATHEMATICALLY and CONCEPTUALLY different from any recent problems
3. Use DIFFERENT numbers than recent problems (if you see 12 and 4, use different numbers)
4. Use a DIFFERENT operation (if recent problems used division, use addition, subtraction, multiplication, etc.)
5. Use a COMPLETELY DIFFERENT real-world context (not "apples" repeatedly - use books, money, distance, time, shapes, etc.)
6. The problem structure must be DIFFERENT from recent problems
7. Set topicId to a descriptive kebab-case label matching the topic you choose${quizModeReminder}`;

      try {
        const client = getOpenAIClient();
        const completion = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.85, // High enough for variety but lower to reduce formatting errors
          response_format: { type: 'json_object' },
          messages: [
            { role: 'system', content: systemContent },
            { role: 'user', content: userContent },
          ],
        });

        const rawContent = completion.choices[0]?.message?.content?.trim();

        if (!rawContent) {
          res.status(500).json({ error: 'No response returned from OpenAI.' });
          return;
        }

        let parsed: unknown;

        try {
          parsed = JSON.parse(rawContent);
        } catch (parseError) {
          console.error('Failed to parse generated problem JSON', parseError, rawContent);
          res.status(500).json({ error: 'Malformed problem response returned from OpenAI.' });
          return;
        }

        let problemText =
          parsed &&
          typeof parsed === 'object' &&
          typeof (parsed as { problemText?: unknown }).problemText === 'string'
            ? ((parsed as { problemText: string }).problemText || '').trim()
            : '';

        if (!problemText) {
          res.status(500).json({ error: 'OpenAI returned an empty problem statement.' });
          return;
        }

        // Post-process to fix common formatting issues
        // STEP 1: Fix incorrect splits first (e.g., "or ganizing" -> "organizing")
        // Fix common words that get incorrectly split
        problemText = problemText
          .replace(/\bor\s+ganizing\b/gi, 'organizing')
          .replace(/\bor\s+ganize\b/gi, 'organize')
          .replace(/\bor\s+ganized\b/gi, 'organized')
          .replace(/\bor\s+ganization\b/gi, 'organization')
          .replace(/\bre\s+alizing\b/gi, 'realizing')
          .replace(/\bre\s+alize\b/gi, 'realize')
          .replace(/\bre\s+alized\b/gi, 'realized')
          .replace(/\bre\s+cognizing\b/gi, 'recognizing')
          .replace(/\bre\s+cognize\b/gi, 'recognize')
          .replace(/\bre\s+cognized\b/gi, 'recognized');

        // STEP 2: Fix angle formatting - replace common malformed angle patterns
        problemText = problemText
          .replace(/(\d+)\s*exto\s*/gi, '$1° ') // Fix "60 exto" or "60exto" -> "60° "
          .replace(/(\d+)\s*degrees?\s*/gi, '$1° ') // Standardize "60 degrees" -> "60° "
          .replace(/(\d+)\s*deg\s*/gi, '$1° ') // Fix "60 deg" -> "60° "
          .replace(/(\d+)\s*°\s*/g, '$1° ') // Normalize spacing around degree symbol
          .replace(/([a-z])([A-Z])/g, '$1 $2') // Add space between camelCase words
          // STEP 3: Fix missing spaces between words and numbers
          .replace(/(\d)([a-zA-Z])/g, '$1 $2') // Add space between number and letter (e.g., "7each" -> "7 each")
          .replace(/([a-zA-Z])(\d)/g, '$1 $2') // Add space between letter and number (e.g., "has30" -> "has 30")
          // STEP 4: Fix concatenated words with "and" + number (e.g., "*fictionbooksand9*" -> "fiction books and 9")
          // Handle both with and without markdown asterisks
          // Match pattern: word+books+and+number (e.g., "fictionbooksand9")
          .replace(/\*?([a-z]+?)(books)(and)(\d+)\*?/gi, '$1 $2 $3 $4') // "*fictionbooksand9*" -> "fiction books and 9"
          // Match pattern: word+book+and+number (e.g., "fictionbookand9")
          .replace(/\*?([a-z]+?)(book)(and)(\d+)\*?/gi, '$1 $2 $3 $4') // "*fictionbookand9*" -> "fiction book and 9"
          // Match pattern: word+books+space+and+number (e.g., "fiction booksand9")
          .replace(/\*?([a-z]+)(books)(\s+)(and)(\d+)\*?/gi, '$1 $2 $3$4 $5') // "*fiction booksand9*" -> "fiction books and 9"
          // STEP 5: Fix missing spaces between common words ONLY when clearly concatenated
          .replace(
            /\b(and|or)(she|he|they|we|you|it|the|a|an|this|that|these|those|has|have|had|is|are|was|were|can|will)\b/gi,
            '$1 $2',
          )
          .replace(
            /\b(she|he|they|we|you|it|the|a|an|this|that|these|those|has|have|had|is|are|was|were|can|will)(and|or)\b/gi,
            '$1 $2',
          )
          // STEP 6: Fix common word concatenations (e.g., "fictionbooks" -> "fiction books")
          .replace(/([a-z]+)(books|book)(\s|$|[^a-z])/gi, (match, prefix, word, after) => {
            // Only split if it's clearly a concatenated word (like "fictionbooks")
            // Common patterns: word + "books" or word + "book"
            if (prefix.toLowerCase() === 'fiction' || prefix.toLowerCase() === 'nonfiction') {
              return `${prefix} ${word}${after || ''}`;
            }
            // For other cases, check if prefix looks like a complete word + "s" or similar
            if (prefix.length > 5 && prefix.endsWith('s')) {
              const base = prefix.slice(0, -1);
              // Only split if base is a reasonable word length
              if (base.length > 3) {
                return `${base} ${word}${after || ''}`;
              }
            }
            return match;
          })
          .replace(/\s+/g, ' ') // Normalize multiple spaces to single space
          .trim();

        // Fix currency detection - add dollar signs before numbers in currency context
        // Match patterns like "costs 5", "spend 30", "buy 5", "$5 and", "to spend 30", etc.
        // BUT NOT for quantity contexts like "has 24 pencils", "has 5 books", etc.
        problemText = problemText.replace(
          /\b(?:costs?|spends?|pays?|spent|price|prices?|worth|total|dollars?)\s+(\d+)\b/gi,
          (match, amount, offset) => {
            // Check if there's already a dollar sign before this number
            const beforeMatch = problemText.substring(0, offset);
            const afterMatch = problemText.substring(offset + match.length);
            const contextBefore = beforeMatch.slice(-30);
            const contextAfter = afterMatch.slice(0, 30);

            // If dollar sign already exists immediately before this number, don't add another
            if (contextBefore.slice(-2) === '$' || beforeMatch.slice(-1) === '$') {
              return match;
            }

            // Also check if this number is part of a math expression (don't add $ to equation numbers)
            if (contextAfter.match(/^\s*[+\-*/=()]/) || contextBefore.match(/[+\-*/=()]\s*$/)) {
              return match;
            }

            // Replace the amount with $amount
            return match.replace(amount, `$${amount}`);
          },
        );

        // Handle "has/have" - don't add $ if followed by quantity words (pencils, books, etc.)
        problemText = problemText.replace(
          /\b(has|have)\s+(\d+)\s+([a-z]+)/gi,
          (match, verb, amount, nextWord, offset) => {
            // Check if there's already a dollar sign before this number
            const beforeMatch = problemText.substring(0, offset);
            if (beforeMatch.slice(-1) === '$') {
              return match;
            }

            // Common quantity words that should NOT have $ added
            const quantityWords = [
              'pencils',
              'pencil',
              'books',
              'book',
              'items',
              'item',
              'pieces',
              'piece',
              'objects',
              'object',
              'things',
              'thing',
              'students',
              'student',
              'people',
              'pupils',
              'pupil',
              'children',
              'child',
            ];

            // If followed by a quantity word, don't add $
            if (quantityWords.includes(nextWord.toLowerCase())) {
              return match;
            }

            // If followed by currency-related words, add $
            const currencyWords = ['dollar', 'dollars', 'cent', 'cents', 'money', 'cash'];
            if (currencyWords.includes(nextWord.toLowerCase())) {
              return match.replace(amount, `$${amount}`);
            }

            // For other cases with "has/have", don't add $ to be safe
            return match;
          },
        );

        // Handle "buy/buys + number + more/quantity words" - don't add $ for quantity purchases
        // This must come BEFORE the general "buy/buys" pattern to prevent false currency detection
        problemText = problemText.replace(
          /\b(buy|buys)\s+(\d+)\s+(more|additional|extra)\s+([a-z]+)/gi,
          (match) => {
            // Check if there's already a dollar sign - if so, remove it
            if (match.includes('$')) {
              return match.replace(/\$(\d+)/g, '$1');
            }
            return match;
          },
        );

        // Handle "buy/buys + number + quantity words" - don't add $ for quantity purchases
        problemText = problemText.replace(
          /\b(buy|buys)\s+(\d+)\s+([a-z]+)/gi,
          (match, verb, amount, nextWord, offset) => {
            // Check if there's already a dollar sign - if so, remove it for quantity purchases
            if (match.includes('$')) {
              const quantityWords = [
                'pencils',
                'pencil',
                'books',
                'book',
                'items',
                'item',
                'pieces',
                'piece',
                'objects',
                'object',
                'things',
                'thing',
                'students',
                'student',
                'people',
                'pupils',
                'pupil',
                'children',
                'child',
                'stickers',
                'sticker',
                'apples',
                'apple',
                'oranges',
                'orange',
                'cookies',
                'cookie',
                'candies',
                'candy',
                'marbles',
                'marble',
                'coins',
                'coin',
                'stamps',
                'stamp',
                'cards',
                'card',
                'tickets',
                'ticket',
                'flowers',
                'flower',
                'trees',
                'tree',
                'cars',
                'car',
                'bikes',
                'bike',
                'toys',
                'toy',
                'games',
                'game',
              ];
              if (quantityWords.includes(nextWord.toLowerCase())) {
                return match.replace(/\$(\d+)/g, '$1');
              }
            }

            const beforeMatch = problemText.substring(0, offset);
            if (beforeMatch.slice(-1) === '$') {
              return match;
            }

            // Common quantity words that should NOT have $ added
            const quantityWords = [
              'pencils',
              'pencil',
              'books',
              'book',
              'items',
              'item',
              'pieces',
              'piece',
              'objects',
              'object',
              'things',
              'thing',
              'students',
              'student',
              'people',
              'pupils',
              'pupil',
              'children',
              'child',
              'stickers',
              'sticker',
              'apples',
              'apple',
              'oranges',
              'orange',
              'cookies',
              'cookie',
              'candies',
              'candy',
              'marbles',
              'marble',
              'coins',
              'coin',
              'stamps',
              'stamp',
              'cards',
              'card',
              'tickets',
              'ticket',
              'flowers',
              'flower',
              'trees',
              'tree',
              'cars',
              'car',
              'bikes',
              'bike',
              'toys',
              'toy',
              'games',
              'game',
            ];

            // If followed by a quantity word, don't add $
            if (quantityWords.includes(nextWord.toLowerCase())) {
              return match;
            }

            // If followed by currency-related words, add $
            const currencyWords = ['dollar', 'dollars', 'cent', 'cents', 'money', 'cash'];
            if (currencyWords.includes(nextWord.toLowerCase())) {
              return match.replace(amount, `$${amount}`);
            }

            // For other cases with "buy/buys", add $ to be safe (buying usually implies currency)
            return match.replace(amount, `$${amount}`);
          },
        );

        // Handle "buy/buys" without a following word (e.g., "buy 5" at end of sentence)
        problemText = problemText.replace(
          /\b(buy|buys)\s+\$?(\d+)(\s|$|[.,!?])/gi,
          (match, verb, amount, after, offset) => {
            const beforeMatch = problemText.substring(0, offset);
            if (beforeMatch.slice(-1) === '$') {
              return match;
            }
            // Check context before the match to see if it's likely a quantity
            const contextBefore = problemText.substring(Math.max(0, offset - 20), offset);
            // If preceded by "more" or quantity words, remove $ if present
            if (contextBefore.match(/\b(more|additional|extra)\s+(buy|buys)\s*$/i)) {
              return match.replace(/\$(\d+)/g, '$1');
            }
            // Otherwise, add $ for buying (usually implies currency) if not already present
            if (!match.includes('$')) {
              return match.replace(amount, `$${amount}`);
            }
            return match;
          },
        );

        // Also fix currency at start of sentences or after certain punctuation
        problemText = problemText.replace(
          /(?:^|\. |, |\? |! )(\d+)\s+(?:and|or|to|costs?|spends?|buy|buys?)(?:\s+([a-z]+))?/gi,
          (match, amount, nextWord) => {
            // Check if it's already a currency
            if (match.includes('$')) {
              // If followed by quantity words, remove the $
              if (nextWord) {
                const quantityWords = [
                  'more',
                  'pencils',
                  'pencil',
                  'books',
                  'book',
                  'items',
                  'item',
                  'pieces',
                  'piece',
                  'objects',
                  'object',
                  'things',
                  'thing',
                  'students',
                  'student',
                  'people',
                  'stickers',
                  'sticker',
                ];
                if (quantityWords.includes(nextWord.toLowerCase())) {
                  return match.replace(/\$(\d+)/g, '$1');
                }
              }
              return match;
            }
            // If followed by quantity words, don't add $
            if (nextWord) {
              const quantityWords = [
                'more',
                'pencils',
                'pencil',
                'books',
                'book',
                'items',
                'item',
                'pieces',
                'piece',
                'objects',
                'object',
                'things',
                'thing',
                'students',
                'student',
                'people',
                'stickers',
                'sticker',
              ];
              if (quantityWords.includes(nextWord.toLowerCase())) {
                return match;
              }
            }
            return match.replace(amount, `$${amount}`);
          },
        );

        // Fix malformed currency/LaTeX patterns
        // Pattern: number followed by $$ (not part of valid $$...$$ block) - likely malformed currency
        problemText = problemText.replace(/(\d+)\$\$([^$]|$)/g, (match, num, after) => {
          // If followed by space or end, likely currency - convert to $num
          // If followed by other char, might be start of equation, keep $$
          if (!after || after.trim() === '') {
            return `$${num}${after || ''}`;
          }
          // Check if it's part of a valid LaTeX block $$...$$ by looking ahead
          const restOfText = problemText.substring(problemText.indexOf(match) + match.length);
          if (restOfText.includes('$$')) {
            // Might be valid LaTeX, don't change
            return match;
          }
          // Likely malformed, fix it
          return `$${num}${after}`;
        });

        // Fix standalone double dollar signs (not part of valid $$...$$ blocks)
        // This handles cases where $$ appears alone or malformed
        problemText = problemText.replace(/([^$])\$\$([^$]|$)/g, (match, before, after) => {
          // Check if this is part of a valid $$...$$ block
          const textAfter = problemText.substring(problemText.indexOf(match) + match.length);
          const hasClosingDollar = textAfter.includes('$$');

          if (!hasClosingDollar) {
            // No closing $$, likely malformed - convert to single $
            return `${before}$${after || ''}`;
          }
          // Might be valid LaTeX block, keep it
          return match;
        });

        const rawTopicId =
          parsed &&
          typeof parsed === 'object' &&
          typeof (parsed as { topicId?: unknown }).topicId === 'string'
            ? ((parsed as { topicId: string }).topicId || '').trim()
            : (requestedTopic ?? 'general');
        const resolvedTopicId = sanitizeTopicId(rawTopicId);

        const rawDifficulty =
          parsed &&
          typeof parsed === 'object' &&
          typeof (parsed as { difficulty?: unknown }).difficulty === 'string'
            ? ((parsed as { difficulty: string }).difficulty || '').trim().toLowerCase()
            : '';

        const resolvedDifficulty: ProblemDifficulty = isValidProblemDifficulty(rawDifficulty)
          ? (rawDifficulty as ProblemDifficulty)
          : requestedDifficulty;

        const suggestedHint =
          parsed &&
          typeof parsed === 'object' &&
          typeof (parsed as { suggestedHint?: unknown }).suggestedHint === 'string'
            ? ((parsed as { suggestedHint: string }).suggestedHint || '').trim()
            : '';

        const title =
          parsed &&
          typeof parsed === 'object' &&
          typeof (parsed as { title?: unknown }).title === 'string'
            ? ((parsed as { title: string }).title || '').trim()
            : '';

        res.status(200).json({
          problemText,
          topicId: resolvedTopicId,
          difficulty: resolvedDifficulty,
          suggestedHint: suggestedHint || undefined,
          title: title || undefined,
        });
      } catch (error) {
        console.error('generateProblem failed', error);
        res.status(500).json({ error: 'Failed to generate problem.' });
      }
    });
  });

export const evaluateQuizAnswer = functions
  .region('us-central1')
  .runWith({
    timeoutSeconds: 120,
    memory: '256MB',
    secrets: ['OPENAI_API_KEY'],
  })
  .https.onRequest((req, res) => {
    // Handle OPTIONS preflight request first with CORS headers
    if (req.method === 'OPTIONS') {
      const origin = req.headers.origin;
      if (origin) {
        res.setHeader('Access-Control-Allow-Origin', origin);
        res.setHeader('Access-Control-Allow-Credentials', 'true');
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*');
      }
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
      res.setHeader('Access-Control-Max-Age', '3600');
      res.status(204).end();
      return;
    }

    corsHandler(req, res, () => {
      if (req.method !== 'POST') {
        res.status(405).json({ error: 'Method not allowed' });
        return;
      }

      const { question, userAnswer, difficulty } = req.body as {
        question?: unknown;
        userAnswer?: unknown;
        difficulty?: unknown;
      };

      if (typeof question !== 'string' || question.trim().length === 0) {
        res.status(400).json({ error: 'Question is required.' });
        return;
      }

      const trimmedQuestion = question.trim();
      const trimmedAnswer = typeof userAnswer === 'string' ? userAnswer.trim() : '';
      const requestedDifficulty: ProblemDifficulty = isValidProblemDifficulty(difficulty)
        ? (difficulty as ProblemDifficulty)
        : DEFAULT_PROBLEM_DIFFICULTY;

      (async () => {
        try {
          const client = getOpenAIClient();
          const completion = await client.chat.completions.create({
            model: 'gpt-4o-mini',
            temperature: 0.1,
            response_format: { type: 'json_object' },
            messages: [
              { role: 'system', content: QUIZ_EVALUATION_SYSTEM_PROMPT },
              {
                role: 'user',
                content: `Evaluate the learner's response and provide structured feedback.

IMPORTANT: Calculate the problem yourself step-by-step to verify the correct answer before evaluating the learner's response.

Question:
${trimmedQuestion}

Learner answer:
${trimmedAnswer || '(no answer provided)'}

Difficulty: ${requestedDifficulty}.

QUIZ MODE EVALUATION PROCESS - FOLLOW THESE STEPS EXACTLY:

STEP 1: Calculate the problem yourself to determine the correct answer.
  Example: "Liam has 25 balloons. He gives away 8. How many does he have left?"
  Correct answer: 25 - 8 = 17

STEP 2: Extract the FINAL NUMERICAL ANSWER from the learner's response:
  - If they wrote just a number (e.g., "17"), use that number → 17
  - If they wrote an equation (e.g., "25-8=17", "25 - 8 = 17"), extract the number AFTER the equals sign → 17
  - If they wrote multiple numbers, use the LAST number (the final answer)

STEP 3: Compare mathematically:
  - If extracted number = correct answer → mark isCorrect as TRUE
  - If extracted number ≠ correct answer → mark isCorrect as FALSE

CRITICAL: If the numbers match, it's CORRECT. Do NOT mark as incorrect for formatting, showing work, or any other reason.

EXAMPLES:
- Question: "Liam has 25 balloons. He gives away 8. How many left?" (Correct: 17)
  * Learner writes "17" → isCorrect = TRUE (17 = 17)
  * Learner writes "25-8=17" → isCorrect = TRUE (extract 17, 17 = 17)
  * Learner writes "25 - 8 = 17" → isCorrect = TRUE (extract 17, 17 = 17)
  * Learner writes "17." → isCorrect = TRUE (extract 17, 17 = 17)
  * Learner writes "16" → isCorrect = FALSE (16 ≠ 17)

- Question: "How many more friends does Sarah need to invite?" (Correct: 5)
  * Learner writes "5" → isCorrect = TRUE (5 = 5)
  * Learner writes "8-3=5" → isCorrect = TRUE (extract 5, 5 = 5)
  * Learner writes "8 - 3 = 5" → isCorrect = TRUE (extract 5, 5 = 5)
  * Learner writes "8-3=3" → isCorrect = FALSE (extract 3, 3 ≠ 5)

REMEMBER: 
- The goal is to check if the learner got the RIGHT ANSWER
- If the final numerical answer matches, mark it as CORRECT
- Do NOT mark as incorrect unless the final numerical answer is mathematically wrong
- When in doubt, mark as CORRECT`,
              },
            ],
          });

          const rawContent = completion.choices[0]?.message?.content?.trim();

          if (!rawContent) {
            res.status(500).json({ error: 'No evaluation returned from OpenAI.' });
            return;
          }

          let parsed: unknown;

          try {
            parsed = JSON.parse(rawContent) as QuizEvaluationResponse;
          } catch (parseError) {
            console.error('Failed to parse quiz evaluation JSON', parseError, rawContent);
            res.status(500).json({ error: 'Malformed evaluation response returned from OpenAI.' });
            return;
          }

          const parsedRecord =
            parsed && typeof parsed === 'object'
              ? (parsed as Partial<QuizEvaluationResponse>)
              : ({} as Partial<QuizEvaluationResponse>);

          let isCorrect = parsedRecord.isCorrect === true;
          const correctAnswer = sanitizeEvaluationField(parsedRecord.correctAnswer);
          const explanation = sanitizeEvaluationField(parsedRecord.explanation);
          const feedback = sanitizeEvaluationField(parsedRecord.feedback);

          // FALLBACK VALIDATION: Extract and compare numerical answers
          // This ensures correct answers aren't marked wrong due to OpenAI inconsistencies
          const extractNumericAnswer = (answer: string): number | null => {
            if (!answer || typeof answer !== 'string') {
              return null;
            }
            // Try to find number after = (for equations like "25-8=17" or "25 - 8 = 17")
            const equationMatch = answer.match(/=\s*(\d+(?:\.\d+)?)/);
            if (equationMatch) {
              const num = Number.parseFloat(equationMatch[1]);
              return Number.isFinite(num) ? num : null;
            }
            // Try to find standalone number (last number in the string)
            const numberMatches = answer.match(/(-?\d+(?:\.\d+)?)/g);
            if (numberMatches && numberMatches.length > 0) {
              // Use the last number (usually the final answer)
              const lastNum = Number.parseFloat(numberMatches[numberMatches.length - 1]);
              return Number.isFinite(lastNum) ? lastNum : null;
            }
            return null;
          };

          const userNumericAnswer = extractNumericAnswer(trimmedAnswer);
          const correctNumericAnswer = correctAnswer ? extractNumericAnswer(correctAnswer) : null;

          // If both numerical answers can be extracted and they match, override OpenAI's judgment
          if (userNumericAnswer !== null && correctNumericAnswer !== null) {
            // Compare with small tolerance for floating point numbers
            if (Math.abs(userNumericAnswer - correctNumericAnswer) < 0.001) {
              if (!isCorrect) {
                console.log(
                  `[evaluateQuizAnswer] Overriding OpenAI evaluation: User answer ${userNumericAnswer} matches correct answer ${correctNumericAnswer}. Question: "${trimmedQuestion.substring(0, 100)}..."`,
                );
              }
              isCorrect = true;
            }
          }

          res.status(200).json({
            isCorrect,
            correctAnswer,
            explanation,
            feedback,
          });
        } catch (error) {
          console.error('evaluateQuizAnswer failed', error);
          res.status(500).json({ error: 'Failed to evaluate quiz answer.' });
        }
      })();
    });
  });
