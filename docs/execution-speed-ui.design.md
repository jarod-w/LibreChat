# 执行速 · 前端设计(向导页 + 落会话)(LibreChat 侧)

> 状态：**已确认(2026-07-03,Q1–Q7 全部敲定),待实现**——按铁律 kotlerapi 先行(其契约已同步确认)
> 涉及仓库：`LibreChat/`(前端 + 极薄透传)、`kotlerapi/`(消费方,契约见 `kotlerapi/markdown/execution_speed_plan.design.md`)
> 关联记忆：[[profile-tenant-isolation]](档案/品牌数据按用户隔离)
> 关联设计：`LibreChat/docs/intent-selector-design.md`(意图选择器,复用其出参链路);`kotlerapi` 侧 `execution_speed_plan.design.md`(plan/confirm/批量 job 契约)
> 入口形态结论来源：三方案线框对比(独立向导页 A / 对话内联 B / 弹窗 C),已选 **A**。

---

## 0. 待澄清问题速览(✅ Q1–Q7 已全部确认,保留决策记录)

| # | 问题 | 结论 | 见 |
|---|------|------|----|
| Q1 | 向导路由放哪层? | ✅ 已确认:挂在 `Root` children 下(**保留侧栏/会话 chrome**,非 onboarding 那种裸页) | §2 |
| Q2 | 落会话怎么触发批量? | ✅ 已确认:建会话 + `ask()` 带 `executionSpeedPlanId`(scalar)→ 后端起 job → `<nucleant:pending>` 轮询 | §4/§5 |
| Q3 | 是否强制先有档案/选品牌产品? | ✅ 已确认:**是**——事实预填依赖它;无档案则先引导去 `/onboarding` | §3/§7 |
| Q4 | Step1 事实编辑是否回写档案? | ✅ 已确认:**回写**(经现有 Profile mutation),保持档案单一真相源 | §3 |
| Q5 | 触发入口 v1 范围? | ✅ 已确认:v1 = 落地页 hero 卡 + 左侧导航项;意图条 chip 作 v2 | §2 |
| Q6 | i18n 前缀? | ✅ 已确认:`com_execspeed_*`(功能种子串硬编码,不进 i18n) | §9 |
| Q7 | 批量结果形态(前端呈现)? | ✅ 已确认:**ContentPackCard 内容包卡片**(读 `result_pack`,无则回退合并 `result`);逐件独立消息留 v2 | §5 |

> Q1–Q7 于 2026-07-03 全部确认(Q7 与 kotlerapi Q8 契约配套;Q1/Q3/Q4 用户显式拍板,其余采纳文档建议)。跨仓库铁律不变:**kotlerapi 先行实现、测试通过后再改前端**。

---

## 1. 背景与结论

现状对话首屏已有[意图选择器](./intent-selector-design.md)(选 1 个意图 → 出 1 件)。执行速要解决的是"**我不知道本轮该做哪几件**"——由系统据事实推荐一整组、确认后一次产出 + 作战表。

**入口形态 = 方案 A(独立向导页)**:两屏向导(填事实 → 确认方案)做**决策**,确认后**落入一个会话**做**产出与迭代**。理由(线框对比结论):方案确认屏是重决策界面(分组清单+徽章+侧栏+边界确认),整页才撑得住,且可复用已跑通的 `OnboardingWizard` 整页向导骨架;产出复用现有报告渲染 + `<nucleant:pending>` 轮询,不另造结果页。执行速与单意图快路径**并存**,非替代。

---

## 2. 路由与挂载

**新路由 `/execution-speed`**,克隆 onboarding 的注册方式,但**放在 `Root` children 下**(保留侧栏与会话 chrome,便于产出后返回会话;onboarding 是一次性裸页,执行速是日常入口,需 chrome)。

- 注册点:`client/src/routes/index.tsx`。onboarding 现为 `AuthLayout` 直属、`Root` 之外的裸页(`{ path: 'onboarding', element: <OnboardingWizard /> }`,line 100-102);执行速改挂在 `Root` 的 `children` 内(line 106-135 一级),与 chat 路由平级 → 带侧栏。(✅ Q1 已确认:带 chrome。)
- 组件目录:`client/src/components/ExecutionSpeed/`。

**触发入口(v1)**:
1. **落地页 hero 卡**——落地态(`isLandingPage`)加一张"帮我规划本轮内容"卡,`navigate('/execution-speed')`。挂点与 `IntentSelector` 同区(`ChatView.tsx:104` 附近)。
2. **左侧导航项**——常驻入口(`Nav` 区),提升可发现性。
3. (v2)意图条加一颗「⚡ 帮我规划本轮」chip。

---

## 3. 向导结构

复用 `OnboardingWizard.tsx` 的状态机范式(`useState` 管 `step`/各步数据 + `StepIndicator` + `handleNext`/校验),字段用 `ProfileFields.tsx` 原语(`Field`/`SelectField`/`ChipsField`/`ToggleField`)。

### Step 1 · 填事实(多数预填,只补一项)

**6 个事实的来源**(已核实,5/6 来自档案):

| 事实 | 预填自 | 处理 |
|------|--------|------|
| 品牌/产品名 | `ProfileBrand.brand_name` / `ProfileProduct.product_name` | 预填 |
| 行业 | `product.industry_minor[0] / industry_mid` | 预填 |
| 主要卖什么 | `product.product_name` / `target_customers` / `product_attributes` | 预填 |
| 主要成交渠道 | `product.main_channels[]` | 预填(`ChipsField`) |
| 不能说/避开 | `brand.forbidden_expressions` | 预填 |
| **本轮想解决的问题** | —(**本轮新增,不入档案**) | `SelectField` 必填 |

- 数据来自 `useProfileBrandsQuery` / `useProfileProductsQuery`(`client/src/data-provider/Profile/queries.ts`),按当前 `activeBrandId`/`activeProductId`(`store/brandProduct.ts`)取主品牌/产品。
- **无档案**:引导先去 `/onboarding`(✅ Q3 已确认:强制)。
- **档案完整时 Step1 塌缩**为"确认档案 + 选本轮问题",一屏即过。
- 预填字段**可内联编辑**;改动经现有 `useUpdateBrandMutation`/`useUpdateProductMutation` **回写档案**(✅ Q4 已确认,保持单一真相源),而非在执行速里另存一份。
- `current_problem` 枚举与 kotlerapi 契约对齐:`周边人不知道我 / 看了不下单 / 询单接不住 / 老客不复购 / 想做活动 / 内容做不出`。

### Step 2 · 确认本轮方案

调 `POST /api/kotler/execution-speed/plan`(经 profile 同款代理)→ 渲染:

- **判断条**(`verdict.lead` + `verdict.why`)。
- **分组清单**:按 `groups`(获客/转化/复购+转介绍)渲染,每项 = 勾选框 + 名称 + 徽章 + 理由;徽章按 `production_status` 上色(recommended🟢 / conditional🟡 / gated🔵 / sample_only⚪);🟡 项显示 `condition_hint`。
- **表达边界确认区**:展示 `boundary.forbidden/cautious/guarantee`,一个**必勾**的"我确认以上边界"复选框。
- **侧栏**:实时"已选 N 件"计数 + 「确认 · 生成内容 + 作战表」按钮。
- 确认 → `POST /plan/{plan_id}/confirm`(带 `selected_piece_keys` + `boundary_confirmed`)→ 落会话(§5)。

---

## 4. 数据流

```
Step1 事实(档案预填 + current_problem)
  → POST /api/kotler/execution-speed/plan            → { plan_id, verdict, groups, boundary }
Step2 勾选 + 边界确认
  → POST /api/kotler/execution-speed/plan/{id}/confirm → { plan_id, status:"confirmed" }
点「确认生成」
  → useNewConvo().newConversation({ template:{ endpoint:'KotlerAPI' } })   // 建会话+定端点
  → set atom activeExecutionSpeedPlanId = plan_id
  → ask({ text: '开始生成本轮内容' })                 // 走既有 SSE 单轮
      → createPayload 写入 executionSpeedPlanId
      → librechat.yaml 注入 X-Execution-Speed-Plan-Id
  → kotlerapi 命中 plan_id → 起异步 job → 回 <nucleant:pending>{job_id,poll_url}
  → Part.tsx 检测 pending → <KotlerPendingResult> 轮询 GET /api/kotler/jobs/:jobId(4s)
  → done → 渲染合并「本轮内容包」报告(N 件分节 + 作战表)
```

`/plan` 与 `/confirm` 走 profile 同款 `/api/kotler/profile` 代理风格(新增 `/api/kotler/execution-speed/*` 代理),用 React Query hook 封装(`client/src/data-provider/ExecutionSpeed/queries.ts`)。

---

## 5. 落会话机制

- **建会话 + 定端点**:`useNewConvo().newConversation({ template: { endpoint: 'KotlerAPI' } })`(`hooks/useNewConvo.ts`),导航到 `/c/new`。
- **触发生成**:`useChatContext().ask({ text })`(`hooks/Chat/useChatFunctions.ts`)。`ask` 会读 Recoil 原子折进 `TSubmission`——执行速新增 `activeExecutionSpeedPlanId` 原子,`ask` 在 line 338-341 附近读入(与 brandId/intent 同处)。
- **产出呈现(Q7 ✅ = ContentPackCard)**:`KotlerPendingResult`(`Messages/Content/KotlerPendingResult.tsx`)轮询到 `done` 后,优先读 `result_pack` 渲染 **ContentPackCard**(内容包卡片);无 `result_pack` 回退渲染合并 `result`(向后兼容)。卡片结构:
  - **作战表置顶**(整包的"地图",每行锚点跳到对应件)+ 独立复制——生成顺序在最后,展示顺序在最前;
  - **逐件手风琴**(默认收起):件名 + `production_status` 徽章 + **分开复制**「复制文案 / AI 提示词」(去向不同:平台后台 vs 可灵/即梦;话术件无配图则只有前者);
  - **【待确认】占位**:头部汇总计数 + 件内高亮(读 `pieces[].placeholders`);
  - 底部迭代提示:"要调整某一件?直接在下方输入…"。
- **生成中**:pending 卡显示 `progress.done/total` + `current_label`(如"3/8 · 正在生成:商品详情页"),逐件清单打勾。
- **会话标题**:`newConversation` 时设 title「执行速 · {日期} · {N}件」,便于事后从会话列表找回。
- **逐件迭代**:v1 靠对话追问("把种草文案改口气");per-piece 独立消息 + 单件重生按钮留 v2(随后端 Q2/Q8 的子 job 方案)。

---

## 6. 状态管理与出参链路

**新原子** `client/src/store/executionSpeed.ts`:`activeExecutionSpeedPlanId: string | null`。是否持久化——**建议不持久化**(与 `intent.ts` 同,单次生成后 reset);plan 本体在服务端(Redis),前端只持 id。加入 `store/index.ts` barrel(line 15-16/36-37 同款 import + spread)。

**新出参字段 `executionSpeedPlanId`**,全程对齐 `intent`/`brandId` 的既有 6 环节:

| 环节 | 文件 | 改动 |
|------|------|------|
| 读原子写 submission | `hooks/Chat/useChatFunctions.ts` (~338-341) | 读 `activeExecutionSpeedPlanId` |
| 类型 | `packages/data-provider/src/types.ts`(`TSubmission` 155-161 / `TPayload` 118-124) | 各加 `executionSpeedPlanId?: string \| null` |
| 组装 payload | `packages/data-provider/src/createPayload.ts`(16-20/47-50) | 解构 + 写入 |
| 白名单 | `packages/api/src/utils/env.ts`(`ALLOWED_BODY_FIELDS` 110-118) | 加 `'executionSpeedPlanId'` |
| header 注入 | `librechat.example.yaml`(KotlerAPI `headers` 368-377) | `X-Execution-Speed-Plan-Id: '{{LIBRECHAT_BODY_EXECUTIONSPEEDPLANID}}'` |
| 重建 | — | `npm run build:data-provider` 后整体 `npm run build` |

> plan_id 是**标量**,规避 header 只能塞标量的限制(`env.ts:197` `String(fieldValue)`);完整 plan 不进前端出参,故无需序列化复杂对象。

> 另:`KotlerJobStatus`(`packages/data-provider/src/data-service.ts` ~1087)增加可选 `progress`(done/total/current_label)与 `result_pack` 字段,与 kotlerapi `execution_speed_plan.design.md §4.4` 契约对齐——同属 data-provider 改动,一并重建。

---

## 7. 与档案 / 意图选择器的关系

- **事实预填自档案**:执行速不新造一套输入,读 brand/product 档案预填,缺失字段在向导补且**回写档案**(Q4)。避免"档案 vs 执行速"双真相源(呼应 [[profile-tenant-isolation]] 的归属不变式)。
- **强绑定当前品牌/产品**:沿用 `activeBrandId`/`activeProductId`(header `X-Brand-Id`/`X-Product-Id` 透传),生成的会话与作战表都归属该品牌/产品。
- **与意图选择器并存**:意图选择器 = "我已知道要哪一件"快路径;执行速 = "帮我规划本轮"引导路径。二者共用同一套 `intent`/piece key 词表(`Chat/Intent/constants.ts` 与 kotlerapi `intent_catalog` 对齐,勿改名)。

---

## 8. 组件清单与改动点

新增 `client/src/components/ExecutionSpeed/`:

| 文件 | 职责 |
|------|------|
| `ExecutionSpeedWizard.tsx` | 容器:StepIndicator + 两步状态机(克隆 `OnboardingWizard.tsx`) |
| `FactsStep.tsx` | Step1 事实表单(档案预填 + `current_problem`),用 `ProfileFields` 原语 |
| `PlanStep.tsx` | Step2 分组清单 + 徽章 + 边界确认 + 侧栏计数/确认 |
| `PieceRow.tsx` / `BoundaryConfirm.tsx` | Step2 子件 |
| `constants.ts` | `current_problem` 枚举、徽章色映射、种子串(硬编码) |
| `index.ts` | 导出 |

另在 `client/src/components/Chat/Messages/Content/` 新增(由 `KotlerPendingResult` 的 done 态调用):

| 文件 | 职责 |
|------|------|
| `ContentPackCard.tsx` | 内容包卡片:作战表置顶(锚点跳件)+ 逐件手风琴 + 【待确认】计数(读 `result_pack`,回退渲染 `result`) |
| `PieceSection.tsx` | 单件手风琴项:`production_status` 徽章 + 复制文案/AI 提示词 + 占位高亮 |

数据层新增 `client/src/data-provider/ExecutionSpeed/queries.ts`:`useExecutionSpeedPlan`(POST /plan)、`useConfirmExecutionSpeedPlan`(POST /confirm);QueryKeys 入 `packages/data-provider/src/keys.ts`。

触发入口:落地页 hero 卡(`ChatView` 落地区)+ 左侧导航项(`Nav`)。

---

## 9. i18n

- 仅加英文键到 `client/src/locales/en/translation.json`(其他语言外部自动化);前缀 **`com_execspeed_*`**(如 `com_execspeed_title`/`com_execspeed_step_facts`/`com_execspeed_step_plan`/`com_execspeed_confirm_boundary`/`com_execspeed_commit`)。
- **功能种子串硬编码、不进 i18n**(如落会话的 `'开始生成本轮内容'`),与 `DEFAULT_INTENT_MESSAGE='开始做吧'`(`Chat/Intent/constants.ts:58`)一致,保证发给 kotlerapi 的文案确定。

---

## 10. 跨仓库实施顺序(项目铁律)

```
1. kotlerapi:实现 /execution-speed/plan · /confirm · 批量 job(接线 pending),
   contract 见 execution_speed_plan.design.md,定向验证通过
   ↓
2. LibreChat(前端):ExecutionSpeed 组件 + data-provider hook + executionSpeed 原子
   ↓
3. LibreChat(出参链路):types → createPayload → useChatFunctions → ALLOWED_BODY_FIELDS → yaml header;build:data-provider
   ↓
4. 端到端:填事实 → 看推荐 → 勾选+确认边界 → 落会话 → pending 轮询 → 合并报告 + 作战表
```

---

## 11. 验收标准(草案)

- [ ] `/execution-speed` 路由可达,带侧栏 chrome(Q1);无档案时引导去 `/onboarding`。
- [ ] Step1 从档案预填 5 项事实;`current_problem` 必填;编辑回写档案。
- [ ] Step2 渲染分组清单 + 徽章(🟢🟡🔵⚪ 上色)+ 🟡 的 `condition_hint`;边界必勾才能生成。
- [ ] 侧栏"已选 N 件"随勾选实时更新。
- [ ] 确认后建会话(端点=KotlerAPI)、发出携带 `executionSpeedPlanId` 的请求,kotlerapi 收到 `X-Execution-Speed-Plan-Id`。
- [ ] `<nucleant:pending>` 渲染 pending 卡并轮询,`progress` 显示 N/总数 + 当前件名;done 后 ContentPackCard 呈现:作战表置顶、逐件可展开/复制、【待确认】计数正确;无 `result_pack` 时回退渲染合并 `result`。
- [ ] 暗色模式 / 移动端窄屏布局正常;文案走 i18n,英文键齐备。
- [ ] 断线重进会话仍能取到已完成 job 结果。

---

## 12. 风险与注意

- **跨用户隔离**([[profile-tenant-isolation]]):新增 header 不改既有 `X-LibreChat-User-Id`/brandId 隔离;占位符为空时 kotlerapi 须回退(无 plan_id = 普通对话)。
- **`build:data-provider`**:types 改后不重建,前端识别不到 `TSubmission.executionSpeedPlanId`(与 intent 上线同坑)。
- **生产 `librechat.yaml` 同步**:example 加了 header 后,生产 yaml 也要加 `X-Execution-Speed-Plan-Id`。
- **chrome 下的向导态(✅ Q1 = 挂 `Root` 下带侧栏)**:向导渲染在 `Root` 的 Outlet 里,替换的是聊天主区(输入框属 ChatView,不会残留);实现时验证窄屏下侧栏折叠 + 向导共存的布局。
- **落会话时序**:`ask` 读 Recoil 原子,须在 `newConversation` 建好会话、`activeExecutionSpeedPlanId` 已 set 之后再调 `ask`,避免原子未就绪。

---

## 13. 待澄清问题(✅ 已全部确认)

Q1–Q7 于 2026-07-03 全部敲定,无遗留待澄清项;决策记录见 §0 速览表。可按 §10 顺序进入实现(kotlerapi 先行)。

---

## 14. 实施状态(2026-07-04)

**✅ 前端已落地**(kotlerapi 侧 P0 已先行落地,见其设计文档 §13):

| 层 | 文件 | 状态 |
|----|------|------|
| data-provider | `types.ts`(TSubmission/TPayload)+ `createPayload.ts` + `data-service.ts`(`KotlerJobStatus` 增 `progress`/`result_pack`,新增 `KotlerResultPack`/`KotlerResultPiece`) | ✅ 已构建入 dist |
| packages/api | `env.ts` `ALLOWED_BODY_FIELDS` + `types/http.ts` `RequestBody` 增 `executionSpeedPlanId` | ✅ |
| api(thin JS) | `controllers/agents/client.js` `buildKotlerRequestBody` 增字段;`routes/kotler.js` 新增 `/execution-speed` 代理(body 的 brandId/productId 由代理提升为 X-Brand-Id/X-Product-Id header) | ✅ |
| store | `store/executionSpeed.ts`(`activeExecutionSpeedPlanId`,不持久化)+ barrel | ✅ |
| 数据层 | `data-provider/ExecutionSpeed/queries.ts`(create/confirm 两个 mutation + 契约类型) | ✅ |
| 向导 | `components/ExecutionSpeed/`:`constants.ts` / `FactsStep.tsx` / `PlanStep.tsx`(内含 PieceRow/BoundaryConfirm)/ `ExecutionSpeedWizard.tsx` / `ExecutionSpeedEntry.tsx` / `ExecutionSpeedAutoStart.tsx` | ✅ |
| 内容包 | `Messages/Content/ContentPackCard.tsx`(作战表置顶+逐件手风琴+分开复制+占位计数);`KotlerPendingResult.tsx` pending 显示 `progress`(N/总+当前件+进度条)、done 优先 `result_pack` 回退 `result` | ✅ |
| 接线 | 路由 `/execution-speed`(Root children,带 chrome);`ChatView` 挂 Entry(落地态)+ AutoStart;`useChatFunctions` 读原子入 submission;i18n `com_execspeed_*`;`librechat.example.yaml` 加 `X-Execution-Speed-Plan-Id` | ✅ |

**与设计的偏差(有意,记录备查)**:

1. **落会话不走 `newConversation({template:{endpoint:'KotlerAPI'}})`**——`TConversation.endpoint` 为严格枚举,自定义端点名需类型断言;改为 `navigate('/c/new')` + `ExecutionSpeedAutoStart` 在落地态自动发送种子消息(不限端点,与 `IntentSelector` 无条件渲染同一先例:Nucleant 部署即 KotlerAPI 单端点)。原子在 ask 闭包捕获后立即重置(单次生效)。
2. **Q4 回写范围收窄**:可编辑+回写 = 成交渠道(product.main_channels)+ 禁说(brand.forbidden_expressions)两项(对推荐影响最大);品牌/产品/行业只读,提示去 设置→档案 修改。回写在 `/plan` 调用前 await 完成,保证 kotlerapi 读到最新档案。
3. **会话标题「执行速 · 日期 · N件」未做**(依赖 newConversation 定制),交给现有自动标题;列遗留。
4. **入口 v1 = 落地页 hero 卡**(`ExecutionSpeedEntry`,IntentSelector 下方);左侧导航项(Nav 侵入较大)列遗留。

**待端到端联调**(需 kotlerapi Docker + 生产 yaml 同步 header):§11 验收清单全部项,尤其 向导→confirm→落会话→pending 进度→ContentPackCard 全链路与断线重进。
