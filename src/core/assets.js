// Import core variables
import { config, items, assets } from "../utils/constants.js";

// Asset loading functions
/**
 * Asynchronously loads image assets from configuration and item definitions into the global assets object.
 *
 * Initiates loading of all images specified in `config.assets` and item assets (hammer, apple, wall, spike). Updates the global `assets` object and load status for each asset based on load success or failure.
 */
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
    spike: items.spike.asset, // Add spike asset loading
  };
  Object.entries(itemAssets).forEach(([key, path]) => {
    const img = new Image();
    img.onload = () => {
      assets[key] = img;
      assets.loadStatus[key] = true;
      console.log(`Loaded item asset: ${key}`);
    };
    img.onerror = (err) => {
      console.error(`Failed to load item asset: ${key}`, err);
      assets.loadStatus[key] = false;
    };
    img.src = path;
  });
}
