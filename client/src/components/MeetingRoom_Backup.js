// This file is a backup of the core meeting logic previously in App.js
// It needs to be integrated with AuthContext and refactored for the /room/:roomId route

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { v4 as uuidV4 } from 'uuid';
import io from 'socket.io-client';
import Whiteboard from '../Whiteboard'; // Adjust path if needed
import Peer from 'peerjs';

// TODO: Socket connection should likely be managed by context or passed as prop
const socket = io('http://localhost:5000');

// TODO: This component will need props like roomId, user (from AuthContext)
const MeetingRoom_Backup = (/* { roomId, user } */) => {
  // --- State and Refs from original App.js ---
  const [peers, setPeers] = useState({});
  const myVideo = useRef();
  const videoGridRef = useRef();
  const [participantCount, setParticipantCount] = useState(1);
  const peerInstance = useRef(null);
  const [localStream, setLocalStream] = useState(null);
  const [isShowingVideo, setIsShowingVideo] = useState(true); // Or maybe controlled by admin role?
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const messagesEndRef = useRef(null);
  const [initialDrawingHistory, setInitialDrawingHistory] = useState([]);

  // TODO: Get roomId from route params (useParams from react-router-dom)
  const roomId = 'TEMP_ROOM_ID'; // Placeholder
  // TODO: Get userId and username from AuthContext
  const userId = 'TEMP_USER_ID'; // Placeholder
  const username = 'TEMP_USERNAME'; // Placeholder

  // --- Callbacks from original App.js ---
  const connectToNewUser = useCallback((peerConnectionIdToCall, stream) => {
    if (!stream || !stream.active) {
      console.error("Local stream not available or active in connectToNewUser");
      return;
    }
    console.log(`Attempting to call peer: ${peerConnectionIdToCall}`);
    if (!peerInstance.current) {
      console.error("PeerJS instance is not ready in connectToNewUser");
      return;
    }

    const call = peerInstance.current.call(peerConnectionIdToCall, stream);
    if (!call) {
      console.warn("Call object is undefined. Could not connect to Peer ID:", peerConnectionIdToCall);
      return;
    }

    console.log(`PeerJS call object created for peer: ${peerConnectionIdToCall}`);

    call.on('stream', userVideoStream => {
      console.log(`Received stream from peer: ${peerConnectionIdToCall}`);
      // Stream handled by PeerVideo component (needs to be included/imported)
    });

    call.on('close', () => {
      console.log(`Call with peer ${peerConnectionIdToCall} closed.`);
    });

    setPeers(prev => {
      console.log(`Adding call object for ${peerConnectionIdToCall} to peers state.`);
      return { ...prev, [peerConnectionIdToCall]: call };
    });
  }, []); // Removed dependency on peerInstance.current - refs don't need to be dependencies

  // --- Effects from original App.js (adapted slightly) ---

  // Effect 1: Get Media, Initialize PeerJS, Join Room
  useEffect(() => {
    // TODO: Check if user is authenticated before proceeding

    const unloadHandler = () => {
      socket.emit('leave-room', roomId, userId);
    };
    window.addEventListener('beforeunload', unloadHandler);

    let streamInstance = null;

    navigator.mediaDevices.getUserMedia({ video: true, audio: false }).then(stream => {
      streamInstance = stream;
      setLocalStream(stream);
      // Note: Setting srcObject and playing is handled by the other effect now

      // TODO: Generate a unique peer ID, maybe based on userId or a new UUID
      const peerConnectionId = uuidV4(); // Example
      console.log(`Initializing PeerJS with connection ID: ${peerConnectionId}`);
      peerInstance.current = new Peer(peerConnectionId);

      peerInstance.current.on('open', id => {
        console.log(`PeerJS connection open with ID: ${id}. Emitting join-room.`);
        // TODO: Send username along with IDs
        socket.emit('join-room', roomId, userId, id, username);
      });

      peerInstance.current.on('error', (err) => {
        console.error('PeerJS main instance error:', err);
      });

    }).catch(err => {
      console.error("Could not access media devices:", err);
      alert(`Camera Error: ${err.name} - ${err.message}\nPlease check browser/OS permissions.`);
    });

    // Cleanup function
    return () => {
      window.removeEventListener('beforeunload', unloadHandler);
      console.log(`[User ${userId}] Cleanup: Stopping local stream tracks.`);
      localStream?.getTracks().forEach(track => track.stop());
      setLocalStream(null);
      console.log(`[User ${userId}] Cleanup: Destroying PeerJS instance.`);
      if (peerInstance.current && !peerInstance.current.destroyed) {
        peerInstance.current.destroy();
      }
      peerInstance.current = null;
      // TODO: Consider if socket 'leave-room' should be emitted here too
    };
    // Dependencies: roomId, userId, username (once obtained from context)
  }, [roomId, userId, username]); // Add username

  // Effect 2: Setup PeerJS Call Listener
  useEffect(() => {
    if (!peerInstance.current) return;

    const handleIncomingCall = (call) => {
      console.log(`Incoming call from ${call.peer}`);
      if (localStream && localStream.active) {
        call.answer(localStream);
        console.log(`Answering call from ${call.peer}`);
      } else {
        console.error(`Cannot answer call from ${call.peer}, localStream not ready or not active.`);
        return;
      }

      call.on('stream', userVideoStream => {
        console.log(`Stream received from incoming call ${call.peer}`);
        // Stream handled by PeerVideo component
      });
      call.on('close', () => {
        console.log(`Call with ${call.peer} closed.`);
        // Peer removal handled by user-disconnected socket event
      });

      setPeers(prev => {
        console.log(`Adding incoming call object for ${call.peer} to peers state.`);
        return { ...prev, [call.peer]: call };
      });
    };

    console.log("Attaching PeerJS 'call' listener.");
    peerInstance.current.on('call', handleIncomingCall);

    return () => {
      console.log("Removing PeerJS 'call' listener.");
      peerInstance.current?.off('call', handleIncomingCall);
    };
  }, [localStream]); // Depends on localStream

  // Effect 3: Setup Socket Listeners
  useEffect(() => {
    if (!socket || !roomId) return;

    // Handler for new user connecting
    const handleUserConnected = (connectedUserId, peerConnectionIdToCall, connectedUsername) => {
      console.log(`User connected: ${connectedUsername} (${connectedUserId} / Peer: ${peerConnectionIdToCall})`);
      if (connectedUserId !== userId && localStream) {
        connectToNewUser(peerConnectionIdToCall, localStream);
      }
    };

    // Handler for user disconnecting
    const handleUserDisconnected = (disconnectedUserId, disconnectedPeerId) => {
      console.log(`User disconnected: ${disconnectedUserId} (Peer ID: ${disconnectedPeerId})`);
      setPeers(prevPeers => {
        if (prevPeers[disconnectedPeerId]) {
          console.log(`Closing connection and removing peer: ${disconnectedPeerId}`);
          prevPeers[disconnectedPeerId].close(); // Close the PeerJS call
          const newPeers = { ...prevPeers };
          delete newPeers[disconnectedPeerId];
          return newPeers;
        }
        return prevPeers; // No change if peer wasn't found
      });
    };

    // Handler for receiving chat messages
    const handleCreateMessage = (messageData) => { // Expect { username: '...', message: '...' }
      setMessages(prev => [...prev, messageData]);
    };

    // Handler for receiving initial whiteboard history
    const handleWhiteboardHistory = (history) => {
      console.log("Received 'whiteboard-history'. Data:", history);
      setInitialDrawingHistory(history || []);
    };

    // Attach listeners
    console.log("Attaching Socket listeners.");
    socket.on('user-connected', handleUserConnected);
    socket.on('user-disconnected', handleUserDisconnected);
    socket.on('createMessage', handleCreateMessage);
    socket.on('whiteboard-history', handleWhiteboardHistory);

    // Cleanup listeners
    return () => {
      console.log("Removing socket listeners.");
      socket.off('user-connected', handleUserConnected);
      socket.off('user-disconnected', handleUserDisconnected);
      socket.off('createMessage', handleCreateMessage);
      socket.off('whiteboard-history', handleWhiteboardHistory);
    };
    // Dependencies: roomId, userId, localStream, connectToNewUser
  }, [roomId, userId, localStream, connectToNewUser]);

  // Effect to attach local stream to video element
  useEffect(() => {
    if (isShowingVideo && localStream && myVideo.current) {
      if (myVideo.current.srcObject !== localStream) {
        myVideo.current.srcObject = localStream;
        myVideo.current.muted = true;
      }
      myVideo.current.play().catch(err => console.error("Local video play failed:", err));
    }
  }, [isShowingVideo, localStream]);

  // Effect to scroll chat
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]);

  // Effect to update participant count
  useEffect(() => {
    const count = Object.keys(peers).length + 1; // +1 for self
    setParticipantCount(count);
  }, [peers]);


  // --- Helper Functions from original App.js ---
  const getVideoLayoutClass = (count) => {
    if (count === 1) return 'layout-1';
    if (count === 2) return 'layout-2';
    if (count >= 3 && count <= 4) return 'layout-4';
    if (count >= 5 && count <= 6) return 'layout-6';
    if (count >= 7 && count <= 9) return 'layout-9';
    return 'layout-many';
  };

  const toggleMainView = () => {
    // TODO: Check if user is admin before allowing toggle
    setIsShowingVideo(prev => !prev);
  };

  const sendMessage = () => {
    if (input.trim()) {
      // Send message object including username
      socket.emit('message', { roomId, message: input.trim() }); // Server will add username
      setInput('');
    }
  };

  const leaveMeeting = () => {
    console.log("Leaving meeting...");
    socket.emit('leave-room', roomId, userId);

    Object.values(peers).forEach(call => call.close());
    setPeers({});
    peerInstance.current?.destroy();

    // TODO: Navigate back to dashboard instead of reloading
    // navigate('/dashboard'); // Example using react-router-dom navigate
    window.location.reload(); // Temporary placeholder
  };

  // --- JSX Structure from original App.js ---
  // TODO: Adapt this structure, potentially removing header/sidebar if handled by a layout component
  return (
    <div className="app-container"> {/* Or a more specific meeting-container class */}
      <div className="header">
        <h2>Room: {roomId} ({participantCount} participant{participantCount !== 1 ? 's' : ''})</h2>
        {/* TODO: Only show toggle button for admin */}
        <button onClick={toggleMainView} className="toggle-view-button">
          {isShowingVideo ? 'Show Whiteboard' : 'Show Videos'}
        </button>
        <button onClick={leaveMeeting} className="leave-button">Leave Meeting</button>
      </div>
      <div className="main-content">
        {/* Video/Whiteboard Section */}
        <div className="video-section">
          {/* Video Grid Area */}
          <div
            ref={videoGridRef}
            className={`video-grid ${getVideoLayoutClass(participantCount)}`}
            style={{ display: isShowingVideo ? 'grid' : 'none' }}
          >
            {/* Render local video */}
            {isShowingVideo && localStream && (
              <video
                ref={myVideo}
                className="video-element self-video"
                muted
                autoPlay
                playsInline
              ></video>
            )}
            {/* Render peer videos */}
            {isShowingVideo && Object.entries(peers).map(([peerId, call]) => (
              <PeerVideo key={peerId} peerId={peerId} call={call} />
            ))}
          </div>

          {/* Whiteboard Area */}
          {/* TODO: Only render/show if admin */}
          <div className="whiteboard-container" style={{ display: !isShowingVideo ? 'flex' : 'none', height: '100%' }}>
            <Whiteboard socket={socket} roomId={roomId} initialHistory={initialDrawingHistory} />
          </div>
        </div>

        {/* Sidebar Section (Chat) */}
        <div className="sidebar-section">
          <div className="chat-container">
            <h3>Chat</h3>
            <div ref={messagesEndRef} className="messages-display">
              {messages.map((msg, idx) => (
                // Display username and message
                <div key={idx} className="message">
                  <strong>{msg.username || 'User'}:</strong> {msg.message}
                </div>
              ))}
            </div>
            <div className="message-input-area">
              <input
                type="text"
                value={input}
                placeholder="Type message..."
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()} // Send on Enter key
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// --- PeerVideo Component (Needs to be included or imported) ---
const PeerVideo = ({ peerId, call }) => {
  const videoRef = useRef();
  const [stream, setStream] = useState(null);

  useEffect(() => {
    if (call && call.remoteStream) {
      setStream(call.remoteStream);
    }

    const handleStream = (remoteStream) => {
      setStream(remoteStream);
    };

    call.on('stream', handleStream);

    // Log if stream event doesn't fire (optional)
    const streamTimeout = setTimeout(() => {
      if (!videoRef.current?.srcObject) { // Check if stream was set
         console.warn(`PeerVideo ${peerId}: 'stream' event might not have fired within 10s.`);
      }
    }, 10000);

    return () => {
      call.off('stream', handleStream);
      clearTimeout(streamTimeout);
    };
  }, [call, peerId]);

  useEffect(() => {
    if (stream && videoRef.current) {
      if (videoRef.current.srcObject !== stream) {
        videoRef.current.srcObject = stream;
        videoRef.current.play().catch(err => console.error(`Peer video play failed for ${peerId}:`, err));
      }
    }
  }, [stream, peerId]);

  return <video ref={videoRef} className="video-element" data-userid={peerId} autoPlay playsInline></video>;
};


// export default MeetingRoom_Backup; // Don't export by default