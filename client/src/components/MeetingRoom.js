// This component handles the actual meeting room functionality.
import React, { useEffect, useState, useRef, useCallback, useLayoutEffect, useMemo } from 'react';
import { v4 as uuidV4 } from 'uuid';
import io from 'socket.io-client';
import Peer from 'peerjs';
import { useParams, useNavigate } from 'react-router-dom'; // Import hooks for route params and navigation
import { useAuth } from '../context/AuthContext'; // Import useAuth
import './MeetingRoom.css'; // Import the component-specific CSS
import { FiMic, FiMicOff, FiVideo, FiVideoOff, FiLogOut, FiCopy, FiUsers, FiGrid, FiEdit3, FiX, FiEdit, FiLogIn } from 'react-icons/fi'; // Added FiX, FiEdit, FiLogIn
import Whiteboard from '../Whiteboard'; // Import the Whiteboard component
import { FaCrown } from 'react-icons/fa'; // Added FaCrown for admin/controller icon


// --- Simplified PeerVideo Component ---
const PeerVideo = ({ peerCall, username, profilePictureUrl, isRemoteVideoEnabled }) => {
  const videoRef = useRef();
  const [remoteStream, setRemoteStream] = useState(null);
  // Initialize based on isRemoteVideoEnabled if provided, otherwise assume false until stream comes.
  const [isVideoActuallyPlaying, setIsVideoActuallyPlaying] = useState(isRemoteVideoEnabled === undefined ? false : isRemoteVideoEnabled);

  // Effect 1: Get the stream from peerCall and manage its lifecycle
  useEffect(() => {
    if (!peerCall) {
      console.log(`[PeerVideo ${peerCall?.peer} for ${username}] No peerCall, clearing remoteStream.`);
      setRemoteStream(null);
      return;
    }

    // If remoteStream is already on the call object, use it directly
    if (peerCall.remoteStream) {
      console.log(`[PeerVideo ${peerCall.peer} for ${username}] Using existing remoteStream from call object.`);
      setRemoteStream(peerCall.remoteStream);
    }

    const handleStreamEvent = (stream) => {
      console.log(`[PeerVideo ${peerCall.peer} for ${username}] 'stream' event received. Stream ID: ${stream.id}`);
      setRemoteStream(stream);
    };
    const handleCloseEvent = () => {
      console.log(`[PeerVideo ${peerCall.peer} for ${username}] 'close' event received. Clearing remoteStream.`);
      setRemoteStream(null);
    };
    const handleErrorEvent = (err) => {
      console.error(`[PeerVideo ${peerCall.peer} for ${username}] 'error' event on call:`, err);
      setRemoteStream(null);
    };

    peerCall.on('stream', handleStreamEvent);
    peerCall.on('close', handleCloseEvent);
    peerCall.on('error', handleErrorEvent);

    return () => {
      console.log(`[PeerVideo ${peerCall.peer} for ${username}] Cleaning up peerCall listeners.`);
      peerCall.off('stream', handleStreamEvent);
      peerCall.off('close', handleCloseEvent);
      peerCall.off('error', handleErrorEvent);
    };
  }, [peerCall, username]);

  // Effect 2: Update isVideoActuallyPlaying based on the signaled remote status
  useEffect(() => {
    // If isRemoteVideoEnabled is explicitly passed (meaning we got a signal), use it.
    // Otherwise, if a stream exists, we can try to infer (e.g., for initial connection before signal).
    if (typeof isRemoteVideoEnabled === 'boolean') {
      console.log(`[PeerVideo ${peerCall?.peer} for ${username}] Using signaled isRemoteVideoEnabled: ${isRemoteVideoEnabled}`);
      setIsVideoActuallyPlaying(isRemoteVideoEnabled);
    } else if (remoteStream) {
      // Fallback for initial state if no signal yet, but stream arrived
      const tracks = remoteStream.getVideoTracks();
      const active = tracks.length > 0 && tracks.some(t => !t.muted && t.readyState === 'live');
      console.log(`[PeerVideo ${peerCall?.peer} for ${username}] No signal for isRemoteVideoEnabled, inferring from stream: ${active}`);
      setIsVideoActuallyPlaying(active);
    } else {
      // No signal and no stream
      setIsVideoActuallyPlaying(false);
    }
    // Note: We are removing the direct track mute/unmute listeners for now,
    // relying on the signaled status. If needed, they can be added back carefully
    // to work in conjunction with the signaled status.
  }, [isRemoteVideoEnabled, remoteStream, peerCall?.peer, username]);

  // Effect 3: Manage video element srcObject and playback based on isVideoActuallyPlaying
  useEffect(() => {
    const videoElement = videoRef.current;
    if (!videoElement) return;

    if (isVideoActuallyPlaying && remoteStream && remoteStream.active) { // Added remoteStream.active check
      console.log(`[PeerVideo DOM ${peerCall?.peer} for ${username}] Playing video. isVideoActuallyPlaying: true`);
      if (videoElement.srcObject !== remoteStream) {
        videoElement.srcObject = remoteStream;
      }
      videoElement.play().catch(e => console.error(`[PeerVideo DOM ${peerCall?.peer} for ${username}] Error playing video:`, e));
    } else {
      console.log(`[PeerVideo DOM ${peerCall?.peer} for ${username}] Stopping video / clearing srcObject. isVideoActuallyPlaying: ${isVideoActuallyPlaying}, remoteStream active: ${remoteStream?.active}`);
      videoElement.srcObject = null;
    }
  }, [isVideoActuallyPlaying, remoteStream, peerCall?.peer, username]); // videoRef.current is stable
  if (!peerCall) return null; // Don't render if no call
  console.log(`[PeerVideo Render ${peerCall?.peer}] Username: ${username}, ProfilePicURL: ${profilePictureUrl}, isVideoActuallyPlaying: ${isVideoActuallyPlaying}`);

return (
    <>
      <video
        ref={videoRef}
        className={`video-element ${!isVideoActuallyPlaying ? 'video-hidden' : ''}`}
        data-userid={peerCall.peer}
        autoPlay
        playsInline
      />
      {!isVideoActuallyPlaying && (
        <div className="video-placeholder">
          {profilePictureUrl ? (
            <img src={profilePictureUrl} alt={username || 'User'} className="profile-picture-in-video" />
          ) : (
            <div className="default-avatar-in-video">
              {(username?.charAt(0) || '?').toUpperCase()}
            </div>
          )}
          <span>{username || 'User'}</span>
          {/* You could add a "Camera Off" specific message here if desired */}
        </div>
      )}
    </>
  );};


const MeetingRoom = () => {
  // Get roomId from URL and user from context
  const { roomId } = useParams();
  const { user, loading: authLoading } = useAuth(); // Get user and loading state
  const navigate = useNavigate();

  // Refs
  const socketRef = useRef(null); // Ref to hold the socket instance
  const peerInstanceRef = useRef(null);
  const localStreamRef = useRef(null); // Store local stream in ref to avoid re-triggering effects
  const myVideoRef = useRef();
  const messagesEndRef = useRef(null);
  const peerIdRef = useRef(uuidV4()); // Stable PeerJS ID for this session

  // State
  const [isConnectedToSocket, setIsConnectedToSocket] = useState(false);
  const [isPeerInitialized, setIsPeerInitialized] = useState(false);
  const [localStreamState, setLocalStreamState] = useState(null); // For React to re-render local video
  const [peers, setPeers] = useState({}); // { peerId: callObject }
  const [messages, setMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [participants, setParticipants] = useState({}); // { socketId: { userId, username, ... } }
  const [hasJoinedRoom, setHasJoinedRoom] = useState(false);

  // UI State
  const [isMicEnabled, setIsMicEnabled] = useState(true);
  const [isCameraEnabled, setIsCameraEnabled] = useState(true);
  const [isShowingVideo, setIsShowingVideo] = useState(true);
  const [isParticipantListOpen, setIsParticipantListOpen] = useState(false);
  const [copySuccess, setCopySuccess] = useState('');
  const [localHasWhiteboardControl, setLocalHasWhiteboardControl] = useState(false);
  const [initialDrawingHistory, setInitialDrawingHistory] = useState([]);

  const [remoteCameraStatuses, setRemoteCameraStatuses] = useState({}); // { [peerId]: boolean }
  // State for custom alert
  const [customAlert, setCustomAlert] = useState({
    show: false,
    message: '',
    type: 'info', // 'info', 'error', 'success'
    onClose: null, // Optional callback for when the alert is closed
  });
  const isAdmin = user?.role === 'admin'; // Check if user is admin

  useEffect(() => {
    // Admin always starts with control
    setLocalHasWhiteboardControl(isAdmin);
  }, [isAdmin]);

  // Ensure these helper functions for the custom alert are defined within the component scope,
  // before they are used in useEffect or the return JSX.
  const showCustomAlert = (message, type = 'info', onCloseCallback = null) => {
    setCustomAlert({ show: true, message, type, onClose: onCloseCallback });
  };

  const hideCustomAlertAndCallback = () => {
    const callback = customAlert.onClose;
    setCustomAlert({ show: false, message: '', type: 'info', onClose: null });
    if (callback) {
      callback();
    }
  };

  // 1. Socket Connection
  useEffect(() => {
    const serverUrl = process.env.REACT_APP_SOCKET_SERVER_URL || 'http://localhost:5000'; // Use env var
    console.log(`[Socket Connection] Attempting to connect to: ${serverUrl}`);
    const newSocket = io(serverUrl, {
      auth: { token: localStorage.getItem('token') }
    });
    socketRef.current = newSocket;

    const handleConnect = () => {
      console.log('[Socket] Connected. ID:', newSocket.id);
      setIsConnectedToSocket(true);
    };
    const handleDisconnect = (reason) => {
      console.log('[Socket] Disconnected. Reason:', reason);
      setIsConnectedToSocket(false);
      setHasJoinedRoom(false); // Reset join status on disconnect
    };

    newSocket.on('connect', handleConnect);
    newSocket.on('disconnect', handleDisconnect);

    return () => {
      console.log('[Socket] Cleaning up socket connection.');
      newSocket.off('connect', handleConnect);
      newSocket.off('disconnect', handleDisconnect);
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, []); // Run only once on mount

  // 2. Get User Media (Local Stream)
  useEffect(() => {
    console.log('[Media] Attempting to get user media.');
    let streamInstance = null; // To hold the stream for cleanup
    navigator.mediaDevices.getUserMedia({ video: true, audio: true })
      .then(stream => { // This is asynchronous
        console.log("[Media] getUserMedia success. Stream ID:", stream.id);
        streamInstance = stream;
        localStreamRef.current = stream;
        console.log("[Media] Calling setLocalStreamState with the new stream.");
        setLocalStreamState(stream); // Update state to trigger re-render for local video
        // We will set srcObject in another effect that depends on localStreamState
        console.log("[Media] setLocalStreamState has been called.");
    }).catch(err => {
      console.error("[Media] Could not access media devices:", err);
      alert(`Camera Error: ${err.name} - ${err.message}\nPlease check browser/OS permissions.`);
      setLocalStreamState(null); // Ensure state is null on error
    });

    return () => {
      console.log('[Media] Cleaning up local stream.');
      if (streamInstance) { // Use the captured streamInstance for cleanup
        streamInstance.getTracks().forEach(track => track.stop());
      }
      localStreamRef.current = null; // Clear ref
      setLocalStreamState(null); // Clear state
    };
  }, []); // Run only once

  // Use useLayoutEffect for DOM manipulations like setting srcObject
  useLayoutEffect(() => {
    const videoElement = myVideoRef.current;
    // console.log('[Local Video Effect] Running. Video Element Ref:', !!videoElement, 'LocalStreamState:', !!localStreamState);

    if (!videoElement) {
      // console.log('[Local Video Effect] No video element ref available yet.');
      return;
    }

    // CRITICAL: Always ensure the local video element is muted for autoplay.
    videoElement.muted = true;

    if (localStreamState) {
      // console.log('[Local Video Effect] LocalStreamState is present. Attempting to attach.');
      if (videoElement.srcObject !== localStreamState) {
        // console.log('[Local Video Effect] srcObject is different or null, setting new stream.');
        videoElement.srcObject = localStreamState;
      }
      // The `autoPlay` attribute on the <video> tag should handle playing.
      // An explicit play() can be a fallback but might cause console errors if called too aggressively.
      // Let's rely on autoPlay first, as it's cleaner with muted streams.
      videoElement.play().catch(error => {
        // console.warn("[Local Video Effect] videoElement.play() caught an error (this can be normal if already playing or due to browser policy, but check if it's 'NotAllowedError' without mute):", error.name, error.message);
      });
    } else {
      // console.log('[Local Video Effect] No localStreamState, ensuring srcObject is null.');
      videoElement.srcObject = null;
    }
  }, [localStreamState, isShowingVideo]); // Add isShowingVideo to dependencies
                           // myVideoRef.current is captured when the effect runs.


  // 3. PeerJS Initialization
  useEffect(() => {
    if (!localStreamState) { // Depend on the state variable to ensure stream is ready for React
      console.log('[PeerJS] Waiting for local stream to initialize Peer.');
      return;
    }

    console.log(`[PeerJS] Initializing with ID: ${peerIdRef.current}`);
    const peer = new Peer(peerIdRef.current, {
      // host: 'localhost', port: 9000, path: '/myapp', // Example for self-hosted PeerServer
      debug: 3,
      config: { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] }
    });
    peerInstanceRef.current = peer;

    peer.on('open', (id) => {
      console.log('[PeerJS] Connection open. Peer ID:', id);
      setIsPeerInitialized(true);
    });

    peer.on('call', (call) => {
      console.log(`[PeerJS] Incoming call from ${call.peer}`);
      if (localStreamRef.current) { // Use the ref here as it's the actual stream object
        call.answer(localStreamRef.current);
        console.log(`[PeerJS] Answered call from ${call.peer}`);
        setPeers(prev => ({ ...prev, [call.peer]: call })); // Add incoming call to peers
      } else {
        console.error('[PeerJS] Cannot answer call, local stream not available.');
      }
    });

    peer.on('error', (err) => console.error('[PeerJS] Error:', err));
    peer.on('disconnected', () => {
      console.log('[PeerJS] Disconnected. Attempting to reconnect...');
      // PeerJS attempts to reconnect automatically.
      // You might want to handle UI state here.
    });
    peer.on('close', () => {
      console.log('[PeerJS] Connection closed.');
      setIsPeerInitialized(false);
    });

    return () => {
      console.log('[PeerJS] Cleaning up PeerJS instance.');
      if (peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
        peerInstanceRef.current.destroy();
      }
      peerInstanceRef.current = null;
      setIsPeerInitialized(false);
    };
  }, [localStreamState]); // Re-run if localStreamState changes (e.g., becomes available)

  // 4. Join Room Logic (Socket Emission)
  useEffect(() => {
    // Check localStreamState to ensure React knows the stream is ready
    if (isConnectedToSocket && isPeerInitialized && localStreamState && user && roomId && !hasJoinedRoom && !authLoading) {
      console.log(`[Socket] Emitting 'join-room'. Room: ${roomId}, User: ${user.username}, PeerID: ${peerIdRef.current}`);
      socketRef.current.emit('join-room', roomId, user._id, peerIdRef.current, user.username);
      // Note: `hasJoinedRoom` will be set by 'room-joined' event from server.
    } else {
      console.log(`[Socket] Join Room conditions not met: SocketConnected: ${isConnectedToSocket}, PeerInitialized: ${isPeerInitialized}, LocalStream: ${!!localStreamState}, User: ${!!user}, RoomID: ${!!roomId}, HasJoined: ${hasJoinedRoom}, AuthLoading: ${authLoading}`);
    }
  }, [isConnectedToSocket, isPeerInitialized, user, roomId, hasJoinedRoom, authLoading]); // localStreamRef.current is implicitly a dependency

  // Memoize handleUserConnected to ensure it has the latest state values when used in the socket listener effect
  const handleUserConnected = useCallback((connectedUserId, peerConnectionIdToCall, connectedUsername) => {
    console.log(`[Socket] 'user-connected': ${connectedUsername} (PeerID: ${peerConnectionIdToCall})`);
    // Use localStreamState to ensure React has acknowledged the stream
    if (connectedUserId !== user?._id && localStreamState && peerInstanceRef.current && isPeerInitialized) {
      console.log(`[PeerJS] Calling new user ${peerConnectionIdToCall}`);
      const call = peerInstanceRef.current.call(peerConnectionIdToCall, localStreamRef.current); // Use localStreamRef for the actual stream
      if (call) {
        console.log(`[PeerJS] Outgoing call object created for ${call.peer}. Adding to peers state.`);
        setPeers(prev => ({ ...prev, [call.peer]: call }));
      } else {
        console.error(`[PeerJS] Failed to create call object for ${peerConnectionIdToCall}`);
      }
    } else {
      console.warn(`[Socket] 'user-connected': Did not call. Conditions: localStreamState=${!!localStreamState}, peerInstance=${!!peerInstanceRef.current}, isPeerInitialized=${isPeerInitialized}, user?._id=${user?._id}`);
    }
  }, [user, localStreamState, isPeerInitialized]); // Dependencies for useCallback

  // 5. Main Socket Event Listeners
  useEffect(() => {
    const currentSocket = socketRef.current;
    if (!currentSocket || !user) return;

    console.log('[Socket] Setting up event listeners.');
    const handleRoomJoined = (data) => { // Assuming server sends { roomId, participants }
      console.log(`[Socket] 'room-joined' received. Room: ${data.roomId}, Participants:`, data.participants);
      setHasJoinedRoom(true);
    };

    const handleJoinRoomError = (data) => {
      console.error(`[Socket] 'join-room-error' received:`, data.message);
      showCustomAlert(
        `Could not join room: ${data.message}`,
        'error',
        () => leaveMeeting(true) // Pass leaveMeeting as the onClose callback
      );
    };

    const handleUserDisconnected = (disconnectedUserId, disconnectedPeerId) => {
      console.log(`[Socket] 'user-disconnected': UserID: ${disconnectedUserId}, PeerID: ${disconnectedPeerId}`);
      setPeers(prevPeers => {
        if (prevPeers[disconnectedPeerId]) {
          console.log(`[PeerJS] Closing call and removing peer: ${disconnectedPeerId}`);
          prevPeers[disconnectedPeerId].close(); // Close the PeerJS call
          const newPeers = { ...prevPeers };
          delete newPeers[disconnectedPeerId];
          return newPeers;
        }
        return prevPeers; // No change if peer wasn't found
      });
    };

    const handleCreateMessage = (messageData) => { // Expect { username: '...', message: '...', color: '...' }
      console.log('[Socket] \'createMessage\':', messageData);
      setMessages(prev => [...prev, messageData]);
    };

    const handleWhiteboardHistory = (history) => {
      console.log("[Socket] 'whiteboard-history':", history);
      setInitialDrawingHistory(history || []);
    };

    const handleUserList = (users) => {
      console.log('[Socket] \'user-list\':', users);
      const participantsMap = {};
      (users || []).forEach(p => {
        participantsMap[p.socketId] = {
          ...p,
          hasWhiteboardControl: participants[p.socketId]?.hasWhiteboardControl ?? (p.role === 'admin')
        };
      });
      setParticipants(participantsMap);
    };

    const handleChatHistory = (history) => {
      console.log('[Socket] \'chat-history\':', history);
      setMessages(Array.isArray(history) ? history : []);
    };

    const handleWhiteboardPermissionUpdate = ({ targetSocketId, hasControl }) => {
      console.log(`[Socket] 'signal:whiteboard-permission-update': Target: ${targetSocketId}, HasControl: ${hasControl}`);
      setParticipants(prev => {
        if (prev[targetSocketId]) {
          return { ...prev, [targetSocketId]: { ...prev[targetSocketId], hasWhiteboardControl: hasControl } };
        }
        return prev;
      });
      if (currentSocket?.id === targetSocketId) {
        setLocalHasWhiteboardControl(hasControl);
      }
    };

    const handleRemoteCameraStatusChanged = ({ peerId, isEnabled }) => {
      console.log(`[Socket] 'remote-camera-status-changed' received for peer ${peerId}, isEnabled: ${isEnabled}`);
      setRemoteCameraStatuses(prevStatuses => ({
        ...prevStatuses,
        [peerId]: isEnabled,
      }));
    };

    currentSocket.on('room-joined', handleRoomJoined);
    currentSocket.on('join-room-error', handleJoinRoomError); // Add new listener
    currentSocket.on('user-connected', handleUserConnected);
    currentSocket.on('user-disconnected', handleUserDisconnected);
    currentSocket.on('createMessage', handleCreateMessage);
    currentSocket.on('whiteboard-history', handleWhiteboardHistory);
    currentSocket.on('signal:whiteboard-permission-update', handleWhiteboardPermissionUpdate);
    currentSocket.on('user-list', handleUserList);
    currentSocket.on('chat-history', handleChatHistory);
    currentSocket.on('remote-camera-status-changed', handleRemoteCameraStatusChanged);
    // Add listener for whiteboard draw events
    // currentSocket.on('draw', handleDrawEvent); // Assuming Whiteboard component handles this
    // currentSocket.on('canvas-cleared', handleCanvasCleared); // Assuming Whiteboard component handles this

    return () => {
      console.log('[Socket] Cleaning up event listeners.');
      currentSocket.off('room-joined', handleRoomJoined);
      currentSocket.off('join-room-error', handleJoinRoomError);
      currentSocket.off('user-connected', handleUserConnected);
      currentSocket.off('user-disconnected', handleUserDisconnected);
      currentSocket.off('createMessage', handleCreateMessage);
      currentSocket.off('whiteboard-history', handleWhiteboardHistory);
      currentSocket.off('signal:whiteboard-permission-update', handleWhiteboardPermissionUpdate);
      currentSocket.off('user-list', handleUserList);
      currentSocket.off('chat-history', handleChatHistory);
      currentSocket.off('remote-camera-status-changed', handleRemoteCameraStatusChanged);
      // currentSocket.off('draw', handleDrawEvent);
      // currentSocket.off('canvas-cleared', handleCanvasCleared);
    };
  }, [isConnectedToSocket, user, participants, handleUserConnected]); // Add handleUserConnected to dependencies

  // Effect for `beforeunload` to emit `leave-room`
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (socketRef.current && hasJoinedRoom && user && roomId) {
        console.log('[App Lifecycle] beforeunload: Emitting leave-room.');
        socketRef.current.emit('leave-room', roomId, user._id);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [hasJoinedRoom, user, roomId]);

  // Scroll chat to bottom
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollTop = messagesEndRef.current.scrollHeight;
    }
  }, [messages]);

// Calculate total number of video tiles to display (1 for local + number of peers)
  const totalVideoTiles = useMemo(() => {
    if (!isShowingVideo) return 0;
    return 1 + Object.keys(peers).length;
  }, [isShowingVideo, peers]);

  const participantCount = Object.keys(participants).length; // For participant list display
  // --- UI Handlers ---
  const getVideoLayoutClass = (count) => {
    if (!isShowingVideo) return ''; // No layout if videos are hidden

    if (count === 1) return 'layout-1'; // Full box
    if (count === 2) return 'layout-2'; // Side-by-side
    if (count === 3) return 'layout-3'; // 2 top, 1 bottom centered
    if (count === 4) return 'layout-4'; // 2x2 grid
    if (count > 4) return 'layout-scrollable'; // Grid with scroll

    // Fallback for 0 tiles, though this case should ideally not render the grid or have a specific placeholder
    return 'layout-default'; // Or 'layout-1' if a single placeholder is always shown for 0 active videos
  };

  const toggleMainView = () => {
    // Allow any user to toggle between video and whiteboard view.
    // Drawing permission is handled by the `canDraw` prop on the Whiteboard component.
    setIsShowingVideo(prev => !prev);
  };

  const sendMessage = () => {
    if (chatInput.trim() && user && socketRef.current) {
      socketRef.current.emit('message', { roomId, message: chatInput.trim() });
      setChatInput('');
    }
  };

  const leaveMeeting = (isErrorLeave = false) => { // Add optional parameter
    if (!user && !isErrorLeave) return; // Allow leave even if user context is briefly lost during an error
    const userId = user?._id; // Use optional chaining if user might be null during error leave
    console.log(`Leaving meeting... UserID: ${userId}, IsErrorLeave: ${isErrorLeave}`);
    if (socketRef.current && hasJoinedRoom) {
      socketRef.current.emit('leave-room', roomId, userId);
    }

    // Stop local media tracks
    if (localStreamRef.current) {
      console.log("[Leave Meeting] Stopping local stream tracks.");
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
      setLocalStreamState(null);
    }

    Object.values(peers).forEach(call => call.close());
    setPeers({});
    if (peerInstanceRef.current && !peerInstanceRef.current.destroyed) {
      peerInstanceRef.current.destroy();
    }
    peerInstanceRef.current = null;

    // Navigate back to the appropriate dashboard, ensure user object exists for role check
    if (user?.role) {
        if (user.role === 'admin') {
            navigate('/admin/dashboard', { replace: true });
        } else if (user.role === 'manager') {
            navigate('/manager/dashboard', { replace: true });
        } else {
            navigate('/user/dashboard', { replace: true });
        }
    }
  };

  const toggleMic = () => {
    if (!localStreamRef.current) return;
    const audioTracks = localStreamRef.current.getAudioTracks();
    if (audioTracks.length > 0) {
      const newState = !isMicEnabled;
      audioTracks[0].enabled = newState; // Enable/disable the track
      setIsMicEnabled(newState); // Update state
      console.log(`[Controls] Microphone ${newState ? 'enabled' : 'disabled'}`);
    }
  };

  const toggleCamera = () => {
    if (!localStreamRef.current) return;
    const videoTracks = localStreamRef.current.getVideoTracks();
    if (videoTracks.length > 0) {
      const newState = !isCameraEnabled;
      videoTracks[0].enabled = newState; // Enable/disable the track
      setIsCameraEnabled(newState); // Update state
      // Emit camera status change
      if (socketRef.current && hasJoinedRoom) {
        socketRef.current.emit("camera-status-changed", { roomId, peerId: peerIdRef.current, isEnabled: newState });
      }
      console.log(`[Controls] Camera ${newState ? 'enabled' : 'disabled'}`);
    }
  };

  const copyRoomIdToClipboard = async () => {
    if (!roomId) return;
    try {
      await navigator.clipboard.writeText(roomId);
      setCopySuccess('Copied!');
      setTimeout(() => setCopySuccess(''), 1500); // Clear message after 1.5s
    } catch (err) {
      console.error('Failed to copy room ID: ', err);
      setCopySuccess('Failed');
      setTimeout(() => setCopySuccess(''), 1500);
    }
  };

  const toggleParticipantList = () => {
    setIsParticipantListOpen(prev => !prev);
  };

  const toggleWhiteboardControl = (targetSocketId) => {
    if (!isAdmin || socketRef.current?.id === targetSocketId) return; // Only admin can change, and not for themselves

    const targetUser = participants[targetSocketId];
    if (!targetUser) return;

    const newPermissionState = !targetUser.hasWhiteboardControl;
    socketRef.current?.emit('signal:set-whiteboard-permission', { roomId, targetSocketId, hasControl: newPermissionState });
  };

  

  // --- Render Logic ---
  if (authLoading || !user) {
    return (
      <div className="meeting-room-page">
        <div style={{ margin: 'auto', textAlign: 'center' }}>Authenticating...</div>
      </div>
    );
  }
  if (!roomId) {
    return <div>No Room ID specified. Please use the dashboard to create or join a room.</div>;
  }

  // Main JSX (similar to original, adapted for new state/refs)
  return (
    <div className="app-container"> {/* Or a more specific meeting-container class */}
      <div className="header">
      <img
          src="/assets/images/logo1.png"
          alt="MeetSphere Logo"
          className="header-logo"
        />
        {/* Loading/Joining indicator if roomId is present but not yet successfully joined */}
        {roomId && !hasJoinedRoom && (
            <div className="joining-indicator" style={{position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', textAlign: 'center', color: '#fff'}}>
                <FiLogIn size={24} style={{ marginRight: '8px' }} /> {/* Use new state here */}
                {isConnectedToSocket ? `Joining room: ${roomId}...` : "Connecting to meeting services..."}
            </div>
        )}
        {hasJoinedRoom && (
          <>
        {/* Left side: Room ID/Copy Button */}
        
        <div className="header-room-info">
          <h2>
            {isAdmin ? (
              <button onClick={copyRoomIdToClipboard} className="copy-room-id-button" title="Copy Room ID">
                Room ID <FiCopy style={{ marginLeft: '5px', verticalAlign: 'middle' }}/>
              </button>
            ) : (
              null // Regular users see nothing here
            )}            
            {copySuccess && <span className="copy-feedback">{copySuccess}</span>}
          </h2>
        </div>
        <button onClick={toggleMainView} className="toggle-view-button" title={isShowingVideo ? 'Switch to Whiteboard view' : 'Switch to Video Grid view'}>
          {/* Keep the text for clarity */}
          <span>{isShowingVideo ? 'Show Whiteboard' : 'Show Videos'}</span>
        </button>
        {/* Right side: Participant Count */}
        <div className="participant-area"> {/* Container for positioning dropdown */}
          <button // Changed div to button for better accessibility
            className={`participant-count-display ${isParticipantListOpen ? 'active' : ''}`}
            title={`${participantCount} participant${participantCount !== 1 ? 's' : ''}`}
            onClick={toggleParticipantList} // Use dropdown toggle function
          >
            <span className="active-dot"></span> <FiUsers /> <span>{participantCount}</span>
          </button>
          {/* Participant Dropdown List - Rendered conditionally */}
          {isParticipantListOpen && (
            <div className="participant-dropdown">
              <ul className="participants-list">
                {/* Render self first */}
                {user && participants[socketRef.current?.id] && (
                  <li key={user._id} className="participant-item self">
                    <span className="participant-name">
                      {user.username}
                      {user.role === 'admin' && <FaCrown title="Admin" className="admin-icon" />}
                      {' (You)'} {/* Directly add '(You)' here */}
                    </span>
                    {/* No controls for self */}
                  </li>
                )}
                {/* Render other participants */}
                {Object.entries(participants)
                  .filter(([socketId]) => socketId !== socketRef.current?.id) // Filter out self
                  .map(([socketId, participantInfo]) => ( // Keep original name here for clarity within map
                    <li key={socketId} className="participant-item">
                      <span className="participant-name">
                        {participantInfo.username}
                        {participantInfo.role === 'admin' && <FaCrown title="Admin" className="admin-icon" />}
                        {/* No '(You)' needed here */}
                      </span>
                      {/* Admin controls for others */}
                      {isAdmin && ( // No need to check socketId !== self here due to filter
                      <button
                        onClick={() => toggleWhiteboardControl(socketId)} // Use socketId from map
                        className={`permission-control-button ${participantInfo.hasWhiteboardControl ? 'revoke' : 'grant'}`} /* Use renamed class */
                        title={participantInfo.hasWhiteboardControl ? 'Revoke Whiteboard Control' : 'Grant Whiteboard Control'}>
                        <FiEdit /> {participantInfo.hasWhiteboardControl ? 'Revoke' : 'Grant'}
                      </button>
                      )}
                    </li>
                  ))}
              </ul>
            </div>
          )}
        </div>
        </>
        )}
      </div> {/* End of header */}

      <div className="main-content"> {/* Start of main content area */}
        {/* Custom Alert Modal */}
        {customAlert.show && (
          <div className="custom-alert-overlay">
            <div className={`custom-alert-box custom-alert-${customAlert.type}`}>
              <h4>{customAlert.type.charAt(0).toUpperCase() + customAlert.type.slice(1)}</h4>
              <p>{customAlert.message}</p>
              <button onClick={hideCustomAlertAndCallback} className="custom-alert-button">
                OK
              </button>
            </div>
          </div>
        )}

        {/* Video/Whiteboard Section */}
        <div className="video-section">
          {/* Video Grid Area */}
          <div
            className={`video-grid ${getVideoLayoutClass(totalVideoTiles)}`}
            style={{ display: isShowingVideo ? 'flex' : 'none' }}
          >
            
            {/* Render local video tile */}
            {isShowingVideo && (
              <div className="video-container self-video-container">
                <video
                  key="local-user-video"
                  ref={myVideoRef}
                  className={`video-element ${(!localStreamState || !isCameraEnabled) ? 'video-hidden' : ''}`}
                  muted
                  autoPlay
                  playsInline
                />
                {(!localStreamState || !isCameraEnabled) && (
                  <div className="video-placeholder">
                    {user?.profilePictureUrl ? (
                      <img src={user.profilePictureUrl} alt={user.username} className="profile-picture-in-video" />
                    ) : (
                      <div className="default-avatar-in-video">
                        {(user?.username?.charAt(0) || 'U').toUpperCase()}
                      </div>
                    )}
                    <span>{user?.username || 'You'}</span>
                    {/* <span>Camera Off</span> */}
                  </div>
                )}
              </div>
            )}
            {/* Render peer videos */}
            {isShowingVideo && hasJoinedRoom && Object.entries(peers).map(([peerId, call]) => {
              const participantDetail = Object.values(participants).find(p => p.peerId === peerId);
              const isRemoteEnabled = remoteCameraStatuses[peerId]; // Get signaled status
              console.log(`[MeetingRoom Render PeerVideo] For PeerID: ${peerId}, Found Participant:`, participantDetail, "All Participants:", participants);              return (
                <div key={peerId} className="video-container">
                  <PeerVideo
                    peerCall={call}
                    username={participantDetail?.username}
                    profilePictureUrl={participantDetail?.profilePictureUrl}
                    isRemoteVideoEnabled={isRemoteEnabled} // Pass the signaled status
                  />
                </div>
              );
           })}
          </div>

          {/* Whiteboard Area */}
          {/* Whiteboard is shown if not showing video AND user has joined (as it needs socket) */}
          {hasJoinedRoom && (
            <div className="whiteboard-container" style={{ display: !isShowingVideo ? 'flex' : 'none', height: '100%' }}>
              <Whiteboard socket={socketRef.current} roomId={roomId} initialHistory={initialDrawingHistory} canDraw={localHasWhiteboardControl} />
            </div>
          )}

          {/* Media Controls Bar - Moved inside video-section */}
          {/* Show controls if local stream exists OR user has joined */}
          {(localStreamState || hasJoinedRoom) && (
            <div className="media-controls">
              {localStreamState && ( // Mic/Cam controls only if stream exists
                <>
                  <button onClick={toggleMic} className={`control-button ${!isMicEnabled ? 'disabled' : ''}`} title={isMicEnabled ? 'Mute Mic' : 'Unmute Mic'}>
                    {isMicEnabled ? <FiMic size={20} /> : <FiMicOff size={20} />}
                    <span>{isMicEnabled ? 'Mute' : 'Unmute'}</span>
                  </button>
                  <button onClick={toggleCamera} className={`control-button ${!isCameraEnabled ? 'disabled' : ''}`} title={isCameraEnabled ? 'Stop Video' : 'Start Video'}>
                    {isCameraEnabled ? <FiVideo size={20} /> : <FiVideoOff size={20} />}
                    <span>{isCameraEnabled ? 'Stop Video' : 'Start Video'}</span>
                  </button>
                </>
              )}
              {hasJoinedRoom && ( // Leave button only if joined
                <button onClick={leaveMeeting} className="control-button leave" title="Leave Meeting">
                  <FiLogOut size={20} />
                  <span>Leave</span>
                </button>
              )}
            </div>
          )}

          {/* Fallback content if not showing video grid and not joined (e.g., whiteboard area placeholder) */}
          {!hasJoinedRoom && !isShowingVideo && (
            <div className="joining-indicator-main-content" style={{display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100%', color: '#ccc'}}>
                <FiLogIn size={30} style={{ marginBottom: '10px' }} />
                <p>Joining room: {roomId}...</p>
                <p>Whiteboard will be available once connected.</p>
            </div>
          )}
        </div>

        {/* Sidebar Section (Chat) */}
        <div className="sidebar-section">
          <div className="chat-container">
            <h3>Chat</h3>
            <div ref={messagesEndRef} className="messages-display">
            {/* Only render chat if successfully joined */}
            {hasJoinedRoom && (
              messages.map((msg, idx) => (
                // Display username and message
                <div key={idx} className="message">
                    <strong style={{ color: msg.color || '#e0e0e0' }}> {/* Apply color */}
                    {msg.username || 'User'}:
                  </strong> {msg.message}                </div>
              )) // End of messages.map
            )} {/* End of hasSuccessfullyJoined conditional block */}
            </div> {/* End of messages-display */}
            <div className="message-input-area">
              <input
                type="text"
                value={chatInput}
                placeholder="Type message..."
                onChange={(e) => setChatInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && sendMessage()}
              />
              <button onClick={sendMessage}>Send</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MeetingRoom; // Export the main component