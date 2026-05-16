/**
 * Kotler API 代理路由。
 * 将 /api/kotler/jobs/:jobId 转发到 kotlerapi GET /v1/jobs/:jobId。
 * 使用 KOTLER_API_URL 环境变量配置 kotlerapi 地址。
 */
const express = require('express');
const axios = require('axios');

const router = express.Router();

const KOTLER_API_URL = (process.env.KOTLER_API_URL || 'http://localhost:8000').replace(/\/$/, '');

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

module.exports = router;
