// Development utilities and live reload functionality
import fs from "fs";

/**
 * Sets up live reload functionality by watching a directory for file changes and exposing a timestamp endpoint.
 *
 * Watches the specified directory for changes (excluding "node_modules") and updates a `lastModified` timestamp whenever a change is detected. Adds a `/last-modified` endpoint to the provided Express app, which returns the current `lastModified` timestamp in JSON format.
 *
 * @param {object} app - The Express application instance to which the endpoint will be added.
 * @param {string} __dirname - The directory path to watch for file changes.
 * @returns {{ lastModified: number }} An object containing the current last modified timestamp.
 */
export function setupLiveReload(app, __dirname) {
  let lastModified = Date.now();

  // Watch relevant directories for changes
  const watchDirs = [__dirname];
  watchDirs.forEach((dir) => {
    try {
      fs.watch(dir, { recursive: true }, (eventType, filename) => {
        if (
          filename &&
          !filename.includes("node_modules") &&
          !filename.startsWith(".git") &&
          (filename.endsWith(".js") ||
            filename.endsWith(".html") ||
            filename.endsWith(".css"))
        ) {
          lastModified = Date.now();
        }
      });
    } catch (error) {
      console.warn(`Failed to watch directory ${dir}:`, error);
    }
  });

  // Add endpoint to check last modified time
  app.get("/last-modified", (req, res) => {
    try {
      res.json({
        lastModified,
        timestamp: new Date(lastModified).toISOString(),
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get last modified time" });
    }
  });

  return { lastModified };
}
