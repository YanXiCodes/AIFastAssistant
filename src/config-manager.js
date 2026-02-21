const Store = require('electron-store');

const schema = {
  deepseekApiKey: {
    type: 'string',
    default: ''
  },
  deepseekBaseUrl: {
    type: 'string',
    default: 'https://api.deepseek.com'
  },
  modelName: {
    type: 'string',
    default: 'deepseek-chat'
  },
  apiProvider: {
    type: 'string',
    default: 'deepseek'
  },
  globalShortcut: {
    type: 'string',
    default: 'CommandOrControl+Shift+Space'
  },
  hideOnBlur: {
    type: 'boolean',
    default: false
  },
  autoLaunch: {
    type: 'boolean',
    default: false
  },
  windowBounds: {
    type: 'object',
    default: {}
  },
  theme: {
    type: 'string',
    default: 'dark'
  },
  currentPreset: {
    type: 'string',
    default: ''
  }
};

// 预设模板
const presets = [
  {
    id: 'default',
    name: '默认对话',
    icon: '💬',
    prompt: ''
  },
  {
    id: 'linux-quick',
    name: 'Linux 速查',
    icon: '🐧',
    prompt: '你是一个 Linux 命令行专家。请用最简洁的方式回答问题，直接给出命令和简短说明，不要啰嗦。格式：命令 + 一句话说明 + 必要时给出示例。'
  },
  {
    id: 'code-review',
    name: '代码审查',
    icon: '🔍',
    prompt: '你是一个资深代码审查专家。请简洁地指出代码问题、潜在bug、性能问题和改进建议。用列表形式，每条建议包含：问题 + 原因 + 解决方案。'
  },
  {
    id: 'debug-helper',
    name: '调试助手',
    icon: '🐛',
    prompt: '你是一个调试专家。请帮我快速定位问题，给出：1) 可能的原因（最多3个）2) 排查步骤 3) 解决方案。保持简洁，直击要害。'
  },
  {
    id: 'api-doc',
    name: 'API 文档',
    icon: '📚',
    prompt: '你是 API 文档专家。请用简洁的格式说明 API 用法：端点、参数、返回值、示例代码。不要过多解释，重点是实用性。'
  },
  {
    id: 'translator',
    name: '翻译助手',
    icon: '🌐',
    prompt: '你是专业翻译。请直接给出翻译结果，不要解释翻译过程。如果是技术术语，在括号中注明英文原文。'
  },
  {
    id: 'regex-helper',
    name: '正则表达式',
    icon: '🔤',
    prompt: '你是正则表达式专家。请直接给出正则表达式和简短说明，格式：正则 + 匹配说明 + 测试示例。'
  },
  {
    id: 'sql-helper',
    name: 'SQL 助手',
    icon: '🗄️',
    prompt: '你是 SQL 专家。请直接给出 SQL 语句和简短说明，不要过多解释。如果有多种写法，给出最优方案。'
  },
  {
    id: 'git-helper',
    name: 'Git 助手',
    icon: '🌿',
    prompt: '你是 Git 专家。请直接给出 Git 命令和简短说明，格式：命令 + 作用 + 注意事项（如有）。'
  },
  {
    id: 'explain-simple',
    name: '简单解释',
    icon: '💡',
    prompt: '请用最简单的语言解释，就像对一个初学者讲解。避免术语，多用比喻和例子。控制在3-5句话内。'
  }
];

// API 提供商配置
const apiProviders = [
  {
    id: 'deepseek',
    name: 'DeepSeek 官方',
    baseUrl: 'https://api.deepseek.com',
    models: [
      { id: 'deepseek-chat', name: 'DeepSeek Chat' },
      { id: 'deepseek-coder', name: 'DeepSeek Coder' }
    ]
  },
  {
    id: 'siliconflow',
    name: '硅基流动',
    baseUrl: 'https://api.siliconflow.cn',
    models: [
      { id: 'deepseek-ai/DeepSeek-V3', name: 'DeepSeek V3' },
      { id: 'Qwen/Qwen2.5-7B-Instruct', name: 'Qwen 2.5 7B' },
      { id: 'Qwen/Qwen2.5-72B-Instruct', name: 'Qwen 2.5 72B' },
      { id: 'THUDM/glm-4-9b-chat', name: 'GLM-4 9B' },
      { id: 'meta-llama/Llama-3.3-70B-Instruct', name: 'Llama 3.3 70B' },
      { id: 'internlm/internlm2_5-7b-chat', name: 'InternLM 2.5 7B' }
    ]
  },
  {
    id: 'custom',
    name: '自定义',
    baseUrl: '',
    models: []
  }
];

const config = new Store({ schema });

module.exports = { config, presets, apiProviders };
