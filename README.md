# Stream Chat Highlight

A lightweight, standalone chat featuring tool for Twitch streamers. Highlight specific chat messages on your stream with full support for Twitch, 7TV, and BTTV emotes, as well as official chatter badges.

---

## For the User: Setup and Usage

You do not need Node.js or any programming knowledge to use this.

### 1. Launch the App
* Double-click the `twitch-chat-display-macos` (or `.exe` on Windows).
* A terminal window will open showing that the server is active. Keep this window open while you are streaming.

### 2. Connect to Your Channel
* Open your web browser and go to: `http://localhost:3000`
* In the top bar, type your Twitch Username and press Enter.
* The app will automatically remember your channel the next time you open it.

### 3. Add to OBS
* **The Dashboard (Control Panel):**
    * In OBS, go to View > Docks > Custom Browser Docks...
    * Name it "Chat Control" and enter the URL: `http://localhost:3000`
    * Click Apply. You can now dock this window anywhere in your OBS layout.
* **The Overlay (Stream View):**
    * Add a new Browser Source to your scene.
    * Set the URL to: `http://localhost:3000/overlay`
    * Set the width to 1920 and height to 1080.

### 4. Featuring Messages
* When someone chats, their message appears in your Dashboard.
* Click any message to make it appear on stream.
* Click Clear Overlay to smoothly fade the message out.

---

## For the Developer: Build Process

If you modify the code and need to generate a new standalone executable, follow these steps.

### Prerequisites
* Node.js (Version 18 or higher recommended).
* The project dependencies installed:
    ```bash
    npm install express socket.io tmi.js
    ```

### Project Structure
Ensure your folder contains these files:
* `server.js` (The logic)
* `dashboard.html` (The UI)
* `overlay.html` (The OBS view)
* `package.json` (The configuration)

### Compiling the Standalone App
We use `pkg` to bundle the Node.js runtime and assets into a single file. Because of Mac permissions, it is best to use `npx`.

1. **Navigate to the project folder:**
    ```bash
    cd /path/to/Twitch-Chat-Display
    ```
2. **Run the Build:**
    ```bash
    npx pkg .
    ```
    *This will read the pkg settings in your package.json and generate files for both macOS and Windows.*

### Troubleshooting the Build
* **Missing Assets:** If the HTML files don't load in the app, ensure they are listed in the "assets" array inside `package.json`.
* **Permission Denied:** If you get an EACCES error on Mac, ensure you are using `npx pkg .` rather than a global install.

---

## Configuration File
The app creates a `config.txt` file in its root directory. This file stores your Twitch channel name so you don't have to re-enter it every time you launch the software.

---

Would you like me to also remove the emojis from the terminal output in the **server.js** code?
