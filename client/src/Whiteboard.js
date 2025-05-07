// === Frontend: Whiteboard.js ===

import React, { useEffect, useRef, useState } from 'react';

const Whiteboard = ({ socket, roomId, initialHistory, canDraw }) => { // Accept canDraw prop instead of userRole
  const canvasRef = useRef(null);
  const ctxRef = useRef(null);
  const drawingRef = useRef(false);
  const [color, setColor] = useState('black'); // Add state for color
  const [lineWidth, setLineWidth] = useState(2); // Add state for line width
  const [localHistory, setLocalHistory] = useState([]); // Internal state for drawing history

  // const isAdmin = userRole === 'admin'; // Remove isAdmin check here, rely on canDraw

  useEffect(() => {
    const canvas = canvasRef.current;
    canvas.width = 800;
    canvas.height = 400; // Adjusted height
    canvas.style.border = '1px solid #000';
    canvas.style.touchAction = 'none'; // Prevent scrolling on canvas touch
    const ctx = canvas.getContext('2d');
    ctx.lineCap = 'round';
    ctx.strokeStyle = color; // Use state
    ctx.lineWidth = lineWidth; // Use state
    ctxRef.current = ctx;

    // Set initial history when component mounts and initialHistory is available
    // Ensure initialHistory is an array before setting
    console.log("Whiteboard Mount/Update Effect 1: initialHistory prop is:", initialHistory); // Log prop value
    if (Array.isArray(initialHistory)) {
        console.log("Whiteboard: Setting localHistory from initialHistory prop."); // Log action
        setLocalHistory(initialHistory);
    } else {
        console.warn("Whiteboard: initialHistory prop is not an array, not setting localHistory."); // Log if not array
    }
  }, [initialHistory]); // Depend on initialHistory to set it up

  // Update context settings when color or lineWidth changes
  useEffect(() => {
    if (ctxRef.current) {
      ctxRef.current.strokeStyle = color;
      ctxRef.current.lineWidth = lineWidth;
    }
  }, [color, lineWidth]);

  // Setup local drawing event listeners (mouse/touch)
  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = ctxRef.current;
    if (!canvas || !ctx || !socket || !roomId) return; // Attach listeners regardless, but check canDraw inside handlers

    const getCoords = (e) => {
      const rect = canvas.getBoundingClientRect();
      // Handle both mouse and touch events safely
      const clientX = e.clientX ?? e.touches?.[0]?.clientX;
      const clientY = e.clientY ?? e.touches?.[0]?.clientY;
      if (clientX === undefined || clientY === undefined) return null;

      // Calculate the mouse position relative to the displayed canvas element
      const rawX = clientX - rect.left;
      const rawY = clientY - rect.top;

      // Scale the coordinates to match the internal canvas resolution
      return {
        offsetX: rawX * (canvas.width / rect.width),
        offsetY: rawY * (canvas.height / rect.height),
      };
    };

    const startDrawing = (e) => {
      if (!canDraw) return; // Check permission HERE
      const coords = getCoords(e);
      if (!coords) return;
      const { offsetX, offsetY } = coords;
      drawingRef.current = true;
      // Only emit the event
      const drawData = { roomId, x: offsetX, y: offsetY, type: 'begin', color, lineWidth };
      socket.emit('draw', drawData);
      // Update local history immediately for responsiveness
      e.preventDefault(); // Prevent default touch actions like scrolling
      setLocalHistory(prev => [...prev, drawData]); // Update local history
    };

    const finishDrawing = (e) => {
      if (!canDraw) return; // Check permission HERE
      if (!drawingRef.current) return;
      drawingRef.current = false;
      ctx.closePath(); // Draw locally
      socket.emit('draw', { roomId, type: 'end' });
      // Update local history immediately
      e.preventDefault();
      setLocalHistory(prev => [...prev, { roomId, type: 'end' }]); // Update local history
    };

    const draw = (e) => {
      if (!drawingRef.current || !canDraw) return; // Check permission HERE
      const coords = getCoords(e);
      if (!coords) return;
      const { offsetX, offsetY } = coords;
      // Only emit the event
      const drawData = { roomId, x: offsetX, y: offsetY, type: 'draw', color, lineWidth };
      socket.emit('draw', drawData);
      // Update local history immediately
      e.preventDefault();
      setLocalHistory(prev => [...prev, drawData]); // Update local history
    };

    // Mouse events
    canvas.addEventListener('mousedown', startDrawing);
    canvas.addEventListener('mouseup', finishDrawing);
    canvas.addEventListener('mousemove', draw);
    canvas.addEventListener('mouseleave', finishDrawing); // Stop drawing if mouse leaves
    // Touch events
    canvas.addEventListener('touchstart', startDrawing);
    canvas.addEventListener('touchend', finishDrawing);
    canvas.addEventListener('touchmove', draw);
    canvas.addEventListener('touchcancel', finishDrawing); // Handle cancelled touches

    return () => {
      // Cleanup all listeners
      canvas.removeEventListener('mousedown', startDrawing);
      canvas.removeEventListener('mouseup', finishDrawing);
      canvas.removeEventListener('mousemove', draw);
      canvas.removeEventListener('mouseleave', finishDrawing);
      canvas.removeEventListener('touchstart', startDrawing);
      canvas.removeEventListener('touchend', finishDrawing);
      canvas.removeEventListener('touchmove', draw);
      canvas.removeEventListener('touchcancel', finishDrawing);
    };
    // Depend on socket, roomId, color, lineWidth, isAdmin
  }, [socket, roomId, color, lineWidth, canDraw]); // Add canDraw dependency

  // Setup socket listeners for incoming draw/clear events
  useEffect(() => {
    if (!socket) return;

    const handleDrawEvent = (data) => {
      // Add received drawing data to history if it's not an 'end' event without coords (already handled locally)
      // Or simply add all non-local events if server filters correctly
      console.log("Whiteboard: Received 'draw' event via socket. Data:", data); // Log received data
      setLocalHistory(prevHistory => [...prevHistory, data]);
    };

    const handleCanvasCleared = () => {
        console.log("Whiteboard: Received 'canvas-cleared' event via socket."); // Log received event
        setLocalHistory([]); // Clear local history
        // Clearing the canvas itself happens in the redraw effect below
    };

    socket.on('draw', handleDrawEvent);
    socket.on('canvas-cleared', handleCanvasCleared); // Listen for clear event

    return () => {
      console.log("Whiteboard: Cleaning up socket listeners.");
      socket.off('draw', handleDrawEvent);
      socket.off('canvas-cleared', handleCanvasCleared);
    };
  }, [socket]); // Depend only on socket

  // Redraw canvas based on localHistory state
  useEffect(() => {
    const ctx = ctxRef.current;
    const canvas = canvasRef.current;
    if (!ctx || !canvas) return;

    // Log the history received right when the effect runs
    console.log("Whiteboard Redraw Effect: Triggered. localHistory length:", localHistory?.length); // Log trigger and length

    // Clear the canvas before replaying history
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Replay the entire local drawing history
    // Ensure history is an array before trying to iterate
    if (Array.isArray(localHistory)) { // Use localHistory state here
      localHistory.forEach(item => { // Use localHistory state here
        // Ensure item has necessary properties before drawing
        if (item && typeof item.x === 'number' && typeof item.y === 'number' && item.type) {
          ctx.strokeStyle = item.color || 'black'; // Apply style from history item
          ctx.lineWidth = item.lineWidth || 2;     // Apply style from history item
          const { x, y, type } = item;
      if (type === 'begin') {
        ctx.beginPath();
        ctx.moveTo(x, y); // Use x, y from data
      } else if (type === 'draw') {
        ctx.lineTo(x, y); // Use x, y from data
        ctx.stroke();
      } else if (type === 'end') {
        ctx.closePath();
      }
        } else {
          console.warn("Whiteboard: Skipping invalid history item", item);
        }
      });
    } else {
      console.warn("Whiteboard: localHistory state is not an array or is undefined."); // Update warning message
    }


    // Restore local user's settings after replaying history
    ctx.strokeStyle = color;
    ctx.lineWidth = lineWidth;

  }, [localHistory, color, lineWidth]); // Depend on localHistory, and local color/width to restore after redraw

  const clearCanvas = () => {
    // --- Remove the immediate local clearing ---
    // setLocalHistory([]); 
    // The canvas will now only clear when the 'canvas-cleared' event 
    // is received back from the server via the socket listener useEffect.
    // Emit a clear event to the server
    console.log("Whiteboard: Emitting clear-canvas event");
    if (canDraw) { // Only users with draw permission can clear
      socket.emit('clear-canvas', { roomId });
    }
  };

  return ( // Conditionally render controls based on isAdmin
    <div>
      {/* Drawing Controls */}
      {/* Only show controls if user can draw */}
      {canDraw && ( // Wrap all controls in a single div with a class
        <div className="whiteboard-controls">
          <div className="control-group">
            <label htmlFor="wb-color">Color:</label>
            <input id="wb-color" type="color" value={color} onChange={(e) => setColor(e.target.value)} />
          </div>
          <div className="control-group">
            <label htmlFor="wb-width">Width:</label>
            <input
              id="wb-width"
              type="range"
              min="1"
              max="20"
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
            />
            <span className="width-display">{lineWidth}</span>
          </div>
          <button onClick={clearCanvas} className="clear-button">Clear</button>
        </div>
      )}
      {/* The Canvas */}
      <canvas ref={canvasRef} style={{ backgroundColor: 'white' }} /> {/* Add white background */}
    </div>
  );
};

export default Whiteboard;
