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

/**
 * Resolves every kotlerapi pending marker inside a message's content parts against
 * the now-completed job, returning the new parts plus whether anything changed.
 * @param {Array<{ type?: string, text?: string }> | undefined} content
 * @returns {Promise<{ content: Array | undefined, changed: boolean }>}
 */
async function resolveContentParts(content) {
  if (!Array.isArray(content)) {
    return { content, changed: false };
  }
  let changed = false;
  const resolved = await Promise.all(
    content.map(async (part) => {
      if (part?.type !== 'text' || !hasNucleantPendingMarker(part.text)) {
        return part;
      }
      const text = await resolveNucleantPendingMarkers(part.text);
      if (text !== part.text) {
        changed = true;
        return { ...part, text };
      }
      return part;
    }),
  );
  return { content: resolved, changed };
}

/**
 * Collects every kotlerapi job id embedded in a text blob's pending markers.
 * @param {string | undefined | null} text
 * @param {Set<string>} out
 */
function collectJobIds(text, out) {
  if (!hasNucleantPendingMarker(text)) {
    return;
  }
  for (const match of text.matchAll(PENDING_RE)) {
    try {
      const jobId = JSON.parse(match[1]).job_id;
      if (jobId) {
        out.add(jobId);
      }
    } catch {
      logger.warn(`[nucleantPending] failed to parse marker payload: ${match[1]}`);
    }
  }
}

/**
 * Records `jobId → { conversationId, messageId, user }` so the kotlerapi
 * job-complete webhook can later find and settle the right pending message.
 * Best-effort: any failure is logged and swallowed — never breaks message save.
 *
 * @param {object} params
 * @param {string | undefined | null} params.text
 * @param {Array<{ type?: string, text?: string }> | undefined} [params.content]
 * @param {string} params.conversationId
 * @param {string} params.messageId
 * @param {string} params.user - the owning user id
 * @returns {Promise<void>}
 */
async function recordPendingJobMapping({ text, content, conversationId, messageId, user }) {
  try {
    if (!conversationId || !messageId || !user) {
      return;
    }
    const jobIds = new Set();
    collectJobIds(text, jobIds);
    if (Array.isArray(content)) {
      for (const part of content) {
        if (part?.type === 'text') {
          collectJobIds(part.text, jobIds);
        }
      }
    }
    if (jobIds.size === 0) {
      return;
    }
    const getLogStores = require('~/cache/getLogStores');
    const { CacheKeys } = require('librechat-data-provider');
    const cache = getLogStores(CacheKeys.NUCLEANT_PENDING_JOBS);
    await Promise.all(
      [...jobIds].map((jobId) => cache.set(jobId, { conversationId, messageId, user })),
    );
  } catch (err) {
    logger.warn(`[nucleantPending] failed to record job mapping: ${err?.message}`);
  }
}

/**
 * Settles a pending message once its kotlerapi job reaches a terminal state.
 * Looks up the recorded mapping for `jobId`, re-resolves the marker against the
 * now-finished job, and writes the real content into the Mongo message so future
 * re-opens never re-poll (and never hit the expired-job 404).
 *
 * Idempotent and safe to call from the unauthenticated webhook: it derives the
 * owning user from the stored mapping and never trusts caller-supplied identity.
 *
 * @param {string} jobId
 * @returns {Promise<{ settled: boolean, changed?: boolean, reason?: string }>}
 */
async function settlePendingJobById(jobId) {
  if (!jobId) {
    return { settled: false, reason: 'no-job-id' };
  }
  const getLogStores = require('~/cache/getLogStores');
  const { CacheKeys } = require('librechat-data-provider');
  const { getMessages, updateMessage } = require('~/models');

  const cache = getLogStores(CacheKeys.NUCLEANT_PENDING_JOBS);
  const mapping = await cache.get(jobId);
  if (!mapping) {
    return { settled: false, reason: 'no-mapping' };
  }

  const { conversationId, messageId, user } = mapping;
  const messages = await getMessages({ conversationId, user });
  const aiMessage = messages?.find((message) => message.messageId === messageId);
  if (!aiMessage) {
    await cache.delete(jobId);
    return { settled: false, reason: 'message-gone' };
  }

  const resolvedText = await resolveNucleantPendingMarkers(aiMessage.text);
  const { content: resolvedContent, changed: contentChanged } = await resolveContentParts(
    aiMessage.content,
  );
  const textChanged = resolvedText !== aiMessage.text;

  const stillPending =
    hasNucleantPendingMarker(resolvedText) ||
    (Array.isArray(resolvedContent) &&
      resolvedContent.some((part) => part?.type === 'text' && hasNucleantPendingMarker(part.text)));

  if (stillPending) {
    return { settled: false, reason: 'job-not-resolvable' };
  }

  if (textChanged || contentChanged) {
    await updateMessage(
      { user: { id: user } },
      {
        messageId,
        ...(textChanged ? { text: resolvedText } : {}),
        ...(contentChanged ? { content: resolvedContent } : {}),
      },
      { context: 'nucleantPending.settlePendingJobById' },
    );
  }

  await cache.delete(jobId);
  return { settled: true, changed: textChanged || contentChanged };
}

module.exports = {
  PENDING_MARKER,
  hasNucleantPendingMarker,
  resolveNucleantPendingMarkers,
  resolveContentParts,
  recordPendingJobMapping,
  settlePendingJobById,
};
