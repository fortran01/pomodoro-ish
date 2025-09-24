// Web Worker for background timer functionality
// This worker runs in a separate thread and is not throttled by the browser

let intervalId = null;
let isRunning = false;

// Listen for messages from main thread
self.addEventListener('message', function(e) {
  const { type, data } = e.data;

  switch(type) {
    case 'start':
      if (!isRunning) {
        isRunning = true;
        intervalId = setInterval(() => {
          // Send tick message back to main thread every second
          self.postMessage({
            type: 'tick',
            timestamp: Date.now()
          });
        }, 1000);
      }
      break;

    case 'stop':
      if (isRunning && intervalId) {
        clearInterval(intervalId);
        intervalId = null;
        isRunning = false;
      }
      break;

    case 'status':
      self.postMessage({
        type: 'status',
        isRunning: isRunning
      });
      break;
  }
});

// Send ready message when worker is loaded
self.postMessage({
  type: 'ready'
});