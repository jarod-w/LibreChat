# LibreChat Admin Panel 设计文档

> **版本**: v1.0
> **日期**: 2026-04-03
> **状态**: 设计中

---

## 1. 项目背景

### 1.1 现状

LibreChat 开源仓库已提供完整的 Admin 后端基础设施：

- Admin 身份认证（本地登录 + OpenID OAuth）
- OAuth Code Exchange 跨域认证流程
- 邀请码管理 CRUD API
- 角色权限管理 API
- `requireAdmin` / `checkAdmin` 中间件

但 Admin Panel 的 UI 前端是 LibreChat 的**付费闭源商业产品**（见 TOS Section 1），目前仓库中不存在。

### 1.2 目标

为本项目（Nucleant）构建一个**独立部署**的 Admin Panel 前端应用，复用已有 Admin 接口，实现以下基本管理功能：

- 管理员登录
- 用户管理（查询、角色变更、封禁）
- 邀请码管理
- 角色权限管理
- 用户余额管理
- 系统概览

### 1.3 非目标（本期）

- 不实现对话内容的查看/管理
- 不实现系统配置的在线编辑（yaml config）
- 不实现审计日志 UI
- 不修改 LibreChat 核心代码（只新增必要的后端 API）

---

## 2. 架构设计

### 2.1 整体架构

```
┌─────────────────────────────────────────────────────┐
│                   Browser                           │
│                                                     │
│  ┌──────────────────┐    ┌───────────────────────┐  │
│  │   Main Client    │    │     Admin Panel       │  │
│  │  (port 3090)     │    │     (port 3001)       │  │
│  │  React SPA       │    │     React SPA         │  │
│  └────────┬─────────┘    └──────────┬────────────┘  │
└───────────┼──────────────────────────┼───────────────┘
            │                          │
            ▼                          ▼
┌──────────────────────────────────────────────────────┐
│               LibreChat Backend (port 3080)          │
│                                                      │
│   /api/*           普通用户接口                       │
│   /api/admin/*     Admin 认证接口                     │
│   /api/invite-codes Admin 邀请码接口                  │
│   /api/roles/*     角色权限接口                       │
│   /api/admin/users [新增] 用户管理接口                │
│   /api/admin/balances [新增] 余额管理接口             │
└──────────────────────────────────────────────────────┘
```

### 2.2 Admin Panel 独立部署

Admin Panel 作为**独立 SPA**部署，通过环境变量与 LibreChat 后端交互：

```bash
# Admin Panel 环境变量
VITE_API_BASE_URL=http://localhost:3080   # LibreChat 后端地址
VITE_ADMIN_PANEL_URL=http://localhost:3001  # 本应用自身地址（用于 OAuth 回调）
```

LibreChat 后端需配置：
```bash
ADMIN_PANEL_URL=http://localhost:3001    # Admin Panel 地址（已支持）
```

### 2.3 认证流程

**本地登录：**
```
Admin Panel                    LibreChat Backend
    │                                 │
    │  POST /api/admin/login/local    │
    │  { email, password }            │
    │ ─────────────────────────────► │
    │                                 │ checkAdmin middleware
    │  { token, refreshToken, user }  │ 验证 role === ADMIN
    │ ◄───────────────────────────── │
    │                                 │
    │  保存 token 到 localStorage      │
```

**OpenID OAuth 登录：**
```
Admin Panel                    LibreChat Backend          OpenID Provider
    │                                 │                        │
    │  redirect to                    │                        │
    │  GET /api/admin/oauth/openid    │                        │
    │ ─────────────────────────────► │                        │
    │                                 │  Passport redirect     │
    │                                 │ ──────────────────────►│
    │                                 │  callback              │
    │                                 │ ◄──────────────────────│
    │                                 │ requireAdmin + 生成 code│
    │  redirect to                    │                        │
    │  /auth/callback?code=xxx        │                        │
    │ ◄───────────────────────────── │                        │
    │                                 │                        │
    │  POST /api/admin/oauth/exchange │                        │
    │  { code }                       │                        │
    │ ─────────────────────────────► │                        │
    │  { token, user }                │                        │
    │ ◄───────────────────────────── │                        │
```

---

## 3. 需要新增的后端接口

现有接口已覆盖认证、邀请码、角色权限，但**用户管理和余额管理**缺少 Admin API，需在 `/packages/api/src/` 中新增（TypeScript，符合项目规范）：

### 3.1 用户管理接口

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/admin/users` | 分页查询用户列表（支持搜索、过滤） |
| `GET` | `/api/admin/users/:id` | 查询用户详情 |
| `PATCH` | `/api/admin/users/:id` | 更新用户（role、emailVerified、plugins） |
| `POST` | `/api/admin/users/:id/ban` | 封禁用户（设置 expiresAt 或软标记） |
| `POST` | `/api/admin/users/:id/unban` | 解封用户 |

**GET /api/admin/users 查询参数：**

```typescript
{
  page?: number;         // 默认 1
  limit?: number;        // 默认 20，最大 100
  search?: string;       // 搜索 name/email/username
  role?: 'USER' | 'ADMIN';
  provider?: string;     // 'local' | 'google' | 'openid' 等
  emailVerified?: boolean;
  sortBy?: 'createdAt' | 'name' | 'email';
  sortDir?: 'asc' | 'desc';
}
```

### 3.2 余额管理接口

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/admin/balances` | 分页查询用户余额列表 |
| `GET` | `/api/admin/balances/:userId` | 查询指定用户余额 |
| `PATCH` | `/api/admin/balances/:userId` | 更新用户余额（设置绝对值） |
| `POST` | `/api/admin/balances/:userId/add` | 为用户增加余额 |

### 3.3 系统统计接口

| Method | Path | 说明 |
|--------|------|------|
| `GET` | `/api/admin/stats` | 系统概览统计数据 |

**响应示例：**
```json
{
  "users": {
    "total": 1234,
    "today": 12,
    "thisWeek": 58
  },
  "conversations": {
    "total": 45678,
    "today": 234
  },
  "tokens": {
    "totalConsumed": 9876543,
    "today": 123456
  }
}
```

---

## 4. 前端技术栈

与 LibreChat 主客户端**技术栈**保持一致，降低维护成本；但视觉风格为独立的后台管理设计语言，详见第 5 节：

| 技术 | 版本 | 说明 |
|------|------|------|
| React | 18 | UI 框架 |
| TypeScript | 5.3+ | 类型安全 |
| Vite | 7 | 构建工具 |
| TailwindCSS | 3 | 样式 |
| React Router | v6 | 路由 |
| TanStack Query | v4 | 服务端状态管理 |
| React Hook Form | latest | 表单状态 |
| Radix UI | latest | 无样式 UI 组件 |
| Lucide React | latest | 图标库 |
| Axios | latest | HTTP 客户端 |

**不引入：**
- Recoil / Jotai（Admin Panel 状态简单，React Context 足够）
- 复杂动画库（Framer Motion 对管理后台不必要）

---

## 5. UI 风格规范

### 5.1 设计定位

Admin Panel 与 LibreChat 主客户端是**完全不同的 UI 范式**：

| 维度 | 主客户端（聊天应用） | Admin Panel（管理后台） |
|------|---------------------|------------------------|
| 布局 | 会话列表 + 聊天区 | 固定侧边导航 + 内容区 |
| 主色调 | 深色为主（`#0d0d0d`） | 浅色为默认，深色可选 |
| 信息密度 | 低（对话式，留白多） | 高（表格、数据、表单） |
| 核心组件 | 消息气泡、输入框 | 数据表格、统计卡片、弹窗表单 |
| 交互模式 | 流式输出、实时感 | CRUD 操作、确认/反馈 |

### 5.2 整体布局

```
┌─────────────────────────────────────────────────────────┐
│  Header（顶部栏，固定高度 56px）                          │
│  [Logo / 应用名]                    [管理员头像 + 退出]   │
├──────────────┬──────────────────────────────────────────┤
│              │                                          │
│   Sidebar    │         Main Content Area                │
│  （固定宽度   │                                          │
│   240px）    │   面包屑导航                              │
│              │   ─────────────────────────────          │
│  ● 概览      │                                          │
│  ● 用户管理  │   页面主体内容（表格 / 卡片 / 表单）        │
│  ● 邀请码    │                                          │
│  ● 角色权限  │                                          │
│  ● 余额管理  │                                          │
│              │                                          │
└──────────────┴──────────────────────────────────────────┘
```

- Sidebar 在移动端折叠为抽屉
- Main Content Area 最大宽度 `1280px`，水平居中

### 5.3 色彩系统

**直接复用 LibreChat 的 CSS 自定义属性**（`client/src/style.css`），不重新定义颜色，保持品牌一致性：

```css
/* 在 Admin Panel 中引入相同的 CSS 变量 */
--surface-primary        /* 页面背景：浅色 #fff / 深色 #0d0d0d */
--surface-secondary      /* 卡片/侧边栏背景：浅色 #f7f7f8 / 深色 #212121 */
--surface-tertiary       /* 表头/分隔区背景 */
--text-primary           /* 主文字 */
--text-secondary         /* 次级文字、标签 */
--border-light           /* 表格分割线、卡片边框 */
--border-medium          /* 输入框边框 */
--surface-submit         /* 主操作按钮（绿色系） */
--surface-destructive    /* 危险操作按钮（红色系） */
```

**语义色补充**（Admin Panel 特有，叠加在变量之上）：

| 用途 | 浅色值 | 说明 |
|------|--------|------|
| 成功/激活 badge | `--green-100` 背景 + `--green-700` 文字 | 邀请码激活、邮箱已验证 |
| 警告 badge | `--amber-100` 背景 + `--amber-700` 文字 | 余额较低 |
| 危险/封禁 badge | `--red-100` 背景 + `--red-700` 文字 | 用户已封禁 |
| 中性 badge | `--gray-100` 背景 + `--gray-600` 文字 | USER 角色、未验证 |
| 强调 badge | `--brand-purple` 淡化背景 + `--brand-purple` 文字 | ADMIN 角色 |

### 5.4 默认配色模式

- **默认浅色模式**：Admin 操作场景信息密度高，浅色背景可读性更好
- **支持深色模式**：跟随系统 `prefers-color-scheme`，或提供手动切换按钮
- 深色模式直接复用 LibreChat 的 `.dark` class 变量值，无额外维护成本

```tsx
// 在 <html> 标签上切换 class
document.documentElement.classList.toggle('dark')
```

### 5.5 字体与间距

与主客户端保持一致：

```css
font-family: system-ui, -apple-system, sans-serif;  /* 系统字体栈 */
--font-size-sm: 0.875rem;    /* 表格行、标签 */
--font-size-base: 1rem;      /* 正文 */
--font-size-lg: 1.125rem;    /* 卡片标题 */
--radius: 0.5rem;             /* 统一圆角 */
```

间距遵循 Tailwind 的 `4px` 基准格，主要间距：`p-4`（16px）、`p-6`（24px）、`gap-4`（16px）。

### 5.6 核心组件规范

**数据表格（DataTable）：**
- 表头：`--surface-tertiary` 背景，`--text-secondary` 文字，`text-xs uppercase`
- 行高：`48px`，hover 时 `--surface-hover`
- 边框：仅水平分割线，`--border-light`
- 空状态：居中显示图标 + 说明文字

**统计卡片（StatCard）：**
- 白色/深色卡片背景，`1px` 边框，`rounded-xl`，`p-6`
- 数字用 `text-2xl font-semibold`，标签用 `text-sm text-secondary`
- 趋势标注（↑ 绿 / ↓ 红）

**Badge：**
- 统一 `rounded-full px-2 py-0.5 text-xs font-medium`
- 颜色语义见 5.3 节

**按钮层级：**
- 主操作（保存/创建）：`--surface-submit` 实色填充
- 次操作（编辑/查看）：`--border-medium` 描边，透明背景
- 危险操作（删除/封禁）：`--surface-destructive` 实色，需二次确认弹窗

**弹窗（Dialog）：**
- 背景遮罩：`rgba(0,0,0,0.5)`
- 宽度：`max-w-md`（普通表单）/ `max-w-lg`（复杂表单）
- 底部固定操作栏：取消 + 确认

### 5.7 参考风格

整体视觉参考 [Shadcn/ui Dashboard](https://ui.shadcn.com/examples/dashboard) 的设计语言：干净、专业、高密度但不拥挤。**不使用 Shadcn/ui 库本身**（避免引入额外依赖），仅参考其视觉风格，用 Radix UI + Tailwind 自行实现相同的组件质感。

---

## 6. 页面功能设计

### 6.1 页面结构

```
/                   → 自动重定向
/login              → 登录页
/auth/callback      → OpenID OAuth 回调处理页
/dashboard          → 概览仪表盘 [需登录]
/users              → 用户列表
/users/:id          → 用户详情
/invite-codes       → 邀请码管理
/roles              → 角色权限管理
/balances           → 余额管理
```

### 6.2 登录页 `/login`

- **本地登录表单**：邮箱 + 密码
- **OpenID 登录按钮**（可选，若后端配置了 OpenID）：点击后跳转 `/api/admin/oauth/openid`
- 登录成功后跳转 `/dashboard`
- 登录失败显示错误信息（403 = 非 Admin、401 = 凭证错误）

### 6.3 概览仪表盘 `/dashboard`

**统计卡片（调用 `GET /api/admin/stats`）：**
- 总用户数 / 今日新增用户
- 今日活跃会话数
- 今日 Token 消耗量
- 待审核邀请码数

**快捷入口：**
- 新建邀请码
- 查看最新注册用户
- 查看余额较低用户

### 6.4 用户管理 `/users`

**列表页：**

| 列 | 说明 |
|----|------|
| 头像 + 名称 | 用户基本信息 |
| 邮箱 | 可复制 |
| 角色 | USER / ADMIN，可内联切换 |
| 注册方式 | local / google / openid 等 |
| 邮箱验证 | 已验证 / 未验证 badge |
| 注册时间 | 相对时间（如 "3 天前"） |
| 操作 | 详情 / 封禁 / 余额 |

**功能：**
- 顶部搜索框（搜索 name/email/username）
- 角色过滤下拉
- 注册方式过滤
- 分页（每页 20 条）

**用户详情页 `/users/:id`：**

左侧：基本信息卡片（头像、名称、邮箱、角色、注册时间）
右侧标签页：
- **权限** - 查看当前 role，可修改为 USER / ADMIN
- **余额** - 当前 tokenCredits，可直接修改或增减
- **封禁** - 封禁状态，可设置封禁/解封

### 6.5 邀请码管理 `/invite-codes`

复用已有 `/api/invite-codes` 接口全部功能：

**列表：**

| 列 | 说明 |
|----|------|
| 邀请码 | 可复制按钮 |
| 使用次数 | usedCount / maxUses（0 = 无限） |
| 过期时间 | 日期或 "永不过期" |
| 状态 | 激活 / 已禁用 badge |
| 备注 | 截断显示 |
| 操作 | 编辑 / 禁用 / 删除 |

**新建邀请码弹窗：**
- 自定义码（选填，不填则自动生成）
- 最大使用次数（0 = 不限）
- 过期时间（日期选择器，不选 = 永不过期）
- 备注（最多 500 字）

### 6.6 角色权限管理 `/roles`

调用 `/api/roles/:roleName` 和 `/api/roles/:roleName/{permissionType}` 接口：

**角色列表：** USER、ADMIN（以及其他自定义角色）

**权限配置表格（选择 USER 角色）：**

| 权限类型 | 权限项 | 开关 |
|----------|--------|------|
| Prompts | USE / CREATE / SHARE | Toggle |
| Agents | USE / CREATE / SHARE | Toggle |
| Memories | USE / OPT_OUT | Toggle |
| MCP Servers | USE / CREATE | Toggle |
| Marketplace | USE | Toggle |
| Remote Agents | USE | Toggle |

修改后实时保存，失败则回滚并提示。

### 6.7 余额管理 `/balances`

**列表（调用 `GET /api/admin/balances`）：**

| 列 | 说明 |
|----|------|
| 用户 | 头像 + 邮箱 |
| 当前余额 | tokenCredits（格式化显示） |
| 自动补充 | 是 / 否 |
| 最后补充时间 | 相对时间 |
| 操作 | 修改余额 |

**修改余额弹窗：**
- 设置绝对值 OR 增减模式（`+500`、`-200`）
- 确认后调用 `PATCH /api/admin/balances/:userId` 或 `POST .../add`

---

## 7. 项目结构

```
admin-panel/
├── public/
├── src/
│   ├── api/                    # API 调用层
│   │   ├── client.ts           # Axios 实例（带 JWT 拦截器）
│   │   ├── auth.ts             # 认证相关 API
│   │   ├── users.ts            # 用户管理 API
│   │   ├── inviteCodes.ts      # 邀请码 API
│   │   ├── roles.ts            # 角色权限 API
│   │   ├── balances.ts         # 余额 API
│   │   └── stats.ts            # 统计 API
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Sidebar.tsx     # 左侧导航
│   │   │   ├── Header.tsx      # 顶部栏（用户信息、退出）
│   │   │   └── Layout.tsx      # 整体布局容器
│   │   └── ui/                 # 通用 UI 组件
│   │       ├── Badge.tsx
│   │       ├── Button.tsx
│   │       ├── DataTable.tsx   # 通用表格组件
│   │       ├── Dialog.tsx      # 弹窗
│   │       ├── Input.tsx
│   │       ├── Select.tsx
│   │       └── StatCard.tsx    # 统计卡片
│   ├── contexts/
│   │   └── AuthContext.tsx     # 认证状态（token、user、logout）
│   ├── hooks/
│   │   ├── useAuth.ts
│   │   ├── useUsers.ts
│   │   ├── useInviteCodes.ts
│   │   ├── useRoles.ts
│   │   └── useBalances.ts
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── AuthCallback.tsx    # OpenID 回调处理
│   │   ├── Dashboard.tsx
│   │   ├── Users/
│   │   │   ├── UserList.tsx
│   │   │   └── UserDetail.tsx
│   │   ├── InviteCodes.tsx
│   │   ├── Roles.tsx
│   │   └── Balances.tsx
│   ├── types/
│   │   └── index.ts            # 共享类型定义
│   ├── App.tsx
│   ├── main.tsx
│   └── router.tsx
├── index.html
├── tailwind.config.ts
├── tsconfig.json
├── vite.config.ts
└── package.json
```

---

## 8. 认证状态管理

```typescript
// src/contexts/AuthContext.tsx
interface AuthState {
  token: string | null;
  user: AdminUser | null;
  isAuthenticated: boolean;
}

interface AdminUser {
  _id: string;
  email: string;
  name: string;
  username: string;
  role: 'ADMIN';
  avatar?: string;
}
```

**Token 持久化：** `localStorage` 存储 JWT token
**Token 注入：** Axios 拦截器统一添加 `Authorization: Bearer <token>`
**Token 过期：** 收到 401 响应时清除本地 token 并跳转 `/login`

---

## 9. 后端实现要求

### 9.1 新增接口规范

所有新增接口遵循 LibreChat 现有规范：

- 代码位置：`packages/api/src/routes/admin/` (TypeScript)
- 路由挂载：`api/server/routes/admin/index.js` (thin wrapper)
- 中间件：`requireJwtAuth` + `requireAdmin`（来自 `packages/api/src/middleware/admin.ts`）
- 错误格式：`{ error: string, error_code: string }`

### 9.2 封禁实现方案

LibreChat 现有 `checkBan` 中间件，但 User model 无 `isBanned` 字段。

建议方案：利用已有的 `expiresAt` 字段实现封禁：
- 封禁：设置 `expiresAt` 为一个极远的未来时间（如 `9999-12-31`）
- 解封：清除 `expiresAt`（设为 `null`）
- `checkBan` 中间件已检查 `expiresAt`，无需修改核心逻辑

### 9.3 用户列表查询

基于 User model 的 `UserFilterOptions` 类型，已支持以下过滤：
`_id`, `search`, `role`, `emailVerified`, `provider`, `twoFactorEnabled`, 日期范围

---

## 10. 部署方式

### 10.1 开发环境

```bash
# 启动 LibreChat 后端
cd /path/to/LibreChat && npm run backend

# 启动 Admin Panel
cd /path/to/admin-panel && npm run dev
# 默认监听 http://localhost:3001
```

### 10.2 生产环境

Admin Panel 构建为静态文件，通过 Nginx 与 LibreChat 后端一起部署：

```nginx
# Admin Panel
server {
  listen 80;
  server_name admin.example.com;
  root /var/www/admin-panel/dist;
  try_files $uri $uri/ /index.html;
}
```

### 10.3 环境变量

**Admin Panel (`admin-panel/.env`)：**
```bash
VITE_API_BASE_URL=https://api.example.com
VITE_OPENID_ENABLED=true   # 是否显示 OpenID 登录按钮
```

**LibreChat Backend (`.env`)：**
```bash
ADMIN_PANEL_URL=https://admin.example.com
```

---

## 11. 实施阶段

### Phase 1：基础框架 + 认证（Day 1-2）

- [ ] 初始化 Vite + React + TypeScript + Tailwind 项目
- [ ] 实现 Layout（Sidebar + Header）
- [ ] 实现登录页（本地登录）
- [ ] 实现 OpenID 回调页（调用 `/api/admin/oauth/exchange`）
- [ ] 实现 AuthContext + Axios 拦截器
- [ ] 实现路由守卫（未登录跳转 `/login`）

### Phase 2：用户管理（Day 3-4）

- [ ] 后端：新增 `GET /api/admin/users`
- [ ] 后端：新增 `GET /api/admin/users/:id`
- [ ] 后端：新增 `PATCH /api/admin/users/:id`（角色变更）
- [ ] 后端：新增 `POST /api/admin/users/:id/ban` + `unban`
- [ ] 前端：用户列表页（搜索、过滤、分页）
- [ ] 前端：用户详情页

### Phase 3：邀请码 + 角色权限（Day 5）

- [ ] 前端：邀请码列表 + 新建/编辑/删除弹窗
- [ ] 前端：角色权限配置表格

### Phase 4：余额管理 + 仪表盘（Day 6-7）

- [ ] 后端：新增余额管理接口（查询 + 修改）
- [ ] 后端：新增统计接口 `GET /api/admin/stats`
- [ ] 前端：余额管理列表页
- [ ] 前端：仪表盘统计卡片

---

## 12. 变更文件清单

### 12.1 新建（Admin Panel，独立项目）

```
admin-panel/               全新独立项目
```

### 12.2 新增（LibreChat 后端，仅 packages/api/src/）

| 文件 | 说明 |
|------|------|
| `packages/api/src/routes/admin/users.ts` | 用户管理路由 |
| `packages/api/src/routes/admin/balances.ts` | 余额管理路由 |
| `packages/api/src/routes/admin/stats.ts` | 统计路由 |

### 12.3 修改（LibreChat 后端，最小改动）

| 文件 | 改动内容 |
|------|---------|
| `api/server/routes/admin/index.js` | 挂载新增的三个路由（thin wrapper） |
