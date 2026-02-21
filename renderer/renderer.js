// 获取 DOM 元素
const chatContainer = document.getElementById('chat-container');
const statusIndicator = document.getElementById('status-indicator');
const statusText = document.getElementById('status-text');
const currentModelDisplay = document.getElementById('current-model');
const messageInput = document.getElementById('message-input');
const sendBtn = document.getElementById('send-btn');
const stopBtn = document.getElementById('stop-btn');
const clearBtn = document.getElementById('clear-btn');
const closeBtn = document.getElementById('close-btn');
const clearChatBtn = document.getElementById('clear-chat-btn');
const settingsBtn = document.getElementById('settings-btn');
const presetBtn = document.getElementById('preset-btn');
const imageBtn = document.getElementById('image-btn');
const imageInput = document.getElementById('image-input');
const configPrompt = document.getElementById('config-prompt');
const apiKeyInput = document.getElementById('api-key-input');
const saveApiKeyBtn = document.getElementById('save-api-key-btn');
const cancelConfigBtn = document.getElementById('cancel-config-btn');

// 设置模态框
const settingsModal = document.getElementById('settings-modal');
const settingsApiProvider = document.getElementById('settings-api-provider');
const settingsModel = document.getElementById('settings-model');
const settingsManualModel = document.getElementById('settings-manual-model');
const customModelInputGroup = document.getElementById('custom-model-input-group');
const settingsBaseUrl = document.getElementById('settings-base-url');
const settingsCustomModel = document.getElementById('settings-custom-model');
const customBaseUrlGroup = document.getElementById('custom-base-url-group');
const customModelGroup = document.getElementById('custom-model-group');
const settingsApiKey = document.getElementById('settings-api-key');
const settingsShortcut = document.getElementById('settings-shortcut');
const settingsHideOnBlur = document.getElementById('settings-hide-on-blur');
const settingsAutoLaunch = document.getElementById('settings-auto-launch');
const settingsOpacity = document.getElementById('settings-opacity');
const opacityValue = document.getElementById('opacity-value');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const cancelSettingsBtn = document.getElementById('cancel-settings-btn');

// 预设模态框
const presetModal = document.getElementById('preset-modal');
const presetList = document.getElementById('preset-list');
const closePresetModal = document.getElementById('close-preset-modal');
const currentPresetDiv = document.getElementById('current-preset');
const presetNameSpan = document.getElementById('preset-name');
const clearPresetBtn = document.getElementById('clear-preset-btn');

// 历史记录模态框
const historyBtn = document.getElementById('history-btn');
const historyModal = document.getElementById('history-modal');
const historyList = document.getElementById('history-list');
const closeHistoryModal = document.getElementById('close-history-modal');

// 快捷命令菜单
const commandMenu = document.getElementById('command-menu');
const commandList = document.getElementById('command-list');

let currentAssistantMessage = null;
let currentAssistantContent = '';
let isProcessing = false;
let currentPreset = null;
let apiProviders = [];
let currentProvider = null;
let uploadedImage = null;
let commandMenuVisible = false;
let selectedCommandIndex = 0;
let availableCommands = [];
let chatHistory = []; // 历史记录（用于显示）
let conversationHistory = []; // 对话上下文（用于 API 请求）
let userScrolling = false;
let scrollTimeout = null;
let lastChunkTime = null; // 记录最后一次收到数据的时间
let stuckCheckInterval = null; // 卡住检测定时器

// 初始化
window.addEventListener('DOMContentLoaded', async () => {
  messageInput.focus();

  // 加载并显示当前模型
  await updateCurrentModelDisplay();

  // 配置 marked
  if (typeof marked !== 'undefined') {
    marked.setOptions({
      breaks: true,
      gfm: true,
      highlight: function(code, lang) {
        if (lang && hljs.getLanguage(lang)) {
          try {
            return hljs.highlight(code, { language: lang }).value;
          } catch (err) {}
        }
        return hljs.highlightAuto(code).value;
      }
    });
  }

  // 加载预设列表
  await loadPresets();

  // 加载当前预设
  const savedPresetId = await window.electronAPI.getConfig('currentPreset');
  if (savedPresetId) {
    const presets = await window.electronAPI.getPresets();
    currentPreset = presets.find(p => p.id === savedPresetId);
    if (currentPreset && currentPreset.id !== 'default') {
      showCurrentPreset();
    }
  }

  // 加载历史记录
  loadHistory();

  // 监听用户手动滚动
  chatContainer.addEventListener('scroll', () => {
    const isAtBottom = chatContainer.scrollHeight - chatContainer.scrollTop - chatContainer.clientHeight < 50;

    if (!isAtBottom) {
      userScrolling = true;
      // 清除之前的定时器
      if (scrollTimeout) {
        clearTimeout(scrollTimeout);
      }
      // 3秒后恢复自动滚动
      scrollTimeout = setTimeout(() => {
        userScrolling = false;
      }, 3000);
    } else {
      userScrolling = false;
    }
  });
});

// 监听配置提示
window.electronAPI.onShowConfigPrompt(() => {
  showConfigPrompt();
});

// 监听模型状态（从 API 响应中获取）
window.electronAPI.onModelStatus((data) => {
  if (data.status === 'reasoning') {
    showStatus('深度思考中...', '🧠');
  } else if (data.status === 'generating') {
    showStatus('生成中...', '✨');
  }
});

// 监听打开设置（从托盘触发）
window.electronAPI.onOpenSettings(() => {
  openSettings();
});

// 监听选中文本
window.electronAPI.onSelectedText((text) => {
  if (text && text.trim()) {
    messageInput.value = text.trim();
    messageInput.focus();
    // 自动选中文本，方便用户修改
    messageInput.select();
  }
});

// 快捷命令定义
const commands = [
  { id: 'trans', icon: '🌐', name: '/trans', desc: '翻译模式', preset: 'translator' },
  { id: 'code', icon: '💻', name: '/code', desc: '代码审查', preset: 'code-review' },
  { id: 'debug', icon: '🐛', name: '/debug', desc: '调试助手', preset: 'debug-helper' },
  { id: 'linux', icon: '🐧', name: '/linux', desc: 'Linux 命令', preset: 'linux-quick' },
  { id: 'sql', icon: '🗄️', name: '/sql', desc: 'SQL 助手', preset: 'sql-helper' },
  { id: 'regex', icon: '🔤', name: '/regex', desc: '正则表达式', preset: 'regex-helper' },
  { id: 'git', icon: '📦', name: '/git', desc: 'Git 助手', preset: 'git-helper' },
  { id: 'explain', icon: '📖', name: '/explain', desc: '简单解释', preset: 'simple-explain' }
];

// 显示快捷命令菜单
function showCommandMenu(filter = '') {
  availableCommands = commands.filter(cmd =>
    cmd.name.includes(filter.toLowerCase()) || cmd.desc.includes(filter)
  );

  if (availableCommands.length === 0) {
    hideCommandMenu();
    return;
  }

  commandList.innerHTML = '';
  availableCommands.forEach((cmd, index) => {
    const item = document.createElement('div');
    item.className = 'command-item' + (index === selectedCommandIndex ? ' selected' : '');
    item.innerHTML = `
      <span class="command-icon">${cmd.icon}</span>
      <div class="command-info">
        <div class="command-name">${cmd.name}</div>
        <div class="command-desc">${cmd.desc}</div>
      </div>
    `;
    item.onclick = () => selectCommand(cmd);
    commandList.appendChild(item);
  });

  commandMenu.style.display = 'block';
  commandMenuVisible = true;
}

// 隐藏快捷命令菜单
function hideCommandMenu() {
  commandMenu.style.display = 'none';
  commandMenuVisible = false;
  selectedCommandIndex = 0;
}

// 选择命令
async function selectCommand(cmd) {
  const presets = await window.electronAPI.getPresets();
  const preset = presets.find(p => p.id === cmd.preset);
  if (preset) {
    await selectPreset(preset);
  }
  messageInput.value = '';
  hideCommandMenu();
  messageInput.focus();
}

// 加载预设列表
async function loadPresets() {
  const presets = await window.electronAPI.getPresets();
  presetList.innerHTML = '';

  presets.forEach(preset => {
    const presetItem = document.createElement('div');
    presetItem.className = 'preset-item';
    presetItem.innerHTML = `
      <span class="preset-icon">${preset.icon}</span>
      <div class="preset-info">
        <div class="preset-title">${preset.name}</div>
        <div class="preset-desc">${preset.prompt ? preset.prompt.substring(0, 50) + '...' : '默认对话模式'}</div>
      </div>
    `;
    presetItem.onclick = () => selectPreset(preset);
    presetList.appendChild(presetItem);
  });
}

// 选择预设
async function selectPreset(preset) {
  currentPreset = preset;
  await window.electronAPI.setConfig('currentPreset', preset.id);
  presetModal.style.display = 'none';

  if (preset.id === 'default') {
    currentPresetDiv.style.display = 'none';
  } else {
    showCurrentPreset();
  }
}

// 显示当前预设
function showCurrentPreset() {
  if (currentPreset && currentPreset.id !== 'default') {
    presetNameSpan.textContent = `${currentPreset.icon} ${currentPreset.name}`;
    currentPresetDiv.style.display = 'flex';
  }
}

// 清除预设
async function clearPreset() {
  const presets = await window.electronAPI.getPresets();
  currentPreset = presets.find(p => p.id === 'default');
  await window.electronAPI.setConfig('currentPreset', 'default');
  currentPresetDiv.style.display = 'none';
}

// 历史记录管理
function loadHistory() {
  const saved = localStorage.getItem('chatHistory');
  if (saved) {
    chatHistory = JSON.parse(saved);
  }
}

function saveHistory(question, answer) {
  const item = {
    question: question.substring(0, 100),
    answer: answer.substring(0, 200),
    time: new Date().toLocaleString('zh-CN')
  };

  chatHistory.unshift(item);
  if (chatHistory.length > 10) {
    chatHistory = chatHistory.slice(0, 10);
  }

  localStorage.setItem('chatHistory', JSON.stringify(chatHistory));
}

function showHistory() {
  if (chatHistory.length === 0) {
    historyList.innerHTML = '<p style="text-align: center; color: #71717a; padding: 20px;">暂无历史记录</p>';
  } else {
    historyList.innerHTML = '';
    chatHistory.forEach((item, index) => {
      const historyItem = document.createElement('div');
      historyItem.className = 'history-item';
      historyItem.innerHTML = `
        <div class="history-question">Q: ${item.question}</div>
        <div class="history-answer">A: ${item.answer}</div>
        <div class="history-time">${item.time}</div>
      `;
      historyItem.onclick = () => {
        messageInput.value = item.question;
        historyModal.style.display = 'none';
        messageInput.focus();
      };
      historyList.appendChild(historyItem);
    });
  }
  historyModal.style.display = 'flex';
}

// 状态管理函数
function showStatus(message, icon = '⏳') {
  statusIndicator.style.display = 'flex';
  statusText.textContent = message;
  statusIndicator.querySelector('.status-icon').textContent = icon;
}

function hideStatus() {
  statusIndicator.style.display = 'none';
}

// 更新当前模型显示
async function updateCurrentModelDisplay() {
  const apiProvider = await window.electronAPI.getConfig('apiProvider') || 'deepseek';
  const modelName = await window.electronAPI.getConfig('modelName') || 'deepseek-chat';

  // 获取提供商信息
  if (apiProviders.length === 0) {
    apiProviders = await window.electronAPI.getApiProviders();
  }

  const provider = apiProviders.find(p => p.id === apiProvider);
  let displayText = modelName;

  // 如果是预设提供商，尝试获取友好名称
  if (provider && provider.models.length > 0) {
    const model = provider.models.find(m => m.id === modelName);
    if (model) {
      displayText = model.name;
    }
  }

  currentModelDisplay.textContent = displayText;
  currentModelDisplay.title = `当前模型: ${modelName}\n提供商: ${provider ? provider.name : apiProvider}`;
}

// 发送消息
async function sendMessage() {
  const message = messageInput.value.trim();
  if ((!message && !uploadedImage) || isProcessing) return;

  // 清除欢迎消息
  const welcomeMsg = chatContainer.querySelector('.welcome-message');
  if (welcomeMsg) {
    welcomeMsg.remove();
  }

  // 构建消息内容
  let fullMessage = message;
  if (uploadedImage) {
    fullMessage = `[图片内容]\n${uploadedImage}\n\n${message}`;
  }

  // 显示用户消息
  appendMessage('user', fullMessage, false);
  messageInput.value = '';
  uploadedImage = null;
  isProcessing = true;
  sendBtn.disabled = true;
  sendBtn.style.display = 'none';
  stopBtn.style.display = 'block';

  // 显示连接中状态
  showStatus('连接中...', '⏳');
  firstChunkReceived = false;

  // 添加用户消息到对话历史
  conversationHistory.push({ role: 'user', content: fullMessage });

  // 创建助手消息容器
  currentAssistantContent = '';
  currentAssistantMessage = appendMessage('assistant', '', true);

  // 初始连接超时检测（10秒内没收到第一个字符）
  let initialTimeout = setTimeout(() => {
    if (!firstChunkReceived) {
      showStatus('连接超时，请检查网络或 API 配置', '⚠️');
    }
  }, 10000);

  // 发送到主进程（带预设 prompt 和对话历史）
  const presetPrompt = currentPreset && currentPreset.prompt ? currentPreset.prompt : '';
  const result = await window.electronAPI.sendMessage(fullMessage, presetPrompt, conversationHistory);

  // 立即清除所有定时器和状态
  clearTimeout(initialTimeout);
  hideStatus();

  if (result.error) {
    currentAssistantMessage.innerHTML = `<p style="color: #ff6b6b;">❌ 错误: ${result.error}</p>`;
    if (result.error.includes('API Key')) {
      showConfigPrompt();
    }
    // 错��时移除最后添加的用户消息
    conversationHistory.pop();
  } else {
    // 添加助手回复到对话历史
    conversationHistory.push({ role: 'assistant', content: currentAssistantContent });

    // 保持对话历史在合理长度（最近 10 轮对话 = 20 条消息）
    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }

    // 保存到历史记录（用于显示）
    saveHistory(message, currentAssistantContent);
  }

  isProcessing = false;
  sendBtn.disabled = false;
  sendBtn.style.display = 'block';
  stopBtn.style.display = 'none';
  messageInput.focus();
}

// 接收流式响应
let firstChunkReceived = false;
window.electronAPI.onMessageChunk((chunk) => {
  if (currentAssistantMessage) {
    // 第一次收到数据时清除初始超时
    if (!firstChunkReceived) {
      firstChunkReceived = true;
      // 状态由 onModelStatus 监听器处理，这里不再手动设置
    }

    currentAssistantContent += chunk;
    // 渲染 Markdown
    if (typeof marked !== 'undefined') {
      const contentDiv = currentAssistantMessage.querySelector('.message-content');
      if (contentDiv) {
        contentDiv.innerHTML = marked.parse(currentAssistantContent);
        // 为代码块添加复制按钮
        addCopyButtonsToCodeBlocks(contentDiv);
      }
    } else {
      const contentDiv = currentAssistantMessage.querySelector('.message-content');
      if (contentDiv) {
        contentDiv.textContent = currentAssistantContent;
      }
    }
    // 只有���用户没有手动滚动时才自动滚动到底部
    if (!userScrolling) {
      requestAnimationFrame(() => {
        chatContainer.scrollTop = chatContainer.scrollHeight;
      });
    }
  }
});

// 添加消息到界面
function appendMessage(role, content, isMarkdown) {
  const messageDiv = document.createElement('div');
  messageDiv.className = `message ${role}`;

  const contentDiv = document.createElement('div');
  contentDiv.className = 'message-content';

  if (isMarkdown && typeof marked !== 'undefined') {
    contentDiv.innerHTML = marked.parse(content);
  } else {
    contentDiv.textContent = content;
  }

  messageDiv.appendChild(contentDiv);

  if (role === 'assistant') {
    const btnGroup = document.createElement('div');
    btnGroup.className = 'message-btn-group';

    const copyBtn = document.createElement('button');
    copyBtn.className = 'copy-btn';
    copyBtn.textContent = '📋 复制';
    copyBtn.onclick = () => copyToClipboard(contentDiv, copyBtn);

    const regenerateBtn = document.createElement('button');
    regenerateBtn.className = 'regenerate-btn';
    regenerateBtn.textContent = '🔄 重新生成';
    regenerateBtn.onclick = () => regenerateResponse(messageDiv);

    btnGroup.appendChild(copyBtn);
    btnGroup.appendChild(regenerateBtn);
    messageDiv.appendChild(btnGroup);

    // 为代码块添加复制按钮
    addCopyButtonsToCodeBlocks(contentDiv);
  }

  chatContainer.appendChild(messageDiv);

  // 新消息添加时重置用户滚动状态，自动滚动到底部
  userScrolling = false;
  requestAnimationFrame(() => {
    chatContainer.scrollTop = chatContainer.scrollHeight;
  });

  // 限制消息数量（保持最多 50 条）
  const messages = chatContainer.querySelectorAll('.message');
  if (messages.length > 50) {
    messages[0].remove();
  }

  return messageDiv;
}

// 复制到剪贴板
function copyToClipboard(contentDiv, button) {
  const text = contentDiv.textContent.trim();
  navigator.clipboard.writeText(text).then(() => {
    button.textContent = '✓ 已复制';
    button.classList.add('copied');
    setTimeout(() => {
      button.textContent = '📋 复制';
      button.classList.remove('copied');
    }, 2000);
  });
}

// 为代码块添加复制按钮
function addCopyButtonsToCodeBlocks(container) {
  const codeBlocks = container.querySelectorAll('pre code');
  codeBlocks.forEach((codeBlock) => {
    const pre = codeBlock.parentElement;

    // 避免重复添加按钮
    if (pre.querySelector('.code-copy-btn')) {
      return;
    }

    // 创建复制按钮
    const copyBtn = document.createElement('button');
    copyBtn.className = 'code-copy-btn';
    copyBtn.textContent = '📋';
    copyBtn.title = '复制代码';

    copyBtn.onclick = (e) => {
      e.stopPropagation();
      const code = codeBlock.textContent;
      navigator.clipboard.writeText(code).then(() => {
        copyBtn.textContent = '✓';
        copyBtn.classList.add('copied');
        setTimeout(() => {
          copyBtn.textContent = '📋';
          copyBtn.classList.remove('copied');
        }, 2000);
      });
    };

    // 添加按钮到 pre 元素
    pre.style.position = 'relative';
    pre.appendChild(copyBtn);
  });
}

// 重新生成回答
async function regenerateResponse(assistantMessageDiv) {
  if (isProcessing) return;

  // 找到这条助手消息对应的用户消息
  let userMessageDiv = assistantMessageDiv.previousElementSibling;
  while (userMessageDiv && !userMessageDiv.classList.contains('user')) {
    userMessageDiv = userMessageDiv.previousElementSibling;
  }

  if (!userMessageDiv) {
    alert('无法找到对应的用户消息');
    return;
  }

  const userMessage = userMessageDiv.querySelector('.message-content').textContent.trim();

  // 移除当前助手消息
  assistantMessageDiv.remove();

  // 从对话历史中移除最后一条助手回复
  if (conversationHistory.length > 0 && conversationHistory[conversationHistory.length - 1].role === 'assistant') {
    conversationHistory.pop();
  }

  // 重新发送请求
  isProcessing = true;
  sendBtn.disabled = true;
  sendBtn.style.display = 'none';
  stopBtn.style.display = 'block';

  showStatus('重新生成中...', '🔄');
  firstChunkReceived = false;

  currentAssistantContent = '';
  currentAssistantMessage = appendMessage('assistant', '', true);

  const presetPrompt = currentPreset && currentPreset.prompt ? currentPreset.prompt : '';
  const result = await window.electronAPI.sendMessage(userMessage, presetPrompt, conversationHistory);

  clearTimeout(timeout);
  hideStatus();

  if (result.error) {
    currentAssistantMessage.innerHTML = `<p style="color: #ff6b6b;">❌ 错误: ${result.error}</p>`;
  } else {
    conversationHistory.push({ role: 'assistant', content: currentAssistantContent });

    if (conversationHistory.length > 20) {
      conversationHistory = conversationHistory.slice(-20);
    }
  }

  isProcessing = false;
  sendBtn.disabled = false;
  sendBtn.style.display = 'block';
  stopBtn.style.display = 'none';
  messageInput.focus();
}

// 清空对话
function clearChat() {
  chatContainer.innerHTML = `
    <div class="welcome-message">
      <h2>👋 欢迎使用 AI Fast Assistant</h2>
      <p>按 <kbd>Ctrl+Shift+Space</kbd> 随时唤起</p>
      <p>按 <kbd>Ctrl+Enter</kbd> 发送消息</p>
      <p>按 <kbd>Esc</kbd> 关闭窗口</p>
      <p>点击 <kbd>📋</kbd> 选择预设模板</p>
    </div>
  `;
  messageInput.focus();
}

// 清空对话上下文
function clearConversation() {
  if (confirm('确定要清空对话上下文吗？这将开始一个全新的对话。')) {
    conversationHistory = [];
    clearChat();
  }
}

// 显示配置提示
function showConfigPrompt() {
  configPrompt.style.display = 'flex';
  apiKeyInput.focus();
}

// 隐藏配置提示
function hideConfigPrompt() {
  configPrompt.style.display = 'none';
  apiKeyInput.value = '';
}

// 保存 API Key
async function saveApiKey() {
  const apiKey = apiKeyInput.value.trim();
  if (!apiKey) {
    alert('请输入 API Key');
    return;
  }

  await window.electronAPI.setConfig('deepseekApiKey', apiKey);
  hideConfigPrompt();
  messageInput.focus();
}

// 打开设置
async function openSettings() {
  // 加载 API 提供商列表
  if (apiProviders.length === 0) {
    apiProviders = await window.electronAPI.getApiProviders();
  }

  const apiKey = await window.electronAPI.getConfig('deepseekApiKey');
  const apiProvider = await window.electronAPI.getConfig('apiProvider') || 'deepseek';
  const modelName = await window.electronAPI.getConfig('modelName') || 'deepseek-chat';
  const baseUrl = await window.electronAPI.getConfig('deepseekBaseUrl');
  const shortcut = await window.electronAPI.getConfig('globalShortcut');
  const hideOnBlur = await window.electronAPI.getConfig('hideOnBlur');
  const autoLaunch = await window.electronAPI.getConfig('autoLaunch');
  const opacity = await window.electronAPI.getConfig('windowOpacity') || 100;

  settingsApiProvider.value = apiProvider;
  settingsApiKey.value = apiKey || '';
  settingsShortcut.value = shortcut || 'CommandOrControl+Shift+Space';
  settingsHideOnBlur.checked = hideOnBlur || false;
  settingsAutoLaunch.checked = autoLaunch || false;
  settingsOpacity.value = opacity;
  opacityValue.textContent = opacity;

  // 更新模型列表
  updateModelList(apiProvider, modelName);

  // 如果是自定义，显示自定义字段
  if (apiProvider === 'custom') {
    customBaseUrlGroup.style.display = 'block';
    customModelGroup.style.display = 'block';
    settingsBaseUrl.value = baseUrl || '';
    settingsCustomModel.value = modelName || '';
  } else {
    customBaseUrlGroup.style.display = 'none';
    customModelGroup.style.display = 'none';
  }

  settingsModal.style.display = 'flex';
  settingsApiKey.focus();
}

// 更新模型列表
function updateModelList(providerId, selectedModel) {
  const provider = apiProviders.find(p => p.id === providerId);
  if (!provider) return;

  settingsModel.innerHTML = '';

  if (provider.models.length > 0) {
    provider.models.forEach(model => {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = model.name;
      if (model.id === selectedModel) {
        option.selected = true;
      }
      settingsModel.appendChild(option);
    });
    settingsModel.style.display = 'block';
    settingsModel.parentElement.style.display = 'block';
  } else {
    settingsModel.style.display = 'none';
    settingsModel.parentElement.style.display = 'none';
  }
}

// API 提供商切换事件
settingsApiProvider.addEventListener('change', (e) => {
  const providerId = e.target.value;
  const provider = apiProviders.find(p => p.id === providerId);

  if (providerId === 'custom') {
    customBaseUrlGroup.style.display = 'block';
    customModelGroup.style.display = 'block';
    customModelInputGroup.style.display = 'none';
    settingsModel.parentElement.style.display = 'none';
  } else {
    customBaseUrlGroup.style.display = 'none';
    customModelGroup.style.display = 'none';
    customModelInputGroup.style.display = 'block';
    updateModelList(providerId, provider.models[0]?.id);
  }
});

// 透明度滑块实时更新
settingsOpacity.addEventListener('input', (e) => {
  const value = e.target.value;
  opacityValue.textContent = value;
});

// 保存设置
async function saveSettings() {
  const apiKey = settingsApiKey.value.trim();
  const apiProvider = settingsApiProvider.value;
  const shortcut = settingsShortcut.value.trim();
  const hideOnBlur = settingsHideOnBlur.checked;
  const autoLaunch = settingsAutoLaunch.checked;

  if (apiKey) {
    await window.electronAPI.setConfig('deepseekApiKey', apiKey);
  }

  // 保存 API 提供商
  await window.electronAPI.setConfig('apiProvider', apiProvider);

  // 保存模型和 base URL
  if (apiProvider === 'custom') {
    const customBaseUrl = settingsBaseUrl.value.trim();
    const customModel = settingsCustomModel.value.trim();
    if (customBaseUrl) {
      await window.electronAPI.setConfig('deepseekBaseUrl', customBaseUrl);
    }
    if (customModel) {
      await window.electronAPI.setConfig('modelName', customModel);
    }
  } else {
    const provider = apiProviders.find(p => p.id === apiProvider);
    if (provider) {
      await window.electronAPI.setConfig('deepseekBaseUrl', provider.baseUrl);

      // 优先使用手动输入的模型名
      const manualModel = settingsManualModel.value.trim();
      const selectedModel = manualModel || settingsModel.value;

      if (selectedModel) {
        await window.electronAPI.setConfig('modelName', selectedModel);
      }
    }
  }

  if (shortcut) {
    const result = await window.electronAPI.setConfig('globalShortcut', shortcut);
    if (result.error) {
      alert(result.error);
      return;
    }
  }

  await window.electronAPI.setConfig('hideOnBlur', hideOnBlur);
  await window.electronAPI.setConfig('autoLaunch', autoLaunch);

  // 保存透明度
  const opacity = parseInt(settingsOpacity.value);
  await window.electronAPI.setConfig('windowOpacity', opacity);

  // 更新当前模型显示
  await updateCurrentModelDisplay();

  // 显示保存成功提示
  showStatus('设置已保存 ✓', '✅');
  setTimeout(() => {
    hideStatus();
  }, 2000);

  settingsModal.style.display = 'none';
  messageInput.focus();
}

// 快捷键录制
let recordingShortcut = false;
let pressedKeys = new Set();

settingsShortcut.addEventListener('focus', () => {
  recordingShortcut = true;
  settingsShortcut.value = '按下快捷键...';
  pressedKeys.clear();
});

settingsShortcut.addEventListener('blur', () => {
  recordingShortcut = false;
});

settingsShortcut.addEventListener('keydown', (e) => {
  if (!recordingShortcut) return;
  e.preventDefault();

  const key = e.key;
  const modifiers = [];

  if (e.ctrlKey || e.metaKey) modifiers.push('CommandOrControl');
  if (e.shiftKey) modifiers.push('Shift');
  if (e.altKey) modifiers.push('Alt');

  // 只记录非修饰键
  if (!['Control', 'Shift', 'Alt', 'Meta'].includes(key)) {
    const keyName = key.toUpperCase();
    const shortcut = modifiers.length > 0 ? `${modifiers.join('+')}+${keyName}` : keyName;
    settingsShortcut.value = shortcut;
  }
});

// 图片上传
imageBtn.addEventListener('click', () => {
  imageInput.click();
});

imageInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  if (file) {
    await handleImageUpload(file);
  }
});

// 处理图片上传
async function handleImageUpload(file) {
  const reader = new FileReader();
  reader.onload = async (e) => {
    const base64 = e.target.result;
    uploadedImage = `图片已上传: ${file.name}`;
    messageInput.placeholder = `已上传图片: ${file.name}，输入问题...`;
  };
  reader.readAsDataURL(file);
}

// 粘贴图片
messageInput.addEventListener('paste', async (e) => {
  const items = e.clipboardData.items;
  for (let item of items) {
    if (item.type.indexOf('image') !== -1) {
      e.preventDefault();
      const file = item.getAsFile();
      await handleImageUpload(file);
      break;
    }
  }
});

// 事件监听
const pasteBtn = document.getElementById('paste-btn');

// 粘贴剪贴板按钮
pasteBtn.addEventListener('click', async () => {
  const text = await window.electronAPI.getClipboardText();
  if (text) {
    messageInput.value = text;
    messageInput.focus();
  }
});

sendBtn.addEventListener('click', sendMessage);
stopBtn.addEventListener('click', async () => {
  await window.electronAPI.stopGeneration();
  hideStatus();

  isProcessing = false;
  sendBtn.disabled = false;
  sendBtn.style.display = 'block';
  stopBtn.style.display = 'none';

  // 在当前消息后添加"已停止"提示
  if (currentAssistantMessage) {
    const contentDiv = currentAssistantMessage.querySelector('.message-content');
    if (contentDiv) {
      contentDiv.innerHTML += '\n\n<p style="color: #fca5a5; font-style: italic;">⏹ 生成已停止</p>';
    }
  }
});
clearBtn.addEventListener('click', clearChat);
clearChatBtn.addEventListener('click', clearConversation);
closeBtn.addEventListener('click', () => window.electronAPI.hideWindow());
historyBtn.addEventListener('click', showHistory);
settingsBtn.addEventListener('click', openSettings);
presetBtn.addEventListener('click', () => presetModal.style.display = 'flex');
saveApiKeyBtn.addEventListener('click', saveApiKey);
cancelConfigBtn.addEventListener('click', hideConfigPrompt);
saveSettingsBtn.addEventListener('click', saveSettings);
cancelSettingsBtn.addEventListener('click', () => settingsModal.style.display = 'none');
closePresetModal.addEventListener('click', () => presetModal.style.display = 'none');
closeHistoryModal.addEventListener('click', () => historyModal.style.display = 'none');
clearPresetBtn.addEventListener('click', clearPreset);

// 快捷键
messageInput.addEventListener('keydown', (e) => {
  // 快捷命令菜单导航
  if (commandMenuVisible) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      selectedCommandIndex = (selectedCommandIndex + 1) % availableCommands.length;
      showCommandMenu(messageInput.value.substring(1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      selectedCommandIndex = (selectedCommandIndex - 1 + availableCommands.length) % availableCommands.length;
      showCommandMenu(messageInput.value.substring(1));
    } else if (e.key === 'Enter' && !e.ctrlKey) {
      e.preventDefault();
      selectCommand(availableCommands[selectedCommandIndex]);
      return;
    } else if (e.key === 'Escape') {
      hideCommandMenu();
      return;
    }
  }

  if (e.key === 'Enter' && e.ctrlKey) {
    e.preventDefault();
    sendMessage();
  }
  if (e.key === 'Escape' && !commandMenuVisible) {
    window.electronAPI.hideWindow();
  }
});

// 监听输入变化，检测斜杠命令
messageInput.addEventListener('input', (e) => {
  const value = messageInput.value;
  if (value.startsWith('/')) {
    showCommandMenu(value.substring(1));
  } else {
    hideCommandMenu();
  }
});

// 配置对话框快捷键
apiKeyInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault();
    saveApiKey();
  }
  if (e.key === 'Escape') {
    hideConfigPrompt();
  }
});

// 全局 Esc 键监听
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') {
    if (settingsModal.style.display === 'flex') {
      settingsModal.style.display = 'none';
    } else if (presetModal.style.display === 'flex') {
      presetModal.style.display = 'none';
    } else if (configPrompt.style.display === 'none') {
      window.electronAPI.hideWindow();
    }
  }
});
