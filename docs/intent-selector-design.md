# 意图选择器（Intent Selector）设计文档

> 状态：**草稿 / 待确认**
> 涉及仓库：`LibreChat/`（前端 + 极薄后端透传）、`kotlerapi/`（下游消费方）
> 关联记忆：[[profile-tenant-isolation]]（档案/品牌数据按用户隔离的既有约束）

---

## 0. 阅读提示：待澄清问题速览

下面是动手前必须确认的点，详细背景见正文对应小节。**未确认前不实现。**

| # | 问题 | 文档推荐方案 | 见小节 |
|---|------|-------------|--------|
| Q1 | ✅ **已确认**：意图条放在输入框 **上方**（方案 B，需求 3「红框下移」让位） | 采用方案 B | §4.1 |
| Q2 | ✅ **已确认**：意图 **单选**（manus 选中 Website 后高亮唯一一项） | 单选 | §4.2 |
| Q3 | ✅ **已确认**：随**发送**一起提交，无独立「确认」按钮（“点击确认”＝“点击发送”，复用 brandId 既有链路） | 随发送提交 | §4.3 |
| Q4 | ✅ **已确认**：输入框可填可不填；**留空时默认发送文案「开始做吧」**（仍随意图 + 职能一起提交） | 留空兜底「开始做吧」 | §4.4 |
| Q5 | ✅ **已确认（采纳推荐）**：选择 **单条消息生效**，发送后重置（不做 localStorage 持久化） | 单条消息生效 | §4.5 |
| Q6 | ✅ **已确认（采纳推荐）**：意图 / 职能列表 **一期前端硬编码常量**；二期可改为接口下发 | 一期硬编码 | §5 |
| Q7 | ✅ **已确认（采纳推荐）**：「更多」弹层选中项 **仅作为当前选中意图高亮**，不提升为一级 chip、不改默认 4 项 | 仅高亮 | §4.2 |
| Q8 | ✅ **已确认**：直接进入 kotlerapi 侧实现，契约以 §6.2 提案为准（`X-Intent` + `X-Intent-Functions` header），按 kotlerapi 既有读取方式落地 | kotlerapi 先行实现 | §6 |
| Q9 | 文档参考图缺失：我手头只有对话里贴的 3 张截图（≈manus.png / manus2.png/manus4.png / 1.png），没有项目内的原图文件，理解基于截图 + 文字描述 | 以本文 §2 的术语与截图理解为准 | §2 |

---

## 1. 背景与目标

当前 Nucleant 的对话首屏（参考图 `1.png`）是一个标准的 LibreChat 落地页：欢迎语 + 输入框，用户需要自己把“想要什么营销产物”用自然语言描述清楚。

竞品 Manus（参考图 `manus.png` / `manus2.png`）在输入框旁提供了一排 **能力快捷入口**（Create slides / Build website…），点击后还能进一步选择子类型。这种“先选意图，再选细分维度”的引导，能显著降低用户的表达成本。

**本需求目标**：在 Nucleant 对话首屏引入一套 **两级营销意图选择器**：

1. 一级：**意图（Intent）** —— 用户想要产出的营销内容类型（如「种草图文」）。
2. 二级：**意图职能（Intent Function）** —— 该内容在营销链路上承担的职能（如「获客种草」「转化成交」），可多选。

用户选完后，把结构化的选择 **随对话请求传给 kotlerapi**，由下游营销智能体据此生成更精准的内容。

---

## 2. 术语与参考图对照

> ⚠️ 我没有拿到项目里的原始图片文件，下述理解来自对话中贴的三张截图与你的文字描述。如有出入请在 Q9 指出。

| 截图 | 内容 | 对应本设计 |
|------|------|-----------|
| `manus.png` | 输入框下方一排 chip：Create slides / Build website / Develop desktop apps / Design / **More**；点 More 弹出下拉（Video / Schedule tasks / …） | 一级**意图条** + 「更多」弹层（§4.1、§4.2） |
| `manus2.png` / `manus4.png` | 选中「Website」后：该 chip 在工具栏内高亮（黄框＝当前意图）；输入框**下方**出现「What would you like to build?」子列表（红框＝E-commerce / Landing Page / Dashboard…） | 选中意图后展开的**意图职能条**（§4.3） |
| `1.png` | Nucleant 现状首屏：红框 = 「欢迎来到 Nucleant」标题 + 「发送消息给 nucleant」输入框 | 改造目标区域（§4.1、需求 3） |

**术语定义**：

- **意图（Intent）**：营销内容的产物类型。单选。
- **意图职能（Intent Function）**：内容在营销链路中承担的职能。多选。

---

## 3. 需求拆解（来自原始需求）

### 需求 1 —— 一级意图条 + 「更多」弹层

在 `1.png` 红框附近加入意图 chip：

**默认显示（一级）：**
1. 种草图文
2. 复购话术
3. 商品详情页
4. 促销机制文案
5. **更多**（点击弹出下方列表）

**「更多」弹层内容：**
1. 拉新短视频脚本
2. 活动预热图文
3. 活动预热短视频脚本
4. 落地页
5. 团购/套餐/活动承接页
6. 私信/客服转化话术
7. 直播成交话术
8. 转介绍话术

> 效果对标 `manus2.png`。

### 需求 2 —— 选中意图后展开「意图职能」（多选）

点击任意一项意图，出现意图职能列表（对标 `manus4.png` 红框）：

1. 获客种草
2. 理解教育
3. 转化成交
4. 信任证明
5. 复购留存
6. 转介绍裂变

- **A.** 意图职能 **可多选**。
- **B.** 被选中的意图自身高亮（对标 manus 黄框中的 Build Website）。
- **C.** 用户**点击确认**后，把相关选择项 **直接传给 kotlerapi 接口**。

### 需求 3 —— 允许下移现有红框

可以把 `1.png` 红框（欢迎语 + 输入框）整体**向下移**，为意图条腾出空间。

---

## 4. 交互设计

### 4.1 布局与放置位置（✅ 已确认：方案 B，意图条在输入框上方）

意图条放在 **输入框上方**，欢迎卡 + 输入框整体下移让位（呼应需求 3）。

```
   ┌── 一级意图条（横向，可滚动）───────────────────┐
   │ [种草图文][复购话术][商品详情页][促销机制文案][更多▾] │
   └─────────────────────────────────────────────┘
   选中「种草图文」后，正下方展开意图职能条（可多选）：
   [✓获客种草][理解教育][✓转化成交][信任证明][复购留存][转介绍裂变]

            欢迎来到 Nucleant, 开启您的体验之旅!（整体下移）
   ┌─────────────────────────────────────────────┐
   │  发送消息给 nucleant                          │
   │                                               │
   │  📎  ⚙️                                  ⬆️   │
   └─────────────────────────────────────────────┘
```

> 与 manus 截图（意图条在输入框下方）的视觉差异是有意为之——按本项目确认采用“上方”。一级意图条在上、其下紧跟意图职能条，再下方是下移后的欢迎卡 + 输入框。

挂载点：落在 **首屏落地态**，渲染在 [Landing.tsx](LibreChat/client/src/components/Chat/Landing.tsx) 内容区与 [ChatForm.tsx](LibreChat/client/src/components/Chat/Input/ChatForm.tsx) 之上方。仅在「新会话 / 落地态」展示（对齐现有 `ConversationStarters` 的显示时机），进入正式对话后是否保留见 Q5。

### 4.2 一级意图与「更多」弹层（需求 1，⚠️ Q2 / Q7）

- 一级意图条横向排列 5 个入口：4 个默认意图 + 「更多」。
- 点击「更多」：在按钮下方弹出 popover（对标 manus.png 红框下拉），列出 8 个扩展意图。复用项目里既有的 portal/popover 写法（参考 [BrandProductSelector.tsx](LibreChat/client/src/components/Chat/BrandProductSelector.tsx) 的 `createPortal` + 定位逻辑，保持风格统一）。
- **单选语义（✅ Q2）**：同一时刻只有一个意图处于选中态（高亮）。点第二个意图会替换前一个。
- **「更多」弹层项的处理（✅ Q7）**：从弹层里点一项，等同于“选中该意图”——它进入选中高亮态并展开职能条，但 **不** 把它提升成一级 chip、也不替换默认 4 项。

### 4.3 意图职能条 + 提交（需求 2，✅ Q3 已确认：随发送提交）

- 选中任一意图后，正下方展开「意图职能」条，6 项，**多选**（点击切换勾选态）。
- 被选中的意图自身保持高亮（需求 2B）。
- **无独立「确认」按钮**：选择只是把 `intent` + `intentFunctions` 写入前端状态；用户照常在输入框输入并点 **发送**，发送时把这两个字段随请求体一起带给 kotlerapi（需求 2C 的“点击确认”＝“点击发送”）。这与既有 `brandId/productId` 完全同构（§6），改动最小、链路最稳。

### 4.4 输入框留空兜底（✅ Q4 已确认）

- 选中意图 + 职能后，输入框 **可填可不填**。
- **留空发送**：把消息文案兜底为 **「开始做吧」**，仍随 `intent` + `intentFunctions` 一起提交。
- 填了内容：按用户输入正常发送（同样附带意图 + 职能）。

**实现要点：**

- 现状发送按钮在文本为空时通常禁用（见 [SendButton.tsx](LibreChat/client/src/components/Chat/Input/SendButton.tsx) / `ChatForm` 的 `disabled` 逻辑）。需放宽：**当已选中意图时，即使文本为空也允许发送**。
- 兜底注入点：在提交入口（`submitMessage` / `ChatForm` 的 `handleSubmit` 包装）里——若 `text` 去空白后为空且存在选中意图，则把 `text` 置为 `localize('com_intent_default_message')`（值＝「开始做吧」），再走既有 `ask`。
- 兜底文案「开始做吧」走 i18n（`com_intent_default_message`），不硬编码。
- 边界：**未选意图且文本为空** → 维持现状（不可发送），不受本规则影响。

### 4.5 生效范围与重置（✅ Q5 已确认）

- 选择 **仅对当前这条消息生效**：发送成功后清空意图与职能（回到未选中态）。
- **不** 做 localStorage 持久化（与 brandId 的持久化策略不同，意图原子无 `localStorageEffect`）。

---

## 5. 数据模型（✅ Q6 已确认：一期前端硬编码）

一期 **前端硬编码常量**，结构如下（`key` 为稳定英文 id，用于传给 kotlerapi；`labelKey` 为 i18n key）。

```ts
// 一级意图（默认 + 更多），单选
interface IntentOption {
  key: string;          // 稳定 id，传给后端
  labelKey: string;     // i18n key
  group: 'primary' | 'more';
}

const INTENTS: IntentOption[] = [
  // primary（默认显示）
  { key: 'seeding_graphic',            labelKey: 'com_intent_seeding_graphic',            group: 'primary' }, // 种草图文
  { key: 'repurchase_script',          labelKey: 'com_intent_repurchase_script',          group: 'primary' }, // 复购话术
  { key: 'product_detail_page',        labelKey: 'com_intent_product_detail_page',        group: 'primary' }, // 商品详情页
  { key: 'promotion_copy',             labelKey: 'com_intent_promotion_copy',             group: 'primary' }, // 促销机制文案
  // more（更多弹层）
  { key: 'acquisition_short_video',    labelKey: 'com_intent_acquisition_short_video',    group: 'more' },    // 拉新短视频脚本
  { key: 'campaign_teaser_graphic',    labelKey: 'com_intent_campaign_teaser_graphic',    group: 'more' },    // 活动预热图文
  { key: 'campaign_teaser_video',      labelKey: 'com_intent_campaign_teaser_video',      group: 'more' },    // 活动预热短视频脚本
  { key: 'landing_page',               labelKey: 'com_intent_landing_page',               group: 'more' },    // 落地页
  { key: 'group_buy_page',             labelKey: 'com_intent_group_buy_page',             group: 'more' },    // 团购/套餐/活动承接页
  { key: 'dm_service_conversion',      labelKey: 'com_intent_dm_service_conversion',      group: 'more' },    // 私信/客服转化话术
  { key: 'livestream_closing',         labelKey: 'com_intent_livestream_closing',         group: 'more' },    // 直播成交话术
  { key: 'referral_script',            labelKey: 'com_intent_referral_script',            group: 'more' },    // 转介绍话术
];

// 意图职能，多选
const INTENT_FUNCTIONS = [
  { key: 'acquisition_seeding',   labelKey: 'com_intent_fn_acquisition_seeding' },   // 获客种草
  { key: 'understanding_edu',     labelKey: 'com_intent_fn_understanding_edu' },     // 理解教育
  { key: 'conversion_closing',    labelKey: 'com_intent_fn_conversion_closing' },    // 转化成交
  { key: 'trust_proof',           labelKey: 'com_intent_fn_trust_proof' },           // 信任证明
  { key: 'repurchase_retention',  labelKey: 'com_intent_fn_repurchase_retention' },  // 复购留存
  { key: 'referral_viral',        labelKey: 'com_intent_fn_referral_viral' },        // 转介绍裂变
];
```

> 上述英文 `key` 是临时拟定，**最终以 kotlerapi 侧约定为准**（Q8）。

---

## 6. 把选择传给 kotlerapi（需求 2C）—— 复用既有 brandId/productId 链路

项目里 **已有一条成熟的“前端 UI 选择 → 注入请求体 → 经 header 透传给 kotlerapi”链路**（品牌/产品选择器）。意图选择器 **完全照搬这条链路**，不要另起炉灶。

### 6.1 既有链路（brandId/productId）参考

| 环节 | 文件 | 做了什么 |
|------|------|---------|
| Recoil 状态 | [client/src/store/brandProduct.ts](LibreChat/client/src/store/brandProduct.ts) | `activeBrandId` / `activeProductId` 原子（带 localStorage 持久化） |
| 选择 UI | [client/src/components/Chat/BrandProductSelector.tsx](LibreChat/client/src/components/Chat/BrandProductSelector.tsx) | 设置上述原子 |
| 组装提交 | [client/src/hooks/Chat/useChatFunctions.ts:336](LibreChat/client/src/hooks/Chat/useChatFunctions.ts#L336) | 读原子，写入 `submission.brandId/productId` |
| 写入请求体 | [packages/data-provider/src/createPayload.ts:17](LibreChat/packages/data-provider/src/createPayload.ts#L17) | 把 `brandId/productId` 放进发往后端的 `payload` |
| 类型 | [packages/data-provider/src/types.ts](LibreChat/packages/data-provider/src/types.ts) | `TSubmission` / `TPayload` 含 `brandId/productId` |
| 透传 kotlerapi | [LibreChat/librechat.example.yaml:371](LibreChat/librechat.example.yaml#L371) | `X-Brand-Id: '{{LIBRECHAT_BODY_BRANDID}}'` 把 body 字段注入 header → kotlerapi 读取 |

> 注意：聊天请求走的是 **自定义端点 `KotlerAPI`（OpenAI 兼容 `/v1/chat/completions`）**，不是 `/api/kotler/*` 代理路由（后者只服务档案）。所以意图字段要么经 `{{LIBRECHAT_BODY_*}}` 注入 header，要么由 kotlerapi 从 body 读取——与 brandId 同理。

### 6.2 意图字段的传递方案（推荐）

新增两个提交字段，全程对齐 brandId/productId 的 6 个环节：

- `intent: string | null` —— 选中意图的 `key`（如 `"seeding_graphic"`）。
- `intentFunctions: string[]` —— 选中职能的 `key` 数组（如 `["acquisition_seeding","conversion_closing"]`）。

透传到 kotlerapi 的两种载体（⚠️ Q8，与 kotlerapi 约定其一）：

- **方案①（推荐，与 brandId 一致）**：经 header 注入
  ```yaml
  # librechat.yaml KotlerAPI.headers 追加
  X-Intent: '{{LIBRECHAT_BODY_INTENT}}'
  X-Intent-Functions: '{{LIBRECHAT_BODY_INTENTFUNCTIONS}}'   # 多选需序列化为字符串（见下）
  ```
  注意：header 值是字符串，`intentFunctions` 数组需先在前端序列化（逗号分隔或 JSON 字符串），kotlerapi 侧再解析。占位符是否支持数组取值需验证，**保险起见前端就存成字符串**（如 `"acquisition_seeding,conversion_closing"`）。

- **方案②**：kotlerapi 直接从 chat/completions 请求 **body** 读取 `intent` / `intentFunctions` 字段（前提：LibreChat 自定义端点不会把这些非标准字段 drop 掉——需确认 `dropParams` 配置与转发逻辑）。

### 6.3 跨仓库实施顺序（项目铁律）

按项目 `CLAUDE.md` 的跨仓库顺序，**先定 kotlerapi 契约，再改前端**：

```
1. kotlerapi：约定 intent / intentFunctions 的字段名、类型、取值枚举，
   实现读取（X-Intent header 或 body 字段）+ 据此影响生成逻辑，接口测试通过
   ↓
2. LibreChat（前端）：store 原子 → 选择器组件 → useChatFunctions → createPayload → types
   ↓
3. LibreChat（librechat.yaml）：KotlerAPI.headers 增加占位符注入
   ↓
4. 端到端验证：选意图 → 选职能 → 发送 → kotlerapi 收到正确字段 → 生成结果符合预期
```

> ✅ **kotlerapi 侧已实现（2026-06-21）**：契约已锁定，见 `kotlerapi/markdown/intent_selector_backend.design.md`。
> - 读取 `X-Intent`（单值 key）+ `X-Intent-Functions`（逗号分隔 key）两个 header。
> - §5 的意图 / 职能 `key` 即最终契约（与 kotlerapi `services/intent_catalog.py` 一一对应，勿改名）。
> - 意图 → forced_agent 的映射由 kotlerapi 持有（前端只管传 key）；职能仅作 prompt 创作导向。
> - 前端待办：把选中的 `intent`(单值) + `intentFunctions`(数组→逗号拼接字符串) 经 `librechat.yaml` 的
>   `X-Intent: '{{LIBRECHAT_BODY_INTENT}}'` / `X-Intent-Functions: '{{LIBRECHAT_BODY_INTENTFUNCTIONS}}'` 注入。

---

## 7. 前端实现概要（待 Q 确认后细化）

新增组件目录建议：`client/src/components/Chat/Intent/`

| 文件 | 职责 |
|------|------|
| `IntentSelector.tsx` | 容器：渲染一级意图条 + 「更多」弹层 + 选中后的职能条 |
| `IntentBar.tsx` | 一级意图横向 chip 条（含「更多」触发） |
| `IntentMorePopover.tsx` | 「更多」弹层（复用 BrandProductSelector 的 portal 定位） |
| `IntentFunctionBar.tsx` | 意图职能多选条 |
| `constants.ts` | §5 的 `INTENTS` / `INTENT_FUNCTIONS` 常量 |
| `index.ts` | 导出 |

状态：`client/src/store/intent.ts` 新增 `activeIntent`（`string|null`）与 `activeIntentFunctions`（`string[]`）原子。是否持久化取决于 Q5（推荐不持久化、发送后 reset）。

挂载：在 Landing 落地区域引入 `<IntentSelector />`，置于欢迎卡 + 输入框**上方**（方案 B）。仅落地态展示，与 `ConversationStarters` 显示时机一致。

数据流改动（对齐 §6.1 表）：
1. `useChatFunctions.ts`：读 `activeIntent / activeIntentFunctions`，写入 `submission`。
2. `createPayload.ts`：从 `submission` 取出写入 `payload`。
3. `packages/data-provider` 的 `TSubmission` / `TPayload` 增加字段；改后需 `npm run build:data-provider`。
4. 发送成功后（若 Q5=单条生效）reset 原子。

样式：复用现有 `Badge` / chip 风格（参考 [BadgeRow.tsx](LibreChat/client/src/components/Chat/Input/BadgeRow.tsx) 与 `@librechat/client` 的 `Badge`），保证视觉一致与暗色模式适配。

i18n：所有文案走 `useLocalize()`，仅在 [client/src/locales/en/translation.json](LibreChat/client/src/locales/en/translation.json) 增 `com_intent_*` / `com_intent_fn_*` / `com_intent_default_message`（留空兜底「开始做吧」）英文 key（其他语言由外部自动化处理；中文展示文案以 §3 列表为准，最终中文由本地化流程产出）。

发送放宽（Q4）：在 `ChatForm` 的提交包装 / `submitMessage` 入口，已选意图时允许空文本发送；空文本则把 `text` 兜底为 `com_intent_default_message`。

---

## 8. 验收标准（草案）

- [ ] 落地首屏出现一级意图条，含 4 个默认意图 + 「更多」。
- [ ] 点「更多」弹出 8 项扩展意图，可选中。
- [ ] 选中任一意图后，该意图高亮，下方出现 6 项意图职能。
- [ ] 意图职能可多选、可取消。
- [ ] 点击发送后，kotlerapi 收到正确的 `intent`（单值）与 `intentFunctions`（多值）。
- [ ] 已选意图 + 输入框留空时，可发送，且消息文案兜底为「开始做吧」。
- [ ] 未选意图时，发送行为与现状一致（空文本不可发送，不破坏既有对话）。
- [ ] 暗色模式、移动端窄屏下布局正常（意图条可横向滚动）。
- [ ] 文案走 i18n，无硬编码中文（en key 齐备）。

---

## 9. 风险与注意

- **跨用户隔离不变式**（见 [[profile-tenant-isolation]]）：意图字段不改变现有 `X-LibreChat-User-Id` / brandId 的隔离逻辑，但新增 header 时不要误删既有 header，注入占位符为空时 kotlerapi 要能回退（无意图＝按纯自然语言处理）。
- **自定义端点 dropParams**：若走 §6.2 方案②（body 透传），务必确认 LibreChat 不会把 `intent/intentFunctions` 当未知参数丢弃；方案①（header）更稳。
- **占位符对数组的支持**：`{{LIBRECHAT_BODY_*}}` 是否能取数组值未经验证，推荐前端先序列化为字符串。
- **显示时机**：进入正式会话后是否还显示意图条（Q5）会影响挂载条件，需与 `ConversationStarters` 的隐藏逻辑对齐。

---

## 10. 实施状态（2026-06-21）

- ✅ **kotlerapi 侧已实现**：见 `kotlerapi/markdown/intent_selector_backend.design.md`。
- ✅ **LibreChat 前端已实现**（对齐 brandId 链路）：
  - `packages/data-provider`：`TSubmission`/`TPayload` + `createPayload` 增加 `intent` / `intentFunctions`。
  - `packages/api`：`ALLOWED_BODY_FIELDS` + `RequestBody` 增加 `intent` / `intentFunctions`（占位符白名单）。
  - `client/src/store/intent.ts`：`activeIntent` / `activeIntentFunctions` 原子（不持久化，Q5）。
  - `client/src/components/Chat/Intent/`：`constants.ts`（含 `DEFAULT_INTENT_MESSAGE='开始做吧'`）、`IntentSelector.tsx`、`index.ts`。
  - `client/src/components/Chat/ChatView.tsx`：落地态在欢迎卡 + 输入框**上方**挂载 `<IntentSelector />`（方案 B）。
  - `useChatFunctions.ts`：读 atom → 写入 submission（`intentFunctions` 逗号拼接）。
  - `useSubmitMessage.ts`：空输入 + 已选意图 → 兜底「开始做吧」；发送后重置意图（Q5）。
  - `SendButton.tsx`：已选意图时允许空输入发送（Q4）。
  - `locales/en/translation.json`：新增 `com_intent_*` / `com_intent_fn_*` 英文键。
  - `librechat.example.yaml`：`KotlerAPI.headers` 增加 `X-Intent` / `X-Intent-Functions` 占位符。

### ⚠️ 部署前必做
1. **`npm run build:data-provider`**（types 变更后，前端才能识别 `TSubmission.intent`）；随后整体 `npm run build`。
2. 把生产 `librechat.yaml` 的 `KotlerAPI.headers` 同步加上 `X-Intent` / `X-Intent-Functions`（example 已加）。
3. 端到端验证（§8）：选意图 → 选职能 → （留空或填写）发送 → kotlerapi 收到 `X-Intent` / `X-Intent-Functions` → 命中对应 forced_agent。
