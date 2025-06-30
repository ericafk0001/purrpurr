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
export let spikes = [];

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
    wall: false,
    spike: false,
  },
};

/**
 * Replaces the current players object with a new set of players.
 * @param {Object} newPlayers - The updated players object.
 */
export function setPlayers(newPlayers) {
  players = newPlayers;
}

/**
 * Updates the current player's state.
 * @param {object|null} player - The new player object or null to clear the current player.
 */
export function setMyPlayer(player) {
  myPlayer = player;
}

/**
 * Updates the array of tree objects in the game state.
 * @param {Array} newTrees - The new array of tree objects to set.
 */
export function setTrees(newTrees) {
  trees = newTrees;
}

/**
 * Updates the global stones array with a new set of stone objects.
 * @param {Array} newStones - The new array of stone objects to assign.
 */
export function setStones(newStones) {
  stones = newStones;
}

/**
 * Replaces the current array of wall objects in the game state.
 * @param {Array} newWalls - The new array of wall objects.
 */
export function setWalls(newWalls) {
  walls = newWalls;
}

/**
 * Replaces the global array of spike objects with a new array.
 * @param {Array} newSpikes - The updated list of spike objects for the game state.
 */
export function setSpikes(newSpikes) {
  spikes = newSpikes;
}
