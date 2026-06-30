const BaseTool = require('../base/BaseTool');

/**
 * DogRecipeRecommendTool - 狗狗菜品推荐工具
 * 根据识别的食材推荐适合狗狗的营养菜品配方
 */
class DogRecipeRecommendTool extends BaseTool {
  constructor() {
    super();
    this.name = 'dog_recipe_recommend';
    this.description = '根据用户提供的食材，推荐适合狗狗的营养菜品配方。包括食谱、制作步骤、营养分析和注意事项。';
  }

  /**
   * 定义工具的参数 schema
   */
  getSchema() {
    return {
      type: 'function',
      function: {
        name: this.name,
        description: this.description,
        parameters: {
          type: 'object',
          properties: {
            ingredients: {
              type: 'array',
              description: '用户提供的食材列表（从图片或文本中识别）',
              items: {
                type: 'string'
              }
            },
            dogInfo: {
              type: 'object',
              description: '狗狗的基本信息（可选）',
              properties: {
                breed: { type: 'string', description: '品种' },
                age: { type: 'string', description: '年龄（幼犬/成犬/老年犬）' },
                weight: { type: 'string', description: '体重范围' },
                allergies: {
                  type: 'array',
                  description: '已知过敏食材',
                  items: { type: 'string' }
                }
              }
            }
          },
          required: ['ingredients']
        }
      }
    };
  }

  /**
   * 执行菜品推荐
   */
  async execute(input, context) {
    try {
      const { ingredients, dogInfo = {} } = input;

      console.log('[DogRecipeRecommendTool] Recommending recipes for ingredients:', ingredients);
      console.log('[DogRecipeRecommendTool] Dog info:', dogInfo);

      // 1. 食材安全性检查
      const safetyCheck = this.checkIngredientSafety(ingredients);

      if (safetyCheck.dangerousItems.length > 0) {
        return {
          success: false,
          error: 'dangerous_ingredients',
          dangerousItems: safetyCheck.dangerousItems,
          message: `⚠️ 检测到对狗狗有害的食材：${safetyCheck.dangerousItems.join('、')}。这些食材不能给狗狗食用！`
        };
      }

      // 2. 过滤掉过敏食材
      const safeIngredients = this.filterAllergies(
        safetyCheck.safeItems,
        dogInfo.allergies || []
      );

      if (safeIngredients.length === 0) {
        return {
          success: false,
          error: 'no_safe_ingredients',
          message: '没有找到适合狗狗的安全食材。'
        };
      }

      // 3. 生成菜品推荐
      const recipes = this.generateRecipes(safeIngredients, dogInfo);

      return {
        success: true,
        recipes: recipes,
        warnings: safetyCheck.warnings,
        totalRecipes: recipes.length
      };

    } catch (error) {
      console.error('[DogRecipeRecommendTool] Error:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * 检查食材安全性
   */
  checkIngredientSafety(ingredients) {
    // 对狗狗有害的食材
    const dangerousFoods = [
      '巧克力', '可可', '咖啡', '茶', '咖啡因',
      '葡萄', '葡萄干', '提子',
      '洋葱', '大葱', '韭菜', '蒜', '大蒜',
      '木糖醇', '甜味剂',
      '酒精', '啤酒', '白酒',
      '牛油果', '鳄梨',
      '生面团', '酵母',
      '坚果', '核桃', '夏威夷果',
      '肉豆蔻', '肉桂', '辣椒',
      '盐', '过咸'
    ];

    // 需要适量的食材
    const moderateFoods = [
      '鸡蛋', '牛奶', '奶酪', '芝士',
      '肝脏', '动物内脏'
    ];

    const dangerousItems = [];
    const safeItems = [];
    const warnings = [];

    ingredients.forEach(ingredient => {
      const isDangerous = dangerousFoods.some(danger =>
        ingredient.includes(danger) || danger.includes(ingredient)
      );

      const needsModeration = moderateFoods.some(moderate =>
        ingredient.includes(moderate) || moderate.includes(ingredient)
      );

      if (isDangerous) {
        dangerousItems.push(ingredient);
      } else if (needsModeration) {
        safeItems.push(ingredient);
        warnings.push(`${ingredient}需要适量，不宜过多`);
      } else {
        safeItems.push(ingredient);
      }
    });

    return {
      dangerousItems,
      safeItems,
      warnings
    };
  }

  /**
   * 过滤过敏食材
   */
  filterAllergies(ingredients, allergies) {
    if (!allergies || allergies.length === 0) {
      return ingredients;
    }

    return ingredients.filter(ingredient => {
      return !allergies.some(allergy =>
        ingredient.includes(allergy) || allergy.includes(ingredient)
      );
    });
  }

  /**
   * 生成菜品推荐
   */
  generateRecipes(ingredients, dogInfo) {
    const recipes = [];

    // 根据食材智能组合
    const hasProtein = ingredients.some(i =>
      ['鸡肉', '牛肉', '猪肉', '鱼肉', '鸡胸肉', '牛肉', '三文鱼'].some(p => i.includes(p))
    );

    const hasCarbs = ingredients.some(i =>
      ['米饭', '红薯', '南瓜', '土豆', '燕麦', '玉米'].some(c => i.includes(c))
    );

    const hasVeggies = ingredients.some(i =>
      ['胡萝卜', '西兰花', '菠菜', '白菜', '黄瓜'].some(v => i.includes(v))
    );

    // 配方 1: 经典营养餐
    if (hasProtein && hasCarbs && hasVeggies) {
      const proteinItem = ingredients.find(i =>
        ['鸡肉', '牛肉', '猪肉', '鱼肉', '鸡胸肉', '三文鱼'].some(p => i.includes(p))
      );
      const carbItem = ingredients.find(i =>
        ['米饭', '红薯', '南瓜', '土豆', '燕麦'].some(c => i.includes(c))
      );
      const veggieItem = ingredients.find(i =>
        ['胡萝卜', '西兰花', '菠菜', '白菜', '黄瓜'].some(v => i.includes(v))
      );

      recipes.push({
        name: '经典营养均衡餐',
        ingredients: [proteinItem, carbItem, veggieItem].filter(Boolean),
        steps: [
          `将${proteinItem}切成小块，煮熟或蒸熟（不加调料）`,
          `将${carbItem}煮熟或蒸熟，压成泥状`,
          `将${veggieItem}切碎，焯水或蒸熟`,
          '混合所有食材，冷却至室温后喂食'
        ],
        nutrition: {
          protein: '高',
          carbs: '适中',
          vitamins: '丰富',
          minerals: '均衡'
        },
        portionGuide: this.getPortionGuide(dogInfo),
        notes: [
          '不添加盐、油、调料',
          '确保食材充分煮熟',
          '冷却后再喂食，避免烫伤'
        ]
      });
    }

    // 配方 2: 简易快手餐
    if (hasProtein && hasCarbs) {
      const proteinItem = ingredients.find(i =>
        ['鸡肉', '牛肉', '猪肉', '鱼肉'].some(p => i.includes(p))
      );
      const carbItem = ingredients.find(i =>
        ['米饭', '红薯', '南瓜', '土豆'].some(c => i.includes(c))
      );

      recipes.push({
        name: '简易能量餐',
        ingredients: [proteinItem, carbItem].filter(Boolean),
        steps: [
          `将${proteinItem}煮熟，撕成小块`,
          `将${carbItem}蒸熟，压成泥`,
          '混合均匀，冷却后喂食'
        ],
        nutrition: {
          protein: '高',
          carbs: '高',
          vitamins: '中等',
          minerals: '中等'
        },
        portionGuide: this.getPortionGuide(dogInfo),
        notes: [
          '适合快速准备',
          '建议搭配蔬菜以获得更全面营养'
        ]
      });
    }

    // 配方 3: 健康零食
    if (hasVeggies || ingredients.some(i => ['红薯', '南瓜', '胡萝卜'].some(v => i.includes(v)))) {
      const snackItems = ingredients.filter(i =>
        ['红薯', '南瓜', '胡萝卜', '西兰花', '苹果'].some(s => i.includes(s))
      );

      if (snackItems.length > 0) {
        recipes.push({
          name: '健康训练小零食',
          ingredients: snackItems,
          steps: [
            `将${snackItems.join('、')}切成小块`,
            '蒸熟或烤熟（不加调料）',
            '冷却后切成适口大小',
            '可作为训练奖励或日常零食'
          ],
          nutrition: {
            protein: '低',
            carbs: '中等',
            vitamins: '丰富',
            fiber: '高'
          },
          portionGuide: '每日零食不超过总热量的10%',
          notes: [
            '适合作为训练奖励',
            '不能替代正餐',
            '注意控制总量'
          ]
        });
      }
    }

    // 如果没有生成任何配方，返回通用建议
    if (recipes.length === 0) {
      recipes.push({
        name: '自由搭配建议',
        ingredients: ingredients,
        steps: [
          '选择1-2种蛋白质食材（鸡肉、牛肉、鱼肉等）',
          '搭配碳水化合物（米饭、红薯、南瓜等）',
          '添加蔬菜（胡萝卜、西兰花等）',
          '全部煮熟，不加调料，混合后冷却喂食'
        ],
        nutrition: {
          protein: '视食材而定',
          carbs: '视食材而定',
          vitamins: '视食材而定'
        },
        portionGuide: this.getPortionGuide(dogInfo),
        notes: [
          '建议蛋白质:碳水:蔬菜 = 4:3:3',
          '多样化搭配更健康'
        ]
      });
    }

    return recipes;
  }

  /**
   * 获取喂食份量指南
   */
  getPortionGuide(dogInfo) {
    const { weight, age } = dogInfo;

    if (weight) {
      if (weight.includes('小') || weight.includes('5') || weight.includes('10')) {
        return '每餐约100-200克（根据活动量调整）';
      } else if (weight.includes('中') || weight.includes('15') || weight.includes('20')) {
        return '每餐约200-400克（根据活动量调整）';
      } else {
        return '每餐约400-600克（根据活动量调整）';
      }
    }

    if (age === '幼犬') {
      return '每日3-4餐，每餐体重的4-6%';
    } else if (age === '老年犬') {
      return '每日2餐，每餐体重的2-3%';
    }

    return '每日2餐，每餐体重的2.5-3.5%（根据活动量调整）';
  }
}

module.exports = DogRecipeRecommendTool;
