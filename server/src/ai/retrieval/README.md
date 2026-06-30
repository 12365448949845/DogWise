# 混合检索系统

## 概述

本目录实现了 DogWise 长期记忆系统的混合检索功能，结合了三种检索技术：

1. **Dense Retrieval（稠密检索）**：基于向量语义相似度
2. **BM25（稀疏检索）**：基于关键词匹配
3. **Cross-Encoder Reranker（重排）**：精准相关性判断

## 架构

```
检索流程：
用户查询 → Dense Retrieval (top 20) ┐
         → BM25 Retrieval (top 20)   ├→ Fusion (RRF) → Reranker → 最终 top 5
```

## 文件说明

### BM25Retriever.js
- 实现 BM25 算法（k1=1.5, b=0.75）
- 使用 jieba 进行中文分词
- 计算词频（TF）和逆文档频率（IDF）
- 按用户 ID 过滤结果

### RerankService.js
- **简单模式**：原始分数（70%）+ 关键词覆盖率（30%）
- **LLM 模式**：使用 Qwen-plus 为每个候选文档打分（0-10）
- 默认使用简单模式（成本低、速度快）

### HybridRetriever.js
- 协调三种检索方式
- 使用 Reciprocal Rank Fusion (RRF) 融合结果
- RRF 公式：`score = 1 / (60 + rank + 1)`
- 权重配置：Dense 60%, BM25 40%

## 使用方式

### 在 VectorMemoryManager 中使用

```javascript
const vectorMemory = new VectorMemoryManager();

// 混合检索（推荐）
const results = await vectorMemory.hybridSearchMemories(
  '用户的遛狗习惯',  // 查询
  userId,            // 用户 ID
  5,                 // 最终返回 5 条
  20                 // 候选集 20 条
);

// 基础向量检索（向后兼容）
const results = await vectorMemory.searchMemories('查询', userId, 5);
```

### 在 SemanticMemorySearchTool 中使用

```javascript
// Agent 调用时自动使用混合检索
{
  query: "我之前喜欢什么训练方法？",
  limit: 3,
  useHybrid: true  // 默认开启
}
```

## 配置参数

### HybridRetriever

- `denseWeight`: Dense 检索权重（默认 0.6）
- `bm25Weight`: BM25 检索权重（默认 0.4）
- `candidateSize`: 候选集大小（默认 20）
- `topK`: 最终返回结果数（默认 5）

### BM25Retriever

- `k1`: BM25 饱和参数（默认 1.5）
- `b`: 文档长度归一化参数（默认 0.75）

### RerankService

- `useSimpleRerank`: 是否使用简单重排（默认 true）
- 可通过 `setRerankMode(false)` 切换到 LLM 模式

## 性能优化

1. **BM25 索引懒加载**：首次检索时从 Qdrant 拉取用户文档建立索引
2. **批量 Embedding**：减少 API 调用次数
3. **降级策略**：混合检索失败时自动降级到基础向量检索
4. **索引缓存**：BM25 索引在内存中缓存，避免重复计算

## 检索效果对比

| 检索方式 | 适用场景 | 优点 | 缺点 |
|---------|---------|------|------|
| Dense Only | 语义理解 | 理解同义词、上下文 | 关键词不精准 |
| BM25 Only | 关键词匹配 | 精确匹配、速度快 | 不理解语义 |
| Hybrid | 综合查询 | 结合两者优势 | 复杂度高 |

## 示例

### 查询："我家狗对什么过敏？"

**Dense Retrieval（语义相似）**：
- "旺财不能吃鸡肉"（高分）
- "它对海鲜过敏"（高分）
- "它吃了牛肉会拉肚子"（中分）

**BM25（关键词匹配）**：
- "它对海鲜过敏"（包含"过敏"关键词）
- "旺财不能吃鸡肉"（包含"不能吃"）

**Reranker（精准排序）**：
1. "它对海鲜过敏"（同时语义相关 + 关键词匹配）
2. "旺财不能吃鸡肉"（语义强相关）
3. "它吃了牛肉会拉肚子"（间接相关）

## 未来优化

- [ ] 支持 Cross-Encoder 模型（更精准的重排）
- [ ] 动态调整 Dense/BM25 权重
- [ ] 增加时间衰减因子（优先最近记忆）
- [ ] 支持多模态检索（图片、语音）
- [ ] A/B 测试不同融合策略
