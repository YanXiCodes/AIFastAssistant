const { BrowserWindow, screen } = require('electron');
const path = require('path');
const { config } = require('./config-manager');

function createMainWindow() {
  const primaryDisplay = screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;

  // 默认窗口大小
  const windowWidth = 500;
  const windowHeight = 700;

  // 默认位置：屏幕右上角
  const defaultX = width - windowWidth - 20;
  const defaultY = 20;

  const win = new BrowserWindow({
    width: windowWidth,
    height: windowHeight,
    x: defaultX,
    y: defaultY,
    frame: false,
    transparent: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: true,
    show: false,
    backgroundColor: '#1e1e1e',
    webPreferences: {
      preload: path.join(__dirname, '../preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  // 恢复上次的窗口位置和大小
  const savedBounds = config.get('windowBounds');
  if (savedBounds) {
    win.setBounds(savedBounds);
  }

  // 恢复透明度设置
  const savedOpacity = config.get('windowOpacity');
  if (savedOpacity) {
    win.setOpacity(savedOpacity / 100);
  }

  // 失焦行为
  win.on('blur', () => {
    if (config.get('hideOnBlur')) {
      win.hide();
    }
  });

  // 保存窗口位置和大小
  win.on('close', () => {
    config.set('windowBounds', win.getBounds());
  });

  // 加载页面
  win.loadFile(path.join(__dirname, '../renderer/index.html'));

  // 确保窗口始终置顶
  win.setAlwaysOnTop(true, 'screen-saver');

  // 窗口显示时确保置顶
  win.on('show', () => {
    win.setAlwaysOnTop(true, 'screen-saver');
    win.focus();
  });

  return win;
}

module.exports = { createMainWindow };
