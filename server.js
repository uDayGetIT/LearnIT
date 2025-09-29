const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
// No need for explicit 'node-fetch' import if using modern Node (>=18)
// const fetch = require('node-fetch'); 

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

// Serve static files
app.use(express.static('public'));

// --- COLLABORATIVE STATE STORAGE ---
let currentVideoState = { /* ... */ };
let currentNotes = "";
let currentCodeState = { code: '', language: 'python', output: '' };
let voiceState = new Map(); 
let connectedUsers = new Map();
let messageHistory = [];

io.on('connection', (socket) => {
    // ... [USER JOIN, DISCONNECT, CHAT, VIDEO SYNC LOGIC REMAINS] ...
    
    // --- NEW: REAL CODE EXECUTION HANDLER ---
    socket.on('execute-code', async (data) => {
        const user = connectedUsers.get(socket.id);
        const startTime = Date.now();
        
        try {
            // Piston API Endpoint
            const apiURL = 'https://emkc.org/api/v2/piston/execute';
            
            const response = await fetch(apiURL, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: 'python',
                    version: '3.10.0', // A stable, recent version
                    files: [{ content: data.code }]
                })
            });

            const result = await response.json();
            const executionTime = Date.now() - startTime;
            
            let output = '';
            let isError = false;

            if (result.run.stderr) {
                output = result.run.stderr;
                isError = true;
            } else if (result.run.stdout) {
                output = result.run.stdout;
            } else {
                 output = "Execution returned no output.";
            }

            // Sync the real output to ALL users
            io.emit('code-output-update', { 
                output: output, 
                error: isError,
                time: executionTime
            });

        } catch (error) {
            console.error('Code execution API error:', error);
            // Sync error status to ALL users
            io.emit('code-output-update', { 
                output: `Server/API Error: Could not reach execution engine.`, 
                error: true,
                time: Date.now() - startTime
            });
        }
    });

    // --- MIC TOGGLE ---
    socket.on('mic-toggle', (isUnmuted) => {
        const user = connectedUsers.get(socket.id);
        if (user) {
             voiceState.set(socket.id, { username: user.username, isMuted: !isUnmuted });
             socket.broadcast.emit('mic-status', { username: user.username, isMuted: !isUnmuted });
             io.emit('system-message', { message: `${user.username} is now ${isUnmuted ? 'Unmuted 🎙️' : 'Muted 🔇'}`, timestamp: Date.now() });
        }
    });

    // --- NOTES DIARY SYNC ---
    socket.on('notes-update', (notes) => {
        currentNotes = notes;
        socket.broadcast.emit('notes-sync', currentNotes);
    });

    // --- CODE EDITOR SYNC ---
    socket.on('code-editor-update', (code) => {
        currentCodeState.code = code;
        socket.broadcast.emit('code-editor-sync', code);
    });
    
    // ... [All other retained logic for user-join, send-message, video-playpause, etc. ] ...
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Collaborative Learning Server running on port ${PORT}`);
});
