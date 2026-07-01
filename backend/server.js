const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const multer = require('multer');
const { spawn } = require('child_process');

const tempDir = path.join(__dirname, 'temp');
if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir);

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use('/temp', express.static(tempDir));
app.use('/uploads', express.static(uploadsDir));

// Multer config for uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        const ext = path.extname(file.originalname) || '.png';
        cb(null, file.fieldname + '-' + uniqueSuffix + ext);
    }
});
const upload = multer({ storage: storage });

// Serve React Frontend (dist folder)
app.use(express.static(path.join(__dirname, '../frontend/dist')));

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: '*',
    }
});

// Database setup
const db = new sqlite3.Database(path.join(__dirname, 'chat.db'));

db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        sender TEXT,
        text TEXT,
        type TEXT,
        media_url TEXT,
        reply_to_id INTEGER,
        reactions TEXT DEFAULT '{}',
        is_recalled BOOLEAN DEFAULT 0,
        status TEXT DEFAULT 'sent',
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    // Add new columns if they don't exist
    db.run("ALTER TABLE messages ADD COLUMN reply_to_id INTEGER", (err) => {});
    db.run("ALTER TABLE messages ADD COLUMN reactions TEXT DEFAULT '{}'", (err) => {});
    db.run("ALTER TABLE messages ADD COLUMN is_recalled BOOLEAN DEFAULT 0", (err) => {});
    db.run("ALTER TABLE messages ADD COLUMN status TEXT DEFAULT 'sent'", (err) => {});

    db.run(`CREATE TABLE IF NOT EXISTS stickers (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        owner TEXT,
        url TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS config (
        key TEXT PRIMARY KEY,
        value TEXT
    )`);
    
    // Set start date 75 days ago if not exists
    db.get("SELECT value FROM config WHERE key = 'start_date'", (err, row) => {
        if (!row) {
            const startDate = new Date();
            startDate.setDate(startDate.getDate() - 75);
            db.run("INSERT INTO config (key, value) VALUES ('start_date', ?)", [startDate.toISOString()]);
        }
    });

    db.get("SELECT value FROM config WHERE key = 'global_theme'", (err, row) => {
        if (!row) {
            db.run("INSERT INTO config (key, value) VALUES ('global_theme', 'pink')");
        }
    });
});

const PASSCODES = {
    'Đ': 'Dat211209198765432',
    'N': 'hyn220909'
};
let connectedUsers = 0;
let userStatuses = {
    'Đ': { status: 'offline', customText: 'Đang làm việc', nickname: '' },
    'N': { status: 'offline', customText: 'Đi ngủ', nickname: '' }
};

app.post('/api/login', (req, res) => {
    const { passcode, username } = req.body;
    if (PASSCODES[username] && passcode === PASSCODES[username]) {
        res.json({ success: true, username });
    } else {
        res.json({ success: false });
    }
});

app.get('/api/config', (req, res) => {
    db.all("SELECT * FROM config", (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        const config = {};
        rows.forEach(r => config[r.key] = r.value);
        res.json(config);
    });
});

app.post('/api/upload', upload.single('image'), (req, res) => {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = `/uploads/${req.file.filename}`;
    res.json({ url });
});

const downloadingMedia = new Set();

app.get('/api/messages', (req, res) => {
    const limit = 15;
    const offset = req.query.offset ? parseInt(req.query.offset) : 0;
    // Join with self to get replied message details
    const query = `
        SELECT m1.*, 
               m2.sender as reply_to_sender, 
               m2.text as reply_to_text, 
               m2.type as reply_to_type,
               m2.is_recalled as reply_is_recalled
        FROM messages m1 
        LEFT JOIN messages m2 ON m1.reply_to_id = m2.id 
        ORDER BY m1.timestamp DESC LIMIT ? OFFSET ?
    `;
    db.all(query, [limit, offset], (err, rows) => {
        if (err) return res.status(500).json({ error: err.message });
        
        // Check for videos to re-download
        rows.forEach(row => {
            if (row.type === 'text' && !row.is_recalled && row.text) {
                const urls = row.text.match(urlRegex);
                if (urls && urls.length > 0) {
                    const firstUrl = urls[0];
                    if (firstUrl.includes('tiktok.com') || firstUrl.includes('youtube.com') || firstUrl.includes('youtu.be')) {
                        downloadVideo(firstUrl, row.id);
                    }
                }
            }
        });

        res.json(rows.reverse()); // return in chronological order for the batch
    });
});

// Any other GET request not handled by /api goes to the React app
app.use((req, res) => {
    res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');
    res.setHeader('Pragma', 'no-cache');
    res.setHeader('Expires', '0');
    res.sendFile(path.join(__dirname, '../frontend/dist/index.html'));
});

function downloadVideo(url, messageId) {
    if (downloadingMedia.has(messageId)) return;
    downloadingMedia.add(messageId);

    const outputFilename = `video_${messageId}.mp4`;
    const outputPath = path.join(tempDir, outputFilename);
    
    // yt-dlp command. Using generic spawn in case yt-dlp-exec has issues on Windows
    const ytDlp = spawn('yt-dlp', [
        '-f', 'best[ext=mp4]/best',
        '-o', outputPath,
        url
    ]);

    ytDlp.on('close', (code) => {
        downloadingMedia.delete(messageId);
        if (code === 0) {
            db.run("UPDATE messages SET media_url = ?, type = 'video' WHERE id = ?", [`/temp/${outputFilename}`, messageId], () => {
                db.get("SELECT * FROM messages WHERE id = ?", [messageId], (err, row) => {
                    if (row) {
                        io.emit('message_updated', row);
                    }
                });
            });
        }
    });
}

const urlRegex = /(https?:\/\/[^\s]+)/g;

io.on('connection', (socket) => {
    connectedUsers++;
    
    socket.on('join', (username) => {
        socket.username = username;
        if (userStatuses[username]) {
            userStatuses[username].status = 'online';
        }
        io.emit('user_status', userStatuses);
    });

    socket.on('heartbeat', () => {
        if (socket.username && userStatuses[socket.username]) {
            userStatuses[socket.username].status = 'online';
        }
    });

    socket.on('update_custom_status', ({ username, text }) => {
        if (userStatuses[username]) {
            userStatuses[username].customText = text;
            io.emit('user_status', userStatuses);
        }
    });

    socket.on('update_nickname', ({ username, nickname }) => {
        if (userStatuses[username]) {
            userStatuses[username].nickname = nickname;
            io.emit('user_status', userStatuses);
        }
    });

    socket.on('update_theme', (theme) => {
        db.run("UPDATE config SET value = ? WHERE key = 'global_theme'", [theme], () => {
            io.emit('theme_updated', theme);
        });
    });

    socket.on('update_avatar', ({ username, url }) => {
        const key = `avatar_${username}`;
        db.get("SELECT * FROM config WHERE key = ?", [key], (err, row) => {
            if (row) {
                db.run("UPDATE config SET value = ? WHERE key = ?", [url, key], () => {
                    io.emit('avatar_updated', { username, url });
                });
            } else {
                db.run("INSERT INTO config (key, value) VALUES (?, ?)", [key, url], () => {
                    io.emit('avatar_updated', { username, url });
                });
            }
        });
    });

    socket.on('typing', ({ username }) => {
        socket.broadcast.emit('user_typing', { username });
    });

    socket.on('stop_typing', ({ username }) => {
        socket.broadcast.emit('user_stop_typing', { username });
    });

    socket.on('mark_as_read', ({ username }) => {
        db.run("UPDATE messages SET status = 'read' WHERE sender != ? AND status != 'read'", [username], function(err) {
            if (!err && this.changes > 0) {
                io.emit('messages_read', { by: username });
            }
        });
    });

    socket.on('get_stickers', (username) => {
        db.all("SELECT * FROM stickers WHERE owner = ? ORDER BY timestamp DESC", [username], (err, rows) => {
            if (!err) socket.emit('stickers_list', rows);
        });
    });

    socket.on('save_sticker', ({ username, url }) => {
        db.run("INSERT INTO stickers (owner, url) VALUES (?, ?)", [username, url], function(err) {
            if (!err) {
                db.all("SELECT * FROM stickers WHERE owner = ? ORDER BY timestamp DESC", [username], (err, rows) => {
                    if (!err) socket.emit('stickers_list', rows);
                });
            }
        });
    });

    socket.on('recall_message', ({ messageId, username }) => {
        db.get("SELECT sender, timestamp FROM messages WHERE id = ?", [messageId], (err, row) => {
            if (row && row.sender === username) {
                // Check if within 5 minutes
                // SQLite CURRENT_TIMESTAMP is UTC
                const msgTime = new Date(row.timestamp + 'Z').getTime();
                const now = Date.now();
                if (now - msgTime <= 5 * 60 * 1000) {
                    db.run("UPDATE messages SET is_recalled = 1 WHERE id = ?", [messageId], () => {
                        io.emit('message_recalled', { id: messageId });
                    });
                }
            }
        });
    });

    socket.on('send_message', (data) => {
        const { sender, text, reply_to_id, type, media_url, client_id } = data;
        
        let msgType = type || 'text';
        let msgMedia = media_url || null;

        db.run("INSERT INTO messages (sender, text, type, media_url, reply_to_id, status) VALUES (?, ?, ?, ?, ?, 'sent')", 
        [sender, text, msgType, msgMedia, reply_to_id || null], function(err) {
            if (err) return;
            const messageId = this.lastID;
            
            const query = `
                SELECT m1.*, 
                       m2.sender as reply_to_sender, 
                       m2.text as reply_to_text, 
                       m2.type as reply_to_type 
                FROM messages m1 
                LEFT JOIN messages m2 ON m1.reply_to_id = m2.id 
                WHERE m1.id = ?
            `;
            db.get(query, [messageId], (err, row) => {
                if (row) {
                    io.emit('new_message', { ...row, client_id });
                    
                    // Check for video links
                    if (msgType === 'text') {
                        const urls = text.match(urlRegex);
                        if (urls && urls.length > 0) {
                            const firstUrl = urls[0];
                            if (firstUrl.includes('tiktok.com') || firstUrl.includes('youtube.com') || firstUrl.includes('youtu.be')) {
                                downloadVideo(firstUrl, messageId);
                            }
                        }
                    }
                }
            });
        });
    });

    socket.on('add_reaction', ({ messageId, emoji, username }) => {
        db.get("SELECT reactions FROM messages WHERE id = ?", [messageId], (err, row) => {
            if (row) {
                let reactions = {};
                try {
                    reactions = JSON.parse(row.reactions || '{}');
                } catch (e) {}
                
                if (!reactions[emoji]) reactions[emoji] = [];
                if (!reactions[emoji].includes(username)) {
                    reactions[emoji].push(username);
                } else {
                    reactions[emoji] = reactions[emoji].filter(u => u !== username); // Toggle off
                    if (reactions[emoji].length === 0) delete reactions[emoji];
                }
                
                const updatedReactions = JSON.stringify(reactions);
                db.run("UPDATE messages SET reactions = ? WHERE id = ?", [updatedReactions, messageId], () => {
                    io.emit('reaction_updated', { id: messageId, reactions: updatedReactions });
                });
            }
        });
    });

    socket.on('disconnect', () => {
        connectedUsers--;
        if (socket.username && userStatuses[socket.username]) {
            userStatuses[socket.username].status = 'offline';
            io.emit('user_status', userStatuses);
        }

        if (connectedUsers === 0) {
            // Cleanup temp folder
            fs.readdir(tempDir, (err, files) => {
                if (err) return;
                for (const file of files) {
                    fs.unlink(path.join(tempDir, file), err => {
                        if (err) console.error(err);
                    });
                }
            });
            db.run("UPDATE messages SET media_url = NULL, type = 'text' WHERE type = 'video'");
        }
    });
});

const PORT = 3001;
server.listen(PORT, () => {
    console.log(`Backend running on http://localhost:${PORT}`);
});
