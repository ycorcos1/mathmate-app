import { callGenerateProblem } from '../api/generateProblem';
import type {
  GeneratedProblem,
  ProblemDifficulty,
  ProblemGenerationParams,
  ProblemTopic,
} from '../types/problem';

export const PROBLEM_TOPICS: ProblemTopic[] = [
  {
    id: 'foundations',
    label: 'Foundations',
    description:
      'Arithmetic, order of operations, factors, prime numbers, fractions, decimals, percentages, ratios, and exponents.',
    samplePrompt:
      'Create a problem involving fractions, decimals, percentages, or ratios with real-world context.',
  },
  {
    id: 'pre-algebra',
    label: 'Pre-Algebra',
    description:
      'Integers, absolute value, expressions, variables, linear equations, inequalities, coordinate plane, and functions.',
    samplePrompt:
      'Craft a problem involving linear equations, inequalities, or expressions with variables.',
  },
  {
    id: 'algebra',
    label: 'Algebra I & II',
    description:
      'Systems of equations, quadratics, factoring, polynomials, rational expressions, radicals, exponential functions, sequences, and complex numbers.',
    samplePrompt:
      'Design a problem involving systems of equations, quadratics, factoring, or polynomials.',
  },
  {
    id: 'geometry',
    label: 'Geometry',
    description:
      'Points, lines, planes, angles, triangles, Pythagorean theorem, circles, polygons, coordinate geometry, perimeter, area, volume, transformations, and proofs.',
    samplePrompt:
      'Create a geometry problem involving triangles, circles, area, volume, or coordinate geometry.',
  },
  {
    id: 'trigonometry',
    label: 'Trigonometry',
    description:
      'Unit circle, sine, cosine, tangent, graphing trig functions, inverse functions, identities, law of sines/cosines, radians, and applications.',
    samplePrompt: 'Write a problem involving trigonometric functions, identities, or applications.',
  },
  {
    id: 'pre-calculus-calculus',
    label: 'Pre-Calculus & Calculus',
    description:
      'Limits, continuity, derivatives, integrals, differential equations, parametric equations, polar equations, and infinite series.',
    samplePrompt:
      'Propose a calculus problem involving limits, derivatives, or integrals with applications.',
  },
  {
    id: 'statistics-probability',
    label: 'Statistics & Probability',
    description:
      'Mean, median, mode, variance, standard deviation, probability rules, conditional probability, combinations, permutations, distributions, and hypothesis testing.',
    samplePrompt:
      'Create a statistics or probability problem involving data analysis or probability calculations.',
  },
  {
    id: 'discrete-math-logic',
    label: 'Discrete Math & Logic',
    description:
      'Logic, truth tables, set theory, combinatorics, graph theory, counting principles, matrices, and recursion.',
    samplePrompt:
      'Design a discrete math problem involving logic, sets, combinatorics, or graph theory.',
  },
  {
    id: 'applied-math',
    label: 'Applied Math',
    description:
      'Word problems, financial math, rate/time/distance, geometry applications, data interpretation, and unit conversions.',
    samplePrompt:
      'Create a real-world applied math problem involving financial math, rates, or data interpretation.',
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
