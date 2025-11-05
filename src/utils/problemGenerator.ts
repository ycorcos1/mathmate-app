import { callGenerateProblem } from '../api/generateProblem';
import type {
  GeneratedProblem,
  ProblemDifficulty,
  ProblemGenerationParams,
  ProblemTopic,
} from '../types/problem';

export const PROBLEM_TOPICS: ProblemTopic[] = [
  {
    id: 'arithmetic-fractions',
    label: 'Fractions & Ratios',
    description: 'Compare, add, or subtract fractions and ratios with real-world context.',
    samplePrompt:
      'Create a word problem involving comparing or adding fractions with unlike denominators.',
  },
  {
    id: 'algebra-linear-equations',
    label: 'Linear Equations',
    description: 'Solve single-variable equations or systems of linear equations.',
    samplePrompt: 'Craft an equation-solving problem where the student isolates the variable.',
  },
  {
    id: 'algebra-quadratics',
    label: 'Quadratic Expressions',
    description: 'Factor, expand, or solve quadratic equations with reasoning.',
    samplePrompt: 'Design a quadratic equation the student must solve by factoring.',
  },
  {
    id: 'geometry-triangles',
    label: 'Triangles & Angles',
    description: 'Use triangle properties, similarity, or Pythagorean theorem.',
    samplePrompt:
      'Create a triangle problem requiring the Pythagorean theorem or angle relationships.',
  },
  {
    id: 'geometry-circles',
    label: 'Circles & Arcs',
    description: 'Work with circumference, area, sectors, or central angles.',
    samplePrompt: 'Write a problem about finding an arc length or area of a sector.',
  },
  {
    id: 'calculus-derivatives',
    label: 'Intro Calculus',
    description: 'Differentiate or interpret rates of change using derivatives.',
    samplePrompt: 'Propose a derivative application problem with a contextual scenario.',
  },
];

export const DIFFICULTY_OPTIONS: Array<{
  value: ProblemDifficulty;
  label: string;
  description: string;
}> = [
  {
    value: 'beginner',
    label: 'Beginner',
    description: 'Foundational skills with guided numbers and direct cues.',
  },
  {
    value: 'intermediate',
    label: 'Intermediate',
    description: 'Multi-step reasoning with moderate abstraction and vocabulary.',
  },
  {
    value: 'advanced',
    label: 'Advanced',
    description: 'Challenging scenarios requiring synthesis or multiple concepts.',
  },
];

export const generateProblem = async (params: ProblemGenerationParams): Promise<GeneratedProblem> =>
  callGenerateProblem(params);

export const getTopicLabel = (topicId: string | null | undefined): string | null => {
  if (!topicId) {
    return null;
  }

  const topic = PROBLEM_TOPICS.find((item) => item.id === topicId);
  if (topic) {
    return topic.label;
  }

  return topicId
    .split('-')
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};

