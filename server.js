const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

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
let currentVideoState = {
    url: '',
    videoId: '',
    isPlaying: false,
    currentTime: 0,
    lastUpdate: Date.now()
};

let currentNotes = "";
let currentCodeState = { code: '', language: 'python', output: '' };
let voiceState = new Map(); 

let connectedUsers = new Map();
let messageHistory = [];

io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    // Handle user joining
    socket.on('user-join', (userData) => {
        connectedUsers.set(socket.id, userData);
        voiceState.set(socket.id, { username: userData.username, isMuted: true });

        // Send welcome message
        io.emit('system-message', {
            message: `${userData.username} joined the study session! 🧑‍💻`,
            timestamp: Date.now()
        });

        // Send all current states to new user for sync
        socket.emit('video-sync', currentVideoState);
        socket.emit('notes-sync', currentNotes);
        socket.emit('code-editor-sync', currentCodeState.code);
        
        // Send message history and user count
        messageHistory.forEach(msg => {
            socket.emit('new-message', msg);
        });
        io.emit('user-count', connectedUsers.size);
    });

    // --- MIC TOGGLE ---
    socket.on('mic-toggle', (isUnmuted) => {
        const user = connectedUsers.get(socket.id);
        if (!user) return;

        voiceState.set(socket.id, { username: user.username, isMuted: !isUnmuted });

        socket.broadcast.emit('mic-status', {
            username: user.username,
            isMuted: !isUnmuted
        });
        
        io.emit('system-message', {
            message: `${user.username} is now ${isUnmuted ? 'Unmuted 🎙️' : 'Muted 🔇'}`,
            timestamp: Date.now()
        });
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

    // --- CODE OUTPUT SYNC ---
    socket.on('code-output-sync', (output) => {
        currentCodeState.output = output;
        socket.broadcast.emit('code-output-update', output);
    });
    
    // Handle chat messages (Retained)
    socket.on('send-message', (messageData) => {
        // ... (Messaging and trigger word logic) ...
    });

    // Video, Award, Surprise, Typing logic (Retained)
    // ...

    // Handle disconnect
    socket.on('disconnect', () => {
        const user = connectedUsers.get(socket.id);
        if (user) {
            io.emit('system-message', {
                message: `${user.username} signed off 👋`,
                timestamp: Date.now()
            });
        }
        
        connectedUsers.delete(socket.id);
        voiceState.delete(socket.id);
        io.emit('user-count', connectedUsers.size);
        console.log('User disconnected:', socket.id);
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`🚀 Collaborative Learning Server running on port ${PORT}`);
    console.log(`🧠 Your study platform is ready at http://localhost:${PORT}`);
});
