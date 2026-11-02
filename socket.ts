// server.ts
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';

// --- 1. Existing Express app ---
const app = express();

// Serve the HTML/JS/CSS in ./public at the root URL
app.use(express.static(path.join(__dirname, 'public')));

// Example REST route to show it coexists with Socket.IO
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

// --- 2. Wrap it in an http.Server ---
const httpServer = createServer(app);

// --- 3. Attach Socket.IO to the HTTP server ---
// Typed events give you autocompletion and compile-time safety on both sides.
interface ServerToClientEvents {
  message: (payload: { from: string; text: string; time: string }) => void;
  userCount: (count: number) => void;
}

interface ClientToServerEvents {
  message: (payload: { from: string; text: string }) => void;
}

const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    // Same-origin in this example, but required if your HTML is served elsewhere
    origin: 'http://localhost:3000',
    methods: ['GET', 'POST'],
  },
  // Optional tuning:
  // pingTimeout: 20000,
  // connectionStateRecovery: {}, // enables automatic reconnect with missed events
});

// --- 4. Handle connections ---
io.on('connection', (socket) => {
  console.log(`🟢 connected: ${socket.id} (total: ${io.engine.clientsCount})`);

  // Tell everyone the current user count
  io.emit('userCount', io.engine.clientsCount);

  // Receive a message from this client, broadcast to all (including sender)
  socket.on('message', (payload) => {
    const enriched = {
      ...payload,
      time: new Date().toISOString(),
    };
    io.emit('message', enriched);
  });

  // Optional: join a room for targeted broadcasting
  socket.join('general');

  socket.on('disconnect', (reason) => {
    console.log(`🔴 disconnected: ${socket.id} (${reason})`);
    io.emit('userCount', io.engine.clientsCount);
  });
});

// --- 5. Listen with the HTTP server, NOT app.listen ---
const PORT = 3000;
httpServer.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
