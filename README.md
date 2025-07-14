# Pomodoro-ish Timer

A modern, multi-timer Pomodoro application that runs entirely in the browser with localStorage persistence.

## Features

- **Multiple Timers**: Create and manage multiple timers simultaneously
- **Default Pomodoro Duration**: Quick timer creation with 25-minute default
- **Manual Completion**: Mark timers as done even before they finish
- **Time Tracking**: See actual time spent on completed timers
- **Persistent Storage**: All timers are saved to localStorage and persist between sessions
- **Real-time Countdown**: Visual countdown with automatic status updates
- **Tab Organization**: Separate tabs for active and completed timers
- **Bulk Operations**: Select and delete multiple timers at once
- **Responsive Design**: Works on desktop and mobile devices
- **Notifications**: Browser notifications and speech synthesis when timers complete
- **Modern UI**: Clean, gradient-based design with smooth animations

## Usage

1. **Create a Timer**: Enter a label and duration (defaults to 25 minutes), then click "Create Timer"
2. **Control Timers**: Use Start/Pause buttons to control individual timers
3. **Manual Completion**: Use "Mark as Done" button to complete timers early
4. **Monitor Progress**: Watch the real-time countdown and status indicators
5. **Track Time**: Completed timers show actual time spent
6. **Organize**: Switch between "Active Timers" and "Done Timers" tabs
7. **Bulk Delete**: Select multiple timers and delete them together

## Timer States

- **Paused**: Timer is created but not running (orange status)
- **Running**: Timer is actively counting down (green status)  
- **Done**: Timer has completed (blue status) - shows "Time spent: XX:XX"

## Timer Controls

- **Start**: Begin countdown for paused timers
- **Pause**: Pause running timers
- **Mark as Done**: Manually complete active timers (tracks actual time spent)
- **Delete**: Remove individual timers

## Technical Implementation

- **Frontend**: Vanilla HTML, CSS, and JavaScript
- **Storage**: Browser localStorage for persistence
- **Architecture**: Object-oriented JavaScript with a single TimerApp class
- **Time Tracking**: Tracks both remaining time and actual time spent
- **Responsive**: CSS Grid and Flexbox for responsive layout
- **Accessibility**: Proper semantic HTML and keyboard navigation

## Files

- `index.html`: Main HTML structure
- `style.css`: All styling and responsive design
- `app.js`: Complete application logic and timer management
- `plans/`: Implementation planning documents

## Deployment

This application is designed to run on GitHub Pages:

1. Push all files to a GitHub repository
2. Enable GitHub Pages in repository settings
3. The app will be available at `https://username.github.io/repository-name`

## Browser Compatibility

- Modern browsers with localStorage support
- Notification API support (optional)
- Speech Synthesis API support (optional)

No external dependencies required - runs entirely with vanilla web technologies! 