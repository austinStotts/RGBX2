const { app, BrowserWindow, ipcMain, webContents, dialog } = require('electron');
const { imageSize } = require('image-size')
let fs = require('fs');
const path = require('node:path');



if (require('electron-squirrel-startup')) {
  app.quit();
}

let mainWindow;

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 720,
    webPreferences: {
      preload: MAIN_WINDOW_PRELOAD_WEBPACK_ENTRY,
    },
  });
  mainWindow.loadURL(MAIN_WINDOW_WEBPACK_ENTRY);
  
};



app.whenReady().then(() => {
  createWindow();

  ipcMain.on('save-canvas', (event, data, fileType) => {

    if(fileType == 'png') {
      let downloadpath = app.getPath('downloads');
      let filename = 'rgbx2-' + Date.now() + '.png';
      let filePath = path.join(downloadpath, filename);
      let base64Data = data.replace(/^data:image\/png;base64,/, '');
      let imageBuffer = Buffer.from(base64Data, 'base64');

      try {
        fs.writeFileSync(filePath, imageBuffer);
        console.log('saved');
      } catch (error) {
        console.log(error);
      }
    } else if (fileType == 'jpg') {
      let downloadpath = app.getPath('downloads');
      let filename = 'rgbx2-' + Date.now() + '.jpg';
      let filePath = path.join(downloadpath, filename);
      let base64Data = data.replace(/^data:image\/jpeg;base64,/, '');
      let imageBuffer = Buffer.from(base64Data, 'base64');

      try {
        fs.writeFileSync(filePath, imageBuffer);
        console.log('saved');
      } catch (error) {
        console.log(error);
      }
    } else {
      let downloadpath = app.getPath('downloads');
      let filename = 'rgbx2-' + Date.now() + '.png';
      let filePath = path.join(downloadpath, filename);
      let base64Data = data.replace(/^data:image\/png;base64,/, '');
      let imageBuffer = Buffer.from(base64Data, 'base64');

      try {
        fs.writeFileSync(filePath, imageBuffer);
        console.log('saved');
      } catch (error) {
        console.log(error);
      }
    }
    


    // console.log(downloadpath);
    // console.log(filename);
  })

  ipcMain.handle('open-dialog', async () => {
    console.log('opening!')
    let result = await dialog.showOpenDialog({
      title: 'Select image to open',
      buttonLabel: 'Open',
      properties: ['openFile'],
      filters: [{ name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] }]
    })

    if(result.canceled) {
      console.log('error opening that file');
      return null;
    }

    let filepath = result.filePaths[0];

    let imageBuffer = await fs.readFileSync(filepath);
    let base64Image = imageBuffer.toString('base64');
    let ext = path.extname(filepath).toLowerCase().slice(1);

    return {
      data: base64Image,
      filepath: filepath,
      mimeType: `image/${ext === 'jpg' ? 'jpeg' : ext}`
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
  mainWindow.webContents.openDevTools();
});



app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});


// setInterval(() => { console.log(file) }, 2000)