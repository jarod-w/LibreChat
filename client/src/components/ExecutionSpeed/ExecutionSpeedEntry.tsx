import { useNavigate } from 'react-router-dom';
import { Zap } from 'lucide-react';
import { useLocalize } from '~/hooks';

/**
 * 执行速落地页入口卡:与意图选择器并存 —— 意图选择器是「我已知道要哪一件」的快路径,
 * 执行速是「帮我规划本轮」的引导路径。仅落地态渲染(挂点见 ChatView)。
 */
export default function ExecutionSpeedEntry() {
  const navigate = useNavigate();
  const localize = useLocalize();

  return (
    <div className="mx-auto mt-2 w-full max-w-3xl px-2">
      <button
        type="button"
        onClick={() => navigate('/execution-speed')}
        className="flex w-full items-center gap-3 rounded-xl border border-border-light bg-surface-secondary px-4 py-2.5 text-left transition-colors hover:border-green-500/60 hover:bg-surface-tertiary"
        data-testid="es-entry"
      >
        <Zap className="h-4 w-4 flex-shrink-0 text-green-600" aria-hidden="true" />
        <span className="flex min-w-0 flex-col">
          <span className="text-sm font-medium text-text-primary">
            {localize('com_execspeed_entry_title')}
          </span>
          <span className="truncate text-xs text-text-secondary">
            {localize('com_execspeed_entry_desc')}
          </span>
        </span>
      </button>
    </div>
  );
}
