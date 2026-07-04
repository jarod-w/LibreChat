jest.mock('@librechat/data-schemas', () => ({
  logger: { debug: jest.fn(), info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock('librechat-data-provider', () => ({
  CacheKeys: { GEN_TITLE: 'GEN_TITLE' },
  Constants: { NO_PARENT: '00000000-0000-0000-0000-000000000000' },
}));

jest.mock('@librechat/api', () => ({
  createRun: jest.fn(async () => ({})),
  createSafeUser: jest.fn((user) => user),
  createTokenCounter: jest.fn(() => jest.fn()),
}));

jest.mock('~/server/services/nucleantPending', () => {
  const actual = jest.requireActual('~/server/services/nucleantPending');
  return { ...actual, resolveNucleantPendingMarkers: jest.fn() };
});

jest.mock('~/server/services/Endpoints/agents', () => ({
  initializeClient: jest.fn(),
  buildOptions: jest.fn(() => ({ agent: Promise.resolve({}) })),
}));

jest.mock('~/models/Conversation', () => ({
  getConvo: jest.fn(),
  saveConvo: jest.fn(),
}));

jest.mock('~/models', () => ({
  getMessages: jest.fn(),
  updateMessage: jest.fn(),
}));

jest.mock('~/cache/getLogStores', () => jest.fn());

const { resolveNucleantPendingMarkers } = require('~/server/services/nucleantPending');
const { initializeClient } = require('~/server/services/Endpoints/agents');
const { getConvo, saveConvo } = require('~/models/Conversation');
const { getMessages, updateMessage } = require('~/models');
const getLogStores = require('~/cache/getLogStores');
const regenerateTitleFromJob = require('../regenerateTitle');

const MARKER = '<nucleant:pending>{"job_id":"j1"}</nucleant:pending>';

const makeReq = () => ({ user: { id: 'user1' }, body: {}, config: {} });

const cacheSet = jest.fn();

beforeEach(() => {
  jest.clearAllMocks();
  getLogStores.mockReturnValue({ set: cacheSet });
});

describe('regenerateTitleFromJob', () => {
  it('returns 404 when the conversation does not exist', async () => {
    getConvo.mockResolvedValue(null);
    const result = await regenerateTitleFromJob(makeReq(), { conversationId: 'c1' });
    expect(result).toEqual({ status: 404 });
    expect(getMessages).not.toHaveBeenCalled();
  });

  it('skips when the conversation already has a non-default title', async () => {
    getConvo.mockResolvedValue({ conversationId: 'c1', title: 'Existing Title' });
    const result = await regenerateTitleFromJob(makeReq(), { conversationId: 'c1' });
    expect(result).toEqual({ title: 'Existing Title', skipped: 'already-titled' });
    expect(getMessages).not.toHaveBeenCalled();
  });

  it('skips when no assistant message carries a pending marker', async () => {
    getConvo.mockResolvedValue({ conversationId: 'c1', title: 'New Chat' });
    getMessages.mockResolvedValue([
      { isCreatedByUser: true, text: 'hi' },
      { isCreatedByUser: false, text: 'a plain answer' },
    ]);
    const result = await regenerateTitleFromJob(makeReq(), { conversationId: 'c1' });
    expect(result).toEqual({ skipped: 'no-pending-message' });
    expect(updateMessage).not.toHaveBeenCalled();
  });

  it('skips when the job is not done yet (marker unresolved)', async () => {
    getConvo.mockResolvedValue({ conversationId: 'c1', title: 'New Chat' });
    getMessages.mockResolvedValue([
      { isCreatedByUser: true, text: '开始生成本轮内容' },
      {
        isCreatedByUser: false,
        messageId: 'm1',
        text: MARKER,
        content: [{ type: 'text', text: MARKER }],
      },
    ]);
    resolveNucleantPendingMarkers.mockImplementation(async (text) => text);

    const result = await regenerateTitleFromJob(makeReq(), { conversationId: 'c1' });
    expect(result).toEqual({ skipped: 'job-not-done' });
    expect(updateMessage).not.toHaveBeenCalled();
    expect(saveConvo).not.toHaveBeenCalled();
  });

  it('resolves the message, generates a title from real content, and persists it', async () => {
    getConvo.mockResolvedValue({
      conversationId: 'c1',
      title: 'New Chat',
      endpoint: 'agents',
      agent_id: 'a1',
      model: 'deepseek-v4-flash',
    });
    getMessages.mockResolvedValue([
      { isCreatedByUser: true, text: '开始生成本轮内容' },
      {
        isCreatedByUser: false,
        messageId: 'm1',
        parentMessageId: 'p1',
        text: MARKER,
        content: [{ type: 'text', text: MARKER }],
      },
    ]);
    resolveNucleantPendingMarkers.mockImplementation(async (text) =>
      typeof text === 'string' && text.includes('<nucleant:pending>') ? '春季新品营销方案' : text,
    );
    const titleConvo = jest.fn().mockResolvedValue('Spring Launch Plan');
    initializeClient.mockResolvedValue({
      client: {
        options: { agent: { id: 'a1' } },
        agentConfigs: new Map(),
        getEncoding: () => ({}),
        titleConvo,
      },
    });

    const result = await regenerateTitleFromJob(makeReq(), {
      conversationId: 'c1',
      messageId: 'm1',
    });

    expect(updateMessage).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        messageId: 'm1',
        text: '春季新品营销方案',
        content: [{ type: 'text', text: '春季新品营销方案' }],
      }),
      expect.anything(),
    );
    expect(titleConvo).toHaveBeenCalledWith(expect.objectContaining({ text: '开始生成本轮内容' }));
    expect(saveConvo).toHaveBeenCalledWith(
      expect.anything(),
      { conversationId: 'c1', title: 'Spring Launch Plan' },
      expect.objectContaining({ noUpsert: true }),
    );
    expect(cacheSet).toHaveBeenCalledWith('user1-c1', 'Spring Launch Plan', expect.any(Number));
    expect(result).toEqual({ title: 'Spring Launch Plan' });
  });
});
