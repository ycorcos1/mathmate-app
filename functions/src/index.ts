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

const DEFAULT_PROBLEM_DIFFICULTY: ProblemDifficulty = 'intermediate';

const PROBLEM_DIFFICULTY_GUIDANCE: Record<ProblemDifficulty, string> = {
  beginner:
    'Design an accessible problem with concrete numbers, explicit structure, and a clear question suitable for students building foundational skills.',
  intermediate:
    'Create a multi-step problem that blends conceptual reasoning and computation, appropriate for typical Algebra I/II or Geometry learners.',
  advanced:
    'Craft a challenging problem that requires synthesizing multiple ideas or deeper abstraction, fitting for precalculus, calculus, or contest-style thinking.',
};

const PROBLEM_TOPIC_GUIDANCE: Record<string, { label: string; guidance: string }> = {
  'arithmetic-fractions': {
    label: 'Fractions & Ratios',
    guidance:
      'Focus on comparing, adding, subtracting, or reasoning with fractions and ratios. Embed the situation in a real-world or story context when possible.',
  },
  'algebra-linear-equations': {
    label: 'Linear Equations',
    guidance:
      'Center the problem on solving single-variable linear equations or systems with clear reasoning steps and opportunities to check work.',
  },
  'algebra-quadratics': {
    label: 'Quadratic Expressions',
    guidance:
      'Highlight factoring, expanding, or solving quadratic equations. Encourage analyzing the structure of the quadratic before proceeding.',
  },
  'geometry-triangles': {
    label: 'Triangles & Angles',
    guidance:
      'Use triangle properties, similarity, or the Pythagorean theorem. Invite the learner to diagram or reference geometric relationships.',
  },
  'geometry-circles': {
    label: 'Circles & Arcs',
    guidance:
      'Work with central angles, arc length, area, or chord properties inside circles. Provide enough detail for geometric reasoning without giving the answer.',
  },
  'calculus-derivatives': {
    label: 'Intro Calculus',
    guidance:
      'Ask for interpretation or computation of derivatives, emphasizing rate-of-change intuition within a contextual scenario.',
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

Rules:
1. NEVER include the final answer or full worked solution.
2. Encourage the learner to think or explain their steps.
3. Use LaTeX delimiters ($...$ or $$...$$) for mathematical expressions when appropriate.
4. Omit suggestedHint if it is not necessary.
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
          console.log('Processing message with image:', { imageUrl, content });
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

        console.log('Sending to OpenAI:', {
          model: hasImages ? 'gpt-4o' : 'gpt-4o-mini',
          hasImages,
          messageCount: sanitizedMessages.length,
          stream: shouldStream,
        });

        if (shouldStream) {
          // Streaming mode: use Server-Sent Events (SSE)
          res.setHeader('Content-Type', 'text/event-stream');
          res.setHeader('Cache-Control', 'no-cache');
          res.setHeader('Connection', 'keep-alive');

          let accumulatedContent = '';
          let accumulatedStepType: StepType | undefined = undefined;
          let jsonBuffer = '';

          const stream = client.chat.completions.create({
            model: hasImages ? 'gpt-4o' : 'gpt-4o-mini',
            temperature: 0.3,
            response_format: { type: 'json_object' },
            messages: sanitizedMessages,
            stream: true,
          });

          // Handle streaming asynchronously
          (async () => {
            try {
              for await (const chunk of stream) {
                const delta = chunk.choices[0]?.delta?.content;
                if (delta) {
                  jsonBuffer += delta;
                  accumulatedContent += delta;

                  // Try to parse complete JSON if we have it
                  try {
                    const parsed = JSON.parse(jsonBuffer);
                    if (
                      parsed &&
                      typeof parsed === 'object' &&
                      typeof parsed.content === 'string'
                    ) {
                      accumulatedContent = parsed.content.trim();
                      if (isValidStepType(parsed.stepType)) {
                        accumulatedStepType = parsed.stepType;
                      }
                    }
                  } catch {
                    // JSON not complete yet, continue accumulating
                  }

                  // Send incremental content update
                  res.write(
                    `data: ${JSON.stringify({ content: accumulatedContent, stepType: accumulatedStepType })}\n\n`,
                  );
                }
              }

              // Finalize: parse complete JSON and send final result
              try {
                const parsed = JSON.parse(jsonBuffer);
                const finalContent =
                  parsed && typeof parsed === 'object' && typeof parsed.content === 'string'
                    ? parsed.content.trim()
                    : accumulatedContent.trim();

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
                // Send accumulated content as fallback
                res.write(
                  `data: ${JSON.stringify({ content: accumulatedContent.trim(), done: true })}\n\n`,
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

      const { topic, difficulty } = req.body as {
        topic?: unknown;
        difficulty?: unknown;
      };

      const requestedTopic = normalizeTopicId(topic);
      const requestedDifficulty: ProblemDifficulty = isValidProblemDifficulty(difficulty)
        ? (difficulty as ProblemDifficulty)
        : DEFAULT_PROBLEM_DIFFICULTY;

      const topicGuidance = requestedTopic ? PROBLEM_TOPIC_GUIDANCE[requestedTopic] : undefined;
      const topicGuidanceText = topicGuidance?.guidance ?? DEFAULT_TOPIC_GUIDANCE;

      const systemContent = `${PROBLEM_GENERATOR_PROMPT}

Difficulty focus: ${PROBLEM_DIFFICULTY_GUIDANCE[requestedDifficulty]}
Topic focus: ${topicGuidanceText}
Return the JSON exactly as specified.`;

      const userContent = topicGuidance
        ? `Generate one ${requestedDifficulty} problem about ${topicGuidance.label}. If you select a different but related topic, set topicId to a descriptive kebab-case label.`
        : `Generate one ${requestedDifficulty} math problem. Choose an appropriate topic and set topicId to a descriptive kebab-case label.`;

      try {
        const client = getOpenAIClient();
        const completion = await client.chat.completions.create({
          model: 'gpt-4o-mini',
          temperature: 0.7,
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

        const problemText =
          parsed &&
          typeof parsed === 'object' &&
          typeof (parsed as { problemText?: unknown }).problemText === 'string'
            ? ((parsed as { problemText: string }).problemText || '').trim()
            : '';

        if (!problemText) {
          res.status(500).json({ error: 'OpenAI returned an empty problem statement.' });
          return;
        }

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
