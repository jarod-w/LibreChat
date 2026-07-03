import { useEffect, useRef } from 'react';
import { useRecoilValue, useResetRecoilState } from 'recoil';
import { useChatContext } from '~/Providers';
import { ES_SEED_MESSAGE } from './constants';
import store from '~/store';

/**
 * 执行速落会话自动发送:向导确认后置 activeExecutionSpeedPlanId 并导航到 /c/new,
 * 本组件在聊天落地态检测到 plan 原子后自动发送种子消息(携带 plan id 经
 * X-Execution-Speed-Plan-Id 触发 kotlerapi 批量 job),随后重置原子(单次生效)。
 * ask 的闭包在本次渲染已捕获原子值,重置不影响已构造的 submission。
 * 设计文档: LibreChat/docs/execution-speed-ui.design.md §5
 */
export default function ExecutionSpeedAutoStart({ isLandingPage }: { isLandingPage: boolean }) {
  const { ask } = useChatContext();
  const planId = useRecoilValue(store.activeExecutionSpeedPlanId);
  const resetPlanId = useResetRecoilState(store.activeExecutionSpeedPlanId);
  const firedRef = useRef(false);

  useEffect(() => {
    if (!planId || !isLandingPage || firedRef.current) {
      return;
    }
    firedRef.current = true;
    ask({ text: ES_SEED_MESSAGE });
    resetPlanId();
  }, [planId, isLandingPage, ask, resetPlanId]);

  return null;
}
