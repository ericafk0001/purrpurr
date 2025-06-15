(function () {
  let lastModified = Date.now();

  // Check for changes every 2 seconds
  setInterval(async () => {
    try {
      const response = await fetch("/last-modified");
      const serverLastModified = await response.json();

      if (serverLastModified > lastModified) {
        lastModified = serverLastModified;
        window.location.reload();
      }
    } catch (err) {
      console.log("Live reload check failed:", err);
    }
  }, 2000);
})();
