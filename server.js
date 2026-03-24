const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const tmi = require('tmi.js');
const { LiveChat } = require('youtube-chat');
const path = require('path');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// --- CONFIGURATION ---
const BUILD_DATE = "March 22, 2026"; 
const PORT = 3000;
const configPath = path.join(process.cwd(), 'config.txt');

let TWITCH_CHANNEL = '', YOUTUBE_ID = '', YOUTUBE_DISPLAY_NAME = '';
let ytStatus = 'offline', tStatus = 'offline';
let emoteMap = {}, badgeMap = {}, tmiClient = null, ytChat = null;

process.on('unhandledRejection', (reason) => {
    console.log('Log: Connection pending or rejected by platform.');
});

// --- PERSISTENCE ---
function saveConfig() {
    try {
        fs.writeFileSync(configPath, JSON.stringify({ 
            twitch: TWITCH_CHANNEL, 
            youtube: YOUTUBE_ID, 
            youtubeName: YOUTUBE_DISPLAY_NAME 
        }), 'utf8');
    } catch (e) { console.error("Save Error:", e); }
}

function loadConfig() {
    try {
        if (fs.existsSync(configPath)) {
            const d = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            TWITCH_CHANNEL = d.twitch || '';
            YOUTUBE_ID = d.youtube || '';
            YOUTUBE_DISPLAY_NAME = d.youtubeName || '';
        }
    } catch (e) {}
}

// --- ASSET LOADING (3RD PARTY EMOTES) ---
async function loadAssets(channel) {
    emoteMap = {}; badgeMap = {};
    if (!channel) return;
    try {
        // Resolve Twitch ID
        const idRes = await fetch(`https://decapi.me/twitch/id/${channel}`).catch(() => null);
        const twitchId = idRes && idRes.ok ? await idRes.text() : null;

        // 7TV Global
        try {
            const res = await fetch('https://7tv.io/v3/emote-sets/global');
            if (res.ok) {
                const data = await res.json();
                if (data.emotes) data.emotes.forEach(e => { emoteMap[e.name] = `https://cdn.7tv.app/emote/${e.id}/3x.webp`; });
            }
        } catch(e) {}

        // 7TV Channel
        try {
            const res = await fetch(`https://7tv.io/v3/users/twitch/${twitchId || channel}`);
            if (res.ok) {
                const data = await res.json();
                if (data.emote_set?.emotes) data.emote_set.emotes.forEach(e => { emoteMap[e.name] = `https://cdn.7tv.app/emote/${e.id}/3x.webp`; });
            }
        } catch(e) {}

        // BTTV Global
        try {
            const res = await fetch('https://api.betterttv.net/3/cached/emotes/global');
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data)) data.forEach(e => { emoteMap[e.code] = `https://cdn.betterttv.net/emote/${e.id}/3x`; });
            }
        } catch(e) {}

        if (twitchId) {
            // BTTV Channel
            try {
                const res = await fetch(`https://api.betterttv.net/3/cached/users/twitch/${twitchId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.channelEmotes) data.channelEmotes.forEach(e => { emoteMap[e.code] = `https://cdn.betterttv.net/emote/${e.id}/3x`; });
                    if (data.sharedEmotes) data.sharedEmotes.forEach(e => { emoteMap[e.code] = `https://cdn.betterttv.net/emote/${e.id}/3x`; });
                }
            } catch(e) {}

            // FFZ Global
            try {
                const res = await fetch('https://api.frankerfacez.com/v1/set/global');
                if (res.ok) {
                    const data = await res.json();
                    if (data.sets) {
                        Object.values(data.sets).forEach(set => {
                            if (set.emoticons) set.emoticons.forEach(e => {
                                emoteMap[e.name] = e.urls["4"] || e.urls["2"] || e.urls["1"];
                            });
                        });
                    }
                }
            } catch(e) {}

            // FFZ Channel
            try {
                const res = await fetch(`https://api.frankerfacez.com/v1/room/id/${twitchId}`);
                if (res.ok) {
                    const data = await res.json();
                    if (data.sets) {
                        Object.values(data.sets).forEach(set => {
                            if (set.emoticons) set.emoticons.forEach(e => {
                                emoteMap[e.name] = e.urls["4"] || e.urls["2"] || e.urls["1"];
                            });
                        });
                    }
                }
            } catch(e) {}
        }

        io.emit('init-assets', { emotes: emoteMap, badges: badgeMap });
    } catch (e) { console.log("Asset load skipped."); }
}

// --- YOUTUBE LOGIC ---
async function getYoutubeId(input) {
    if (!input || input.trim() === "") return null;
    const clean = input.trim();
    if (clean.startsWith('UC') && clean.length === 24) return { id: clean, name: clean };
    try {
        const url = clean.startsWith('http') ? clean : (clean.startsWith('@') ? `https://www.youtube.com/${clean}` : `https://www.youtube.com/@${clean}`);
        const res = await fetch(url);
        const html = await res.text();
        const idMatch = html.match(/"externalId":"(UC[a-zA-Z0-9_-]{22})"/);
        const nameMatch = html.match(/"name":"([^"]+)"/);
        return idMatch ? { id: idMatch[1], name: nameMatch ? nameMatch[1] : clean } : null;
    } catch (e) { return null; }
}

function connectYouTube(id) {
    if (ytChat) { try { ytChat.stop(); } catch(e) {} ytChat = null; }
    if (!id || id.trim() === "") { 
        ytStatus = 'offline'; YOUTUBE_ID = ''; YOUTUBE_DISPLAY_NAME = '';
        io.emit('status-update', { platform: 'youtube', status: 'offline' }); 
        return; 
    }
    ytStatus = 'loading'; io.emit('status-update', { platform: 'youtube', status: 'loading' });
    try {
        ytChat = new LiveChat({ channelId: id });
        ytChat.on("chat", (item) => {
            const txt = item.message.map(m => m.text || '').join('');
            const elements = item.message.map(m => {
                if (m.text) return { type: 'text', text: m.text };
                if (m.url) return { type: 'emote', url: m.url, text: m.alt || m.emojiText || '' };
                return { type: 'text', text: '' };
            });
            io.emit('new-message', { platform: 'youtube', user: item.author.name, color: '#ff0000', badges: {}, text: txt, elements: elements });
        });
        ytChat.on("error", () => { ytStatus = 'offline'; io.emit('status-update', { platform: 'youtube', status: 'offline' }); });
        ytChat.start().then(() => { ytStatus = 'online'; io.emit('status-update', { platform: 'youtube', status: 'online' }); })
            .catch(() => { ytStatus = 'offline'; io.emit('status-update', { platform: 'youtube', status: 'offline' }); });
    } catch (e) { ytStatus = 'offline'; io.emit('status-update', { platform: 'youtube', status: 'offline' }); }
}

// --- TWITCH LOGIC (Message logging removed) ---
function connectTwitch(channel) {
    if (tmiClient) { try { tmiClient.disconnect(); } catch(e) {} tmiClient = null; }
    if (!channel || channel.trim() === "") { 
        tStatus = 'offline'; TWITCH_CHANNEL = '';
        io.emit('status-update', { platform: 'twitch', status: 'offline' }); 
        return; 
    }

    tStatus = 'loading'; 
    io.emit('status-update', { platform: 'twitch', status: 'loading' });
    console.log(`Twitch: Connecting to #${channel}...`);

    tmiClient = new tmi.Client({ connection: { reconnect: true, secure: true }, channels: [channel] });

    tmiClient.on('join', (chan, username) => {
        if (username.toLowerCase() === tmiClient.getUsername().toLowerCase()) {
            console.log(`✅ Twitch: Successfully joined ${chan}`);
            tStatus = 'online';
            io.emit('status-update', { platform: 'twitch', status: 'online' });
        }
    });

    tmiClient.on('message', (chan, tags, msg, self) => {
        if (!self) {
            // No console.log here to keep terminal clean
            io.emit('new-message', { 
                platform: 'twitch', 
                user: tags['display-name'], 
                color: tags.color || '#9147ff', 
                badges: tags.badges || {}, 
                emotes: tags.emotes, 
                text: msg 
            });
        }
    });

    tmiClient.connect().then(() => {
        setTimeout(() => {
            if (tStatus === 'loading') {
                console.log(`❌ Twitch: Failed to join #${channel} (Timeout).`);
                tStatus = 'offline';
                io.emit('status-update', { platform: 'twitch', status: 'offline' });
                if (tmiClient) tmiClient.disconnect();
            }
        }, 6000);
    }).catch(() => {
        tStatus = 'offline';
        io.emit('status-update', { platform: 'twitch', status: 'offline' });
    });

    loadAssets(channel);
}

// --- SOCKET HANDSHAKE ---
io.on('connection', (socket) => {
    socket.emit('init-assets', { emotes: emoteMap, badges: badgeMap });
    socket.emit('current-config', { twitch: TWITCH_CHANNEL, youtube: YOUTUBE_DISPLAY_NAME, buildDate: BUILD_DATE });
    socket.emit('status-update', { platform: 'twitch', status: TWITCH_CHANNEL ? tStatus : 'offline' });
    socket.emit('status-update', { platform: 'youtube', status: YOUTUBE_ID ? ytStatus : 'offline' });

    socket.on('update-channels', async (d) => {
        TWITCH_CHANNEL = d.twitch ? d.twitch.toLowerCase().trim() : '';
        const yt = await getYoutubeId(d.youtube);
        if (yt) { 
            YOUTUBE_ID = yt.id; YOUTUBE_DISPLAY_NAME = yt.name; 
            socket.emit('name-update', { youtube: yt.name }); 
        } else { 
            YOUTUBE_ID = ''; YOUTUBE_DISPLAY_NAME = d.youtube ? d.youtube.trim() : ''; 
        }
        saveConfig(); connectTwitch(TWITCH_CHANNEL); connectYouTube(YOUTUBE_ID);
    });

    socket.on('feature-msg', (data) => io.emit('show-feature', data));
    socket.on('clear-msg', () => io.emit('clear-overlay'));
});

// --- START ---
loadConfig();
connectTwitch(TWITCH_CHANNEL);
connectYouTube(YOUTUBE_ID);

app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'dashboard.html')));
app.get('/overlay', (req, res) => res.sendFile(path.join(__dirname, 'overlay.html')));

server.listen(PORT, () => {
    console.log(`\n--- Dashboard Ready: http://localhost:${PORT} ---\n`);
});