/**
 * BaseTool - 所有 Tool 的抽象基类
 * 提供统一的接口和错误处理
 */
class BaseTool {
  constructor() {
    this.name = '';
    this.description = '';
    this.parameters = {};
  }

  /**
   * 获取 Tool 的 schema（供 LangChain 使用）
   */
  getSchema() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: this.parameters,
      },
    };
  }

  /**
   * 执行 Tool 的核心逻辑（子类必须实现）
   * @param {Object} input - Tool 的输入参数
   * @param {Object} context - 上下文信息（userId, token 等）
   * @returns {Promise<Object>} - Tool 的执行结果
   */
  async execute(input, context) {
    throw new Error('execute() must be implemented by subclass');
  }

  /**
   * 参数验证（可选覆盖）
   */
  validate(input) {
    const required = this.parameters.required || [];
    for (const field of required) {
      if (!input[field]) {
        throw new Error(`Missing required parameter: ${field}`);
      }
    }
    return true;
  }

  /**
   * 错误处理包装
   */
  async run(input, context) {
    try {
      this.validate(input);
      const result = await this.execute(input, context);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      console.error(`[Tool Error] ${this.name}:`, error.message);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

module.exports = BaseTool;
