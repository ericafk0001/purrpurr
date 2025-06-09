const express = require("express");
const http = require("http");
const path = require("path");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Serve static files (including index.html) from this folder
app.use(express.static(path.join(__dirname)));

const config = {
  trees: {
    count: 10,
    radius: 20,
  },
};

const players = {};
const trees = [];

// Generate trees on server
function generateTrees() {
  for (let i = 0; i < config.trees.count; i++) {
    trees.push({
      x: Math.random() * 800, // canvas width
      y: Math.random() * 600, // canvas height
      radius: config.trees.radius,
    });
  }
}

generateTrees();

io.on("connection", (socket) => {
  console.log("A player connected:", socket.id);

  players[socket.id] = { x: 100, y: 100 };

  // Send both players and trees data to new player
  socket.emit("initGame", { players, trees });

  socket.broadcast.emit("newPlayer", { id: socket.id, x: 100, y: 100 });

  socket.on("playerMovement", (movement) => {
    const player = players[socket.id];
    if (player) {
      player.x = movement.x;
      player.y = movement.y;

      socket.broadcast.emit("playerMoved", {
        id: socket.id,
        x: player.x,
        y: player.y,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Player disconnected:", socket.id);
    delete players[socket.id];
    io.emit("playerDisconnected", socket.id);
  });
});

server.listen(3000, () => {
  console.log("Listening on port 3000");
});
