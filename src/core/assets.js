// Import core variables
import { config, items, assets } from "../utils/constants.js";

// Asset loading functions
/**
 * Loads image assets defined in the configuration and item definitions into the application.
 *
 * Initiates asynchronous loading of all assets specified in `config.assets` and item-specific assets (hammer, apple, wall). Updates the global `assets` object and load status for each asset upon completion or failure.
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
