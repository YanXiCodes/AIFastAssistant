const { contextBridge, ipcRenderer } = require('electron');

// 暴露安全的 API 给渲染进程
contextBridge.exposeInMainWorld('electronAPI', {
  // 发送消息（支持预设 prompt）
  sendMessage: (message, presetPrompt) => ipcRenderer.invoke('send-message', message, presetPrompt),

  // 隐藏窗口
  hideWindow: () => ipcRenderer.send('hide-window'),

  // 获取配置
  getConfig: (key) => ipcRenderer.invoke('get-config', key),

  // 设置配置
  setConfig: (key, value) => ipcRenderer.invoke('set-config', key, value),

  // 获取预设列表
  getPresets: () => ipcRenderer.invoke('get-presets'),

  // 打开配置对话框
  openConfigDialog: () => ipcRenderer.invoke('open-config-dialog'),

  // 监听消息块
  onMessageChunk: (callback) => {
    ipcRenderer.on('message-chunk', (event, chunk) => callback(chunk));
  },

  // 监听配置提示
  onShowConfigPrompt: (callback) => {
    ipcRenderer.on('show-config-prompt', () => callback());
  },

  // 监听选中文本
  onSelectedText: (callback) => {
    ipcRenderer.on('selected-text', (event, text) => callback(text));
  },

  // 获取剪贴板文本
  getClipboardText: () => ipcRenderer.invoke('get-clipboard-text')
});
