# 意图选择 → 输入框提示词预填(Prompt Prefill)设计文档(LibreChat 侧)

> 状态:**已确认(§0 的 Q1–Q8 全部采纳推荐方案)** — 剩余前置项:业务/营销定稿 12 意图骨架 + 6 职能片段文案(§7 / §11 步骤 2),定稿后即可按 §11 实施
> 涉及仓库:**仅 `LibreChat/` 前端**(判断见 §1.3;不改 kotlerapi 契约)
> 关联记忆:[[profile-tenant-isolation]](档案/品牌数据按用户隔离)
> 关联设计:`LibreChat/docs/intent-selector-design.md`(本功能是意图选择器的增量);`LibreChat/docs/execution-speed-ui.design.md`(档案预填做法可复用)
> 需求来源:选完 [快捷创作]→[意图职能] 后,**直接把提示词写进输入框,用户只需补上必要的产品/其它信息即可发送**(把"用户自己组织语言"降级为"填空")。

---

## 0. 已确认决策速览(✅ Q1–Q8 全部采纳推荐方案)

> 用户已于 2026-07-04 确认:以下 8 条推荐方案**全部采纳**,作为本功能的实现约定。后续按 §11 顺序实施(仅剩文案定稿为前置项)。

| # | 问题 | 确认方案(✅ 已采纳) | 见 |
|---|------|---------|----|
| Q1 | **模板粒度**:提示词按什么维度组织?(意图 12 项 × 职能 6 项若做全矩阵会爆炸,且职能可多选) | 以**意图**为骨架模板(12 套)+ 每个**职能**贡献一行"导向"片段(6 条),多选职能时片段拼接 | §4 |
| Q2 | **触发时机**:何时把模板写进输入框? | 选中**意图即写入**基础骨架;每次增/减**职能**时刷新"职能导向段"(即时反馈,不必等两级都选) | §5.1 |
| Q3 | **覆盖策略**(最关键):用户已在输入框打字后再改选择,是否覆盖его输入? | **仅当输入框为空、或内容 === 上次注入的模板时才替换**;用户手动改过就标记 dirty,后续选择变化只更新结构化 header、不再动文本 | §5.2 |
| Q4 | **占位符形式**:让用户填的"空"怎么标记? | v1 纯文本 `【填写:xxx】`(可正则检测),不做富交互 snippet 跳转(留 v2) | §4.3 |
| Q5 | **是否用档案预填产品信息**:已知的产品名/卖点等是否从当前品牌/产品档案自动带入,只把未知字段留空?(对齐 execution-speed 的做法) | **是**——读 `activeProductId` 对应档案预填已知槽位,未知留 `【填写:…】`;更贴合"只填必要信息"。呼应 [[profile-tenant-isolation]] | §6 |
| Q6 | **模板文案归属**:提示词是前端硬编码(v1)还是后端下发(v2)?谁维护这批营销文案? | v1 前端硬编码常量(与 `DEFAULT_INTENT_MESSAGE='开始做吧'` 同性质:功能性种子文本,非纯 UI);具体文案**待业务/营销定稿**,文档先给结构+示例 | §4.4 / §7 |
| Q7 | **残留占位符的处理**:发送时若模板里还留着 `【填写:…】` 没填,怎么办? | v1 **软提示**(输入框下方灰字"还有 N 处未填写"),仍允许发送;不硬拦截 | §5.3 |
| Q8 | **与既有 `X-Intent` header 链路的关系**:预填文本后,是否还发送结构化的 intent/职能 header? | **照旧发送**(header 管 forced_agent 路由,文本管创作内容,二者并存);因此 kotlerapi **零改动**,纯前端功能 | §1.3 / §8 |

> 补充确认:布局位置沿用现状(意图条在**输入框下方**,见 `ChatView.tsx:106` / 截图),本功能不移动它。

---

## 1. 背景、目标与仓库定位

### 1.1 现状(已上线的意图选择器)

对话落地首屏已有[意图选择器](./intent-selector-design.md):`IntentSelector.tsx` 渲染「快捷创作」一级意图条(单选)+ 选中后展开「意图职能」多选条。选择后当前行为:

- 只写两个 Recoil 原子:`store.activeIntent`(单值)、`store.activeIntentFunctions`(数组)——见 [IntentSelector.tsx:24-45](../client/src/components/Chat/Intent/IntentSelector.tsx#L24-L45)。
- 仅**改输入框 placeholder**为「描述你的{意图}需求,或直接发送…」——见 [useTextarea.ts:99-104](../client/src/hooks/Input/useTextarea.ts#L99-L104)。**不预填 textarea 文本**。
- 发送时:空文本兜底为 `DEFAULT_INTENT_MESSAGE='开始做吧'`——见 [useSubmitMessage.ts:37](../client/src/hooks/Messages/useSubmitMessage.ts#L37);intent/职能随 submission 以 `intent` + 逗号拼接的 `intentFunctions` 出参,经 `librechat.yaml` 注入 `X-Intent`/`X-Intent-Functions` header 给 kotlerapi。
- 单条生效:发送后 reset 两个原子——见 [useSubmitMessage.ts:49-52](../client/src/hooks/Messages/useSubmitMessage.ts#L49-L52)。

### 1.2 目标(本次增量)

把"选择后只改 placeholder"升级为"**选择后把一段结构化提示词写进输入框**":用户看到的是一份已成型、带产品信息槽的提示词草稿,**只需填空(产品名/卖点/人群等)**再发送。降低表达成本,提升发给 kotlerapi 的 prompt 质量。

**不改变**:意图/职能的选择交互、单选/多选语义、header 出参链路、发送后 reset 的单条生效语义。

### 1.3 仓库定位(项目铁律第 1 条)

**本需求 = 纯 `LibreChat/` 前端改动。** 理由:

- 提示词模板是**用户可编辑的脚手架文本**(性质同 `ConversationStarters` / `DEFAULT_INTENT_MESSAGE`),不是后端系统提示词,可作前端常量(Q6)。
- 发给 kotlerapi 的仍是"user 消息文本 + 既有 header",**接口契约零变化**(Q8),不触发跨仓库协作顺序。
- 若未来改为后端下发模板(v2),再按铁律走 kotlerapi 先行。

---

## 2. 需求拆解

| # | 需求 | 落点 |
|---|------|------|
| R1 | 选中 快捷创作(意图)后,输入框自动出现对应提示词骨架 | §5.1 触发 |
| R2 | 选中/取消 意图职能(多选)时,提示词里的"职能导向段"同步刷新 | §4.2 / §5.1 |
| R3 | 提示词里预留"产品/其它信息"的填空位,用户补全即可 | §4.3 占位符 + §6 档案预填 |
| R4 | 用户可自由编辑预填内容,不被后续误覆盖 | §5.2 覆盖策略 |
| R5 | 补全后照常发送,行为与现状一致(header 照带、发后重置) | §8 |

---

## 3. 现有可复用机制(实现地基)

| 能力 | 位置 | 说明 |
|------|------|------|
| 往 composer 注入文本 | `store.activePromptByIndex(index)` 原子 → [useTextarea.ts:64-71](../client/src/hooks/Input/useTextarea.ts#L64-L71) `insertTextAtCursor` + `forceResize` | prompts 功能就走这条;但它是**光标处插入(append 语义)**,不替换 |
| 受控 textarea 值 | `ChatForm.tsx` 用 react-hook-form `register('text')` / `methods.setValue('text', …)` / `useWatch` | **替换语义**用 `setValue` 最干净(会同步 RHF 校验/`isDirty`) |
| 意图原子 | [store/intent.ts](../client/src/store/intent.ts) `activeIntent` / `activeIntentFunctions` | 本功能的输入信号 |
| 档案数据 | `useProfileProductsQuery` + `store/brandProduct.ts` 的 `activeProductId` | 产品槽预填数据源(Q5) |
| placeholder 仅空态显示 | [useTextarea.ts:74-77](../client/src/hooks/Input/useTextarea.ts#L74-L77)(非空即早返回) | 预填后 textarea 非空,placeholder 自然不出现,**无冲突** |

> 结论:注入走 **RHF `setValue`(替换)** 为主,而非 `activePrompt` 的 append;逻辑集中在 `useTextarea`(它已持有 `textAreaRef` 且在 ChatForm 的 FormProvider 内,可拿 `useChatFormContext()`)。

---

## 4. 模板模型(Q1 / Q4 / Q6)

### 4.1 数据结构(新增 `client/src/components/Chat/Intent/promptTemplates.ts`)

```ts
/** 每个意图一套骨架模板;{{product}} 等为可被档案预填替换的槽,【填写:…】为需用户补的空 */
interface IntentPromptTemplate {
  intentKey: string;   // 对齐 INTENTS[].key
  build: (ctx: PromptContext) => string;   // 生成骨架(不含职能段)
}

/** 每个职能一行"导向"片段,多选时按选中顺序拼接 */
interface FunctionDirective {
  functionKey: string; // 对齐 INTENT_FUNCTIONS[].key
  line: string;        // 如 "获客种草:用真实场景+情绪钩子降低『与我有关』的门槛"
}

interface PromptContext {
  productName?: string;      // 来自档案(Q5),缺失则用占位
  sellingPoints?: string;    // 来自档案(product_attributes 等)
}
```

组合函数(供 §5 注入调用):

```ts
buildIntentPrompt(intentKey, functionKeys[], ctx) =>
  骨架(intent.build(ctx))
  + "\n\n营销职能导向(本篇需同时承担):\n" + functionKeys 映射 FunctionDirective.line 逐行 "- …"
  + "\n\n" + 该意图的产出要求
```

### 4.2 为什么"意图骨架 + 职能片段"而非全矩阵(Q1)

- 意图 12 项、职能 6 项,职能**可多选** → 全矩阵组合上百,无法维护。
- 骨架(结构、产品槽、产出要求)由**意图**决定;职能只影响"内容导向",天然是**可叠加的一行片段**。
- 多选职能 = 多行导向拼接,语义清晰、维护成本 = 12 + 6 = 18 段文案。

### 4.3 占位符/填空格式(Q4)

- 需用户补的空统一写成 `【填写:产品名称】`、`【填写:核心卖点(1-3条)】` 等,**方括号 + "填写:" 前缀**,便于正则 `/【填写:[^】]*】/g` 检测(用于 Q7 的未填提示)。
- v1 **纯文本**,不做点击跳转/高亮下一个空的 snippet 交互(留 v2)。

### 4.4 文案归属与定稿(Q6)

- v1 硬编码在 `promptTemplates.ts`,性质等同 `DEFAULT_INTENT_MESSAGE`(功能性种子文本,固定中文,**不进 i18n**,保证发给 kotlerapi 的文案确定)。
- **具体营销文案待业务/营销团队定稿**;18 段全量初稿见 **§13 附录**(已与 `promptTemplates.ts` 常量逐字一致,定稿时同步改这两处,勿改 key)。

### 4.5 示例(种草图文 + 获客种草 + 信任证明,已开档案预填)

```
请为南城香·南城香中餐创作一篇「种草图文」,用于小红书 / 大众点评等内容平台。

产品信息:
- 核心卖点:【填写:1-3 条核心卖点】
- 目标人群:【填写:目标人群,如周边 3km 白领 / 家庭客】
- 补充信息(可选):【填写:价格档位 / 门店位置 / 当前活动】

营销职能导向(本次内容需同时承担):
- 获客种草:用真实场景 + 情绪钩子吸引路人,降低"这和我有关"的门槛。
- 信任证明:自然嵌入可信细节(食材 / 工艺 / 资质 / 口碑 / 复购),打消顾虑。

产出要求:给出 3 个标题备选 + 正文(分段、真实场景、适度 emoji)+ 5-8 个话题标签。
```

> 上例为 `buildIntentPrompt` 的实际渲染结果:开档案预填时产品名(此处 `南城香·南城香中餐`)直接来自档案、不带 `【】`;未开档案预填(Q5=否)时,首行为 `请为【填写:产品 / 品牌名称】创作…`。

---

## 5. 注入与交互机制

### 5.1 触发时机(Q2)

在 `useTextarea` 内新增一个 effect(或抽 `useIntentPromptSync` hook),**watch `activeIntent` + `activeIntentFunctions`(+ 预填用的 product 档案)**:

- `activeIntent` 变为非空 → 组合模板并注入(替换,见 §5.2)。
- 职能数组变化 → 重新组合(骨架不变、刷新职能导向段)并注入。
- `activeIntent` 变为 `null`(用户再次点选中项取消)→ 若当前文本仍是我们注入的模板,则清空;否则保留用户内容。

> IntentSelector 保持"纯原子写入"不变,注入逻辑集中在 composer 侧,单一职责。

### 5.2 覆盖策略 / dirty 保护(Q3,最关键)

用一个 ref 记住"上次注入的模板文本" `lastInjectedRef`:

```
组合出 nextTemplate 后:
  const cur = 当前 textarea 值
  if (cur === '' || cur === lastInjectedRef.current) {
     methods.setValue('text', nextTemplate, { shouldValidate: true })
     lastInjectedRef.current = nextTemplate
  } else {
     // 用户已手动编辑 → 不覆盖,仅让结构化 header 照常更新(原子已由 IntentSelector 写)
  }
```

- 效果:选中/切换意图或职能会**实时刷新**草稿;**一旦用户动手改**,后续选择变化不再踩他的文本。
- 发送后 / reset 时清空 `lastInjectedRef.current`,恢复干净态。

### 5.3 未填占位符软提示(Q7)

- 发送前不硬拦截。若 `text` 仍含 `/【填写:[^】]*】/`,在输入框下方显示灰字提示「还有 N 处『【填写:…】』未替换,确认直接发送?」(仍可发)。
- 走 i18n:`com_intent_prefill_unfilled_hint`(英文键)。

---

## 6. 档案预填(Q5,呼应 [[profile-tenant-isolation]])

- 数据源:`useProfileProductsQuery`(经 `/api/kotler/profile` 代理,带 `X-LibreChat-User-Id` + brand/product 隔离)按 `activeProductId` 取当前产品。
- 预填映射(能填就填,填不到留 `【填写:…】`):
  - `productName` ← `product.product_name`(缺则回退品牌名)。
  - `sellingPoints` ← `product.product_attributes` / `target_customers`(若结构合适)。
- **只读不回写**:本功能不改档案(与 execution-speed 的"回写"不同;这里模板是一次性草稿,用户在 textarea 里的修改不应污染档案)。
- 隔离不变式:预填只发生在已有 `activeProductId` 且档案查询成功时;无档案则全部留占位,不阻塞。

---

## 7. 组件与改动清单(全部在 `LibreChat/` 前端)

| 层 | 文件 | 改动 |
|----|------|------|
| 模板常量(新增) | `client/src/components/Chat/Intent/promptTemplates.ts` | `IntentPromptTemplate[]`(12)、`FunctionDirective[]`(6)、`buildIntentPrompt()`、占位符正则 |
| 注入逻辑 | `client/src/hooks/Input/useTextarea.ts` | 新增 watch `activeIntent`/`activeIntentFunctions`(+product 档案)的 effect,按 §5.2 用 `useChatFormContext().setValue` 注入 + dirty 保护 |
| 档案数据(Q5) | 同上 hook 内 | `useProfileProductsQuery` + `store.activeProductId` 取 `PromptContext` |
| 软提示(Q7) | `client/src/components/Chat/Input/ChatForm.tsx` 或其下提示区 | 检测残留 `【填写:…】`,渲染灰字提示 |
| reset 联动 | `client/src/hooks/Messages/useSubmitMessage.ts` | 发送后除 reset 意图原子外,清 `lastInjectedRef`(若 ref 放 hook 内则由 effect 自然处理) |
| i18n | `client/src/locales/en/translation.json` | 新增 `com_intent_prefill_unfilled_hint`(英文键);模板正文**不进 i18n**(Q6) |

> `IntentSelector.tsx`、`store/intent.ts`、出参链路(`useChatFunctions`/`createPayload`/types/yaml header)**均不改**——本功能只在"选择 → 文本"这一段加料。

---

## 8. 与既有 header 链路的关系(Q8)

- `intent` + `intentFunctions` 仍照旧写入 submission 并注入 `X-Intent`/`X-Intent-Functions`(不动 [useChatFunctions.ts](../client/src/hooks/Chat/useChatFunctions.ts) 与 `librechat.yaml`)。
- kotlerapi 收到:**结构化 header(管 forced_agent 路由)+ 富文本 user 消息(管创作内容)**,二者互补,无需改 kotlerapi。
- `DEFAULT_INTENT_MESSAGE='开始做吧'` 兜底保留:仅在用户把模板清空、又不填任何字时兜底(边缘情形)。

---

## 9. i18n

- 仅提示类 UI 文案进 i18n(如 `com_intent_prefill_unfilled_hint`),只加英文键到 `client/src/locales/en/translation.json`(其他语言外部自动化)。
- **模板正文硬编码中文、不进 i18n**(Q6),与 `DEFAULT_INTENT_MESSAGE` 一致——保证发给 kotlerapi 的 prompt 确定。

---

## 10. 验收标准(草案)

- [ ] 选中任一「快捷创作」意图 → 输入框立即出现对应骨架模板(Q2)。
- [ ] 增/减「意图职能」→ 模板"职能导向段"实时刷新,骨架不变。
- [ ] 再次点选中的意图取消 → 若文本仍是模板则清空,用户改过的内容不被清。
- [ ] 用户编辑模板后再切换选择 → **不覆盖**其编辑(dirty 保护,Q3)。
- [ ] 开档案预填时,产品名等已知槽被带入,未知槽留 `【填写:…】`(Q5);无档案时全部留占位、不报错。
- [ ] 残留 `【填写:…】` 时显示"未填写"软提示,但仍可发送(Q7)。
- [ ] 发送后输入框清空、意图原子重置(单条生效)、下次选择重新预填。
- [ ] `X-Intent`/`X-Intent-Functions` 仍正确送达 kotlerapi(链路未回归)。
- [ ] 暗色模式 / 移动端窄屏正常;placeholder 与预填不冲突。

---

## 11. 实施顺序(纯前端)

```
1. ✅ §0 的 Q1–Q8 已确认(全部采纳推荐方案,含 Q3 覆盖策略、Q5 档案预填、Q6 文案归属)
   ↓
2. 业务/营销定稿 12 意图骨架 + 6 职能片段文案(AI 初稿见 §13)  ← 当前前置项
   ↓
3. promptTemplates.ts 常量 + buildIntentPrompt()
   ↓
4. useTextarea 注入 effect(dirty 保护)+(Q5)档案预填
   ↓
5. Q7 软提示 + i18n 英文键
   ↓
6. 端到端:选意图/职能 → 预填 → 编辑保护 → 补空 → 发送 → header 正确 → 发后重置
```

> 无 `build:data-provider`、无 yaml、无 kotlerapi 改动——不涉及出参类型与跨仓库契约。

---

## 12. 风险与注意

- **覆盖用户输入(最高风险)**:Q3 的 dirty 保护是核心;`setValue` 替换前务必比对 `lastInjectedRef`,否则会吞掉用户已打的字。实现时重点测"打字后切换选择""快速连点意图"。
- **RHF 同步**:用 `methods.setValue('text', …, { shouldValidate: true })` 而非直接改 DOM,确保 `useWatch('text')`、发送按钮禁用态、自动增高一致;若改用 `activePrompt` 的 execCommand 路径需自行处理"替换而非追加"。
- **档案预填时序(Q5)**:`useProfileProductsQuery` 异步;意图选中时档案可能未就绪 → 先用占位注入,档案到位后若文本仍是旧模板可二次刷新(纳入 §5.2 同一比对逻辑),避免打断用户。
- **跨用户隔离**([[profile-tenant-isolation]]):预填读档案不新增隔离风险,但须走既有 `useProfileProductsQuery`(带 user/brand/product 头),不得旁路。
- **placeholder 冗余**:预填后 textarea 非空,原 placeholder 逻辑自然不触发;但意图选中→未注入的空窗期,旧 placeholder 仍会闪一下,可接受。
- **文案质量**:模板直接决定生成质量,务必业务定稿(Q6),避免占位符/导向语误导 LLM。

---

## 13. 附录:18 段文案初稿(⚠️ 待业务/营销定稿)

> 状态:**AI 初稿**,非最终文案。业务/营销可直接在本表批注/改写,定稿后回写到常量。
> 与代码的关系:本 §13 已**回写到** `client/src/components/Chat/Intent/promptTemplates.ts`(`INTENT_TEMPLATES` / `FUNCTION_DIRECTIVES`),二者当前**逐字一致**;后续业务定稿时同步改这两处(本表 + 常量),保持一致,勿改 key、勿改文件位置。
> 组成:12 意图骨架(每个 = 首句 + 产出要求)+ 6 职能导向片段 = 18 段(呼应 §4.2)。key 严格对齐 [constants.ts](../client/src/components/Chat/Intent/constants.ts) 与 [zh-Hans/translation.json](../client/src/locales/zh-Hans/translation.json),**勿改 key**,只改中文文案。

### 13.1 共用件(所有意图复用,不计入 18 段)

**产品名 `{product}`**:开档案预填时替换为产品/品牌名(§6);无档案时为 `【填写:产品 / 品牌名称】`。

**产品信息块**(插在首句之后,所有意图统一):

```
产品信息:
- 核心卖点:【填写:1-3 条核心卖点】
- 目标人群:【填写:目标人群,如周边 3km 白领 / 家庭客】
- 补充信息(可选):【填写:价格档位 / 门店位置 / 当前活动】
```

**拼装顺序**(见 `buildIntentPrompt`):`首句` → `产品信息块` → `营销职能导向段`(选了职能才有)→ `产出要求`。

### 13.2 十二意图骨架(首句 + 产出要求)

| # | 意图(key) | 骨架首句 | 产出要求 |
|---|-----------|---------|---------|
| 1 | 种草图文<br>`seeding_graphic` | 请为 {product} 创作一篇「种草图文」,用于小红书 / 大众点评等内容平台。 | 给出 3 个标题备选 + 正文(分段、真实场景、适度 emoji)+ 5-8 个话题标签。 |
| 2 | 复购话术<br>`repurchase_script` | 请为 {product} 撰写一组「复购话术」,用于社群 / 私信 / 到店场景触达老客。 | 给出 3-5 条可直接发送的话术,每条注明触发场景与复购理由。 |
| 3 | 商品详情页<br>`product_detail_page` | 请为 {product} 撰写「商品详情页」文案,用于电商 / 小程序商详。 | 首屏主卖点 + 卖点分点详述 + 使用场景 + 信任背书 + 行动号召。 |
| 4 | 促销机制文案<br>`promotion_copy` | 请为 {product} 设计一次「促销活动」的机制与文案。 | 促销机制说明 + 主推文案 + 3 条渠道分发短文案(朋友圈 / 社群 / 短信)。 |
| 5 | 拉新短视频脚本<br>`acquisition_short_video` | 请为 {product} 撰写一条「拉新短视频脚本」,用于抖音 / 视频号等平台获客。 | 3 秒开头钩子 + 分镜脚本(口播 + 画面 + 字幕)+ 结尾引导关注 / 到店。 |
| 6 | 活动预热图文<br>`campaign_teaser_graphic` | 请为 {product} 创作一篇「活动预热图文」,用于活动开始前造势。 | 悬念钩子 + 预热主文案 + 3 个标题备选 + 话题标签。 |
| 7 | 活动预热短视频脚本<br>`campaign_teaser_video` | 请为 {product} 撰写一条「活动预热短视频脚本」,用于活动前引流蓄水。 | 悬念开头 + 分镜脚本(口播 + 画面 + 字幕)+ 结尾活动预告。 |
| 8 | 落地页<br>`landing_page` | 请为 {product} 撰写「广告落地页」文案,用于承接投放流量。 | 主标题 + 副标题 + 卖点分区 + 用户见证 + 表单 / 行动号召。 |
| 9 | 团购/套餐/活动承接页<br>`group_buy_page` | 请为 {product} 撰写「团购 / 套餐承接页」文案。 | 套餐组合与价格锚点 + 核心卖点 + 限时限量说明 + 行动号召。 |
| 10 | 私信/客服转化话术<br>`dm_service_conversion` | 请为 {product} 撰写一组「私信 / 客服转化话术」,把咨询转化为下单。 | 按咨询意图分类的话术(开场 / 答疑 / 逼单)+ 常见异议应答。 |
| 11 | 直播成交话术<br>`livestream_closing` | 请为 {product} 撰写一组「直播成交话术」,用于直播间逼单转化。 | 产品讲解话术 + 价格 / 福利话术 + 3 波逼单话术 + 互动引导。 |
| 12 | 转介绍话术<br>`referral_script` | 请为 {product} 撰写一组「转介绍话术」,激励老客带新客。 | 转介绍邀请话术 + 利益点说明 + 可直接转发给好友的文案。 |

### 13.3 六职能导向片段(选中职能才拼入,多选按选中顺序逐行)

标题行固定:`营销职能导向(本次内容需同时承担):`,其下每条职能一行 `- …`。每条片段自成一句、统一以句号结尾,保证任意选中顺序/数量下都读得通(代码只做逐行拼接,不按位置改标点)。

| # | 职能(key) | 导向片段 |
|---|-----------|---------|
| 1 | 获客种草<br>`acquisition_seeding` | 获客种草:用真实场景 + 情绪钩子吸引路人,降低"这和我有关"的门槛。 |
| 2 | 理解教育<br>`understanding_edu` | 理解教育:把卖点讲成用户能听懂的价值,补齐认知差、建立品类认知。 |
| 3 | 转化成交<br>`conversion_closing` | 转化成交:给出明确的行动指令与理由,制造紧迫感推动即时下单。 |
| 4 | 信任证明<br>`trust_proof` | 信任证明:自然嵌入可信细节(食材 / 工艺 / 资质 / 口碑 / 复购),打消顾虑。 |
| 5 | 复购留存<br>`repurchase_retention` | 复购留存:强化复购理由与记忆点,唤醒老客再次到店 / 下单。 |
| 6 | 转介绍裂变<br>`referral_viral` | 转介绍裂变:设计可分享的钩子与利益点,促使老客主动带新客。 |

### 13.4 完整拼装示例(直播成交话术 + 转化成交 + 信任证明,未开档案预填)

补充 §4.5 的图文示例,展示话术类意图 + 多职能的拼装效果:

```
请为【填写:产品 / 品牌名称】撰写一组「直播成交话术」,用于直播间逼单转化。

产品信息:
- 核心卖点:【填写:1-3 条核心卖点】
- 目标人群:【填写:目标人群,如周边 3km 白领 / 家庭客】
- 补充信息(可选):【填写:价格档位 / 门店位置 / 当前活动】

营销职能导向(本次内容需同时承担):
- 转化成交:给出明确的行动指令与理由,制造紧迫感推动即时下单。
- 信任证明:自然嵌入可信细节(食材 / 工艺 / 资质 / 口碑 / 复购),打消顾虑。

产出要求:产品讲解话术 + 价格 / 福利话术 + 3 波逼单话术 + 互动引导。
```

### 13.5 定稿注意

- **只改中文,不改 key**:key 是发往 kotlerapi 的稳定标识(`intent_catalog.py`),改名会断链路。
- **占位符格式固定**:填空一律 `【填写:…】`(全角方括号 + `填写:` 前缀),否则 Q7 的未填检测正则 `/【填写:[^】]*】/g` 会漏。
- **首句含意图名**:每条首句都点名意图类型(「种草图文」「直播成交话术」…),与 UI 选中标签一致,便于用户核对。
- **产出要求宜给结构、不给字数**:让 LLM 有发挥空间,过细的字数/条数约束建议留给用户在 `【填写:补充信息】` 里自定。
