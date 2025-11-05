import { Component, Fragment, ReactNode } from 'react';
import { BlockMath, InlineMath } from 'react-katex';
import 'katex/dist/katex.css';

type Segment =
  | { type: 'text'; value: string }
  | { type: 'inline'; value: string }
  | { type: 'block'; value: string };

// Validate basic LaTeX syntax
const validateLaTeX = (latex: string): { valid: boolean; error?: string } => {
  if (!latex || latex.trim().length === 0) {
    return { valid: false, error: 'Empty LaTeX expression' };
  }

  // Check for null bytes (security concern)
  if (latex.includes('\0')) {
    return { valid: false, error: 'Invalid characters in LaTeX' };
  }

  // Basic check for balanced braces (common issue)
  let braceCount = 0;
  let bracketCount = 0;
  let parenCount = 0;

  for (let i = 0; i < latex.length; i++) {
    const char = latex[i];
    if (char === '{') braceCount++;
    else if (char === '}') braceCount--;
    else if (char === '[') bracketCount++;
    else if (char === ']') bracketCount--;
    else if (char === '(') parenCount++;
    else if (char === ')') parenCount--;
  }

  if (braceCount !== 0 || bracketCount !== 0 || parenCount !== 0) {
    return { valid: false, error: 'Unbalanced delimiters in LaTeX' };
  }

  return { valid: true };
};

// Sanitize LaTeX input (basic sanitization)
const sanitizeLaTeX = (latex: string): string => {
  // Remove null bytes
  let sanitized = latex.replace(/\0/g, '');
  // Trim whitespace
  sanitized = sanitized.trim();
  return sanitized;
};

// Match $$...$$, \[...\], $...$, and \(...\)
// For \(...\), we need to handle nested parentheses by matching until we find \) that's not escaped
const parseMathDelimiters = (input: string): Segment[] => {
  const segments: Segment[] = [];
  let lastIndex = 0;
  let i = 0;

  while (i < input.length) {
    // Check for block math: $$...$$
    if (input[i] === '$' && input[i + 1] === '$') {
      const start = i + 2;
      const end = input.indexOf('$$', start);
      if (end !== -1) {
        if (i > lastIndex) {
          segments.push({ type: 'text', value: input.slice(lastIndex, i) });
        }
        segments.push({ type: 'block', value: input.slice(start, end) });
        i = end + 2;
        lastIndex = i;
        continue;
      }
    }

    // Check for inline math: $...$
    if (input[i] === '$' && input[i - 1] !== '$' && input[i + 1] !== '$') {
      const start = i + 1;
      const end = input.indexOf('$', start);
      if (end !== -1) {
        if (i > lastIndex) {
          segments.push({ type: 'text', value: input.slice(lastIndex, i) });
        }
        segments.push({ type: 'inline', value: input.slice(start, end) });
        i = end + 1;
        lastIndex = i;
        continue;
      }
    }

    // Check for block math: \[...\]
    if (input[i] === '\\' && input[i + 1] === '[') {
      const start = i + 2;
      const end = input.indexOf('\\]', start);
      if (end !== -1) {
        if (i > lastIndex) {
          segments.push({ type: 'text', value: input.slice(lastIndex, i) });
        }
        segments.push({ type: 'block', value: input.slice(start, end) });
        i = end + 2;
        lastIndex = i;
        continue;
      }
    }

    // Check for inline math: \(...\) - handle nested parentheses
    if (input[i] === '\\' && input[i + 1] === '(') {
      const start = i + 2;
      let depth = 1;
      let j = start;

      while (j < input.length && depth > 0) {
        if (input[j] === '\\' && input[j + 1] === ')') {
          depth--;
          if (depth === 0) {
            if (i > lastIndex) {
              segments.push({ type: 'text', value: input.slice(lastIndex, i) });
            }
            segments.push({ type: 'inline', value: input.slice(start, j) });
            i = j + 2;
            lastIndex = i;
            break;
          }
          j += 2;
        } else if (input[j] === '\\' && input[j + 1] === '(') {
          depth++;
          j += 2;
        } else {
          j++;
        }
      }

      if (depth === 0) {
        continue;
      }
    }

    i++;
  }

  if (lastIndex < input.length) {
    segments.push({ type: 'text', value: input.slice(lastIndex) });
  }

  return segments.length > 0 ? segments : [{ type: 'text', value: input }];
};

const parseSegments = (input: string): Segment[] => {
  // Use the custom parser which handles all delimiter types including nested parentheses in \(...\)
  return parseMathDelimiters(input);
};

// Error boundary for LaTeX rendering
class LaTeXErrorBoundary extends Component<
  { children: ReactNode; math: string; type: 'block' | 'inline' },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: { children: ReactNode; math: string; type: 'block' | 'inline' }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error) {
    console.error('LaTeX rendering error:', error);
  }

  render() {
    if (this.state.hasError) {
      const { math, type } = this.props;
      const sanitized = sanitizeLaTeX(math);

      if (type === 'block') {
        return (
          <div className="my-2 rounded-lg border border-brand-coral/40 bg-[#FEE2E2] p-3">
            <div className="flex items-start gap-2">
              <span className="text-lg">⚠️</span>
              <div className="flex-1">
                <p className="text-xs font-medium text-brand-charcoal">
                  Could not render this equation
                </p>
                <code className="mt-1 block rounded bg-white px-2 py-1 text-xs text-brand-slate">
                  {sanitized}
                </code>
                {this.state.error && (
                  <p className="mt-1 text-xs text-brand-slate">Error: {this.state.error.message}</p>
                )}
              </div>
            </div>
          </div>
        );
      }

      return (
        <span className="inline-block rounded border border-brand-coral/40 bg-[#FEE2E2] px-1.5 py-0.5 text-xs">
          <span className="mr-1">⚠️</span>
          <code className="text-brand-slate">{sanitized}</code>
        </span>
      );
    }

    return this.props.children;
  }
}

// Safe LaTeX renderer with error boundary
const SafeBlockMath = ({ math }: { math: string }) => {
  const sanitized = sanitizeLaTeX(math);
  const validation = validateLaTeX(sanitized);

  if (!validation.valid) {
    return (
      <div className="my-2 rounded-lg border border-brand-coral/40 bg-[#FEE2E2] p-3">
        <div className="flex items-start gap-2">
          <span className="text-lg">⚠️</span>
          <div className="flex-1">
            <p className="text-xs font-medium text-brand-charcoal">
              Could not render this equation
            </p>
            <code className="mt-1 block rounded bg-white px-2 py-1 text-xs text-brand-slate">
              {sanitized}
            </code>
            {validation.error && (
              <p className="mt-1 text-xs text-brand-slate">{validation.error}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <LaTeXErrorBoundary math={sanitized} type="block">
      <BlockMath math={sanitized} />
    </LaTeXErrorBoundary>
  );
};

// Safe inline LaTeX renderer with error boundary
const SafeInlineMath = ({ math }: { math: string }) => {
  const sanitized = sanitizeLaTeX(math);
  const validation = validateLaTeX(sanitized);

  if (!validation.valid) {
    return (
      <span className="inline-block rounded border border-brand-coral/40 bg-[#FEE2E2] px-1.5 py-0.5 text-xs">
        <span className="mr-1">⚠️</span>
        <code className="text-brand-slate">{sanitized}</code>
      </span>
    );
  }

  return (
    <LaTeXErrorBoundary math={sanitized} type="inline">
      <InlineMath math={sanitized} />
    </LaTeXErrorBoundary>
  );
};

export const MathText = ({ content }: { content: string }) => {
  const segments = parseSegments(content);

  return (
    <div className="text-sm leading-relaxed text-brand-charcoal">
      {segments.map((segment, index) => {
        if (segment.type === 'block') {
          return (
            <div
              key={`block-${index}`}
              className="my-4 overflow-x-auto rounded-xl border border-brand-mint/40 bg-white p-4 shadow-sm"
            >
              <div className="flex justify-center">
                <SafeBlockMath math={segment.value} />
              </div>
            </div>
          );
        }

        if (segment.type === 'inline') {
          return <SafeInlineMath key={`inline-${index}`} math={segment.value} />;
        }

        const lines = segment.value.split(/\r?\n/);

        return (
          <Fragment key={`text-${index}`}>
            {lines.map((line, lineIndex) => (
              <Fragment key={`text-line-${index}-${lineIndex}`}>
                {line}
                {lineIndex < lines.length - 1 ? <br /> : null}
              </Fragment>
            ))}
          </Fragment>
        );
      })}
    </div>
  );
};

export default MathText;
