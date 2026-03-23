# LibreChat 邀请码注册功能设计文档

> **版本**: v1.0  
> **日期**: 2026-03-24  
> **状态**: 设计中

---

## 1. 需求概述

### 1.1 背景

LibreChat 当前通过环境变量 `ALLOW_REGISTRATION=true/false` 控制是否开放注册。在部署场景中，完全开放注册存在安全风险（被滥用），而完全关闭注册又无法让新用户加入。

现有的邀请系统（`npm run invite-user`）基于 **email + token 绑定**，通过命令行为指定 email 生成一次性 token 链接，并要求配置邮件服务发送。此方式存在以下不足：

- 必须事先知道被邀请人的 email
- 依赖邮件服务配置
- 每次邀请需要运行命令行工具
- token 一次性使用、不可复用

### 1.2 目标

实现 **通用邀请码注册** 功能：

1. 管理员可生成邀请码（invite code）
2. 邀请码可设置 **最大使用次数** 和 **过期时间**
3. 用户注册时输入邀请码即可注册，无需绑定 email
4. 支持在 `ALLOW_REGISTRATION=false` 情况下通过邀请码注册
5. 提供管理 API 用于增删查改邀请码
6. 与现有的 invite-user（email token）机制 **共存、互不影响**

### 1.3 非目标

- 不修改现有的 email token 邀请流程
- 不实现管理后台 UI（本期仅提供 API，可后续在 Admin Panel 中集成）

---

## 2. 现有系统分析

### 2.1 注册流程全貌

```
客户端 Registration.tsx
  → POST /api/auth/register { name, email, username, password, confirm_password, token? }
    → middleware 链:
        registerLimiter     → 限流
        checkBan            → 封禁检查
        checkInviteUser     → 验证 email token 邀请（可选）
        validateRegistration → 判断是否允许注册
    → registrationController
      → AuthService.registerUser()
        → registerSchema.safeParse()    → Zod 校验
        → isEmailDomainAllowed()        → 域名白名单
        → findUser() 去重
        → createUser() 创建
        → sendVerificationEmail()       → 邮箱验证（可选）
```

### 2.2 关键文件一览

| 层级 | 文件路径 | 职责 |
|------|----------|------|
| **前端组件** | `client/src/components/Auth/Registration.tsx` | 注册表单 UI |
| **前端路由** | `client/src/routes/index.tsx` | `/register` 路由 |
| **类型定义** | `packages/data-provider/src/types.ts` | `TRegisterUser` 类型 |
| **启动配置类型** | `packages/data-provider/src/config.ts` | `TStartupConfig` 类型 |
| **API 数据服务** | `packages/data-provider/src/data-service.ts` | `register()` API 调用 |
| **React Query** | `packages/data-provider/src/react-query/react-query-service.ts` | `useRegisterUserMutation` |
| **API 路由** | `api/server/routes/auth.js` | `/register` 路由定义 |
| **配置路由** | `api/server/routes/config.js` | StartupConfig 下发 |
| **中间件入口** | `api/server/middleware/index.js` | 中间件导出汇总 |
| **邀请用户中间件** | `api/server/middleware/checkInviteUser.js` | 验证 email token |
| **注册验证中间件** | `api/server/middleware/validateRegistration.js` | 判断是否允许注册 |
| **注册控制器** | `api/server/controllers/AuthController.js` | `registrationController` |
| **注册服务** | `api/server/services/AuthService.js` | `registerUser()` 核心业务 |
| **Zod 校验** | `api/strategies/validators.js` | `registerSchema` |
| **邀请模型** | `api/models/inviteUser.js` | 现有 email token 邀请 |
| **路由索引** | `api/server/routes/index.js` | 路由注册汇总 |
| **Admin 角色中间件** | `api/server/middleware/roles/admin.js` | `checkAdmin` |

### 2.3 现有邀请机制（email token）

现有流程通过 `config/invite-user.js`（对应 `npm run invite-user`）：

1. 管理员运行命令，输入被邀请人 email
2. 生成随机 token → hash 后存入 MongoDB tokens 集合
3. 拼接链接 `{DOMAIN_CLIENT}/register?token={encodedToken}`
4. 通过邮件发送给被邀请人
5. 被邀请人打开链接 → 前端从 URL 提取 token → 注册时带上 token
6. `checkInviteUser` 中间件验证 token + email → 通过后设置 `req.invite = invite`
7. `validateRegistration` 中若 `req.invite` 存在则跳过 `ALLOW_REGISTRATION` 检查
8. token 验证后立即从数据库删除（一次性）

---

## 3. 方案设计

### 3.1 数据模型

新建 MongoDB 模型 `InviteCode`：

```javascript
// api/models/InviteCode.js

const inviteCodeSchema = new mongoose.Schema({
  // 邀请码（明文存储，管理员可见）
  code: {
    type: String,
    required: true,
    unique: true,
    index: true,
    trim: true,
  },
  // 最大使用次数（0 = 无限制）
  maxUses: {
    type: Number,
    default: 0,
    min: 0,
  },
  // 已使用次数
  usedCount: {
    type: Number,
    default: 0,
  },
  // 使用该邀请码注册的用户列表
  usedBy: [{
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    usedAt: { type: Date, default: Date.now },
  }],
  // 过期时间（null = 永不过期）
  expiresAt: {
    type: Date,
    default: null,
  },
  // 创建者（管理员 ID）
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  },
  // 是否激活
  isActive: {
    type: Boolean,
    default: true,
  },
  // 备注
  note: {
    type: String,
    default: '',
    maxlength: 500,
  },
}, {
  timestamps: true,
});
```

**设计决策**：
- **明文存储 code**：邀请码不同于密码，需要管理员可见可管理，因此不做 hash
- **usedBy 记录**：便于审计追踪
- **isActive 软删除**：保留历史记录

### 3.2 环境变量

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `REQUIRE_INVITE_CODE` | boolean | `false` | 是否要求注册时提供邀请码 |

**行为矩阵**：

| ALLOW_REGISTRATION | REQUIRE_INVITE_CODE | 行为 |
|----|----|----|
| `true` | `false` | 自由注册（默认行为，不变） |
| `true` | `true` | 必须提供有效邀请码才能注册 |
| `false` | `false` | 禁止注册（仅 email token 邀请可用） |
| `false` | `true` | 禁止自由注册，有效邀请码可注册 |

### 3.3 API 设计

#### 3.3.1 注册接口变更

**`POST /api/auth/register`** - 请求体新增字段：

```typescript
// 新增 inviteCode 可选字段
{
  name: string;
  email: string;
  username?: string;
  password: string;
  confirm_password: string;
  token?: string;        // 现有 email token
  inviteCode?: string;   // 新增：邀请码
}
```

#### 3.3.2 邀请码管理 API（管理员）

所有接口均需要 JWT 认证 + Admin 角色。

| 方法 | 路径 | 说明 |
|------|------|------|
| `POST` | `/api/invite-codes` | 创建邀请码 |
| `GET` | `/api/invite-codes` | 查询邀请码列表（分页） |
| `GET` | `/api/invite-codes/:id` | 查询单个邀请码详情 |
| `PATCH` | `/api/invite-codes/:id` | 更新邀请码（启用/禁用、修改次数等） |
| `DELETE` | `/api/invite-codes/:id` | 删除邀请码 |

**创建邀请码 - 请求 / 响应**：

```jsonc
// POST /api/invite-codes
// Request
{
  "code": "WELCOME2026",      // 可选，不传则自动生成
  "maxUses": 100,              // 可选，默认 0（无限）
  "expiresAt": "2026-12-31",   // 可选，默认 null（永不过期）
  "note": "社区推广活动"        // 可选
}

// Response 201
{
  "_id": "660a1b2c...",
  "code": "WELCOME2026",
  "maxUses": 100,
  "usedCount": 0,
  "expiresAt": "2026-12-31T00:00:00.000Z",
  "isActive": true,
  "note": "社区推广活动",
  "createdBy": "user_id...",
  "createdAt": "2026-03-24T..."
}
```

**查询列表 - 响应**：

```jsonc
// GET /api/invite-codes?page=1&limit=20
// Response 200
{
  "codes": [...],
  "total": 42,
  "page": 1,
  "pages": 3
}
```

### 3.4 中间件设计

新建 `checkInviteCode` 中间件，插入注册路由的中间件链中：

```
registerLimiter → checkBan → checkInviteCode(新) → checkInviteUser → validateRegistration → registrationController
```

**核心逻辑**：

```
checkInviteCode(req, res, next):
  1. if REQUIRE_INVITE_CODE !== true → next()
  2. if req.body.inviteCode 为空 → 403 "Invite code is required"
  3. 查询 InviteCode: { code: inviteCode, isActive: true }
  4. if 不存在 → 403 "Invalid invite code"
  5. if 已过期 → 403 "Invite code has expired"
  6. if maxUses > 0 && usedCount >= maxUses → 403 "Invite code usage limit reached"
  7. req.inviteCode = inviteCodeDoc → next()
```

### 3.5 注册服务修改

修改 `validateRegistration` 中间件，增加邀请码通过的判断：

```javascript
function validateRegistration(req, res, next) {
  if (req.invite) return next();        // 现有：email token 邀请通过
  if (req.inviteCode) return next();    // 新增：邀请码通过
  if (isEnabled(process.env.ALLOW_REGISTRATION)) return next();
  return res.status(403).json({ message: 'Registration is not allowed.' });
}
```

邀请码使用计数更新逻辑放在 `registrationController` 中，**用户创建成功后**才递增：

```javascript
const registrationController = async (req, res) => {
  try {
    const response = await registerUser(req.body);
    const { status, message } = response;

    // 注册成功后，更新邀请码使用次数
    if (status === 200 && req.inviteCode) {
      await InviteCode.findByIdAndUpdate(req.inviteCode._id, {
        $inc: { usedCount: 1 },
        $push: { usedBy: { userId: response.user?._id, usedAt: new Date() } },
      });
    }

    res.status(status).send({ message });
  } catch (err) {
    logger.error('[registrationController]', err);
    return res.status(500).json({ message: err.message });
  }
};
```

> **注意**：当前 `registerUser` 返回值中没有 `user` 字段。考虑到最小化改动，可以在不传 userId 的情况下仅做 `$inc: { usedCount: 1 }`，后续再补充完整审计。

### 3.6 前端修改

#### 3.6.1 StartupConfig 配置下发

在 `api/server/routes/config.js` 的 payload 中新增：

```javascript
inviteCodeEnabled: isEnabled(process.env.REQUIRE_INVITE_CODE),
```

在 `packages/data-provider/src/config.ts` 的 `TStartupConfig` 类型中新增：

```typescript
inviteCodeEnabled?: boolean;
```

#### 3.6.2 Registration.tsx 修改

在注册表单中，当 `startupConfig?.inviteCodeEnabled` 为 `true` 时，渲染邀请码输入框：

```tsx
{startupConfig?.inviteCodeEnabled &&
  renderInput('inviteCode', 'com_auth_invite_code', 'text', {
    required: localize('com_auth_invite_code_required'),
  })
}
```

表单提交时，将 `inviteCode` 一并发送：

```tsx
onSubmit={handleSubmit((data: TRegisterUser) =>
  registerUser.mutate({
    ...data,
    token: token ?? undefined,
    // inviteCode 已通过 register('inviteCode', ...) 自动包含在 data 中
  }),
)}
```

#### 3.6.3 类型定义修改

`packages/data-provider/src/types.ts`：

```typescript
export type TRegisterUser = {
  name: string;
  email: string;
  username: string;
  password: string;
  confirm_password?: string;
  token?: string;
  inviteCode?: string;    // 新增
};
```

#### 3.6.4 国际化

`client/src/locales/en/translation.json` 新增：

```json
"com_auth_invite_code": "Invite Code",
"com_auth_invite_code_required": "Invite code is required",
"com_auth_invite_code_invalid": "Invalid invite code"
```

`client/src/locales/zh-Hans/translation.json` 新增：

```json
"com_auth_invite_code": "邀请码",
"com_auth_invite_code_required": "邀请码为必填项",
"com_auth_invite_code_invalid": "邀请码无效"
```

---

## 4. 变更文件清单

### 4.1 新建文件

| 文件路径 | 说明 |
|----------|------|
| `api/models/InviteCode.js` | 邀请码 Mongoose 模型 |
| `api/server/middleware/checkInviteCode.js` | 邀请码验证中间件 |
| `api/server/routes/inviteCodes.js` | 邀请码管理 API 路由 |
| `api/server/controllers/InviteCodeController.js` | 邀请码管理控制器 |

### 4.2 修改文件

| 文件路径 | 修改点 |
|----------|--------|
| `api/server/middleware/index.js` | 导出 `checkInviteCode` |
| `api/server/middleware/validateRegistration.js` | 增加 `req.inviteCode` 放行判断 |
| `api/server/routes/auth.js` | 注册路由中间件链插入 `checkInviteCode` |
| `api/server/routes/index.js` | 注册邀请码管理路由 |
| `api/server/routes/config.js` | 下发 `inviteCodeEnabled` 到前端 |
| `api/server/controllers/AuthController.js` | 注册成功后更新邀请码计数 |
| `api/server/index.js` | 挂载 `/api/invite-codes` 路由 |
| `packages/data-provider/src/types.ts` | `TRegisterUser` 增加 `inviteCode` 字段 |
| `packages/data-provider/src/config.ts` | `TStartupConfig` 增加 `inviteCodeEnabled` |
| `client/src/components/Auth/Registration.tsx` | 渲染邀请码输入框 |
| `client/src/locales/en/translation.json` | 英文翻译 |
| `client/src/locales/zh-Hans/translation.json` | 中文翻译 |
| `.env.example` | 新增 `REQUIRE_INVITE_CODE` 说明 |

---

## 5. 流程图

### 5.1 注册流程（含邀请码）

```
用户打开 /register
        │
        ▼
┌─────────────────────┐
│  GET /api/config    │ ← 获取 startupConfig
└────────┬────────────┘
         │
         ▼
   inviteCodeEnabled?
     ├── true → 显示邀请码输入框
     └── false → 不显示（正常注册）
         │
         ▼
   用户填写表单并提交
         │
         ▼
   POST /api/auth/register
   { name, email, password, ..., inviteCode? }
         │
         ▼
┌────────────────────┐
│  registerLimiter   │ → 限流
└────────┬───────────┘
         ▼
┌────────────────────┐
│    checkBan        │ → 封禁检查
└────────┬───────────┘
         ▼
┌────────────────────┐
│ checkInviteCode    │ → ★ 新增：验证邀请码
│  (REQUIRE_INVITE_  │    - 未启用 → 跳过
│   CODE=true时生效) │    - 验证码/过期/次数
└────────┬───────────┘
         ▼
┌────────────────────┐
│ checkInviteUser    │ → 现有：验证 email token
└────────┬───────────┘
         ▼
┌────────────────────────┐
│ validateRegistration   │ → req.invite || req.inviteCode || ALLOW_REGISTRATION
└────────┬───────────────┘
         ▼
┌────────────────────────┐
│ registrationController │ → registerUser() + 更新邀请码计数
└────────────────────────┘
```

### 5.2 邀请码管理流程

```
管理员 (JWT + Admin Role)
         │
         ├── POST   /api/invite-codes     → 创建邀请码
         ├── GET    /api/invite-codes      → 查看列表
         ├── GET    /api/invite-codes/:id  → 查看详情
         ├── PATCH  /api/invite-codes/:id  → 更新（启用/禁用/改次数）
         └── DELETE /api/invite-codes/:id  → 删除
```

---

## 6. 安全考虑

| 风险 | 应对措施 |
|------|----------|
| 邀请码被暴力猜测 | 1. 利用现有 `registerLimiter` 限流 2. 邀请码建议 ≥8 字符 3. 验证失败记录日志 |
| 邀请码泄漏 | 1. 支持设置 `maxUses` 和 `expiresAt` 限制影响范围 2. 支持 `isActive=false` 快速禁用 |
| 管理接口被非授权访问 | 所有管理 API 要求 `requireJwtAuth` + `checkAdmin` 中间件 |
| 并发注册导致超额使用 | 使用 MongoDB `findOneAndUpdate` 的原子操作 `$inc` + 条件查询 |
| 与现有 email token 冲突 | `checkInviteCode` 在 `checkInviteUser` **之前** 执行，两者互相独立 |

### 6.1 并发安全

邀请码验证与使用计数递增需要原子性保障。推荐方案：

```javascript
// 原子性验证 + 递增（在 controller 中）
const result = await InviteCode.findOneAndUpdate(
  {
    _id: req.inviteCode._id,
    isActive: true,
    $or: [
      { maxUses: 0 },                          // 无限制
      { $expr: { $lt: ['$usedCount', '$maxUses'] } },  // 未达上限
    ],
  },
  { $inc: { usedCount: 1 } },
  { new: true }
);

if (!result) {
  // 竞态条件：在验证中间件通过后、到这里已被用完
  return res.status(403).json({ message: 'Invite code is no longer valid.' });
}
```

---

## 7. 测试计划

### 7.1 单元测试

| 测试项 | 文件 | 覆盖场景 |
|--------|------|----------|
| checkInviteCode 中间件 | `api/server/middleware/checkInviteCode.spec.js` | 未启用/无码/无效码/过期/超额/正常通过 |
| InviteCode 模型 | `api/models/InviteCode.spec.js` | CRUD、唯一索引、字段校验 |
| InviteCodeController | `api/server/controllers/InviteCodeController.spec.js` | 创建/查询/更新/删除 |

### 7.2 集成测试

| 测试项 | 场景 |
|--------|------|
| 注册流程（邀请码启用） | 有效码注册成功、无效码被拒 |
| 注册流程（邀请码未启用） | 现有行为不受影响 |
| 邀请码计数 | 注册后 usedCount 递增 |
| 邀请码过期 | 过期后无法注册 |
| 邀请码用尽 | 达到 maxUses 后无法注册 |
| 管理 API 权限 | 非管理员无法访问 |
| 与 email token 共存 | email token 注册不受邀请码影响 |

### 7.3 手动验证 Checklist

- [ ] `REQUIRE_INVITE_CODE=false` 时，注册页无邀请码输入框，行为不变
- [ ] `REQUIRE_INVITE_CODE=true` + `ALLOW_REGISTRATION=false` 时，有效邀请码可注册
- [ ] `REQUIRE_INVITE_CODE=true` + `ALLOW_REGISTRATION=true` 时，必须提供邀请码
- [ ] 邀请码用完后提示友好
- [ ] 邀请码过期后提示友好
- [ ] email token 邀请功能不受影响
- [ ] 管理 API 可正常 CRUD 邀请码

---

## 8. 部署 & 配置指南

### 8.1 环境变量

在 `.env` 中添加：

```bash
# 邀请码注册（可选，默认 false）
# 设为 true 后，注册页面将显示邀请码输入框
# 即使 ALLOW_REGISTRATION=false，持有有效邀请码的用户也可注册
REQUIRE_INVITE_CODE=false
```

### 8.2 数据库迁移

无需手动迁移。`InviteCode` 模型在首次使用时由 Mongoose 自动创建集合和索引。

### 8.3 创建邀请码

通过管理 API 创建：

```bash
# 登录获取 JWT token 后：
curl -X POST http://localhost:3080/api/invite-codes \
  -H "Authorization: Bearer <admin_jwt_token>" \
  -H "Content-Type: application/json" \
  -d '{
    "code": "WELCOME2026",
    "maxUses": 50,
    "expiresAt": "2026-12-31",
    "note": "首批用户邀请"
  }'
```

---

## 9. 后续扩展（Out of Scope）

| 方向 | 说明 |
|------|------|
| Admin Panel UI | 在管理后台页面中集成邀请码管理界面 |
| 邀请码分组 | 支持按用途/活动分组管理 |
| 邀请码关联角色 | 不同邀请码注册的用户赋予不同初始角色 |
| 邀请码关联余额 | 不同邀请码给予不同初始 token 余额 |
| 用户自助生成邀请码 | 允许已注册用户生成有限数量的邀请码（裂变） |
| 邀请码使用统计 Dashboard | 可视化邀请码使用趋势 |

---

## 10. 实施步骤

按以下顺序逐步实施，每步完成后可独立验证：

| 步骤 | 内容 | 预计工时 |
|------|------|----------|
| 1 | 创建 `InviteCode` 模型 | 15 min |
| 2 | 创建 `checkInviteCode` 中间件 + 修改 `validateRegistration` | 20 min |
| 3 | 修改注册路由 `auth.js`、中间件导出 `index.js` | 10 min |
| 4 | 修改 `registrationController` 更新邀请码计数 | 15 min |
| 5 | 创建邀请码管理 API（Controller + Route）+ 挂载路由 | 30 min |
| 6 | 修改 `config.js` 下发 `inviteCodeEnabled` 配置 | 5 min |
| 7 | 修改前端类型定义 `TRegisterUser` + `TStartupConfig` | 10 min |
| 8 | 修改 `Registration.tsx` 添加邀请码输入框 | 15 min |
| 9 | 添加国际化翻译 | 10 min |
| 10 | 更新 `.env.example` | 5 min |
| 11 | 编写测试 | 30 min |
| **合计** | | **~2.5 h** |
