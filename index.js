const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');

const app = express();
const port = process.env.PORT || 10000;

// Health check endpoint for Render/Railway
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

app.get('/', (req, res) => {
  res.status(200).send('Relay Server is running!');
});

// Create HTTP Server
const server = http.createServer(app);

// Create WebSocket Server attached to the HTTP server
const wss = new WebSocketServer({ server });

// Keep track of connected clients
const clients = new Map();

wss.on('connection', (ws, req) => {
  console.log('New client connected');

  // A new client might want to register their ID upon connection
  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message);
      
      // Register logic: expects { type: "register", id: "user-uuid" }
      if (data.type === 'register' && data.id) {
        clients.set(data.id, ws);
        ws.userId = data.id;
        console.log(`User registered: ${data.id}`);
        return;
      }

      // Relay logic: expects { to: "user-uuid", type: "xxx", payload: {} }
      if (data.to) {
        const targetClient = clients.get(data.to);
        if (targetClient && targetClient.readyState === 1) { // 1 = OPEN
          targetClient.send(message.toString());
          console.log(`Relayed message from ${ws.userId} to ${data.to}`);
        } else {
          console.log(`Target ${data.to} not found or disconnected`);
          // Optional: Send error back
          ws.send(JSON.stringify({
            type: 'error',
            message: 'Target user is offline or not found on relay server'
          }));
        }
      } else {
        // Broadcast to all (for general chat or presence fallback)
        // Usually, point-to-point is preferred, but broadcast is here just in case.
        wss.clients.forEach((client) => {
          if (client !== ws && client.readyState === 1) {
            client.send(message.toString());
          }
        });
      }
    } catch (e) {
      console.error('Invalid JSON received:', message.toString());
    }
  });

  ws.on('close', () => {
    if (ws.userId) {
      clients.delete(ws.userId);
      console.log(`User disconnected: ${ws.userId}`);
    } else {
      console.log('Unknown client disconnected');
    }
  });
  
  ws.on('error', console.error);
});

server.listen(port, () => {
  console.log(`Relay server started on port ${port}`);
});
