/**
 * Nucleant marker 预处理 — 把 KotlerAPI 输出里的 `<nucleant:KIND>{json}</nucleant:KIND>`
 * marker 转成可被 ReactMarkdown 正常渲染的 markdown 文本(主要是 blockquote 状态行),
 * 解决原始 marker 被当作未知标签或自动链接渲染的问题(见 KotlerAPI services/types.py
 * NucleantMarkerKind 协议定义)。
 *
 * 不在 ReactMarkdown 里加自定义组件:那样需要 remark 插件 + React 组件配套,工作量大且
 * `nucleant:progress` 的冒号语法对 markdown 语法解析不友好。纯字符串预处理足够覆盖
 * 当前所有 marker 类型,后续如需可视化升级再迁移到组件化方案。
 */

const NUCLEANT_MARKER_RE = /<nucleant:([a-z_]+)>(\{[\s\S]*?\})<\/nucleant:\1>/g;

type ProgressStatus = 'started' | 'done';

interface ProgressPayload {
  step: number;
  total: number;
  agent: string;
  label?: string | null;
  status?: ProgressStatus | null;
  duration_ms?: number | null;
  retry_count?: number | null;
  provider_chain_used?: string[] | null;
}

interface DebatePayload {
  agent: string;
  round: string;
  status?: string;
}

interface ErrorPayload {
  code: string;
  failed_agent: string;
  detail: string;
  missing_fields?: string[] | null;
}

interface ClarifyPayload {
  type: 'intent' | 'fields';
  tentative_forced_agent?: string | null;
}

interface PendingPayload {
  job_id: string;
  poll_url: string;
  message: string;
}

const formatDuration = (ms: number): string => {
  if (ms < 1000) {
    return `${ms}ms`;
  }
  return `${(ms / 1000).toFixed(1)}s`;
};

const renderProgress = (p: ProgressPayload): string => {
  const name = p.label || p.agent;
  if (!name) {
    return '';
  }
  if (p.status === 'started') {
    return `\n> 🔄 **${name}** · 进行中…\n\n`;
  }
  if (p.status === 'done') {
    const dur =
      typeof p.duration_ms === 'number' ? ` · 耗时 ${formatDuration(p.duration_ms)}` : '';
    return `\n> ✅ **${name}** · 完成${dur}\n\n`;
  }
  return '';
};

const renderDebate = (p: DebatePayload): string => {
  const status = p.status && p.status !== 'ok' ? ` · ${p.status}` : '';
  return `\n> 💭 ${p.agent} · ${p.round}${status}\n\n`;
};

const renderError = (p: ErrorPayload): string => {
  const detail = (p.detail || '').trim();
  return `\n> ❌ **${p.failed_agent || 'pipeline'}** · ${detail || p.code}\n\n`;
};

const renderClarify = (p: ClarifyPayload): string => {
  if (p.type === 'intent') {
    return '\n> ❓ 请选择意图后继续\n\n';
  }
  if (p.type === 'fields') {
    return '\n> ❓ 请补充必要信息后继续\n\n';
  }
  return '';
};

const renderPending = (p: PendingPayload): string => {
  const msg = (p.message || '正在首次分析该细分市场，请稍候…').trim();
  return `\n> ⏳ ${msg}\n\n`;
};

export const preprocessNucleantMarkers = (content: string): string => {
  if (!content || content.indexOf('<nucleant:') === -1) {
    return content;
  }
  return content.replace(NUCLEANT_MARKER_RE, (_match, kind: string, jsonStr: string) => {
    let payload: unknown;
    try {
      payload = JSON.parse(jsonStr);
    } catch {
      return '';
    }
    if (typeof payload !== 'object' || payload === null) {
      return '';
    }
    switch (kind) {
      case 'progress':
        return renderProgress(payload as ProgressPayload);
      case 'debate':
        return renderDebate(payload as DebatePayload);
      case 'error':
        return renderError(payload as ErrorPayload);
      case 'clarify':
        return renderClarify(payload as ClarifyPayload);
      case 'pending':
        return renderPending(payload as PendingPayload);
      case 'report_start':
      case 'report_end':
        return '';
      default:
        return '';
    }
  });
};
