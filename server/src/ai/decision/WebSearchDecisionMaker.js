const { ChatOpenAI } = require('@langchain/openai');

/**
 * WebSearchDecisionMaker - 混合决策器（规则 + LLM）
 * 判断是否需要触发联网搜索
 */
class WebSearchDecisionMaker {
  constructor(apiKey, baseURL) {
    // 初始化轻量级 LLM（用于决策）
    this.llm = new ChatOpenAI({
      apiKey: apiKey,
      configuration: {
        baseURL: baseURL || 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      },
      modelName: 'qwen-turbo', // 使用快速模型做决策
      temperature: 0.1, // 低温度，更确定性
    });
  }

  /**
   * 主决策入口：三层决策
   * @param {string} userQuery - 用户问题
   * @param {Object} ragResult - RAG 检索结果
   * @returns {Promise<Object>} - { needsWebSearch: boolean, reason: string, decisionLayer: string }
   */
  async decide(userQuery, ragResult) {
    console.log('[WebSearchDecisionMaker] Starting three-layer decision process');

    // 第一层：硬规则（必须）
    const ruleDecision = this.applyHardRules(userQuery, ragResult);

    if (ruleDecision.decision !== 'uncertain') {
      console.log(`[WebSearchDecisionMaker] ✅ Layer 1 (Hard Rules): ${ruleDecision.decision} - ${ruleDecision.reason}`);
      return {
        needsWebSearch: ruleDecision.decision === 'search',
        reason: ruleDecision.reason,
        decisionLayer: 'rule',
        confidence: 1.0
      };
    }

    // 第二层：LLM 判断（规则不确定时）
    console.log('[WebSearchDecisionMaker] ⚡ Layer 1 uncertain, escalating to Layer 2 (LLM)');
    const llmDecision = await this.askLLM(userQuery, ragResult);

    console.log(`[WebSearchDecisionMaker] ✅ Layer 2 (LLM): ${llmDecision.decision} - ${llmDecision.reason}`);

    // 第三层：最终决策（规则 || LLM）
    const finalDecision = ruleDecision.decision === 'search' || llmDecision.decision === 'yes';

    return {
      needsWebSearch: finalDecision,
      reason: llmDecision.reason,
      decisionLayer: 'llm',
      confidence: llmDecision.confidence
    };
  }

  /**
   * 第一层：硬规则判断
   * @returns {Object} - { decision: 'search' | 'no_search' | 'uncertain', reason: string }
   */
  applyHardRules(userQuery, ragResult) {
    // 规则 1: RAG 完全失败 → 必须搜索
    if (!ragResult || !ragResult.success) {
      return {
        decision: 'search',
        reason: '[Rule] RAG failed, web search required'
      };
    }

    // 规则 2: 没有检索到任何文档 → 必须搜索
    if (!ragResult.knowledge || ragResult.knowledge.length === 0) {
      return {
        decision: 'search',
        reason: '[Rule] No knowledge retrieved, web search required'
      };
    }

    // 计算 RAG 指标
    const avgScore = ragResult.knowledge.reduce((sum, k) => sum + (k.score || 0), 0) / ragResult.knowledge.length;
    const totalLength = ragResult.knowledge.reduce((sum, k) => sum + k.content.length, 0);

    // 规则 3: 明确的时效性需求 → 必须搜索（优先级最高，因为即使 RAG 充分也可能过时）
    const timeKeywords = ['2024', '2025', '2026', '最新', '新政策', '近期', '今年', '最近'];
    const hasTimeKeyword = timeKeywords.some(keyword => userQuery.includes(keyword));

    if (hasTimeKeyword) {
      return {
        decision: 'search',
        reason: '[Rule] Query requires latest information (time-sensitive)'
      };
    }

    // 规则 4: RAG 分数很高（> 0.8）且内容充足（> 300字）→ 不需要搜索
    if (avgScore > 0.8 && totalLength > 300) {
      return {
        decision: 'no_search',
        reason: `[Rule] RAG sufficient (score: ${avgScore.toFixed(2)}, length: ${totalLength})`
      };
    }

    // 规则 5: RAG 分数极低（< 0.3）→ 必须搜索
    if (avgScore < 0.3) {
      return {
        decision: 'search',
        reason: `[Rule] RAG score too low (${avgScore.toFixed(2)}), web search required`
      };
    }

    // 规则 6: 其他情况 → 不确定，交给 LLM
    return {
      decision: 'uncertain',
      reason: `[Rule] Uncertain (score: ${avgScore.toFixed(2)}, items: ${ragResult.knowledge.length})`
    };
  }

  /**
   * 第二层：LLM 判断
   */
  async askLLM(userQuery, ragResult) {
    try {
      // 构建 RAG 摘要
      const ragSummary = this.buildRAGSummary(ragResult);

      // 构建提示词
      const prompt = `你是一个智能决策助手，负责判断是否需要联网搜索来补充知识库的不足。

**用户问题：**
${userQuery}

**知识库检索结果摘要：**
${ragSummary}

**判断标准：**
1. 如果知识库内容已经完整、准确地回答了用户问题 → 不需要搜索
2. 如果知识库内容不完整、过于简略、或可能过时 → 需要搜索
3. 如果用户问题涉及最新资讯、政策变化、时事新闻 → 需要搜索
4. 如果知识库内容与问题相关性较低 → 需要搜索

**请严格按照以下 JSON 格式回答（不要添加任何额外文字）：**
{
  "decision": "yes" 或 "no",
  "reason": "一句话说明理由",
  "confidence": 0.0-1.0 之间的数字
}`;

      const response = await this.llm.invoke(prompt);
      const content = response.content.trim();

      // 解析 JSON 响应
      let parsed;
      try {
        // 尝试提取 JSON（如果 LLM 包裹了额外文字）
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          parsed = JSON.parse(jsonMatch[0]);
        } else {
          parsed = JSON.parse(content);
        }
      } catch (error) {
        console.error('[WebSearchDecisionMaker] Failed to parse LLM response:', content);
        // 回退：保守策略，触发搜索
        return {
          decision: 'yes',
          reason: 'LLM response parsing failed, fallback to search',
          confidence: 0.5
        };
      }

      return {
        decision: parsed.decision,
        reason: parsed.reason || 'LLM decision',
        confidence: parsed.confidence || 0.7
      };

    } catch (error) {
      console.error('[WebSearchDecisionMaker] LLM decision error:', error);
      // 回退：保守策略
      return {
        decision: 'yes',
        reason: 'LLM decision failed, fallback to search',
        confidence: 0.5
      };
    }
  }

  /**
   * 构建 RAG 摘要（供 LLM 判断）
   */
  buildRAGSummary(ragResult) {
    if (!ragResult.knowledge || ragResult.knowledge.length === 0) {
      return '（无检索结果）';
    }

    const avgScore = ragResult.knowledge.reduce((sum, k) => sum + (k.score || 0), 0) / ragResult.knowledge.length;
    const totalLength = ragResult.knowledge.reduce((sum, k) => sum + k.content.length, 0);

    let summary = `检索到 ${ragResult.knowledge.length} 条知识，平均相关性：${avgScore.toFixed(2)}，总字数：${totalLength}\n\n`;

    summary += '知识摘要：\n';
    ragResult.knowledge.forEach((k, idx) => {
      const preview = k.content.slice(0, 100) + (k.content.length > 100 ? '...' : '');
      summary += `${idx + 1}. ${k.title} (分数: ${(k.score || 0).toFixed(2)})\n   ${preview}\n`;
    });

    return summary;
  }
}

module.exports = WebSearchDecisionMaker;
