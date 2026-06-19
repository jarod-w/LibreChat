/**
 * Kotler API 代理路由。
 * - GET /api/kotler/jobs/:jobId        → kotlerapi GET /v1/jobs/:jobId（无需登录）
 * - ALL /api/kotler/profile/*          → kotlerapi /v1/profile/*（需登录）
 *
 * 档案代理要点（见 nucleant user_brand_profile.design.md §5 + Q3）：
 * 浏览器不直连 kotlerapi，也不持有 KOTLER_API_KEY。代理在 requireJwtAuth 之后用
 * 共享的 KOTLER_API_KEY 作 Bearer，并以 X-LibreChat-User-Id 携带当前登录用户 id，
 * kotlerapi 据此按用户隔离档案数据。缺了这个 header，kotlerapi 会把所有用户落到
 * 同一档案行（跨用户数据泄露）。
 * 使用 KOTLER_API_URL 环境变量配置 kotlerapi 地址。
 */
const express = require('express');
const axios = require('axios');
const { requireJwtAuth } = require('~/server/middleware');

const router = express.Router();

const KOTLER_API_URL = (process.env.KOTLER_API_URL || 'http://localhost:8000').replace(/\/$/, '');
const KOTLER_API_KEY = process.env.KOTLER_API_KEY || '';

router.get('/jobs/:jobId', async (req, res) => {
  const { jobId } = req.params;
  try {
    const response = await axios.get(
      `${KOTLER_API_URL}/v1/jobs/${encodeURIComponent(jobId)}`,
      { timeout: 10000 },
    );
    res.json(response.data);
  } catch (err) {
    const status = err.response?.status;
    if (status === 404) {
      res.status(404).json({ error: 'Job not found or expired' });
    } else {
      res.status(502).json({ error: 'Failed to fetch job status from kotlerapi' });
    }
  }
});

/**
 * 文档摄入上传走 multipart，不能套用下方强制 application/json 的通用 /profile 代理。
 * 这里把原始请求流直接透传给 kotlerapi，保留 multipart 边界与文件字节。
 * 必须在通用 /profile 代理之前注册，否则会被其拦截。
 * extract 内含 LLM 提炼，耗时较长，超时放宽到 120s。
 */
router.post('/profile/documents/extract', requireJwtAuth, async (req, res) => {
  try {
    const response = await axios.post(
      `${KOTLER_API_URL}/v1/profile/documents/extract`,
      req,
      {
        timeout: 120000,
        maxBodyLength: Infinity,
        maxContentLength: Infinity,
        headers: {
          'Content-Type': req.headers['content-type'],
          'Content-Length': req.headers['content-length'],
          Authorization: `Bearer ${KOTLER_API_KEY}`,
          'X-LibreChat-User-Id': req.user.id,
        },
        validateStatus: () => true,
      },
    );
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach kotlerapi document extract service' });
  }
});

router.use('/profile', requireJwtAuth, async (req, res) => {
  try {
    const response = await axios({
      method: req.method,
      url: `${KOTLER_API_URL}/v1/profile${req.url}`,
      data: req.body,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${KOTLER_API_KEY}`,
        'X-LibreChat-User-Id': req.user.id,
      },
      validateStatus: () => true,
    });
    if (response.status === 204 || response.data === '' || response.data == null) {
      res.status(response.status).end();
      return;
    }
    res.status(response.status).json(response.data);
  } catch (err) {
    res.status(502).json({ error: 'Failed to reach kotlerapi profile service' });
  }
});

module.exports = router;
