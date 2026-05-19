/**
 * Extracts structured field data from a <nucleant:clarify type="fields"> marker
 * so Part.tsx can render an interactive FieldsForm instead of plain markdown text.
 */

const FIELDS_CLARIFY_RE = /<nucleant:clarify>(\{[\s\S]*?\})<\/nucleant:clarify>/;

export interface FieldSpec {
  field: string;
  question: string;
  ui_type: 'free_text' | 'single_choice' | 'multi_choice';
  options?: string[] | null;
}

interface RawPayload {
  type?: string;
  missing_fields?: FieldSpec[];
}

/**
 * Detects `<nucleant:clarify>{"type":"fields","missing_fields":[...]}` in raw text.
 * Returns null when the marker is absent, malformed, or has no missing_fields.
 * Called by Part.tsx before falling through to markdown rendering.
 */
export function extractFieldsFormData(text: string): {
  cleanText: string;
  fields: FieldSpec[];
} | null {
  const match = FIELDS_CLARIFY_RE.exec(text);
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
    payload.type !== 'fields' ||
    !Array.isArray(payload.missing_fields) ||
    payload.missing_fields.length === 0
  ) {
    return null;
  }

  const cleanText = text.replace(match[0], '').trim();
  return { cleanText, fields: payload.missing_fields };
}
