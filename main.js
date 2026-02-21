const { app, globalShortcut, ipcMain, dialog, clipboard, Tray, Menu, nativeImage } = require('electron');
const { createMainWindow } = require('./src/window-manager');
const DeepSeekClient = require('./src/deepseek-client');
const { config, presets, apiProviders } = require('./src/config-manager');
const path = require('path');

let mainWindow = null;
let tray = null;
let currentShortcut = null;
let lastClipboardText = '';
let currentClient = null; // 保存当前的 DeepSeekClient 实例

// 禁用硬件加速以减少内存占用
app.disableHardwareAcceleration();

// 禁用不需要的功能
app.commandLine.appendSwitch('disable-features', 'MediaRouter');
app.commandLine.appendSwitch('disable-background-timer-throttling');

app.whenReady().then(() => {
  // 设置开机自启动
  const autoLaunch = config.get('autoLaunch');
  if (autoLaunch !== undefined) {
    app.setLoginItemSettings({
      openAtLogin: autoLaunch,
      openAsHidden: true // 开机后隐藏窗口，只在后台运行
    });
  }

  // 创建系统托盘
  createTray();

  // 创建主窗口
  mainWindow = createMainWindow();

  // 阻止窗口关闭，改为隐藏
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();
    }
  });

  // 窗口加载完成后显示
  mainWindow.webContents.once('did-finish-load', () => {
    mainWindow.show();
    mainWindow.focus();

    // 检查 API Key 配置
    const apiKey = config.get('deepseekApiKey');
    if (!apiKey) {
      mainWindow.webContents.send('show-config-prompt');
    }
  });

  // 注册全局快捷键
  currentShortcut = config.get('globalShortcut');
  registerGlobalShortcut(currentShortcut);
});

// 创建系统托盘
function createTray() {
  // 创建托盘图标（使用简单的文本图标）
  const icon = nativeImage.createFromDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAYAAABzenr0AAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAA7AAAAOwBeShxvQAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAGvSURBVFiF7ZY9TsNAEIW/sZ0fJRAKKKiQaGiQKLgAHRUlF+AAdFSchI6Gkg4JCQkJCQoKpIQiEiLYTrzDFrGz3rWdGAkqXmnlnZ2d92bXu2sBGhoaGv4bAqgABbwCT8A9cANcAefAEXAA7AP7wB6wC+wAW8AmsAGsA2vAKrACLAPLwBKwCCwA88AcMAtsANPAFDAJTADjwBgwCowAw8AQMAiUgAGgHxgA+oA+oBfoAXqAbqAL6AS6gA6gHWgD2oFWoAVoBpqARqABqAdqgRqgGqgCKoEKoByoAEqBUqAYKAaKgCKgECgA8kAeyAE5IAvkgAyQBtJACkgBSSABxIE4EANiQBSIABEgDISBEBAEAkAACAB+wA/4AB/gBbyAB3ADLsAJOAAH4ADsgB2wAVbAAtgAM2AGzIAJMAImwASYABNgBEyACTACRsAIGAEjYASMgBEwAkbACBgBI2AEjIARMAJGwAgYASNgBIyAETACRsAIGAEjYASMgBEwAkbACBgBI2AEjIARMAJGwAgYASNgBIyAETACRsAIGAEjYASMgBEwAkbACBgBI2AEjIARMAJGwAgYASNgBIyAETACRsAIGAEjYAT+AV8A7qLgHzEKAAAAAElFTkSuQmCC');

  tray = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '显示窗口',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
      }
    },
    {
      label: '隐藏窗口',
      click: () => {
        mainWindow.hide();
      }
    },
    {
      type: 'separator'
    },
    {
      label: '设置',
      click: () => {
        mainWindow.show();
        mainWindow.focus();
        mainWindow.webContents.send('open-settings');
      }
    },
    {
      type: 'separator'
    },
    {
      label: '退出',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setToolTip('AI Fast Assistant');
  tray.setContextMenu(contextMenu);

  // 双击托盘图标显示/隐藏窗口
  tray.on('double-click', () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      mainWindow.show();
      mainWindow.focus();
    }
  });
}

// 注册全局快捷键函数
function registerGlobalShortcut(shortcut) {
  // 先注销旧的快捷键
  if (currentShortcut) {
    globalShortcut.unregister(currentShortcut);
  }

  const registered = globalShortcut.register(shortcut, () => {
    if (mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      // 检查剪贴板是否有新的选中文本
      const currentClipboard = clipboard.readText();
      if (currentClipboard && currentClipboard !== lastClipboardText && currentClipboard.length < 1000) {
        // 发送选中的文本到渲染进程
        mainWindow.webContents.once('did-finish-load', () => {
          mainWindow.webContents.send('selected-text', currentClipboard);
        });
        lastClipboardText = currentClipboard;
      }

      mainWindow.show();
      mainWindow.focus();
    }
  });

  if (registered) {
    currentShortcut = shortcut;
    return { success: true };
  } else {
    return { error: '快捷键注册失败，可能与其他程序冲突' };
  }
}

// IPC 处理：发送消息（支持预设 prompt 和对话历史）
ipcMain.handle('send-message', async (event, message, presetPrompt, conversationHistory = []) => {
  const apiKey = config.get('deepseekApiKey');
  const baseUrl = config.get('deepseekBaseUrl');
  const modelName = config.get('modelName') || 'deepseek-chat';

  if (!apiKey) {
    return { error: '请先配置 API Key' };
  }

  // 如果有预设 prompt，将其添加到消息前
  const fullMessage = presetPrompt ? `${presetPrompt}\n\n用户问题：${message}` : message;

  const client = new DeepSeekClient(apiKey, baseUrl, modelName);
  currentClient = client; // 保存当前客户端实例

  return new Promise((resolve) => {
    let fullResponse = '';

    client.streamChat(
      fullMessage,
      (chunk) => {
        fullResponse += chunk;
        event.sender.send('message-chunk', chunk);
      },
      () => {
        resolve({ success: true, response: fullResponse });
      },
      (error) => {
        resolve({ error: error.message || '请求失败' });
      },
      conversationHistory,
      (status, reasoningContent) => {
        // 发送状态更新到渲染进程
        event.sender.send('model-status', { status, reasoningContent });
      }
    );
  });
});

// IPC 处理：隐藏窗口
ipcMain.on('hide-window', () => {
  if (mainWindow) {
    mainWindow.hide();
  }
});

// IPC 处理：获取配置
ipcMain.handle('get-config', (event, key) => {
  return config.get(key);
});

// IPC 处理：设置配置
ipcMain.handle('set-config', (event, key, value) => {
  config.set(key, value);

  // 如果修改了快捷键，重新注册
  if (key === 'globalShortcut') {
    return registerGlobalShortcut(value);
  }

  // 如果修改了透明度，更新窗口
  if (key === 'windowOpacity' && mainWindow) {
    mainWindow.setOpacity(value / 100);
  }

  // 如果修改了开机自启动，更新系统设置
  if (key === 'autoLaunch') {
    app.setLoginItemSettings({
      openAtLogin: value,
      openAsHidden: true
    });
  }

  return { success: true };
});

// IPC 处理：获取预设列表
ipcMain.handle('get-presets', () => {
  return presets;
});

// IPC 处理：获取 API 提供商列表
ipcMain.handle('get-api-providers', () => {
  return apiProviders;
});

// IPC 处理：打开配置对话框
ipcMain.handle('open-config-dialog', async () => {
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'info',
    title: '配置 API Key',
    message: '请在设置中配置 DeepSeek API Key',
    detail: '你可以在 https://platform.deepseek.com 获取 API Key',
    buttons: ['确定']
  });
  return result;
});

// IPC 处理：获取剪贴板文本
ipcMain.handle('get-clipboard-text', () => {
  return clipboard.readText();
});

// IPC 处理：停止生成
ipcMain.handle('stop-generation', () => {
  if (currentClient) {
    currentClient.cancel();
    currentClient = null;
    return { success: true };
  }
  return { success: false };
});

// 清理快捷键
app.on('will-quit', () => {
  globalShortcut.unregisterAll();
});

// macOS 特殊处理
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (mainWindow === null) {
    mainWindow = createMainWindow();
  }
});
