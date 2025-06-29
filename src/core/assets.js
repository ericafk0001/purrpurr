// Import core variables
import { config, items, assets } from "../utils/constants.js";

// Asset loading functions
// Modify loadAssets function to include apple
export function loadAssets() {
  Object.keys(config.assets).forEach((key) => {
    const img = new Image();
    img.onload = () => {
      assets[key] = img;
      assets.loadStatus[key] = true;
      console.log(`Loaded asset: ${key}`);
    };
    img.onerror = (err) => {
      console.error(`Failed to load asset: ${key}`, err);
      assets.loadStatus[key] = false;
    };
    img.src = config.assets[key];
  });

  const itemAssets = {
    hammer: items.hammer.asset,
    apple: items.apple.asset,
    wall: items.wall.asset, // Add this line to load wall asset
  };
  Object.entries(itemAssets).forEach(([key, path]) => {
    const img = new Image();
    img.onload = () => {
      assets[key] = img;
      assets.loadStatus[key] = true;
      console.log(`Loaded item asset: ${key}`);
    };
    img.src = path;
  });
}
