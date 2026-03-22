## README: Stream Chat Highlight
**Version 2**

This is a lightweight, standalone application designed to display and feature chat messages from both Twitch and YouTube simultaneously. It allows streamers to select specific viewer comments to highlight on their broadcast through a clean, interactive overlay.

---

### New Features in this Version
* **Multi-Platform Support**: Includes native binaries for macOS (Intel and Apple Silicon), Windows (x64), and Linux (x64).
* **Auto-Pause Scrolling**: The dashboard automatically pauses live updates when the user scrolls down to read older messages, preventing the list from jumping.
* **Status Indicators**: Real-time visual feedback in the settings menu (Green/Gray dots) to confirm connection states for each platform.
* **Site Filtering**: A dropdown menu to toggle between viewing All Chat, Twitch Only, or YouTube Only.
* **Persistent Configuration**: User settings are saved to a local config.txt file and automatically reloaded on launch.

---

### Installation and Setup

#### 1. Running the Application
Launch the executable corresponding to your operating system:
* **macOS**: Double-click `stream-chat-highlight-macos`.
* **Windows**: Run `stream-chat-highlight-win.exe`.
* **Linux**: Open a terminal in the folder and run `chmod +x stream-chat-highlight-linux` followed by `./stream-chat-highlight-linux`.

#### 2. Connection Configuration
1. Open a web browser to `http://localhost:3000`.
2. Click the **Settings** icon (gear symbol).
3. Enter your **Twitch Username**.
4. Enter your **YouTube Channel ID** (The unique string starting with UC).
5. Click **Update & Save**. The status indicators will update once the connection is initialized.

#### 3. OBS Integration
* **Broadcast Overlay**: Create a new **Browser Source** in OBS. Set the URL to `http://localhost:3000/overlay` and the dimensions to `1920x1080`.
* **Internal Dashboard**: Go to **Docks > Custom Browser Docks** in OBS. Create a dock titled "Chat Manager" with the URL `http://localhost:3000`. This allows you to manage the chat directly within the OBS interface.

---

### Controls and Interface
* **Feature Message**: Click any message in the dashboard to send it to the OBS Overlay.
* **Clear Overlay**: Click the red button to remove the currently featured message from the stream.
* **Clear Log**: Click the gray button to wipe the dashboard history without affecting the overlay.
* **Pause Feed**: Scroll down within the chat log to pause incoming messages.
* **Resume Feed**: Click the **Resume Live Chat** button (Up Arrow) to return to the top and resume live updates.

---

### Linux Requirements
For Linux users, ensure the application has proper execution and write permissions for the directory it resides in. The application requires a standard Node.js environment or the bundled runtime provided in the binary. If the application fails to launch, check that no other process is utilizing Port 3000.

---

### Development and Rebuilding
To modify the source code or rebuild the binaries:

1. **Install Dependencies**: Run `npm install`.
2. **Version Dating**: Manually update the `BUILD_DATE` constant in `server.js`.
3. **Compilation**: Execute `npx pkg .` to generate new binaries.
*Note: The project configuration is set to include all node_modules as assets to ensure the virtual snapshot filesystem functions correctly across different environments.*

---

**Would you like me to generate a separate "Quick Start" text file specifically for the Linux version to include in the distribution folder?**
