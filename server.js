const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: '*' },
  // Reconnexion automatique compatible Railway
  pingTimeout: 60000,
  pingInterval: 25000,
  transports: ['polling', 'websocket']
});

app.use(express.static(path.join(__dirname, 'public')));

// Health check pour Railway
app.get('/health', (req, res) => res.json({ status: 'ok' }));

// Credentials TURN sécurisés
app.get('/turn-credentials', async (req, res) => {
  try {
    const response = await fetch(
      `https://karaoke.metered.live/api/v1/turn/credentials?apiKey=rb7yslw8x5D8Z9j_4A1MQMKxG5P90Ru7DbYNenCaswjy1qAO`
    );
    const data = await response.json();
    res.json(data);
  } catch(e) {
    res.json([{ urls: 'stun:stun.l.google.com:19302' }]);
  }
});

let hostSocket = null;
const singers = new Map();

io.on('connection', (socket) => {
  console.log('Connexion:', socket.id);

  socket.on('register-host', () => {
    hostSocket = socket.id;
    console.log('Box connectée:', socket.id);
    socket.emit('host-confirmed', { singerCount: singers.size });
    // Renvoi la liste des singers déjà connectés si la box se reconnecte
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
      console.log('Box déconnectée');
    } else if (singers.has(socket.id)) {
      const name = singers.get(socket.id).name;
      singers.delete(socket.id);
      console.log('Singer parti:', name);
      if (hostSocket) {
        io.to(hostSocket).emit('singer-left', { singerId: socket.id, singerCount: singers.size });
      }
    }
  });
});

// PORT dynamique Railway (obligatoire) ou 3000 en local
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`🎤 Serveur karaoké sur le port ${PORT}`);
});
