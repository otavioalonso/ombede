const { app, BrowserWindow } = require('electron');
const path = require('path');
const url = require('url');
const { spawn } = require('child_process');

let mainWindow;
let backendProcess;

function createWindow() {
    mainWindow = new BrowserWindow({width: 800, height: 600});

    mainWindow.loadURL(
    process.env.NODE_ENV === 'dev'
        ? 'http://localhost:5173'
        : `file://${path.join(__dirname, '../dist/index.html')}` // Built React app
    );

    if(process.env.NODE_ENV === 'dev') {
        mainWindow.webContents.openDevTools();
    }
    
    mainWindow.removeMenu();

    mainWindow.on('closed', function () {
        mainWindow = null
    })
}

app.on('ready', createWindow);

// Start backend server when Electron is ready
app.on('ready', () => {
    backendProcess = spawn('node',
        [path.join(__dirname, '../server/server.js')], {
            stdio: 'inherit',
            cwd: path.join(__dirname, '../server')
    });
});

// Ensure backend server is killed when Electron quits
app.on('will-quit', () => {
    if (backendProcess) {
        backendProcess.kill();
    }
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') {
        app.quit()
    }
});

app.on('activate', function () {
    if (mainWindow === null) {
        createWindow()
    }
});
