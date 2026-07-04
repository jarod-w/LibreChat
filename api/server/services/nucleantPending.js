/**
 * 在持久化消息前解析 kotlerapi 的 <nucleant:pending> marker。
 *
 * kotlerapi 对长任务的流式响应会以以下形式占位:
 *   <nucleant:pending>{"job_id":"...","message":"..."}</nucleant:pending>
 *
 * 该 marker 会被保存进 message.text。若用户在任务完成前断开,
 * 历史消息将永久带着 marker — 重新打开对话时前端会再次轮询,
 * 而对应 job 早已过期 (404)。
 *
 * 此处在最终落库前同步向 kotlerapi 拉一次 job 状态:
 *   - done   → 用真实结果替换整个 marker 块
 *   - failed → 替换为错误占位文本
 *   - 其他   → 保留 marker (前端兜底会展示 "expired")
 */
const axios = require('axios');
const { logger } = require('@librechat/data-schemas');

const PENDING_MARKER = '<nucleant:pending>';
const PENDING_RE = /<nucleant:pending>(\{[\s\S]*?\})<\/nucleant:pending>/g;
const RESOLVE_TIMEOUT_MS = 3000;

/**
 * @param {string | undefined | null} text
 * @returns {boolean} whether the text carries an unresolved kotlerapi pending marker
 */
function hasNucleantPendingMarker(text) {
  return typeof text === 'string' && text.indexOf(PENDING_MARKER) !== -1;
}

const KOTLER_API_URL = (process.env.KOTLER_API_URL || 'http://localhost:8000').replace(/\/$/, '');

async function fetchJobStatus(jobId) {
  try {
    const response = await axios.get(
      `${KOTLER_API_URL}/v1/jobs/${encodeURIComponent(jobId)}`,
      { timeout: RESOLVE_TIMEOUT_MS },
    );
    return response.data;
  } catch (err) {
    return null;
  }
}

/**
 * @param {string | undefined | null} text
 * @returns {Promise<string | undefined | null>}
 */
async function resolveNucleantPendingMarkers(text) {
  if (!hasNucleantPendingMarker(text)) {
    return text;
  }

  const matches = [...text.matchAll(PENDING_RE)];
  if (matches.length === 0) {
    return text;
  }

  let resolved = text;
  for (const match of matches) {
    const [fullMarker, payload] = match;
    let jobId;
    try {
      jobId = JSON.parse(payload).job_id;
    } catch (err) {
      logger.warn(`[nucleantPending] failed to parse marker payload: ${payload}`);
      continue;
    }
    if (!jobId) {
      continue;
    }

    const job = await fetchJobStatus(jobId);
    if (!job) {
      continue;
    }

    if (job.status === 'done' && typeof job.result === 'string' && job.result.length > 0) {
      resolved = resolved.replace(fullMarker, job.result);
    } else if (job.status === 'failed') {
      resolved = resolved.replace(fullMarker, '> ❌ Analysis failed.');
    }
  }

  return resolved;
}

module.exports = { PENDING_MARKER, hasNucleantPendingMarker, resolveNucleantPendingMarkers };
