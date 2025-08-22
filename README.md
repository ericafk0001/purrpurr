# PurrPurr.io

A multiplayer survival IO game inspired by moomoo.io where players gather resources, build defenses, and engage in combat.

P.S You may look at a green grid screen for a bit as the server starts up. Check back in 1-2 minutes and you should be able to play!

## 🎮 Game Features

- Real-time multiplayer combat with lag compensation
- Build walls and place spikes to defend your territory
- Smooth player movement and attack animations
- Chat system
- Inventory system with multiple items:
  - Hammer: Your primary weapon for combat and breaking structures
  - Apple: Restore health when needed
  - Walls: Create defensive barriers
  - Spikes: Set traps for your enemies
  - More in future

## 🛠️ Technical Features

- Client-side prediction for responsive controls
- Server-side validation to prevent cheating
- Interpolated movement for smooth gameplay
- Adaptive netcode for varying network conditions
- Mobile-friendly touch controls

## 🚀 Getting Started

1. Install dependencies:

```bash
npm install
```

2. Start the server:

```bash
node server.js
```

3. Open `http://localhost:3000` in your browser to play

## 🎯 How to Play

- WASD or Arrow Keys to move
- Left Click to attack/use items
- Numbers 1-4 to switch items
- Press Enter to chat
- Build walls and spikes strategically
- Team up or fight other players
- Survive and dominate!

## 🔧 Development

Built with:

- Socket.IO for real-time networking
- HTML5 Canvas for rendering
- Express.js for the server

## 🤝 Contributing

Feel free to contribute by submitting issues and pull requests!

## 📝 License

MIT License
