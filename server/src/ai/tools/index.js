const KnowledgeSearchTool = require('./knowledge/KnowledgeSearchTool');
const SemanticMemorySearchTool = require('./memory/SemanticMemorySearchTool');
const DogRecipeRecommendTool = require('./recipe/DogRecipeRecommendTool');
const WebSearchTool = require('./search/WebSearchTool');

/**
 * ToolRegistry - Tool 注册中心
 * 统一管理所有 Tools
 */
class ToolRegistry {
  constructor() {
    this.tools = new Map();
    this.registerDefaultTools();
  }

  /**
   * 注册默认 Tools
   */
  registerDefaultTools() {
    this.register(new KnowledgeSearchTool());
    this.register(new SemanticMemorySearchTool());
    this.register(new DogRecipeRecommendTool());
    this.register(new WebSearchTool());
    // 后续可以继续添加其他 tools
  }

  /**
   * 注册单个 Tool
   */
  register(tool) {
    this.tools.set(tool.name, tool);
    console.log(`[ToolRegistry] Registered tool: ${tool.name}`);
  }

  /**
   * 获取单个 Tool
   */
  getTool(name) {
    return this.tools.get(name);
  }

  /**
   * 获取所有 Tools
   */
  getAllTools() {
    return Array.from(this.tools.values());
  }

  /**
   * 获取所有 Tool Schemas（供 LangChain 使用）
   */
  getAllSchemas() {
    return this.getAllTools().map(tool => tool.getSchema());
  }

  /**
   * 执行 Tool
   */
  async executeTool(name, input, context) {
    const tool = this.getTool(name);
    if (!tool) {
      throw new Error(`Tool not found: ${name}`);
    }
    return await tool.run(input, context);
  }
}

// 导出单例
module.exports = new ToolRegistry();
