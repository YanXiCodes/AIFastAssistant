const { app, globalShortcut, ipcMain, dialog, clipboard } = require('electron');
const { createMainWindow } = require('./src/window-manager');
const DeepSeekClient = require('./src/deepseek-client');
const { config, presets } = require('./src/config-manager');

let mainWindow = null;
let currentShortcut = null;
let lastClipboardText = '';

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

  // 创建主窗口
  mainWindow = createMainWindow();

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

// IPC 处理：发送消息（支持预设 prompt）
ipcMain.handle('send-message', async (event, message, presetPrompt) => {
  const apiKey = config.get('deepseekApiKey');
  const baseUrl = config.get('deepseekBaseUrl');

  if (!apiKey) {
    return { error: '请先配置 API Key' };
  }

  // 如果有预设 prompt，将其添加到消息前
  const fullMessage = presetPrompt ? `${presetPrompt}\n\n用户问题：${message}` : message;

  const client = new DeepSeekClient(apiKey, baseUrl);

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
