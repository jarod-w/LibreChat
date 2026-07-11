import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { QueryKeys, ContentTypes, dataService } from 'librechat-data-provider';
import type {
  TMessage,
  KotlerJobStatus,
  KotlerResultPack,
  KotlerJobProgress,
  TMessageContentParts,
} from 'librechat-data-provider';
import { extractPendingData } from '~/utils/nucleantPendingUtils';
import { useGetMessagesByConvoId } from '~/data-provider';

/**
 * 产出工作台数据源(P0):从会话消息里解析出执行速批量 job 的 jobId,
 * 再轮询 getKotlerJobStatus 拿 result_pack / 进度。
 *
 * ⚠️ P0 局限:jobId 来自会话消息里未 settle 的 `<nucleant:pending>` marker;
 *    会话 settle 后 marker 被解析写回、结构化 result_pack 不再可得 → 归为 'expired'。
 *    耐久轮次记录(GET round/:cid)是 P1,补齐后此处优先读耐久源。
 * 设计文档: LibreChat/docs/execution-speed-output-workspace.design.md §4
 */

const POLL_INTERVAL_MS = 4000;

function readTextPart(part: TMessageContentParts): string {
  if (part.type !== ContentTypes.TEXT) {
    return '';
  }
  const value = part.text;
  return typeof value === 'string' ? value : (value?.value ?? '');
}

function findJobId(messages?: TMessage[]): string | null {
  if (!messages) {
    return null;
  }
  for (const message of messages) {
    if (message.isCreatedByUser === true) {
      continue;
    }
    const candidates: string[] = [];
    if (typeof message.text === 'string' && message.text.length > 0) {
      candidates.push(message.text);
    }
    if (Array.isArray(message.content)) {
      for (const part of message.content) {
        const text = readTextPart(part);
        if (text.length > 0) {
          candidates.push(text);
        }
      }
    }
    for (const raw of candidates) {
      const payload = extractPendingData(raw);
      if (payload?.job_id != null && payload.job_id !== '') {
        return payload.job_id;
      }
    }
  }
  return null;
}

export type RoundStatus = 'loading' | 'pending' | 'done' | 'failed' | 'missing' | 'expired';

export interface RoundData {
  jobId: string | null;
  status: RoundStatus;
  resultPack: KotlerResultPack | null;
  progress: KotlerJobProgress | null;
}

function resolveStatus(args: {
  messagesLoading: boolean;
  jobId: string | null;
  jobLoading: boolean;
  error: unknown;
  job?: KotlerJobStatus;
}): RoundStatus {
  const { messagesLoading, jobId, jobLoading, error, job } = args;
  if (messagesLoading) {
    return 'loading';
  }
  if (jobId == null) {
    return 'missing';
  }
  if (error != null) {
    return 'expired';
  }
  if (jobLoading || job == null) {
    return 'loading';
  }
  if (job.status === 'failed') {
    return 'failed';
  }
  if (job.status === 'done') {
    return job.result_pack != null && job.result_pack.pieces.length > 0 ? 'done' : 'expired';
  }
  return 'pending';
}

export function useRoundData(conversationId: string): RoundData {
  const { data: messages, isLoading: messagesLoading } = useGetMessagesByConvoId(conversationId);
  const jobId = useMemo(() => findJobId(messages), [messages]);

  const {
    data: job,
    isLoading: jobLoading,
    error,
  } = useQuery<KotlerJobStatus>({
    queryKey: [QueryKeys.kotlerJob, jobId],
    queryFn: () => dataService.getKotlerJobStatus(jobId ?? ''),
    enabled: jobId != null,
    refetchInterval: (latest, query) => {
      if (query.state.error != null) {
        return false;
      }
      return latest?.status === 'pending' ? POLL_INTERVAL_MS : false;
    },
    staleTime: 0,
    retry: 1,
  });

  const status = resolveStatus({ messagesLoading, jobId, jobLoading, error, job });

  return {
    jobId,
    status,
    resultPack: job?.result_pack ?? null,
    progress: job?.progress ?? null,
  };
}
