const { logger } = require('@librechat/data-schemas');
const { CacheKeys, Constants } = require('librechat-data-provider');
const { createRun, createSafeUser, createTokenCounter } = require('@librechat/api');
const {
  hasNucleantPendingMarker,
  resolveNucleantPendingMarkers,
} = require('~/server/services/nucleantPending');
const { initializeClient, buildOptions } = require('~/server/services/Endpoints/agents');
const { getConvo, saveConvo } = require('~/models/Conversation');
const { getMessages, updateMessage } = require('~/models');
const getLogStores = require('~/cache/getLogStores');

const DEFAULT_TITLE = 'New Chat';
const TITLE_CACHE_TTL_MS = 120000;

/**
 * A response `res` stub for `initializeClient`. Title generation never streams to
 * the client (it only resolves provider config and runs a single title call), so
 * the aggregation callbacks wired by `initializeClient` are never invoked here.
 */
const noopRes = {
  write: () => true,
  end: () => {},
  headersSent: false,
  writableEnded: false,
};

/**
 * @param {Array<{ type?: string, text?: string }> | undefined} content
 * @returns {string}
 */
function joinTextParts(content) {
  if (!Array.isArray(content)) {
    return '';
  }
  return content
    .filter((part) => part?.type === 'text' && typeof part.text === 'string')
    .map((part) => part.text)
    .join('\n');
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
 * Runs the standard agent title generation against already-resolved content,
 * reusing `AgentClient.titleConvo` so provider/title config is honored exactly as
 * in the live flow. A minimal run is created solely to satisfy `titleConvo`'s
 * dependency on `client.run.generateTitle` — no graph/tool execution occurs.
 *
 * @param {import('express').Request} req
 * @param {object} params
 * @param {import('librechat-data-provider').TConversation} params.convo
 * @param {string} params.inputText - the user's first message text
 * @param {string} params.contentText - the resolved assistant content
 * @param {string} params.messageId - the assistant message id
 * @param {string} params.parentMessageId
 * @returns {Promise<string | undefined>}
 */
async function generateTitle(req, { convo, inputText, contentText, messageId, parentMessageId }) {
  const abortController = new AbortController();
  try {
    const { spec, iconURL, agent_id, endpoint, endpointType, model } = convo;
    const parsedBody = { spec, iconURL, agent_id, ...(model != null ? { model } : {}) };
    const endpointOption = buildOptions(req, endpoint, parsedBody, endpointType);

    req.body = {
      ...(req.body ?? {}),
      endpointOption,
      conversationId: convo.conversationId,
      parentMessageId: parentMessageId ?? Constants.NO_PARENT,
    };

    const { client } = await initializeClient({
      req,
      res: noopRes,
      signal: abortController.signal,
      endpointOption,
    });

    const agents = [client.options.agent];
    if (client.agentConfigs && client.agentConfigs.size > 0) {
      agents.push(...client.agentConfigs.values());
    }

    client.conversationId = convo.conversationId;
    client.responseMessageId = messageId;
    client.parentMessageId = parentMessageId ?? Constants.NO_PARENT;
    client.contentParts = [{ type: 'text', text: contentText }];

    client.run = await createRun({
      agents,
      messages: [],
      indexTokenCountMap: {},
      runId: messageId,
      signal: abortController.signal,
      user: createSafeUser(req.user),
      tokenCounter: createTokenCounter(client.getEncoding()),
    });

    return await client.titleConvo({ text: inputText ?? '', abortController });
  } catch (error) {
    logger.error('[regenerateTitleFromJob] Error generating title', error);
    return undefined;
  } finally {
    if (!abortController.signal.aborted) {
      abortController.abort();
    }
  }
}

/**
 * Deferred title generation for kotlerapi async-job conversations.
 *
 * The execution-speed flow streams a `<nucleant:pending>` placeholder as the
 * assistant response while the real content is produced in the background. The
 * live title path is skipped for these (see `isPendingJobResponse` in the agents
 * request controller). Once the frontend observes the job completing, it calls
 * this to (1) settle the placeholder message with the resolved content and
 * (2) generate a real title from that content.
 *
 * Idempotent: only runs while the conversation still has the default title.
 *
 * @param {import('express').Request} req
 * @param {object} params
 * @param {string} params.conversationId
 * @param {string} [params.messageId] - the assistant message to resolve; if omitted,
 *   the first assistant message still carrying a pending marker is used.
 * @returns {Promise<{ status?: number, title?: string | null, skipped?: string }>}
 */
async function regenerateTitleFromJob(req, { conversationId, messageId }) {
  const userId = req.user.id;

  const convo = await getConvo(userId, conversationId);
  if (!convo) {
    return { status: 404 };
  }
  if (convo.title && convo.title !== DEFAULT_TITLE) {
    return { title: convo.title, skipped: 'already-titled' };
  }

  const messages = await getMessages({ conversationId, user: userId });
  if (!messages?.length) {
    return { status: 404 };
  }

  const aiMessage = messageId
    ? messages.find((message) => message.messageId === messageId)
    : messages.find(
        (message) =>
          !message.isCreatedByUser &&
          (hasNucleantPendingMarker(message.text) ||
            (Array.isArray(message.content) &&
              message.content.some(
                (part) => part?.type === 'text' && hasNucleantPendingMarker(part.text),
              ))),
      );

  if (!aiMessage) {
    return { skipped: 'no-pending-message' };
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

  if (stillPending || (!textChanged && !contentChanged)) {
    return { skipped: 'job-not-done' };
  }

  if (textChanged || contentChanged) {
    await updateMessage(
      req,
      {
        messageId: aiMessage.messageId,
        ...(textChanged ? { text: resolvedText } : {}),
        ...(contentChanged ? { content: resolvedContent } : {}),
      },
      { context: 'regenerateTitleFromJob' },
    );
  }

  const userMessage = messages.find((message) => message.isCreatedByUser);
  const contentText = joinTextParts(resolvedContent) || resolvedText;

  const title = await generateTitle(req, {
    convo,
    inputText: userMessage?.text,
    contentText,
    messageId: aiMessage.messageId,
    parentMessageId: aiMessage.parentMessageId,
  });

  if (!title) {
    return { skipped: 'no-title' };
  }

  await saveConvo(
    req,
    { conversationId, title },
    { context: 'regenerateTitleFromJob', noUpsert: true },
  );

  const titleCache = getLogStores(CacheKeys.GEN_TITLE);
  await titleCache.set(`${userId}-${conversationId}`, title, TITLE_CACHE_TTL_MS);

  return { title };
}

module.exports = regenerateTitleFromJob;
