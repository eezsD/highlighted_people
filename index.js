const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const path = require("path");
const fs = require("fs");
const { OAuth2Client } = require("google-auth-library");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const googleClient = new OAuth2Client(GOOGLE_CLIENT_ID);

// Middleware
app.use(express.static("public"));
app.use(express.json({ charset: "utf-8" }));
app.use(express.urlencoded({ extended: true, charset: "utf-8" }));

// Set UTF-8 encoding for responses
app.use((req, res, next) => {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  next();
});

// In-memory storage for authenticated users (in production, use a database)
let authenticatedUsers = {};

// Middleware to check if user is authenticated
function ensureAuthenticated(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const token = authHeader.substring(7);
  const user = authenticatedUsers[token];
  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }
  req.user = user;
  next();
}

// In-memory storage for comments (in production, use a database)
let comments = {};
let ebooks = [];

function removeFileExtension(filename) {
  const lastDotIndex = filename.lastIndexOf('.');
  if (lastDotIndex === -1) return filename; // 확장자가 없는 경우
  return filename.slice(0, lastDotIndex);
}

// Function to scan existing uploads and populate ebooks array
function scanExistingUploads() {
  const uploadsDir = path.join(__dirname, "uploads");
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
  }
  ebooks = [];
  try {
    const files = fs.readdirSync(uploadsDir);
    files.forEach((file, idx) => {
      ebooks.push({
        id: String(idx + 1),
        title: removeFileExtension(file),
        filename: file,
      });
    });
  } catch (error) {
    console.error("Error scanning uploads:", error);
  }
}
scanExistingUploads();

// Get Google Client ID endpoint
app.get("/auth/google-client-id", (req, res) => {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (clientId) {
    res.json({ clientId });
  } else {
    res.status(500).json({ error: "Google Client ID not set" });
  }
});

// Google 로그인 처리 (popup 방식만 지원)
app.post("/auth/google", async (req, res) => {
  const { credential } = req.body;
  if (!credential) {
    return res.status(400).json({ error: "No credential provided" });
  }
  try {
    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: GOOGLE_CLIENT_ID,
    });
    const payload = ticket.getPayload();
    // 간단한 세션 토큰 생성 (실서비스에서는 JWT 등 사용 권장)
    const token = Math.random().toString(36).substring(2);
    authenticatedUsers[token] = {
      id: payload.sub,
      name: payload.name,
      email: payload.email,
      photo: payload.picture,
    };
    res.json({ token, user: authenticatedUsers[token] });
  } catch (error) {
    res.status(401).json({ error: "Invalid Google credential" });
  }
});

// 로그아웃
app.post("/auth/logout", (req, res) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7);
    delete authenticatedUsers[token];
  }
  res.json({ success: true });
});

// 로그인된 사용자 정보 반환
app.get("/auth/user", (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Not authenticated" });
  }
  const token = authHeader.substring(7);
  const user = authenticatedUsers[token];
  if (!user) {
    return res.status(401).json({ error: "Invalid token" });
  }
  res.json(user);
});

// Routes
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/ebooks", (req, res) => {
  res.json(ebooks);
});

app.get("/ebook/:id", (req, res) => {
  const ebook = ebooks.find((e) => e.id === req.params.id);
  if (!ebook) {
    return res.status(404).json({ error: "Ebook not found" });
  }
  const filePath = path.join(__dirname, "uploads", ebook.filename);
  if (fs.existsSync(filePath)) {
    const content = fs.readFileSync(filePath, "utf-8");
    res.json({ ...ebook, content });
  } else {
    res.status(404).json({ error: "File not found" });
  }
});

app.get("/comments/:ebookId", (req, res) => {
  const ebookComments = comments[req.params.ebookId] || [];
  res.json(ebookComments);
});

app.post("/comments/:ebookId", ensureAuthenticated, (req, res) => {
  const { selectedText, comment, position } = req.body;
  const ebookId = req.params.ebookId;
  if (!comments[ebookId]) {
    comments[ebookId] = [];
  }
  const newComment = {
    id: Math.random().toString(36).substring(2),
    user: req.user,
    selectedText,
    comment,
    position,
    createdAt: new Date().toISOString(),
  };
  comments[ebookId].push(newComment);
  io.emit("newComment", { ebookId, comment: newComment });
  res.json(newComment);
});

// Socket.IO for real-time collaboration
io.on("connection", (socket) => {
  socket.on("userHighlight", (data) => {
    socket.broadcast.emit("userHighlight", data);
  });
  socket.on("userTyping", (data) => {
    socket.broadcast.emit("userTyping", data);
  });
});

const PORT = process.env.PORT || 5500;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on port:${PORT}`);
});