import type { Agents } from 'librechat-data-provider';

const CLARIFICATION_MARKER = '<!-- KOTLER_CLARIFICATION:';

/**
 * Extract clarification options data from message text content.
 *
 * KotlerAPI embeds structured clarification data as an HTML comment marker
 * within the text content: <!-- KOTLER_CLARIFICATION:{json} -->
 *
 * @returns An object with the clean text (marker removed) and parsed clarification data, or null.
 */
export function extractClarificationData(text: string): {
  cleanText: string;
  clarification: Agents.ClarificationOptionsContent['clarification_options'];
} | null {
  const markerStart = text.indexOf(CLARIFICATION_MARKER);
  if (markerStart === -1) {
    return null;
  }

  const jsonStart = markerStart + CLARIFICATION_MARKER.length;
  const markerEnd = text.indexOf('-->', jsonStart);
  if (markerEnd === -1) {
    return null;
  }

  try {
    const jsonStr = text.substring(jsonStart, markerEnd).trim();
    const data = JSON.parse(jsonStr);
    const cleanText = text.substring(0, markerStart).trimEnd();

    return {
      cleanText,
      clarification: {
        question: data.question ?? '',
        gaps: data.gaps ?? [],
        options: data.options ?? [],
        allow_custom_input: data.allow_custom_input ?? true,
        multi_select: data.multi_select ?? false,
      },
    };
  } catch {
    return null;
  }
}
