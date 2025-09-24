// Timer Application
class TimerApp {
  constructor() {
    this.timers = [];
    this.intervalId = null;
    this.currentTab = "active";
    this.worker = null;
    this.lastTickTime = Date.now();
    this.isPageVisible = !document.hidden;
    this.init();
  }

  init() {
    this.loadTimers();
    this.setupEventListeners();
    this.setupWorker();
    this.setupPageVisibility();
    this.startMainLoop();
    this.render();
  }

  // localStorage wrapper functions
  getTimers() {
    try {
      const stored = localStorage.getItem("pomodoro-timers");
      return stored ? JSON.parse(stored) : [];
    } catch (error) {
      console.error("Error loading timers:", error);
      return [];
    }
  }

  saveTimers() {
    try {
      localStorage.setItem("pomodoro-timers", JSON.stringify(this.timers));
    } catch (error) {
      console.error("Error saving timers:", error);
    }
  }

  loadTimers() {
    this.timers = this.getTimers();
    // Initialize timeSpent for existing timers that don't have it
    this.timers.forEach((timer) => {
      if (timer.timeSpent === undefined) {
        if (timer.status === "done") {
          // For done timers, calculate time spent based on total time
          timer.timeSpent = timer.totalTime;
        } else {
          // For active timers, calculate time spent based on elapsed time
          timer.timeSpent = timer.totalTime - timer.remainingTime;
        }
      }
    });
    this.saveTimers();
  }

  // Timer creation
  createTimer(label, durationMinutes) {
    const timer = {
      id: Date.now().toString(),
      label: label.trim(),
      totalTime: durationMinutes * 60,
      remainingTime: durationMinutes * 60,
      timeSpent: 0,
      status: "paused",
      createdAt: new Date().toISOString(),
    };

    this.timers.push(timer);
    this.saveTimers();
    this.render();
  }

  // Timer controls
  startTimer(id) {
    const timer = this.timers.find((t) => t.id === id);
    if (timer && timer.status !== "done" && timer.status !== "completed") {
      timer.status = "running";
      this.saveTimers();
      this.render();
    }
  }

  pauseTimer(id) {
    const timer = this.timers.find((t) => t.id === id);
    if (timer && timer.status === "running") {
      timer.status = "paused";
      this.saveTimers();
      this.render();
    }
  }

  markTimerAsDone(id) {
    const timer = this.timers.find((t) => t.id === id);
    if (timer && timer.status !== "done") {
      const wasCompleted = timer.status === "completed";
      timer.timeSpent = timer.totalTime - timer.remainingTime;
      timer.status = "done";
      timer.remainingTime = 0;
      this.saveTimers();
      this.render();
      // Don't show notification again if timer was already completed
      if (!wasCompleted) {
        this.showNotification(timer.label);
      }
    }
  }

  deleteTimer(id) {
    this.timers = this.timers.filter((t) => t.id !== id);
    this.saveTimers();
    this.render();
  }

  // Bulk delete
  bulkDelete(tab) {
    const checkboxes = document.querySelectorAll(
      `#${tab}-timers-list .timer-checkbox:checked`
    );
    const idsToDelete = Array.from(checkboxes).map((cb) => cb.dataset.id);

    this.timers = this.timers.filter((t) => !idsToDelete.includes(t.id));
    this.saveTimers();
    this.render();
  }

  // Select all functionality
  selectAllTimers(tab) {
    const checkboxes = document.querySelectorAll(
      `#${tab}-timers-list .timer-checkbox`
    );
    const selectAllBtn = document.getElementById(`select-all-${tab}-btn`);

    const allChecked = Array.from(checkboxes).every((cb) => cb.checked);

    checkboxes.forEach((cb) => {
      cb.checked = !allChecked;
    });

    // Update button text and bulk delete button
    selectAllBtn.textContent = allChecked ? "Select All" : "Deselect All";
    this.updateBulkDeleteButtons();
  }

  // Timer countdown logic
  startMainLoop() {
    this.intervalId = setInterval(() => {
      this.processTimerTick();
    }, 1000);
  }

  processTimerTick() {
    const now = Date.now();
    const timeDiff = Math.floor((now - this.lastTickTime) / 1000);
    this.lastTickTime = now;

    let hasRunningTimers = false;

    this.timers.forEach((timer) => {
      if (timer.status === "running") {
        hasRunningTimers = true;
        // Handle multiple seconds if tab was in background
        const secondsToSubtract = Math.max(1, timeDiff);
        timer.remainingTime -= secondsToSubtract;
        timer.timeSpent += secondsToSubtract;

        if (timer.remainingTime <= 0) {
          timer.remainingTime = 0;
          timer.status = "completed";
          this.showNotification(timer.label);
        }
      }
    });

    if (hasRunningTimers) {
      this.saveTimers();
      this.updateTimerDisplays();
    }

    // Update worker status based on running timers
    this.updateWorkerStatus(hasRunningTimers);
  }

  // Web Worker setup and management
  setupWorker() {
    if (typeof Worker !== 'undefined') {
      this.worker = new Worker('timer-worker.js');

      this.worker.addEventListener('message', (e) => {
        const { type } = e.data;

        switch(type) {
          case 'ready':
            console.log('Timer worker ready');
            break;
          case 'tick':
            // Process timer updates when receiving worker tick
            if (!this.isPageVisible) {
              this.processTimerTick();
            }
            break;
          case 'status':
            // Worker status received
            break;
        }
      });

      this.worker.addEventListener('error', (error) => {
        console.error('Worker error:', error);
        // Fallback to regular intervals if worker fails
      });
    }
  }

  updateWorkerStatus(hasRunningTimers) {
    if (this.worker) {
      if (hasRunningTimers && !this.isPageVisible) {
        this.worker.postMessage({ type: 'start' });
      } else {
        this.worker.postMessage({ type: 'stop' });
      }
    }
  }

  // Page Visibility API setup
  setupPageVisibility() {
    // Handle page visibility changes
    document.addEventListener('visibilitychange', () => {
      const wasVisible = this.isPageVisible;
      this.isPageVisible = !document.hidden;

      if (wasVisible && !this.isPageVisible) {
        // Page became hidden
        console.log('Page hidden - starting background worker');
        this.lastTickTime = Date.now();
        const hasRunningTimers = this.timers.some(timer => timer.status === 'running');
        this.updateWorkerStatus(hasRunningTimers);
      } else if (!wasVisible && this.isPageVisible) {
        // Page became visible
        console.log('Page visible - stopping background worker');
        this.updateWorkerStatus(false);
        // Sync up any time that passed while in background
        this.processTimerTick();
      }
    });

    // Handle window focus/blur for additional coverage
    window.addEventListener('blur', () => {
      this.lastTickTime = Date.now();
    });

    window.addEventListener('focus', () => {
      if (this.isPageVisible) {
        this.processTimerTick();
      }
    });
  }

  // Notification
  showNotification(timerLabel) {
    if ("Notification" in window && Notification.permission === "granted") {
      new Notification(`Timer Complete: ${timerLabel}`, {
        icon: "/favicon.ico",
        body: "Your timer has finished!",
      });
    }

    // Fallback: play a sound or show browser alert
    if (window.speechSynthesis) {
      const utterance = new SpeechSynthesisUtterance(
        `Timer ${timerLabel} complete`
      );
      utterance.rate = 0.8;
      utterance.pitch = 1.2;
      window.speechSynthesis.speak(utterance);
    }
  }

  // Time formatting
  formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs
      .toString()
      .padStart(2, "0")}`;
  }

  // UI Rendering
  render() {
    this.renderActiveTimers();
    this.renderDoneTimers();
    this.updateBulkDeleteButtons();
  }

  renderActiveTimers() {
    const container = document.getElementById("active-timers-list");
    const activeTimers = this.timers.filter((t) => t.status !== "done");

    if (activeTimers.length === 0) {
      container.innerHTML =
        '<div class="empty-state">No active timers. Create one above!</div>';
      return;
    }

    container.innerHTML = activeTimers
      .map((timer) => this.createTimerHTML(timer))
      .join("");
  }

  renderDoneTimers() {
    const container = document.getElementById("done-timers-list");
    const doneTimers = this.timers.filter((t) => t.status === "done");

    if (doneTimers.length === 0) {
      container.innerHTML =
        '<div class="empty-state">No completed timers yet.</div>';
      return;
    }

    container.innerHTML = doneTimers
      .map((timer) => this.createTimerHTML(timer))
      .join("");
  }

  createTimerHTML(timer) {
    const statusClass = timer.status === "done" ? "done" : "";
    const statusText =
      timer.status.charAt(0).toUpperCase() + timer.status.slice(1);

    // Show time spent for done/completed timers, remaining time for active timers
    const displayTime =
      timer.status === "done" || timer.status === "completed" ? timer.timeSpent : timer.remainingTime;
    const timeLabel = timer.status === "done" || timer.status === "completed" ? "Time spent: " : "";

    // Timer item classes
    const timerItemClasses = `bg-gray-50 border border-gray-200 rounded-xl p-6 mb-4 flex items-center gap-4 transition-all duration-200 hover:shadow-md hover:bg-white hover:transform hover:-translate-y-0.5 ${
      timer.status === "done" ? "bg-green-50 border-green-200" :
      timer.status === "completed" ? "bg-orange-50 border-orange-200" : ""
    }`;

    // Status classes
    const statusClasses = {
      running: "bg-green-100 text-green-800",
      paused: "bg-yellow-100 text-yellow-800",
      completed: "bg-orange-100 text-orange-800",
      done: "bg-blue-100 text-blue-800",
    };

    return `
            <div class="timer-item ${statusClass} ${timerItemClasses}">
                <input type="checkbox" class="timer-checkbox w-5 h-5 cursor-pointer" data-id="${
                  timer.id
                }" style="accent-color: #007aff;">
                <div class="timer-info flex-1">
                    <div class="timer-label text-xl font-semibold text-gray-800 mb-2">${
                      timer.label
                    }</div>
                    <div class="timer-time text-2xl font-bold font-roboto tracking-tight ${
                      timer.status === "done" ? "text-green-600" :
                      timer.status === "completed" ? "text-orange-600" : "text-accent"
                    }">${timeLabel}${this.formatTime(displayTime)}</div>
                </div>
                <div class="timer-status text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider ${
                  statusClasses[timer.status]
                }">${statusText}</div>
                <div class="timer-controls flex gap-2 flex-wrap">
                    ${
                      timer.status === "completed"
                        ? `
                        <button class="done-btn px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 bg-blue-500 text-white hover:bg-blue-600 hover:transform hover:-translate-y-0.5" onclick="app.markTimerAsDone('${
                          timer.id
                        }')">
                            Mark as Done
                        </button>
                    `
                        : timer.status !== "done"
                        ? `
                        <button class="start-btn px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 bg-green-500 text-white hover:bg-green-600 hover:transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none" onclick="app.startTimer('${
                          timer.id
                        }')" ${timer.status === "running" ? "disabled" : ""}>
                            Start
                        </button>
                        <button class="pause-btn px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 bg-yellow-500 text-white hover:bg-yellow-600 hover:transform hover:-translate-y-0.5 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:transform-none" onclick="app.pauseTimer('${
                          timer.id
                        }')" ${timer.status === "paused" ? "disabled" : ""}>
                            Pause
                        </button>
                        <button class="done-btn px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 bg-blue-500 text-white hover:bg-blue-600 hover:transform hover:-translate-y-0.5" onclick="app.markTimerAsDone('${
                          timer.id
                        }')">
                            Mark as Done
                        </button>
                    `
                        : ""
                    }
                    <button class="delete-btn px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 bg-red-500 text-white hover:bg-red-600 hover:transform hover:-translate-y-0.5" onclick="app.deleteTimer('${
                      timer.id
                    }')">
                        Delete
                    </button>
                </div>
            </div>
        `;
  }

  updateTimerDisplays() {
    const timerItems = document.querySelectorAll(".timer-item");
    timerItems.forEach((item) => {
      const checkbox = item.querySelector(".timer-checkbox");
      const timerId = checkbox.dataset.id;
      const timer = this.timers.find((t) => t.id === timerId);

      if (timer) {
        const timeDisplay = item.querySelector(".timer-time");
        const statusDisplay = item.querySelector(".timer-status");

        // Show time spent for done/completed timers, remaining time for active timers
        const displayTime =
          timer.status === "done" || timer.status === "completed" ? timer.timeSpent : timer.remainingTime;
        const timeLabel = timer.status === "done" || timer.status === "completed" ? "Time spent: " : "";
        timeDisplay.textContent = timeLabel + this.formatTime(displayTime);
        statusDisplay.textContent =
          timer.status.charAt(0).toUpperCase() + timer.status.slice(1);
        statusDisplay.className = `timer-status status-${timer.status}`;

        // Update button states
        const startBtn = item.querySelector(".start-btn");
        const pauseBtn = item.querySelector(".pause-btn");

        if (startBtn) startBtn.disabled = timer.status === "running";
        if (pauseBtn) pauseBtn.disabled = timer.status === "paused";

        // Update item class for done timers
        if (timer.status === "done") {
          item.classList.add("done");
        }
      }
    });
  }

  updateBulkDeleteButtons() {
    const activeBtn = document.getElementById("bulk-delete-btn");
    const doneBtn = document.getElementById("bulk-delete-done-btn");
    const selectAllActiveBtn = document.getElementById("select-all-active-btn");
    const selectAllDoneBtn = document.getElementById("select-all-done-btn");

    // Count selected items
    const selectedActive = document.querySelectorAll(
      "#active-timers-list .timer-checkbox:checked"
    ).length;
    const selectedDone = document.querySelectorAll(
      "#done-timers-list .timer-checkbox:checked"
    ).length;

    // Count total items
    const totalActive = this.timers.filter((t) => t.status !== "done").length;
    const totalDone = this.timers.filter((t) => t.status === "done").length;

    // Update delete button text and state
    activeBtn.textContent =
      selectedActive > 0
        ? `Delete Selected (${selectedActive})`
        : "Delete Selected";
    activeBtn.disabled = selectedActive === 0;

    doneBtn.textContent =
      selectedDone > 0
        ? `Delete Selected (${selectedDone})`
        : "Delete Selected";
    doneBtn.disabled = selectedDone === 0;

    // Update select all button text and state
    if (selectAllActiveBtn) {
      selectAllActiveBtn.disabled = totalActive === 0;
      selectAllActiveBtn.textContent =
        selectedActive === totalActive && totalActive > 0
          ? "Deselect All"
          : "Select All";
    }

    if (selectAllDoneBtn) {
      selectAllDoneBtn.disabled = totalDone === 0;
      selectAllDoneBtn.textContent =
        selectedDone === totalDone && totalDone > 0
          ? "Deselect All"
          : "Select All";
    }
  }

  // Tab switching
  switchTab(tab) {
    this.currentTab = tab;

    // Update tab buttons
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.classList.remove("active");
    });
    document.querySelector(`[data-tab="${tab}"]`).classList.add("active");

    // Update timer lists
    document.querySelectorAll(".timer-list").forEach((list) => {
      list.classList.remove("active");
    });
    document.getElementById(`${tab}-timers`).classList.add("active");
  }

  // Auto-completion functionality
  getUniquePreviousLabels() {
    const labels = this.timers.map((timer) => timer.label);
    return [...new Set(labels)].sort();
  }

  getUniquePreviousDurations() {
    const durations = this.timers.map((timer) =>
      Math.floor(timer.totalTime / 60)
    );
    return [...new Set(durations)].sort((a, b) => a - b);
  }

  showLabelSuggestions(inputValue) {
    const suggestions = this.getUniquePreviousLabels();
    const filtered = suggestions.filter((label) =>
      label.toLowerCase().includes(inputValue.toLowerCase())
    );

    const container = document.getElementById("label-suggestions");

    if (filtered.length === 0 || inputValue === "") {
      container.classList.add("hidden");
      return;
    }

    container.innerHTML = filtered
      .map(
        (label) =>
          `<div class="suggestion-item px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0" data-value="${label}">
        ${label}
      </div>`
      )
      .join("");

    container.classList.remove("hidden");
  }

  showDurationSuggestions(inputValue) {
    const suggestions = this.getUniquePreviousDurations();
    const filtered = suggestions.filter((duration) =>
      duration.toString().includes(inputValue)
    );

    const container = document.getElementById("duration-suggestions");

    if (filtered.length === 0 || inputValue === "") {
      container.classList.add("hidden");
      return;
    }

    container.innerHTML = filtered
      .map(
        (duration) =>
          `<div class="suggestion-item px-4 py-3 hover:bg-gray-100 cursor-pointer border-b border-gray-100 last:border-b-0" data-value="${duration}">
        ${duration} minutes
      </div>`
      )
      .join("");

    container.classList.remove("hidden");
  }

  hideSuggestions() {
    document.getElementById("label-suggestions").classList.add("hidden");
    document.getElementById("duration-suggestions").classList.add("hidden");
  }

  handleSuggestionKeydown(e, containerId) {
    const container = document.getElementById(containerId);
    if (container.classList.contains("hidden")) return;

    const suggestions = container.querySelectorAll(".suggestion-item");
    const highlighted = container.querySelector(".suggestion-item.highlighted");
    let currentIndex = highlighted
      ? Array.from(suggestions).indexOf(highlighted)
      : -1;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (highlighted) highlighted.classList.remove("highlighted");
        currentIndex = (currentIndex + 1) % suggestions.length;
        suggestions[currentIndex].classList.add("highlighted");
        suggestions[currentIndex].scrollIntoView({ block: "nearest" });
        break;

      case "ArrowUp":
        e.preventDefault();
        if (highlighted) highlighted.classList.remove("highlighted");
        currentIndex =
          currentIndex <= 0 ? suggestions.length - 1 : currentIndex - 1;
        suggestions[currentIndex].classList.add("highlighted");
        suggestions[currentIndex].scrollIntoView({ block: "nearest" });
        break;

      case "Enter":
        e.preventDefault();
        if (highlighted) {
          highlighted.click();
        } else if (suggestions.length > 0) {
          suggestions[0].click();
        }
        break;

      case "Escape":
        e.preventDefault();
        this.hideSuggestions();
        break;
    }
  }

  // Event listeners
  setupEventListeners() {
    // Create timer
    document
      .getElementById("create-timer-btn")
      .addEventListener("click", () => {
        const labelInput = document.getElementById("timer-label");
        const durationInput = document.getElementById("timer-duration");

        const label = labelInput.value.trim();
        const duration = parseInt(durationInput.value);

        if (label && duration > 0) {
          this.createTimer(label, duration);
          labelInput.value = "";
          durationInput.value = "25";
          this.hideSuggestions();
        }
      });

    // Auto-completion for label input
    const labelInput = document.getElementById("timer-label");
    labelInput.addEventListener("input", (e) => {
      this.showLabelSuggestions(e.target.value);
    });

    labelInput.addEventListener("focus", (e) => {
      this.showLabelSuggestions(e.target.value);
    });

    // Auto-completion for duration input
    const durationInput = document.getElementById("timer-duration");
    durationInput.addEventListener("input", (e) => {
      this.showDurationSuggestions(e.target.value);
    });

    durationInput.addEventListener("focus", (e) => {
      this.showDurationSuggestions(e.target.value);
    });

    // Handle suggestion clicks
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("suggestion-item")) {
        const value = e.target.dataset.value;
        const container = e.target.parentElement;

        if (container.id === "label-suggestions") {
          labelInput.value = value;
          labelInput.focus();
        } else if (container.id === "duration-suggestions") {
          durationInput.value = value;
          durationInput.focus();
        }

        this.hideSuggestions();
      } else if (!e.target.closest(".timer-creator")) {
        // Hide suggestions when clicking outside
        this.hideSuggestions();
      }
    });

    // Keyboard navigation for suggestions
    labelInput.addEventListener("keydown", (e) => {
      this.handleSuggestionKeydown(e, "label-suggestions");
    });

    durationInput.addEventListener("keydown", (e) => {
      this.handleSuggestionKeydown(e, "duration-suggestions");
    });

    // Enter key for timer creation
    document.getElementById("timer-label").addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        const suggestions = document.getElementById("label-suggestions");
        if (!suggestions.classList.contains("hidden")) {
          const firstSuggestion =
            suggestions.querySelector(".suggestion-item.highlighted") ||
            suggestions.querySelector(".suggestion-item");
          if (firstSuggestion) {
            firstSuggestion.click();
            return;
          }
        }
        document.getElementById("create-timer-btn").click();
      }
    });

    document
      .getElementById("timer-duration")
      .addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          const suggestions = document.getElementById("duration-suggestions");
          if (!suggestions.classList.contains("hidden")) {
            const firstSuggestion =
              suggestions.querySelector(".suggestion-item.highlighted") ||
              suggestions.querySelector(".suggestion-item");
            if (firstSuggestion) {
              firstSuggestion.click();
              return;
            }
          }
          document.getElementById("create-timer-btn").click();
        }
      });

    // Tab switching
    document.querySelectorAll(".tab-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        this.switchTab(btn.dataset.tab);
      });
    });

    // Bulk delete
    document.getElementById("bulk-delete-btn").addEventListener("click", () => {
      this.bulkDelete("active");
    });

    document
      .getElementById("bulk-delete-done-btn")
      .addEventListener("click", () => {
        this.bulkDelete("done");
      });

    // Select all buttons
    document
      .getElementById("select-all-active-btn")
      .addEventListener("click", () => {
        this.selectAllTimers("active");
      });

    document
      .getElementById("select-all-done-btn")
      .addEventListener("click", () => {
        this.selectAllTimers("done");
      });

    // Listen for checkbox changes to update button states
    document.addEventListener("change", (e) => {
      if (e.target.classList.contains("timer-checkbox")) {
        this.updateBulkDeleteButtons();
      }
    });

    // Request notification permission
    if ("Notification" in window && Notification.permission === "default") {
      Notification.requestPermission();
    }
  }
}

// Initialize the app
const app = new TimerApp();
