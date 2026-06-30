const BaseTool = require('../base/BaseTool');
const axios = require('axios');

/**
 * WebSearchTool - 联网搜索工具
 * 当知识库内容不足时，通过搜索引擎补充最新信息
 *
 * ⚠️ 重要约束：
 * 1. 不能直接作为最终答案，只能作为补充材料
 * 2. 不能替代 RAG，仅在 RAG 不足时触发
 * 3. 必须与 RAG 结果合并后由 LLM 生成最终回答
 */
class WebSearchTool extends BaseTool {
  constructor() {
    super();
    this.name = 'web_search';
    this.description = `联网搜索最新信息，用于补充知识库不足的内容。

**何时调用：**
- 知识库检索结果不充分（如：检索到的知识过时、内容过少）
- 需要最新资讯（如：2024年新政策、最新研究）
- 知识库未覆盖的小众话题

**何时不调用：**
- 知识库已有完整答案
- 用户问题与时效性无关
- 闲聊和打招呼

**调用示例：**
- "2024年最新狗狗疫苗政策" → 调用（需要最新信息）
- "某小众品种的特点" → 调用（知识库可能未覆盖）
- "金毛能吃鸡蛋吗" → 不调用（知识库有完整答案）`;

    this.parameters = {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '搜索查询关键词'
        },
        num_results: {
          type: 'number',
          description: '返回结果数量，默认 3',
          default: 3
        }
      },
      required: ['query']
    };

    // 配置搜索引擎
    this.searchEngine = process.env.SEARCH_ENGINE || 'mock';
    this.apiKey = process.env.SERPAPI_API_KEY || '';
  }

  /**
   * 执行联网搜索
   */
  async execute(input, context) {
    const { query, num_results = 3 } = input;

    if (!query || query.trim().length === 0) {
      return {
        success: false,
        error: '搜索关键词不能为空'
      };
    }

    try {
      console.log(`[WebSearchTool] 🔍 Searching web for: "${query}"`);

      // 记录搜索触发
      this.logSearchTrigger(query, context);

      // 根据配置选择搜索引擎
      let results;
      switch (this.searchEngine) {
        case 'serpapi':
          results = await this.searchWithSerpAPI(query, num_results);
          break;
        case 'duckduckgo':
          results = await this.searchWithDuckDuckGo(query, num_results);
          break;
        default:
          results = await this.searchWithMockEngine(query, num_results);
      }

      if (results.length === 0) {
        return {
          success: true,
          message: '未找到相关搜索结果',
          results: [],
          source: 'web_search'
        };
      }

      console.log(`[WebSearchTool] ✅ Found ${results.length} web results`);

      return {
        success: true,
        results: results,
        count: results.length,
        source: 'web_search',
        query: query,
        engine: this.searchEngine
      };
    } catch (error) {
      console.error('[WebSearchTool] ❌ Error:', error.message);
      return {
        success: false,
        error: error.message,
        source: 'web_search'
      };
    }
  }

  /**
   * 使用 SerpAPI 搜索
   */
  async searchWithSerpAPI(query, num) {
    if (!this.apiKey) {
      throw new Error('SERPAPI_API_KEY not configured');
    }

    const url = 'https://serpapi.com/search';
    const params = {
      q: query,
      api_key: this.apiKey,
      engine: 'google',
      num: num,
      hl: 'zh-cn'
    };

    const response = await axios.get(url, { params, timeout: 10000 });
    const organicResults = response.data.organic_results || [];

    return organicResults.map(result => ({
      title: result.title,
      snippet: result.snippet,
      url: result.link,
      source: result.source || 'Google',
      date: result.date || null
    }));
  }

  /**
   * 使用 DuckDuckGo 搜索
   */
  async searchWithDuckDuckGo(query, num) {
    const url = 'https://html.duckduckgo.com/html/';
    const params = new URLSearchParams({
      q: query,
      kl: 'cn-zh'
    });

    try {
      const response = await axios.post(url, params, {
        timeout: 10000,
        headers: { 'User-Agent': 'Mozilla/5.0' }
      });

      const results = this.parseDuckDuckGoHTML(response.data, num);
      return results;
    } catch (error) {
      console.error('[WebSearchTool] DuckDuckGo search failed:', error.message);
      return [];
    }
  }

  /**
   * 解析 DuckDuckGo HTML 结果
   */
  parseDuckDuckGoHTML(html, num) {
    const results = [];
    const titleRegex = /<a[^>]*class="result__a"[^>]*>([^<]+)<\/a>/g;
    const snippetRegex = /<a[^>]*class="result__snippet"[^>]*>([^<]+)<\/a>/g;

    let titleMatch;
    let snippetMatch;
    let count = 0;

    while ((titleMatch = titleRegex.exec(html)) && count < num) {
      snippetMatch = snippetRegex.exec(html);
      results.push({
        title: titleMatch[1].trim(),
        snippet: snippetMatch ? snippetMatch[1].trim() : '',
        url: '',
        source: 'DuckDuckGo',
        date: null
      });
      count++;
    }

    return results;
  }

  /**
   * Mock 搜索引擎
   */
  async searchWithMockEngine(query, num) {
    console.log('[WebSearchTool] ⚠️  Using mock search engine');

    await new Promise(resolve => setTimeout(resolve, 500));

    return [
      {
        title: `${query} - 最新资讯`,
        snippet: `关于 ${query} 的最新信息...（模拟搜索结果）`,
        url: 'https://example.com/1',
        source: 'Mock Engine',
        date: new Date().toISOString()
      },
      {
        title: `${query} - 专业解答`,
        snippet: `专家对 ${query} 的详细解答...（模拟搜索结果）`,
        url: 'https://example.com/2',
        source: 'Mock Engine',
        date: new Date().toISOString()
      }
    ].slice(0, num);
  }

  /**
   * 记录搜索触发
   */
  logSearchTrigger(query, context) {
    const logEntry = {
      timestamp: new Date().toISOString(),
      query: query,
      userId: context.userId,
      conversationId: context.conversationId,
      engine: this.searchEngine
    };

    console.log('[WebSearchTool] 📊 Search triggered:', JSON.stringify(logEntry));
  }
}

module.exports = WebSearchTool;
