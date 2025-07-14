// Timer Application
class TimerApp {
	constructor() {
		this.timers = [];
		this.intervalId = null;
		this.currentTab = "active";
		this.init();
	}

	init() {
		this.loadTimers();
		this.setupEventListeners();
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
		if (timer && timer.status !== "done") {
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
			timer.timeSpent = timer.totalTime - timer.remainingTime;
			timer.status = "done";
			timer.remainingTime = 0;
			this.saveTimers();
			this.render();
			this.showNotification(timer.label);
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

	// Timer countdown logic
	startMainLoop() {
		this.intervalId = setInterval(() => {
			let hasRunningTimers = false;

			this.timers.forEach((timer) => {
				if (timer.status === "running") {
					hasRunningTimers = true;
					timer.remainingTime--;
					timer.timeSpent++;

					if (timer.remainingTime <= 0) {
						timer.remainingTime = 0;
						timer.status = "done";
						this.showNotification(timer.label);
					}
				}
			});

			if (hasRunningTimers) {
				this.saveTimers();
				this.updateTimerDisplays();
			}
		}, 1000);
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

		// Show time spent for done timers, remaining time for active timers
		const displayTime =
			timer.status === "done" ? timer.timeSpent : timer.remainingTime;
		const timeLabel = timer.status === "done" ? "Time spent: " : "";

		return `
            <div class="timer-item ${statusClass}">
                <input type="checkbox" class="timer-checkbox" data-id="${
									timer.id
								}">
                <div class="timer-info">
                    <div class="timer-label">${timer.label}</div>
                    <div class="timer-time">${timeLabel}${this.formatTime(
			displayTime
		)}</div>
                </div>
                <div class="timer-status status-${
									timer.status
								}">${statusText}</div>
                <div class="timer-controls">
                    ${
											timer.status !== "done"
												? `
                        <button class="start-btn" onclick="app.startTimer('${
													timer.id
												}')" ${timer.status === "running" ? "disabled" : ""}>
                            Start
                        </button>
                        <button class="pause-btn" onclick="app.pauseTimer('${
													timer.id
												}')" ${timer.status === "paused" ? "disabled" : ""}>
                            Pause
                        </button>
                        <button class="done-btn" onclick="app.markTimerAsDone('${
													timer.id
												}')">
                            Mark as Done
                        </button>
                    `
												: ""
										}
                    <button class="delete-btn" onclick="app.deleteTimer('${
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

				// Show time spent for done timers, remaining time for active timers
				const displayTime =
					timer.status === "done" ? timer.timeSpent : timer.remainingTime;
				const timeLabel = timer.status === "done" ? "Time spent: " : "";
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

		activeBtn.disabled =
			this.timers.filter((t) => t.status !== "done").length === 0;
		doneBtn.disabled =
			this.timers.filter((t) => t.status === "done").length === 0;
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
					durationInput.value = "";
				}
			});

		// Enter key for timer creation
		document.getElementById("timer-label").addEventListener("keypress", (e) => {
			if (e.key === "Enter") {
				document.getElementById("create-timer-btn").click();
			}
		});

		document
			.getElementById("timer-duration")
			.addEventListener("keypress", (e) => {
				if (e.key === "Enter") {
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

		// Request notification permission
		if ("Notification" in window && Notification.permission === "default") {
			Notification.requestPermission();
		}
	}
}

// Initialize the app
const app = new TimerApp();
