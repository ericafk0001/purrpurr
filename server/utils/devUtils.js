// Development utilities and live reload functionality
import fs from "fs";

export function setupLiveReload(app, __dirname) {
  let lastModified = Date.now();

  // Watch relevant directories for changes
  const watchDirs = [__dirname];
  watchDirs.forEach((dir) => {
    fs.watch(dir, (filename) => {
      if (filename && !filename.includes("node_modules")) {
        lastModified = Date.now();
      }
    });
  });

  // Add endpoint to check last modified time
  app.get("/last-modified", (req, res) => {
    res.json(lastModified);
  });

  return { lastModified };
}
