/**
 * Extracts intent candidates from a <nucleant:clarify type="intent"> marker
 * so Part.tsx can render an interactive picker (reuses ClarificationOptions)
 * instead of dropping candidate_intents into a static blockquote.
 */

import type { Agents } from 'librechat-data-provider';

const INTENT_CLARIFY_RE = /<nucleant:clarify>(\{[\s\S]*?\})<\/nucleant:clarify>/;

interface RawCandidateIntent {
  agent_id: string;
  display_name?: string | null;
  layer?: string | null;
  why_match?: string | null;
}

interface RawPayload {
  type?: string;
  candidate_intents?: RawCandidateIntent[];
}

type Clarification = Agents.ClarificationOptionsContent['clarification_options'];

const buildDescription = (c: RawCandidateIntent): string => {
  const layer = c.layer ? `[${c.layer}] ` : '';
  const why = (c.why_match ?? '').trim();
  return `${layer}${why}`.trim();
};

export function extractIntentClarifyData(text: string): {
  cleanText: string;
  clarification: Clarification;
} | null {
  const match = INTENT_CLARIFY_RE.exec(text);
  if (!match) {
    return null;
  }

  let payload: RawPayload;
  try {
    payload = JSON.parse(match[1]) as RawPayload;
  } catch {
    return null;
  }

  if (
    payload.type !== 'intent' ||
    !Array.isArray(payload.candidate_intents) ||
    payload.candidate_intents.length === 0
  ) {
    return null;
  }

  const options = payload.candidate_intents
    .filter((c) => c && c.agent_id)
    .map((c) => {
      const label = (c.display_name ?? c.agent_id).trim();
      return {
        id: c.agent_id,
        label,
        value: label,
        description: buildDescription(c),
      };
    });

  if (options.length === 0) {
    return null;
  }

  const cleanText = text.replace(match[0], '').trim();
  return {
    cleanText,
    clarification: {
      question: '请选择最匹配的意图以继续',
      gaps: [],
      options,
      allow_custom_input: false,
      multi_select: false,
    },
  };
}
