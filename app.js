'use strict';
const express = require('express');
const app = express();
const expressHbs = require('express-handlebars');
const WebSocket = require('ws');
const uuidv4 = require('uuid/v4');

// Views
app.engine('hbs', expressHbs({extname: 'hbs'}));
app.set('view engine', 'hbs');
app.set('views', __dirname + '/views');
app.use(express.static(__dirname + '/public'))

app.get('/', (req, res) => {
  res.render('index');
});

app.get('/viewer', (req, res) => {
  res.render('camera');
});

app.get('/control-room', (req, res) => {
  res.render('control_room');
});

// Webserver
let webServer = app.listen(3000, null, null, () => {
  let host = webServer.address().address;
  let port = webServer.address().port;
  console.log('Web server listening at http://%s:%s', host, port);
});

// WS Server
const wss = new WebSocket.Server({server: webServer});

// Handling client sub-groups
wss.clientGroups = {
  'cameras': new Set(),
  'controlRooms': new Set()
};

wss.cleanupClients = (subGroup, ws) => {
  // Clean up the sub-group clients
  for (let item of subGroup) {
    if (item.id === ws.id) {
      subGroup.delete(item);
      break;
    }
  }
}

// Initialise with 9 screens available
let freeScreens = [1, 2, 3, 4, 5, 6, 7, 8, 9];

wss.on('connection', function(ws, req) {
  let wss = this;
  ws.id = uuidv4();

  if (req.url === '/ws/control-room') {
    controlRoom(ws, wss);
  } else if (req.url === '/ws/viewer') {
    camera(ws, wss);
  } else {
    ws.on('error', (data) => {
      console.warn('Client disconnected: ' + data);
    });
    ws.on('close', (data) => {
      console.log('Connection closed: ' + data);
    });
    console.log(req.url);
    ws.close(1000, 'Unknown client', false);
  }

  function controlRoom(ws, wss) {
    // Register connection into sub group
    wss.clientGroups.controlRooms.add(ws);

    console.log('Control room connected ID: %s', ws.id);

    // When a new controlRoom connects force update from cameras
    wss.broadcastCameras('update');

    // A message event can and will only come from a control room
    ws.on('message', (data) => {
      data = JSON.parse(data);
      if (data.type === 'ping') {
        console.log('Incoming ping from control room: %s', ws.id);
      }
    });

    // The cameraEvent is triggered by cameras and broadcast to the control rooms
    ws.on('cameraEvent', function(data) {
      let dataObj = JSON.parse(data);
      console.log('Data from camera attached to screen %s: {center: %s, zoom:%s}', dataObj.screen, dataObj.payload.center, dataObj.payload.zoom);
      ws.send(data);
    })

    // When a camera disconnects the front-end should do something
    ws.on('disconnectCamera', function(screen) {
      let data = {
        type: 'disconnection',
        screen: screen
      };
      ws.send(JSON.stringify(data));
    });

    ws.on('close', (data) => {
      wss.cleanupClients(wss.clientGroups.controlRooms, ws);
      console.log('Removed control room ID: ' + ws.id);
    });

    ws.on('error', (data) => {
      wss.cleanupClients(wss.clientGroups.controlRooms, ws);
      console.warn('Disconnection of control room');
    });
  }

  function camera(ws, wss) {
    // Register connection into sub group
    wss.clientGroups.cameras.add(ws);
    freeScreens = freeScreens.sort();

    if (freeScreens.length) {
      // Connect the client to a screen
      ws.screenId = freeScreens.shift();
      console.log('New camera connection, assigned screen ' + ws.screenId);

      // Pass incoming data on to the control rooms
      ws.on('message', (data) => {
        data = JSON.parse(data);

        // Passthrough to control rooms (only if there are any)
        if (wss.clientGroups.controlRooms.size && data.type === 'position') {
          console.log('re-route to controlroom');
          wss.broadcastControlRooms(data, ws.screenId);
        }
      });

      // A connected client leaves
      ws.on('close', (data) => {
        wss.cleanupClients(wss.clientGroups.cameras, ws);
        freeScreens.indexOf(ws.screenId) === -1  && freeScreens.push(ws.screenId);
        console.log('Camera on screen ' + ws.screenId + ' is leaving');
        wss.broadcastControlRooms('close', ws.screenId);
      });
    } else {
      // Remove client without assigning screen
      // First param is a code for the reason connection closing (1000 = 'normal')
      ws.close(1000, 'lobby is full', false);

      // Server message
      ws.on('close', (data) => {
        console.log('turning client away because all screens are full');
      });
    }

    ws.on('error', (data) => {
      wss.cleanupClients(wss.clientGroups.cameras, ws);
      console.warn('Disconnection of camera');
    });
  }
});

// Method to broadcast to all control rooms
wss.broadcastControlRooms = (data, screen) => {
  wss.clientGroups.controlRooms.forEach((controlRoom) => {
    // Add screen id to data
    if (data.type === 'position') {
      data.screen = screen;
      let position = JSON.stringify(data);
      controlRoom.emit('cameraEvent', position);
    }
    if (data === 'close') {
      controlRoom.emit('disconnectCamera', screen);
    }
  });
};

// Method to broadcast to all cameras
wss.broadcastCameras = (signal) => {
  // Force all cameras to send coords
  if (signal === 'update') {
    wss.clientGroups.cameras.forEach((camera) => {
      camera.send(signal);
    });
  }
}