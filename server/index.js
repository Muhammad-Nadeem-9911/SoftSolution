const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const cors = require("cors");
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const User = require('./models/User'); // Import the User model (keep this)
const rateLimit = require('express-rate-limit'); // Import express-rate-limit
const managerRoutes = require('./routes/managerRoutes'); // Import manager routes

const app = express();
require('./config/cloudinary'); // <<< Add this line to run the Cloudinary config
require('dotenv').config();
const clientURL = process.env.FRONTEND_URL || "http://localhost:3000"; // Define client URL from env FIRST
app.use(express.json());
app.use(cors({ origin: clientURL, credentials: true })); // Now clientURL is defined


// Serve static files from the 'public' directory
app.use(express.static('public'));
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: clientURL,
    methods: ["GET", "POST"],
  }
});

// Rate Limiting Setup
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // Limit each IP to 20 requests per windowMs for most auth actions
  message: { msg: 'Too many requests from this IP, please try again after 15 minutes' },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

const signupLimiter = rateLimit({ // Stricter for signup
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // TEMPORARILY INCREASED FOR DEVELOPMENT: Limit each IP to 500 signup attempts per hour
    message: { msg: 'Too many accounts created from this IP (dev limit), please try again after an hour' },
    standardHeaders: true,
    legacyHeaders: false,
});

// In d:\Zoom-Clone-Mern\server\index.js
app.use('/api/auth/signup', signupLimiter); // Apply stricter limiter to signup
app.use('/api/auth/login', generalLimiter);
app.use('/api/auth/forgot-password', generalLimiter);
app.use('/api/auth/reset-password/:token', generalLimiter); // Note: token in URL, IP still primary factor
app.use('/api/auth/verify-email/:token', generalLimiter); // Note: token in URL
app.use('/api/auth/resend-verification', generalLimiter);
app.use('/api/auth', require('./routes/auth')); // Mount the auth routes AFTER specific limiters
app.use('/api/users', require('./routes/users')); // Use relative path './'
app.use('/api/manager', managerRoutes); // Mount manager-specific routes

mongoose.connect(process.env.MONGODB_URI).then(() => {
  console.log('Connected to MongoDB')
}).catch((err) => {
  console.log('Error connecting to MongoDB:', err)
})




const rooms = {};
// Add storage for whiteboard history per room
const roomWhiteboardHistories = {};
// Add storage for chat history per room
const roomChatHistories = {};

// Helper function to generate a color from a string (e.g., userId)
function generateColorFromString(str) {
  // Add a check for null or undefined string
  if (!str || typeof str !== 'string') {
    console.warn('[generateColorFromString] Received invalid input string:', str, '- defaulting color.');
    return `hsl(${Math.random() * 360}, 80%, 60%)`; // Return a random default color
  }
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32bit integer
  }
  // Generate HSL values
  const hue = hash % 360; // Hue (0-359)
  const saturation = 70 + (hash % 31); // Saturation (70-100%)
  const lightness = 55 + (hash % 26); // Lightness (55-80%) - avoids very dark/light

  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

io.on("connection", (socket) => {
  console.log(`User connected: ${socket.id}`);

    socket.on("disconnect", async (reason) => { // Make async

    // Retrieve the roomId and userId stored on the socket
    const { roomId, userId, peerConnectionId, username } = socket; // Get username too
    
    console.log(`User disconnected: Socket ID ${socket.id}, UserID: ${userId}, RoomID: ${roomId}, Reason: ${reason}`);

    // --- NEW: Clear activeMeeting status on disconnect ---
    if (userId) { // Check if userId was associated with this socket
      try {
        const user = await User.findOne({ _id: userId, 'activeMeeting.socketId': socket.id });
        if (user) {
          console.log(`Clearing active meeting for user ${userId} (socket ${socket.id}) from meeting ${user.activeMeeting.meetingId} due to disconnect.`);
          user.activeMeeting.meetingId = null;
          user.activeMeeting.socketId = null;
          user.activeMeeting.joinedAt = null;
          await user.save();
        }
      } catch (error) {
        console.error(`Error clearing active meeting for user ${userId} on disconnect:`, error);
      }
    }
    // --- END NEW ---
    
    if (roomId && userId && rooms[roomId]) {
      console.log(`User ${username || userId} disconnected from room ${roomId}`); // Use username in log if available
      

      // Remove user from our room tracking
      // Filter based on userId within the stored user objects
      rooms[roomId] = rooms[roomId].filter((user) => user.userId !== userId);
      
      // Notify remaining users in the room
      // Use io.to(roomId).emit to include sender if needed, or socket.to(roomId) to exclude sender
      io.to(roomId).emit("user-disconnected", userId, peerConnectionId); // Send both IDs
      
      // Optional: Update user list for remaining users
      io.to(roomId).emit("user-list", rooms[roomId]); 
      
      // Clean up empty room
      if (rooms[roomId].length === 0) {
        delete rooms[roomId];
        // Also delete whiteboard history for the empty room
        delete roomWhiteboardHistories[roomId];
        // Also delete chat history for the empty room
        delete roomChatHistories[roomId];
        console.log(`Room ${roomId} deleted as it is empty.`);
      }
    } else {
      console.log(`User ${socket.id} disconnected (was not in a tracked room).`);
    }
  });

  socket.on("join-room", async (roomId, userId, peerConnectionId, username) => { // Make handler async
    // Log received parameters immediately
    console.log(`[Receive join-room] Room: ${roomId}, UserID: ${userId}, PeerID: ${peerConnectionId}, Username: ${username}`);

    let userToJoin; // Will hold the validated user object

    // --- Step 1: Validate user and check existing meeting status ---
    try {
      const user = await User.findById(userId);
      if (!user) {
        console.error(`User ${userId} not found when trying to join room ${roomId}`);
        socket.emit('join-room-error', { message: 'Authentication error. User not found.' });
        return;
      }

      if (user.activeMeeting && user.activeMeeting.meetingId) {
        // User is marked as in a meeting. Let's check the socket.
        const oldSocketId = user.activeMeeting.socketId;
        if (oldSocketId && oldSocketId !== socket.id) {
          // Marked as in a meeting on a DIFFERENT socket.
          // Check if that old socket is still connected.
          const oldSocketInstance = io.sockets.sockets.get(oldSocketId);
          if (oldSocketInstance && oldSocketInstance.connected) {
            // The old socket is still active. User is genuinely in another meeting.
            console.log(`User ${userId} attempted to join room ${roomId} but is already in meeting ${user.activeMeeting.meetingId} on ACTIVE socket ${oldSocketId}`);
            socket.emit('join-room-error', {
              message: `You are already in meeting ${user.activeMeeting.meetingId}. Please leave it before joining another.`,
              activeMeetingId: user.activeMeeting.meetingId
            });
            return;
          }
          console.log(`User ${userId} was marked in meeting ${user.activeMeeting.meetingId} on STALE socket ${oldSocketId}. Allowing join with new socket ${socket.id}. The stale record should be cleared by its own disconnect/leave event.`);
        }
      }
      userToJoin = user; // User is valid and not in another conflicting meeting
    } catch (error) {
      console.error(`Error during pre-join user validation for ${userId}:`, error);
      socket.emit('join-room-error', { message: 'Server error during user validation.' });
      return;
    }
    // --- END Step 1 ---

    // --- Step 2: Proceed with joining logic if validation passed ---
    try {
      // Update activeMeeting status for the validated user
      userToJoin.activeMeeting.meetingId = roomId;
      userToJoin.activeMeeting.socketId = socket.id;
      console.log(`[Server Join-Room] User ${userToJoin.username} DB profilePictureUrl: ${userToJoin.profilePictureUrl}`);
      userToJoin.activeMeeting.joinedAt = new Date();
      await userToJoin.save();
      console.log(`User ${userId} activeMeeting status updated for room ${roomId}, socket ${socket.id}`);

      // Get user role from the already fetched user object
      const userRole = userToJoin.role;
      console.log(`[Server] Role for ${username}: ${userRole}`);

      socket.userProfilePictureUrl = userToJoin.profilePictureUrl; // Ensure this is set before calling performRoomJoiningTasks
      const userColor = generateColorFromString(userId); // Generate userColor here
      // Continue with existing room setup logic
      await performRoomJoiningTasks(socket, roomId, userId, peerConnectionId, username, userRole, userColor); // Pass it

    } catch (error) {
      console.error(`Error during main join logic for user ${userId} in room ${roomId}:`, error);
      // Attempt to roll back activeMeeting status if an error occurred after setting it
      if (userToJoin && userToJoin.activeMeeting.socketId === socket.id) {
        try {
          userToJoin.activeMeeting.meetingId = null;
          userToJoin.activeMeeting.socketId = null;
          userToJoin.activeMeeting.joinedAt = null;
          await userToJoin.save();
          console.log(`Rolled back activeMeeting status for ${userId} due to error during join.`);
        } catch (rollbackError) {
          console.error(`Error rolling back activeMeeting status for ${userId}:`, rollbackError);
        }
      }
      socket.emit('join-room-error', { message: 'Server error while joining room.' });
    }
  });

  async function performRoomJoiningTasks(socket, roomId, userId, peerConnectionId, username, userRole, userColor) {
    socket.join(roomId);
    // Store roomId and userId on the socket object for later use (like disconnect)
    socket.roomId = roomId;
    socket.userId = userId;
    socket.peerConnectionId = peerConnectionId; // Store the peer connection ID too
    socket.username = username; // Store username on the socket
    console.log(`User ${username} (${userId} / Peer: ${peerConnectionId}) joining room ${roomId}`);

    // Initialize room if it doesn't exist
    if (!rooms[roomId]) {
      rooms[roomId] = [];
      console.log(`[Server] Initialized empty array for rooms[${roomId}]`); // Add log here
    }
    console.log(`[Server] User ${username} joining room ${roomId}. Checking history.`); // Use username
    // Initialize whiteboard history if room is new
    if (!roomWhiteboardHistories[roomId]) {
      roomWhiteboardHistories[roomId] = [];
      console.log(`[Server] Initialized empty history for new room ${roomId}.`); // Log init
    }
    // Initialize chat history if room is new
    if (!roomChatHistories[roomId]) {
      roomChatHistories[roomId] = [];
      console.log(`[Server] Initialized empty chat history for new room ${roomId}.`);
    }
    // userColor is now passed as an argument, generate it before calling this function if needed.
    // The fallback below is less critical now since we generate it before calling, but harmless.
    // if (!userColor) userColor = generateColorFromString(userId);

    // Assuming userToJoin (fetched before calling this function) has profilePictureUrl
    // We stored it on socket.userProfilePictureUrl in the join-room handler
    if (socket.userProfilePictureUrl === undefined) {
      console.warn(`[performRoomJoiningTasks] socket.userProfilePictureUrl is undefined for user ${username}. This should have been set in join-room.`);
    }

    const userInfo = { userId, username, peerConnectionId, color: userColor, socketId: socket.id, role: userRole, profilePictureUrl: socket.userProfilePictureUrl }; // Use profilePictureUrl from socket
    // Try assigning a new array instead of pushing
    rooms[roomId] = [...rooms[roomId], userInfo];
    // Log the state IMMEDIATELY after assigning the new array
    console.log(`[join-room] User ${userId} (socket ${socket.id}) successfully joined room ${roomId}.`);
    console.log(`[Server] State of rooms[${roomId}] IMMEDIATELY after push:`, JSON.stringify(rooms[roomId])); // Log room state stringified

    // Send updated user list (just names/IDs) to everyone in the room
    // Include color in the user list
    // Include socketId and role in the user list sent to clients
    const userList = rooms[roomId].map(u => ({
      userId: u.userId,
      username: u.username,
      color: u.color,
      socketId: u.socketId,
      role: u.role,
      profilePictureUrl: u.profilePictureUrl, // Ensure this is correctly mapped
      peerId: u.peerConnectionId // Ensure this is correctly mapped
    }));
    // Log the state RIGHT before emitting
    const currentRoomStateForEmit = rooms[roomId];
    console.log(`[Server] State of rooms[${roomId}] right before mapping/emitting user-list:`, JSON.stringify(currentRoomStateForEmit)); // Log the array content stringified
    console.log(`[Server] Emitting user-list for room ${roomId}:`, userList); // Log the list before sending
    io.to(roomId).emit("user-list", userList); // Emit the mapped list

    // Emit a specific event to confirm successful join to the joining client
    socket.emit('room-joined', { roomId, participants: userList });

    const historyToSend = roomWhiteboardHistories[roomId]; // Get history before emitting user-connected
    console.log(`[Server] Sending history to ${userId}. History length: ${historyToSend.length}`); // Log before send
    socket.to(roomId).emit("user-connected", userId, peerConnectionId, username); // Send username to others too

    // Send the current whiteboard history to the joining user
    socket.emit('whiteboard-history', roomWhiteboardHistories[roomId]);
    // Send the current chat history to the joining user
    socket.emit('chat-history', roomChatHistories[roomId]);
    console.log(`[Server] Sending chat history to ${userId}. History length: ${roomChatHistories[roomId].length}`);
  }

  // Handle explicit leave-room event from client
  socket.on("leave-room", async (roomId, userId) => { // Make async, assuming client sends roomId and userId
    console.log(`[leave-room event] User ${userId} (Socket: ${socket.id}) is attempting to leave room ${roomId}`);
    
    // --- NEW: Clear activeMeeting status on explicit leave ---
    if (userId) {
      try {
        const user = await User.findById(userId);
        // Check if they are leaving the meeting they are marked active in with this specific socket
        if (user && user.activeMeeting.meetingId === roomId && user.activeMeeting.socketId === socket.id) {
          user.activeMeeting.meetingId = null;
          user.activeMeeting.socketId = null;
          user.activeMeeting.joinedAt = null;
          await user.save();
          console.log(`Cleared active meeting for user ${userId} after leaving room ${roomId}.`);
        }
      } catch (error) {
        console.error(`Error clearing active meeting for user ${userId} on leave-room:`, error);
      }
    }
    // --- END NEW ---
    socket.leave(roomId);
    // Removed activeMeetings cleanup. The main "disconnect" event will handle user removal from the room.
  });

  // Handle drawing events (moved outside join-room)
  socket.on("draw", (data) => {
    const { roomId } = data;
    console.log(`[Server] Received draw event for room: ${roomId}`); // Log entry
    // Add drawing data to history if room exists
    if (roomId && roomWhiteboardHistories[roomId]) {
      console.log(`[Server] Found history for room ${roomId}. Current length before push: ${roomWhiteboardHistories[roomId].length}`); // Log state before push
      roomWhiteboardHistories[roomId].push(data);
      console.log(`[Server] Pushed draw data to history for room ${roomId}. New length: ${roomWhiteboardHistories[roomId].length}`); // Log after push
      // Broadcast drawing events to everyone else in the room
      socket.to(roomId).emit("draw", data);
    } else {
      // It's possible history doesn't exist if draw comes before join finishes, though unlikely with current setup
      console.warn(`Received draw event for non-existent room or history: ${roomId}`);
    }
  });

  // Handle chat messages (moved outside join-room)
  socket.on("message", ({ roomId, message }) => { // Expect an object
    // Verify the sender is actually in the specified room and has a username stored on the socket
    if (socket.roomId === roomId && socket.username) {
      // Find the user's info in the room to get their color
      const roomUsers = rooms[roomId] || [];
      const senderInfo = roomUsers.find(u => u.userId === socket.userId);
      const senderColor = senderInfo ? senderInfo.color : '#e0e0e0'; // Default to ash-white if not found

      const messageData = { username: socket.username, message, color: senderColor };

      // Store message in history (consider limiting size later)
      roomChatHistories[roomId]?.push(messageData);

      // Emit an object containing the username and message
      io.to(roomId).emit("createMessage", messageData); // Include color
    } else {
      console.warn(`Blocked message for room ${roomId} from socket ${socket.id} - not in room or no username.`);
    }
  });

  // Handle whiteboard clearing
  socket.on("clear-canvas", ({ roomId }) => {
    console.log(`[Server] Received clear-canvas for room: ${roomId}`); // Log entry
    if (roomId && roomWhiteboardHistories[roomId]) {
      console.log(`[Server] Found history for room ${roomId}. Current length: ${roomWhiteboardHistories[roomId].length}`); // Log state before clear
      // Clear the history on the server
      roomWhiteboardHistories[roomId] = [];
      console.log(`Cleared whiteboard history for room: ${roomId}`);
      // Broadcast to everyone in the room that it was cleared
      io.to(roomId).emit("canvas-cleared");
      console.log(`[Server] Broadcasted 'canvas-cleared' to room ${roomId}.`); // Log broadcast
    } else {
      // This might happen if clear comes before join finishes or after disconnect
      console.warn(`Received clear-canvas event for non-existent room or history: ${roomId}`);
    }
  });

  // Handle whiteboard permission changes initiated by admin
  socket.on("signal:set-whiteboard-permission", async ({ roomId, targetSocketId, hasControl }) => {
    const requestingUserId = socket.userId; // ID of the user sending the request
    const requestingUsername = socket.username;

    // --- IMPORTANT SECURITY TODO ---
    // Verify that the requestingUserId is actually the admin for this room.
    // This might involve looking up the user's role in your database or checking against room metadata.
    // For now, we'll log a warning. Replace this check with real validation.
    // const requestingUser = await User.findById(requestingUserId); // Example DB lookup
    // if (!requestingUser || requestingUser.role !== 'admin') {
    //   console.warn(`[SECURITY] Non-admin user ${requestingUsername} (${requestingUserId}) attempted to change whiteboard permissions.`);
    //   return; // Stop processing if not admin
    // }
    console.log(`[Server] Processing permission change for ${targetSocketId} in room ${roomId} to ${hasControl} requested by ${requestingUsername}`);

    // 1. Broadcast the requested update for the target user
    io.to(roomId).emit("signal:whiteboard-permission-update", { targetSocketId, hasControl });

    // 2. Find the admin in the room (assuming role is stored correctly in rooms[roomId])
    const adminInRoom = rooms[roomId]?.find(u => u.role === 'admin');

    if (adminInRoom && adminInRoom.socketId !== targetSocketId) { // Don't change admin if they are the target
      // 3. If the request was to GRANT control to someone else, REVOKE from admin
      //    If the request was to REVOKE control from someone else, GRANT back to admin
      const controlForAdmin = !hasControl; // Admin gets control if target loses it, loses if target gets it
      io.to(roomId).emit("signal:whiteboard-permission-update", { targetSocketId: adminInRoom.socketId, hasControl: controlForAdmin });
      console.log(`[Server] Also setting admin (${adminInRoom.username}) control to ${controlForAdmin}`);
    }
  });

  // Handle camera status changes
  socket.on("camera-status-changed", ({ roomId, peerId, isEnabled }) => {
    // Ensure the sender is actually in the room they claim
    if (socket.rooms.has(roomId) && socket.peerConnectionId === peerId) {
      console.log(`[Server] Camera status changed for peer ${peerId} in room ${roomId} to ${isEnabled}`);
      // Broadcast to everyone else in the room
      socket.to(roomId).emit("remote-camera-status-changed", { peerId, isEnabled });
    }
  });
});

// ...
const PORT = process.env.PORT || 5000; // Fallback for local dev
server.listen(PORT, '0.0.0.0', () => { // Start the http server instance that io is attached to
  console.log(`Server (including Socket.IO) running on port ${PORT}`);
});
