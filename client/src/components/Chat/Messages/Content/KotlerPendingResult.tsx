import { useQuery } from '@tanstack/react-query';
import { Spinner } from '@librechat/client';
import { QueryKeys, dataService } from 'librechat-data-provider';
import type { KotlerJobStatus } from 'librechat-data-provider';
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

  const { data, error, isLoading } = useQuery<KotlerJobStatus>({
    queryKey: [QueryKeys.kotlerJob, jobId],
    queryFn: () => dataService.getKotlerJobStatus(jobId),
    refetchInterval: (data) => {
      const status = data?.status;
      return status === 'pending' || status === undefined ? POLL_INTERVAL_MS : false;
    },
    staleTime: 0,
    retry: 2,
  });

  if (isLoading || !data || data.status === 'pending') {
    const msg = pendingMessage || localize('com_kotler_job_pending');
    return (
      <Container>
        <div className="flex items-center gap-2 py-1 text-sm text-token-text-secondary">
          <Spinner className="h-4 w-4 animate-spin" />
          <span>{msg}</span>
        </div>
      </Container>
    );
  }

  if (error || data.status === 'failed') {
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
