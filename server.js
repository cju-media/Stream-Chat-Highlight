const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const tmi = require('tmi.js');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const configPath = path.join(process.cwd(), 'config.txt');
let CHANNEL_NAME = loadChannel();
let emoteMap = {};
let badgeMap = {};
let client = null;

function saveChannel(name) {
    try { fs.writeFileSync(configPath, name, 'utf8'); } catch (e) {}
}

function loadChannel() {
    try { if (fs.existsSync(configPath)) return fs.readFileSync(configPath, 'utf8').trim(); } catch (e) { }
    return 'twitch'; 
}

async function loadAssets(channel) {
    try {
        const gBadgeRes = await fetch('https://badges.twitch.tv/v1/badges/global/display');
        const gBadgeData = await gBadgeRes.json();
        const cBadgeRes = await fetch(`https://badges.twitch.tv/v1/badges/channels/${channel}/display`).catch(() => null);
        let cBadgeData = { badge_sets: {} };
        if (cBadgeRes && cBadgeRes.ok) cBadgeData = await cBadgeRes.json();

        badgeMap = { ...gBadgeData.badge_sets, ...cBadgeData.badge_sets };

        emoteMap = {};
        const seventv = await fetch(`https://7tv.io/v3/users/twitch/${channel}`).catch(() => null);
        if (seventv?.ok) {
            const data = await seventv.json();
            data.emote_set?.emotes.forEach(e => {
                emoteMap[e.name] = `https://cdn.7tv.app/emote/${e.id}/3x.webp`;
            });
        }
        const bttv = await fetch('https://api.betterttv.net/3/cached/emotes/global').catch(() => null);
        if (bttv?.ok) {
            const data = await bttv.json();
            data.forEach(e => emoteMap[e.code] = `https://cdn.betterttv.net/emote/${e.id}/3x`);
        }

        io.emit('init-assets', { emotes: emoteMap, badges: badgeMap });
    } catch (e) { console.error("Asset fetch error:", e); }
}

function connectToTwitch(channel) {
    if (client) client.disconnect();
    client = new tmi.Client({ connection: { reconnect: true, secure: true }, channels: [channel] });
    client.on('message', (chan, tags, message, self) => {
        if (self) return;
        io.emit('new-message', {
            user: tags['display-name'],
            color: tags.color || '#9147ff',
            emotes: tags.emotes,
            badges: tags.badges || {},
            text: message
        });
    });
    client.connect().then(() => console.log(`🚀 Connected: ${channel}`));
    loadAssets(channel);
}

loadAssets(CHANNEL_NAME).then(() => connectToTwitch(CHANNEL_NAME));

io.on('connection', (socket) => {
    socket.emit('current-channel', CHANNEL_NAME);
    socket.emit('init-assets', { emotes: emoteMap, badges: badgeMap });
    socket.on('feature-msg', (data) => io.emit('show-feature', data));
    socket.on('clear-msg', () => io.emit('clear-overlay'));
    socket.on('change-channel', (name) => {
        CHANNEL_NAME = name.toLowerCase().trim();
        saveChannel(CHANNEL_NAME);
        connectToTwitch(CHANNEL_NAME);
    });
});

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/overlay', (req, res) => res.sendFile(path.join(__dirname, 'overlay.html')));

const PORT = 3000;

server.listen(PORT, () => {
    // Clear the console for a clean "App" feel
    console.clear(); 
    
    console.log(`
**************************************************
  TWITCH CHAT HIGHLIGHTER
**************************************************

  1. DASHBOARD (Control Panel):
     http://localhost:${PORT}
     -> Add this as a "Custom Browser Dock" in OBS.

  2. OVERLAY (Stream View):
     http://localhost:${PORT}/overlay
     -> Add this as a "Browser Source" in OBS.
     -> Recommended Size: 1920 x 1080

  CURRENT CHANNEL: ${CHANNEL_NAME.toUpperCase()}
  (Change this anytime in the Dashboard)

**************************************************
    `);
});