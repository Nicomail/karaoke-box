const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket']
});

app.use(express.static(path.join(__dirname, 'public')));

app.get('/health', (req, res) => res.json({ status: 'ok' }));

let hostSocket = null;
const singers = new Map();

io.on('connection', (socket) => {
  console.log('Connexion:', socket.id);

  socket.on('register-host', () => {
    hostSocket = socket.id;
    console.log('Box connectée:', socket.id);
    socket.emit('host-confirmed', { singerCount: singers.size });
    singers.forEach((data, id) => {
      socket.emit('singer-joined', { singerId: id, name: data.name, singerCount: singers.size });
    });
  });

  socket.on('join-as-singer', ({ name }) => {
    singers.set(sock
