/**
 * 从原始 SSE 文本中提取 <nucleant:pending> marker 的 payload。
 *
 * 必须在 preprocessNucleantMarkers() 之前调用，因为该函数会把 marker 转成
 * 可读 markdown，原始 JSON 数据将丢失。
 */

export interface PendingPayload {
  job_id: string;
  poll_url: string;
  message: string;
}

const PENDING_RE = /<nucleant:pending>(\{[\s\S]*?\})<\/nucleant:pending>/;

export function extractPendingData(rawContent: string): PendingPayload | null {
  if (!rawContent || rawContent.indexOf('<nucleant:pending>') === -1) {
    return null;
  }
  const match = PENDING_RE.exec(rawContent);
  if (!match) {
    return null;
  }
  try {
    const payload = JSON.parse(match[1]) as PendingPayload;
    if (!payload.job_id) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}
