# 犬知道 DogWise

一个面向养犬爱好者的知识分享与社交平台，涵盖内容发现、知识库、AI 智能问答、关注动态等功能。

## 技术栈

### 前端

- React 19 + TypeScript
- Vite 8（构建工具）
- TailwindCSS 4（样式）
- Redux Toolkit（状态管理）
- React Router 7（路由）
- react-virtuoso（虚拟滚动）
- Three.js / GSAP / Motion / Matter.js（首页交互动效）
- react-markdown + rehype-highlight（Markdown 渲染）
- Axios（HTTP 请求）

### 后端

- Node.js + Express 5
- MongoDB + Mongoose 9（数据库）
- Redis / ioredis（缓存）
- JWT + bcryptjs（认证与加密）
- Multer + Sharp（图片上传与压缩）
- DeepSeek API（AI 问答）

## 项目结构

```
DogWise/
├── InspireHub/          # 前端 React SPA
│   ├── src/
│   │   ├── components/  # 通用组件
│   │   ├── features/    # 功能模块（article、user）
│   │   ├── hooks/       # 自定义 Hooks
│   │   ├── layout/      # 布局组件
│   │   ├── pages/       # 页面组件
│   │   ├── router/      # 路由配置
│   │   ├── services/    # API 服务
│   │   ├── store/       # Redux Store
│   │   └── utils/       # 工具函数
│   └── package.json
├── server/              # 后端 Express API
│   ├── src/
│   │   ├── config/      # 数据库配置
│   │   ├── controllers/ # 控制器层
│   │   ├── middlewares/ # 中间件（鉴权、上传、错误处理）
│   │   ├── models/      # Mongoose 数据模型
│   │   ├── routes/      # 路由定义
│   │   ├── services/    # 业务逻辑层
│   │   └── utils/       # 工具函数
│   ├── uploads/         # 用户上传图片存储
│   └── package.json
└── shared/              # 前后端共享 TypeScript 类型
    └── types/
```

## 功能模块

| 模块 | 说明 |
|------|------|
| 首页 | 品牌落地页，Three.js 3D 画廊、GSAP 滚动动画、Matter.js 物理球坑 |
| 发现 | 动态流浏览，点赞/收藏/评论，热门/最新排序，虚拟滚动无限加载 |
| 知识库 | 按分类浏览专业养犬知识文章，无限滚动分页 |
| AI 问答 | 集成 DeepSeek 大模型，实时流式问答 |
| 搜索 | 模糊搜索文章/知识/用户，关键词高亮，搜索历史记录 |
| 社交 | 关注/粉丝体系，关注动态流，个人主页 |
| 通知 | 实时通知（点赞、评论、关注） |
| 发布 | Markdown 编辑器，多图上传，封面图 |

## 性能优化

- **代码分割**：13 个页面路由级 React.lazy 懒加载 + 骨架屏过渡
- **虚拟滚动**：react-virtuoso 仅渲染可视区 DOM，滚动帧率 60fps
- **请求优化**：400ms 输入防抖 + requestCache 请求去重 + Redis 服务端缓存
- **图片优化**：Intersection Observer 懒加载 + Sharp 压缩转 WebP
- **预加载**：导航悬停时 prefetch 对应页面 chunk

## 快速开始

### 环境要求

- Node.js >= 18
- MongoDB（本地或 Atlas）
- Redis（本地或云服务）

### 1. 克隆项目

```bash
git clone https://github.com/your-username/DogWise.git
cd DogWise
```

### 2. 启动后端

```bash
cd server
npm install
```

创建 `.env` 文件：

```env
PORT=3001
MONGO_URI=mongodb://localhost:27017/dogwise
JWT_SECRET=your_jwt_secret_here
DEEPSEEK_API_KEY=your_deepseek_api_key
DEEPSEEK_BASE_URL=https://api.deepseek.com
```

启动：

```bash
npm run dev
```

### 3. 启动前端

```bash
cd InspireHub
npm install
npm run dev
```

访问 http://localhost:

## API 路由

| 路径 | 说明 |
|------|------|
| `/api/auth` | 注册、登录 |
| `/api/articles` | 文章 CRUD、点赞、收藏 |
| `/api/comments` | 评论 |
| `/api/users` | 用户资料、关注、搜索 |
| `/api/knowledge` | 知识文章 |
| `/api/ai` | AI 问答 |
| `/api/upload` | 图片上传 |
| `/api/notifications` | 通知 |
| `/api/messages` | 消息 |

## License

MIT
