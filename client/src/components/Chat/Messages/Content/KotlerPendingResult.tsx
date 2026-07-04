import { useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@librechat/client';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { KotlerJobStatus } from 'librechat-data-provider';
import { useGenTitleFromJobMutation } from '~/data-provider';
import { useMessageContext } from '~/Providers';
import ContentPackCard from './ContentPackCard';
import { useLocalize } from '~/hooks';
import { Text } from './Parts';
import Container from './Container';

const POLL_INTERVAL_MS = 4000;

type Props = {
  jobId: string;
  pendingMessage: string;
  isCreatedByUser: boolean;
};

export default function KotlerPendingResult({ jobId, pendingMessage, isCreatedByUser }: Props) {
  const localize = useLocalize();
  const { conversationId, messageId } = useMessageContext();
  const genTitleFromJob = useGenTitleFromJobMutation();
  const titleRequestedRef = useRef(false);

  const { data, error, isLoading } = useQuery<KotlerJobStatus>({
    queryKey: [QueryKeys.kotlerJob, jobId],
    queryFn: () => dataService.getKotlerJobStatus(jobId),
    refetchInterval: (latest, query) => {
      if (query.state.error) {
        return false;
      }
      return latest?.status === 'pending' ? POLL_INTERVAL_MS : false;
    },
    staleTime: 0,
    retry: 1,
  });

  /**
   * The live title path is skipped for pending job responses; once the job
   * resolves, ask the backend to settle the message and title the conversation
   * from the real content. Fires once per mounted result.
   */
  useEffect(() => {
    if (data?.status !== 'done' || titleRequestedRef.current || !conversationId) {
      return;
    }
    titleRequestedRef.current = true;
    genTitleFromJob.mutate({ conversationId, messageId });
  }, [data?.status, conversationId, messageId, genTitleFromJob]);

  if (error) {
    return (
      <Container>
        <Text
          text={`> ⚠️ ${localize('com_kotler_job_expired')}`}
          isCreatedByUser={isCreatedByUser}
          showCursor={false}
        />
      </Container>
    );
  }

  if (isLoading || !data || data.status === 'pending') {
    const msg = pendingMessage || localize('com_kotler_job_pending');
    const progress = data?.progress;
    return (
      <Container>
        <div className="flex flex-col gap-1.5 py-1">
          <div className="flex items-center gap-2 text-sm text-token-text-secondary">
            <Spinner className="h-4 w-4 animate-spin" />
            <span>{msg}</span>
          </div>
          {progress != null && progress.total > 0 && (
            <div className="flex items-center gap-2 pl-6 text-xs text-token-text-secondary">
              <span className="font-medium tabular-nums">
                {progress.done}/{progress.total}
              </span>
              {progress.current_label != null && progress.current_label !== '' && (
                <span>
                  · {localize('com_execspeed_generating')}: {progress.current_label}
                </span>
              )}
              <span
                className="h-1 flex-1 max-w-40 overflow-hidden rounded-full bg-surface-tertiary"
                role="progressbar"
                aria-valuenow={progress.done}
                aria-valuemax={progress.total}
              >
                <span
                  className="block h-full rounded-full bg-green-500 transition-all duration-500"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </span>
            </div>
          )}
        </div>
      </Container>
    );
  }

  if (data.status === 'failed') {
    return (
      <Container>
        <Text
          text={`> ❌ ${localize('com_kotler_job_failed')}`}
          isCreatedByUser={isCreatedByUser}
          showCursor={false}
        />
      </Container>
    );
  }

  if (data.status === 'done') {
    // 执行速内容包:优先结构化卡片(result_pack),无则回退合并 Markdown(向后兼容)
    if (data.result_pack != null && data.result_pack.pieces.length > 0) {
      return <ContentPackCard pack={data.result_pack} isCreatedByUser={isCreatedByUser} />;
    }
    if (!data.result) {
      return (
        <Container>
          <Text
            text={`> ⚠️ ${localize('com_kotler_job_expired')}`}
            isCreatedByUser={isCreatedByUser}
            showCursor={false}
          />
        </Container>
      );
    }
    return (
      <Container>
        <Text text={data.result} isCreatedByUser={isCreatedByUser} showCursor={false} />
      </Container>
    );
  }

  return null;
}
