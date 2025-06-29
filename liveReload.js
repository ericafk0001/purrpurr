(function () {
  // Only enable live reload in development
  if (window.location.hostname === "localhost") {
    let lastModified = Date.now();

    // Check for changes every 2 seconds
    setInterval(async () => {
      try {
        const response = await fetch("/last-modified");
        if (!response.ok) throw new Error("Live reload not available");

        const serverLastModified = await response.json();
        if (serverLastModified > lastModified) {
          lastModified = serverLastModified;
          window.location.reload();
        }
      } catch (err) {
        // Silent fail in production or if endpoint unavailable
        console.debug("Live reload not available:", err);
      }
    }, 2000);
  }
})();
