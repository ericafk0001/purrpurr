// Import configuration and items
import { gameConfig } from "../config/config.js";
import { gameItems } from "../config/items.js";

// Core game configuration and globals
export const config = gameConfig;
config.collision.debug = config.collision.debugEnabled; // initialize debug state

export const canvas = document.getElementById("gameCanvas");
export const ctx = canvas.getContext("2d");
export const socket = io(
  location.hostname === "localhost"
    ? "http://localhost:3000"
    : "https://purrpurr-server.onrender.com"
);

// Use the imported gameItems
export const items = gameItems;

// Game state variables
export let players = {};
export let myPlayer = null;
export let trees = [];
export let stones = [];
export let walls = [];

// Input state
export const keys = { w: false, a: false, s: false, d: false };

// Camera
export const camera = {
  x: 0,
  y: 0,
};

export const targetCamera = {
  x: 0,
  y: 0,
};

// Assets
export const assets = {
  loadStatus: {
    player: false,
    tree: false,
    stone: false,
  },
};

// Setter functions for variables that need to be reassigned from other modules
export function setPlayers(newPlayers) {
  players = newPlayers;
}

export function setMyPlayer(player) {
  myPlayer = player;
}

export function setTrees(newTrees) {
  trees = newTrees;
}

export function setStones(newStones) {
  stones = newStones;
}

export function setWalls(newWalls) {
  walls = newWalls;
}
