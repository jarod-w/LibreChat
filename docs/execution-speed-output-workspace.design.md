# 执行速 · 产出工作台整页(Output Workspace)前端设计

> 状态:**方案定稿(2026-07-10,Q1–Q3 + §13 Q'1–Q'4 全部拍板),待实现——按 §9 从 P0 开始**
> 涉及仓库:`LibreChat/`(前端整页 + 极薄后端耐久层)。**不涉及 kotlerapi 契约变更**(除 Phase 2)。
> 承接设计:`LibreChat/docs/execution-speed-ui.design.md`(向导 + 落会话 + `ContentPackCard`)——本文只描述"产出后的整页工作台",不重复向导部分。
> 关联记忆:[[profile-tenant-isolation]](产出按 user/brand/product 归属,新增读接口须带同款隔离)。
> 视觉参考:`nucleant_execution_speed_output_page_mockup_v3.html`(左产出件目录 / 中正文·图片·使用说明 tab / 右使用说明·素材检查 / 底作战表)。

---

## 0. 决策速览(✅ 已确认,保留决策记录)

| # | 问题 | 结论 | 见 |
|---|------|------|----|
| Q1 | 整页的定位/入口? | ✅ **登录后默认落地页**——落地决策器解析"最近一轮"→ 进 `/execution-speed/output/:conversationId`;无则回退 `/c/new` | §2 |
| Q2 | 使用说明/待补素材/分组 数据来源? | ✅ **前端 catalog 常量**(按 `piece_key` 映射,走 i18n);非"内容专属",专属留 Phase 2 上移 kotlerapi | §3 |
| Q3 | 修订区(这件是否可用 / 调整·补语气)形态? | ✅ **完整内嵌 ChatView**,绑同一 conversationId | §5 |
| D1 | 是否与 in-chat 呈现并存? | ✅ 并存过渡:`ContentPackCard` 作会话内"轻量回看",整页作"本轮产出主工作台" | §12 |
| D2 | 结构化 result_pack 如何耐久? | ✅ 新增**执行速轮次记录**(settle 时写),脱离 kotlerapi Redis TTL 与已删除的 pending 缓存 | §4 |

> 决策来源:2026-07-10 用户就 Q1/Q2/Q3 显式拍板(分别选 登录后落地 / 前端常量 / 完整内嵌 ChatView);D1/D2 为随之推导、本文档提出。

---

## 1. 背景与结论

向导侧(`execution-speed-ui.design.md`)已跑通:填事实 → 方案确认 → 落会话 → 批量 job → `<nucleant:pending>` 轮询 → done 后在会话消息里渲染 `ContentPackCard`(作战表置顶 + 逐件手风琴)。

本轮解决的是:**把"内嵌在会话消息里的内容包"提升为一个整页产出工作台**——左侧产出件目录、中间带 tab 的正文/图片方案/使用说明、右侧使用说明卡 + 发布素材检查、底部作战表,且**修订仍是对话**(内嵌 ChatView)。

**结论**:整页**复用同一份 `result_pack` 数据**,是它的更丰富呈现,不是新数据模型;缺的三块(使用说明/待补素材/获客·转化·复购分组)用前端 catalog 常量补;"登录后落地"与"耐久回看"靠新增一层轻量轮次记录。

---

## 2. 路由与落地(Q1)

**新路由 `/execution-speed/output/:conversationId`**,挂在 `Root` children 下(与 chat / execution-speed 平级,带 chrome)。

- **带 `:conversationId` 是硬约束**:内嵌 ChatView 通过 `useParams()` 读 conversationId(`client/src/components/Chat/ChatView.tsx:35`,同 `ChatRoute.tsx:46`),不带则对话绑不到那一轮会话。
- 组件目录:`client/src/components/ExecutionSpeed/Output/`。
- 注册点:`client/src/routes/index.tsx`(现有 `execution-speed` 路由同级追加)。

**登录后落地决策器**:
- 现状 index 路由 = `{ index: true, element: <Navigate to="/c/new" replace={true} /> }`(`client/src/routes/index.tsx`)。
- 改为一个轻组件 `<OutputLandingRedirect />`:调 `GET /api/kotler/execution-speed/latest`(§4)——(✅ Q'1 已确认:采纳建议)
  - 有最近一轮 → `<Navigate to="/execution-speed/output/:cid" replace />`;
  - `latest` 返回空(该用户**无任何执行速轮次记录** = 首次/无产出)→ 引导 `<Navigate to="/execution-speed" replace />`(向导);
  - `latest` 有 conversationId 但后续 `round/:cid` **取不到**(数据异常/被删)→ 回退 `<Navigate to="/c/new" replace />`。
- 决策器只在 index 命中(裸进站),不拦截用户主动开的其他路由。

---

## 3. 数据来源(三块)

### 3.1 产出内容 = 现有 `result_pack`(零契约改动)

`KotlerResultPack` / `KotlerResultPiece`(`packages/data-provider/src/data-service.ts:1088–1127`)已带:`verdict`、`battle_plan_markdown`、`pieces[]{piece_key,label,production_status,copy_markdown,image_plan_markdown,placeholders,error}`。整页字段映射:

| 附件元素 | result_pack 字段 |
|---|---|
| 正文 / 文案 | `pieces[].copy_markdown` |
| 图片方案(A 自拍 / B AI 图) | `pieces[].image_plan_markdown`(单块 md;附件的 A/B 结构由前端渲染时分节,不拆契约) |
| 作战表(14 天) | `battle_plan_markdown`(单块 md;附件的 D1–D3… 4 阶段由前端解析/分段,不拆契约) |
| 待确认占位计数 | `pieces[].placeholders` |
| 状态徽章 / 完成·待确认 tag | `pieces[].production_status` + `placeholders.length`(复用 `STATUS_BADGES`,`components/ExecutionSpeed/constants.ts`) |
| 判断头 | `verdict` |

### 3.2 使用说明 + 待补素材 + 分组 = 前端 catalog 常量(Q2)

新增 `client/src/components/ExecutionSpeed/Output/catalog.ts`,按 `piece_key` 映射:

```ts
type PieceCatalogEntry = {
  funnel: 'acquisition' | 'conversion' | 'retention_referral'; // 获客/转化/复购分组
  purposeKey: TranslationKeys;   // 发布目的
  channelKey: TranslationKeys;   // 推荐渠道
  timeKey: TranslationKeys;      // 建议发布时间
  signalKey: TranslationKeys;    // 收到什么信号
  materialKeys: TranslationKeys[]; // 待补真实素材清单
};
```

- key 与 kotlerapi `services/plan_recommender.py` 的 piece 词表 / `intent_catalog` **一一对应,勿新造**(呼应现有 `constants.ts` 的 `CURRENT_PROBLEMS` 对齐约定)。
- `funnel` 分组:优先用 catalog 常量(整页脱离会话独立打开时 plan 已不在内存);若同 session 内 plan 还在,可用 `PlanGroup.funnel`(`data-provider/ExecutionSpeed/queries.ts:26`)校正。
- 全部走 i18n,前缀 **`com_execspeed_output_*`**。
- ⚠️ 明确取舍:catalog = **按件类型的通用打法**,非"这条内容专属";要专属须 Phase 2 由 kotlerapi 在 plan/catalog 返回 usage 元数据。

### 3.3 修订对话 = 内嵌 ChatView(见 §5)

---

## 4. 耐久层与"最近一轮"(D2 / 支撑 Q1)

**为什么必须新增**:
- `KotlerPendingResult` 每次实时从 kotlerapi 拉 `result_pack`(`.../Content/KotlerPendingResult.tsx:29`),job 有 TTL(`com_kotler_job_expired`)。
- 已有的 settle 路径(`api/server/services/nucleantPending.js:189` `settlePendingJobById`)在 done 时把 marker 解析成**文本 markdown 写回消息**,但**不保留结构化 `result_pack`**;且 `jobId→{conversationId,messageId,user}` 映射缓存 settle 后即删(`:238`)。
- 故"登录后落地 / 结构化整页回看 / 查最近一轮"都无耐久数据源 → 必须补一层。

**方案**:新增**执行速轮次记录 = Mongo 独立集合 `ExecutionSpeedRound`**(✅ Q'2 已确认,采纳建议:独立集合便于按 `user + createdAt` 索引查 latest,不塞会话 metadata),字段:

```
{ user, brandId, productId, conversationId, jobId, planId, verdict, result_pack, createdAt }
```

- **写入点**:在 `settlePendingJobById` 落定成功后(或 `webhook/job-complete`,`api/server/routes/kotler.js:32`),若该 job 是执行速内容包(`result_pack != null`),幂等 upsert 一条(jobId 唯一)。**只新增、不改动**现有 marker 解析写回逻辑。
- **读接口(LibreChat 原生,非代理)**:
  - `GET /api/kotler/execution-speed/latest` → 当前用户 `createdAt` 最新一条 → `{ conversationId, jobId, createdAt, ...摘要 }`。
  - `GET /api/kotler/execution-speed/round/:conversationId` → 该会话轮次的 `result_pack`(整页读取源,耐久)。
  - ⚠️ **注册顺序**:两条须在 `router.use('/execution-speed', requireJwtAuth, proxy)`(`kotler.js:104` 的 catch-all 代理)**之前**注册,否则被代理吞掉转发去 kotlerapi。
  - 均 `requireJwtAuth`,且按 [[profile-tenant-isolation]] 以登录态 user 过滤,brandId/productId 收窄。
- **整页数据获取优先级**:`round/:conversationId`(耐久,done 后) → 回退实时 `getKotlerJobStatus(jobId)`(job 未过期时)。
- **jobId 来源**:耐久记录未写时(生成中/未 settle),从该会话 pending 消息的 `<nucleant:pending>` marker 解析(前端 `client/src/utils/nucleantPendingUtils.ts`)。
- **生成中(pending)状态是一等公民**(因 Q'3 = 向导 confirm 直接落整页,落入时 job 常未完成):整页须能渲染"生成中"——复用 `KotlerPendingResult` 的进度(`progress.done/total` + `current_label` + 进度条),逐件清单打勾,done 后原地填充三栏。轮询同款 4s(`POLL_INTERVAL_MS`)。

---

## 5. 内嵌 ChatView(Q3,最大工作量)

整页右侧/下方"修订 studio" = **完整 ChatView**,绑本轮 conversationId。

- **会话 bootstrap**:整页须复刻 `ChatRoute` 的会话初始化(`ChatRoute.tsx:110–191` 的 `newConversation` + models/endpoints + `hasSetConversation`),并用 `ToolCallsMapProvider`(`ChatRoute.tsx:218`)包裹后渲染 `<ChatView index={...} />`。建议**抽出共享 hook**(如 `useBootstrapConversation`)供 ChatRoute 与整页复用,避免复制那段易错 effect。
- **ChatView 嵌入模式**:ChatView 默认撑满主区、自带 header/输入框/落地态(`ChatView.tsx:64` `isLandingPage`)。塞进整页子面板需加一个 `embedded?: boolean` prop 收敛其 header/宽度/落地态。**这是对核心文件 `ChatView.tsx` 的小改,属风险点**,改动须最小、加开关不改默认路径。
- **迭代语义不变**:用户在内嵌对话里追问("把种草文案改口气")= 现有单轮 SSE;产出更新回渲染沿用现有 `ContentPackCard` / 消息流。整页监听该会话消息变化后刷新左侧目录 / 正文。

---

## 6. 布局与双侧栏

- `Root` 已渲染会话侧栏 `<Nav>` + Outlet(`client/src/routes/Root.tsx:78/94`,`navVisible` 经 context 透传)。整页自建三栏会与 Nav 形成**双侧栏**。
- 方案:整页挂载时默认**折叠 Root 的 Nav**(用透传的 `setNavVisible`),把横向空间让给"产出件目录 + 正文 + 右栏";用户可手动展开 Nav 切会话。
- 窄屏:按 `execution-speed-ui.design.md §12` 同款验证——三栏塌缩为可切换的单栏 + 内嵌 ChatView 单列(参考 mockup 的 `@media(max-width:850px)`)。

---

## 7. 组件清单与改动点

**新增 `client/src/components/ExecutionSpeed/Output/`**:

| 文件 | 职责 |
|------|------|
| `OutputWorkspace.tsx` | 容器:会话 bootstrap + 三栏布局 + 折叠 Nav;读 `round/:conversationId` |
| `PieceLibrary.tsx` | 左侧产出件目录(按 `funnel` 分组 + 完成/待确认 tag) |
| `PieceDetail.tsx` | 中间正文:tab(正文 / 图片方案 / 使用说明);复用 `Content/Parts` 的 `Text` 渲染 md |
| `UsagePanel.tsx` | 右栏:使用说明卡(catalog)+ 发布素材检查(catalog materials + placeholders 推导) |
| `BattlePlan.tsx` | 底部作战表(渲染/分段 `battle_plan_markdown`) |
| `RevisionStudio.tsx` | 内嵌 ChatView 包装(bootstrap + `ToolCallsMapProvider` + `embedded`) |
| `catalog.ts` | `piece_key → {funnel,purpose,channel,time,signal,materials}` |
| `index.ts` | 导出 |

**改动既有**:

| 文件 | 改动 |
|------|------|
| `client/src/routes/index.tsx` | 追加 `output/:conversationId` 路由;index 改 `<OutputLandingRedirect />` |
| `client/src/components/Chat/ChatView.tsx` | 加 `embedded?: boolean`(收敛 header/宽度/落地态),默认行为不变 |
| `client/src/components/Chat/Messages/Content/ContentPackCard.tsx` | 头部加「打开产出工作台」按钮 → `navigate('/execution-speed/output/'+conversationId)` |
| `client/src/hooks`(新) | 抽 `useBootstrapConversation`,ChatRoute 与整页共用 |
| `client/src/data-provider/ExecutionSpeed/queries.ts` | 加 `useExecutionSpeedLatest` / `useExecutionSpeedRound`(GET) |
| `api/server/routes/kotler.js` | 在 `:104` 代理**之前**注册 `GET /execution-speed/latest`、`/execution-speed/round/:conversationId`(原生) |
| `api/server/services/nucleantPending.js` | `settlePendingJobById` 成功后 upsert 轮次记录(只增,不改现逻辑) |
| `packages/data-schemas` | `ExecutionSpeedRound` model(独立集合,索引 `user + createdAt`) |

---

## 8. i18n

- 仅加英文键到 `client/src/locales/en/translation.json`(其他语言外部自动化),前缀 **`com_execspeed_output_*`**(如 `com_execspeed_output_tab_copy` / `_tab_image` / `_tab_usage` / `_purpose` / `_channel` / `_time` / `_signal` / `_material_missing` / `_open_workspace` / `_funnel_acquisition|conversion|retention`)。
- catalog 的具体打法文案(目的/渠道/时间/信号/素材清单)全部走 i18n,不硬编码在组件里。

---

## 9. 跨仓库实施顺序与分期

本次前端为主,耐久层为 LibreChat 后端(thin JS + 可选 data-schemas),**不动 kotlerapi 契约**,故不必 kotlerapi 先行。建议实施次序(先立后接,非砍需求):

```
P0  · 工作台本体(从会话可进)
     路由 output/:conversationId + Output 三栏组件 + catalog.ts
     + 复用现有 result_pack(实时读 + 【生成中 pending 状态,一等公民】)
     + ContentPackCard 加「打开工作台」入口
        ↓
P0.5· 内嵌 ChatView 修订区
     抽 useBootstrapConversation + ChatView embedded 模式 + RevisionStudio
        ↓
P1  · 登录后落地 + 耐久 + 向导直落整页
     后端 settle 落定时 upsert 轮次记录 + GET latest / round/:cid
     + index 落地决策器 OutputLandingRedirect
     + 向导 confirm 直接 navigate('/execution-speed/output/:cid')(Q'3;改现有落会话 AutoStart)
        ↓
端到端:向导→确认→直落整页(生成中进度)→done 落定+持久化→三栏填充→内嵌对话迭代→登出重进仍在
```

---

## 10. 验收标准(草案)

- [ ] `/execution-speed/output/:conversationId` 可达,带 chrome;进入时 Root Nav 折叠、三栏布局正常。
- [ ] 左侧目录按 获客/转化/复购 分组,每件带 完成/待确认 tag;点选切换中间正文。
- [ ] 中间 tab:正文 / 图片方案 / 使用说明 均正确渲染;使用说明四要素来自 catalog(i18n)。
- [ ] 右栏发布素材检查:catalog materials + `placeholders` 推导的缺失项正确。
- [ ] 底部作战表渲染 `battle_plan_markdown`。
- [ ] 内嵌 ChatView 绑对本轮会话;追问触发单轮 SSE,产出更新回渲染;ChatView 默认(非 embedded)路径行为不变。
- [ ] 向导 confirm 后直接落到 `/output/:cid`;job 生成中显示进度(N/总 + 当前件 + 进度条),done 后原地填充三栏(不需手动刷新)。
- [ ] 登录后裸进站:有最近一轮 → 落到该轮工作台;无轮次记录 → 向导 `/execution-speed`;有 cid 但 round 取不到 → /c/new。
- [ ] 登出重进 / job 过期后:整页仍能从耐久轮次记录读到 `result_pack`(不撞 `com_kotler_job_expired`)。
- [ ] `latest` / `round` 接口按 user(+brand/product)隔离,跨用户取不到他人产出。
- [ ] 暗色 / 窄屏布局正常;英文 i18n 键齐备。

---

## 11. 风险与注意

- **改核心 `ChatView`**:`embedded` prop 必须加开关、不改默认路径;回归验证 `/c/:id` 正常聊天不受影响。
- **会话 bootstrap 复制**:务必抽共享 hook,勿在整页复制 `ChatRoute` 那段带 `eslint-disable exhaustive-deps` 的 effect(易触发无限渲染,见 `ChatRoute.tsx:181`)。
- **路由注册顺序**:`latest`/`round` 若晚于 `:104` 的 `/execution-speed` catch-all 代理注册,会被转发去 kotlerapi 而 404。
- **耐久写入幂等**:轮次记录按 jobId upsert;webhook 可能重放(`settlePendingJobById` 已声明幂等)。
- **跨用户隔离**([[profile-tenant-isolation]]):新读接口不改既有 `X-LibreChat-User-Id`/brandId 隔离;查询必带 user。
- **catalog 通用性**:使用说明/素材为"按件类型",非内容专属;产品侧需知晓,避免误解为 AI 针对该条生成。
- **落地决策器体验**:裸进站多一次 `latest` 往返 → 加 loading 兜底,避免闪 /c/new 再跳。

---

## 12. 与 in-chat 呈现 / 向导的关系(D1)

- **并存过渡**:`ContentPackCard`(会话内)= 轻量回看 + 「打开工作台」入口;整页 = 本轮产出主工作台。不删除 `ContentPackCard`。
- **同一数据**:两者读同一 `result_pack`(整页优先耐久轮次记录)。
- **向导基本不变**:`execution-speed-ui.design.md` 的两屏向导保持;仅**落点改为整页**——✅ Q'3 已确认:confirm 后建会话 + 起 job,随即 `navigate('/execution-speed/output/:cid')`(P1),整页以"生成中"状态承接,不再中停在 `/c/new`。改动点在现有 `ExecutionSpeedAutoStart`(见 `execution-speed-ui.design.md §14` 偏差 1)。

---

## 13. 待澄清问题(实现前定)

- ~~**Q'1** 落地无最近一轮时,回退 `/c/new` 还是引导 `/execution-speed` 向导?~~ ✅ **已确认(2026-07-10,采纳建议)**:首次/无轮次记录 → 向导 `/execution-speed`;有 conversationId 但 `round/:cid` 取不到 → `/c/new`。落点见 §2。
- ~~**Q'2** 轮次记录存 Mongo 独立集合 `ExecutionSpeedRound` 还是会话 metadata?~~ ✅ **已确认(2026-07-10,采纳建议)**:独立集合 `ExecutionSpeedRound`,索引 `user + createdAt`。见 §4/§7。
- ~~**Q'3** 整页确认生成后的落点:向导 confirm 后直接 `navigate` 到整页,还是仍先落会话再由用户点入?~~ ✅ **已确认(2026-07-10,采纳建议)**:直接落整页(P1),整页以"生成中"状态承接。见 §4/§9/§12。

> §13 全部 4 项已确认(2026-07-10)。方案定稿,可按 §9 分期从 P0 进入实现。

---

## 14. 实施状态

### P0 · 工作台本体(✅ 已落地,2026-07-10;typecheck + ESLint clean,待端到端联调)

| 层 | 文件 | 状态 |
|----|------|------|
| catalog | `client/src/components/ExecutionSpeed/Output/catalog.ts`(12 件 × funnel/使用打法,逐条对齐 kotlerapi `EXEC_PIECES`) | ✅ |
| i18n | `client/src/locales/en/translation.json` `com_execspeed_output_*`(68 键:chrome + 分组/字段标签 + 12 件 × 5 打法) | ✅ |
| 数据 | `Output/useRoundData.ts`(会话消息 `extractPendingData` 取 jobId → 轮询 `getKotlerJobStatus` → result_pack/进度/状态) | ✅ |
| 三栏 | `Output/PieceLibrary.tsx`(按 funnel 分组 + 完成/待确认 tag)/ `PieceDetail.tsx`(正文·图片方案·使用说明 tab)/ `UsagePanel.tsx`(素材检查 + 渠道/时间/信号)/ `BattlePlan.tsx` | ✅ |
| 壳 | `Output/OutputWorkspace.tsx`(折叠 Nav + 三栏 + **生成中进度状态** + loading/expired/failed/missing 兜底 + 回会话按钮) | ✅ |
| 路由 | `client/src/routes/index.tsx` 新增 `execution-speed/output/:conversationId`(Root children,带 chrome) | ✅ |
| 入口 | `ContentPackCard.tsx` 头部加「打开产出工作台」按钮 → `navigate('/execution-speed/output/:cid')`;`KotlerPendingResult.tsx` 透传 conversationId | ✅ |

**与设计的偏差(有意,记录备查)**:

1. **使用说明分两处呈现**(与 §3.2 微调):`PieceDetail` 的「使用说明」tab 显示 目的/渠道/时间/信号 四要素;右栏 `UsagePanel` 显示 素材检查 + 渠道/时间/信号 摘要(与中栏略重叠,还原 mockup 的有意冗余)。
2. **Nav 折叠不还原**:进整页 `setNavVisible(false)`,离开不自动恢复(P0 从简;必要时 P0.5 补 unmount 还原)。
3. **数据仅实时源**:P0 只有 `getKotlerJobStatus(jobId)` 实时源;会话 settle 后 marker 消失 → 归 `expired`。耐久轮次记录 + `latest`/`round` 读接口 = **P1**(§4)。
4. **catalog 5 件为起草**:活动预热图文/视频、落地页、直播成交、转介绍 5 件的打法文案为按口径起草,**待产品复核**;另 7 件取自 mockup 既有文案。

**待办(P0.5 / P1,未做)**:内嵌 ChatView 修订区(P0.5);后端 settle 落定持久化 result_pack + `GET latest`/`round/:cid` + index 落地决策器 + 向导 confirm 直落整页(P1)。

**未验证**:端到端未在实跑环境联调(需 LibreChat 后端 + Mongo + kotlerapi job)。当前仅静态验证(tsc/ESLint clean)。
- ~~**Q'4** 「添加产出类型」(mockup 的 12 类)本轮是否做?~~ ✅ **已确认(2026-07-10,采纳建议)**:留 Phase 2(对应 re-plan / 增件 job,需 kotlerapi 配合);本轮工作台不含「添加产出类型」入口。
