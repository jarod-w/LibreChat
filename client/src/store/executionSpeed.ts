import { atom } from 'recoil';

/**
 * Nucleant 执行速(execution speed)状态。
 * 设计文档: LibreChat/docs/execution-speed-ui.design.md §6
 *
 * activeExecutionSpeedPlanId:confirmed 计划 id,由向导确认后写入,
 * 随下一条消息经 body → X-Execution-Speed-Plan-Id 触发批量生成;
 * 单次生效,自动发送后重置,不做 localStorage 持久化(计划本体在服务端 Redis)。
 */
const activeExecutionSpeedPlanId = atom<string | null>({
  key: 'activeExecutionSpeedPlanId',
  default: null,
});

export default { activeExecutionSpeedPlanId };
