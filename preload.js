const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 发送消息（支持预设 prompt 和对话历史）
  sendMessage: (message, presetPrompt, conversationHistory) => ipcRenderer.invoke('send-message', message, presetPrompt, conversationHistory),

  // 隐藏窗口
  hideWindow: () => ipcRenderer.send('hide-window'),

  // 获取配置
  getConfig: (key) => ipcRenderer.invoke('get-config', key),

  // 设置配置
  setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),

  // 获取预设列表
  getPresets: () => ipcRenderer.invoke('get-presets'),

  // 获取 API 提供商列表
  getApiProviders: () => ipcRenderer.invoke('get-api-providers'),

  // 打开配置对话框
  openConfigDialog: () => ipcRenderer.invoke('open-config-dialog'),

  // 监听消息块
  onMessageChunk: (callback) => {
    ipcRenderer.on('message-chunk', (event, chunk) => callback(chunk));
  },

  // 监听模型状态
  onModelStatus: (callback) => {
    ipcRenderer.on('model-status', (event, data) => callback(data));
  },

  // 监听配置提示
  onShowConfigPrompt: (callback) => {
    ipcRenderer.on('show-config-prompt', () => callback());
  },

  // 监听选中文本
  onSelectedText: (callback) => {
    ipcRenderer.on('selected-text', (event, text) => callback(text));
  },

  // 监听打开设置
  onOpenSettings: (callback) => {
    ipcRenderer.on('open-settings', () => callback());
  },

  // 停止生成
  stopGeneration: () => ipcRenderer.invoke('stop-generation'),

  // 获取剪贴板文本
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text')
});
