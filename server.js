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
  socket.on('register-host', () => {
    hostSocket = socket.id;
    socket.emit('host-confirmed', { singerCount: singers.size });
    singers.forEach((data, id) => {
      socket.emit('singer-joined', { singerId: id, name: data.name, singerCount: singers.size });
    });
  });

  socket.on('join-as-singer', ({ name }) => {
    singers.set(socket.id, { name: name || 'Chanteur' });
    if (hostSocket) {
      io.to(hostSocket).emit('singer-joined', {
        singerId: socket.id,
        name: singers.get(socket.id).name,
        singerCount: singers.size
      });
    }
    socket.emit('joined-confirmed', { singerId: socket.id });
  });

  socket.on('offer', ({ offer, singerId }) => {
    if (hostSocket) io.to(hostSocket).emit('offer', { offer, singerId });
  });

  socket.on('answer', ({ answer, singerId }) => {
    io.to(singerId).emit('answer', { answer });
  });

  socket.on('ice-candidate', ({ candidate, targetId }) => {
    io.to(targetId).emit('ice-candidate', { candidate, fromId: socket.id });
  });

  socket.on('disconnect', () => {
    if (socket.id === hostSocket) {
      hostSocket = null;
    } else if (singers.has(socket.id)) {
      const name = singers.get(socket.id).name;
      singers.delete(socket.id);
      if (hostSocket) {
        io.to(hostSocket).emit('singer-left', { singerId: socket.id, singerCount: singers.size });
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log('Serveur karaoke sur port ' + PORT);
});
