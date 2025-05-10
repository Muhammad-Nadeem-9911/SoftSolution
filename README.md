# SoftSolution - Real-time Communication Platform

**SoftSolution** is a full-stack MERN (MongoDB, Express.js, React, Node.js) application designed to provide real-time video conferencing, chat, and collaborative whiteboard functionalities, similar to platforms like Zoom or Google Meet. It features robust user authentication, role-based access control, and profile management.

## Table of Contents

1.  [Introduction](#introduction)
2.  [Core Functionalities](#core-functionalities)
3.  [Technologies Used](#technologies-used)
4.  [Project Structure](#project-structure)
5.  [Key Modules & Components](#key-modules--components)
6.  [Security Features](#security-features)
7.  [Setup and Installation](#setup-and-installation)
8.  [Deployment](#deployment)
9.  [Environment Variables](#environment-variables)
10. [API Endpoints Overview](#api-endpoints-overview)
11. [Future Enhancements](#future-enhancements)

## 1. Introduction

SoftSolution aims to deliver a seamless and interactive online meeting experience. Users can register, verify their accounts, join or create meeting rooms, engage in video/audio calls, chat in real-time, and utilize a shared whiteboard for collaboration. The application also includes administrative and managerial roles for user management.

## 2. Core Functionalities

### 2.1. User Authentication & Authorization
*   **User Signup:** New users can register with a username, email, and password.
*   **Email Verification:** Accounts require email verification via a link sent to the user's registered email address. Verification links expire after a set duration (e.g., 10 minutes).
*   **Resend Verification Email:** Unverified users can request a new verification link.
*   **User Login:** Authenticates users and provides a JSON Web Token (JWT) for session management.
*   **Password Reset:** Users can request a password reset link via email if they forget their password.
*   **Role-Based Access Control (RBAC):**
    *   **User:** Standard user with access to join/create meetings and manage their own profile.
    *   **Manager:** Can manage users with the 'user' role (view, update role to 'user', delete).
    *   **Admin:** Highest level of access, including full user management and system oversight (details inferred, specific admin routes beyond user management are not fully detailed in provided files but the role exists).
*   **Protected Routes:** Frontend routes are protected based on authentication status and user roles.

### 2.2. User Profile Management
*   **View Profile:** Users can view their profile information.
*   **Update Email:** Users can update their registered email address.
*   **Update Password:** Users can change their account password.
*   **Update Profile Picture:** Users can upload and update their profile picture, which is stored on Cloudinary.
*   **Delete Account:** Users can delete their own accounts. This action also removes their profile picture from Cloudinary and sends a confirmation email.

### 2.3. Manager Actions
*   **View Manageable Users:** Managers can view a list of users with the 'user' role.
*   **Update User Role:** Managers can update a user's role (currently restricted to setting it as 'user').
*   **Delete User Account:** Managers can delete accounts of users with the 'user' role. A notification email is sent to the deleted user.

### 2.4. Real-time Meeting Rooms
*   **Create & Join Rooms:** Users can create new meeting rooms (generating a unique room ID) or join existing ones.
*   **Video & Audio Streaming:** Peer-to-peer video and audio communication using WebRTC (via PeerJS).
*   **Real-time Chat:** In-room text chat functionality with messages broadcast to all participants. Chat history is loaded for users joining the room.
*   **Shared Whiteboard:**
    *   Collaborative drawing on a shared canvas.
    *   Drawing actions are broadcast in real-time.
    *   Whiteboard history is loaded for new participants.
    *   Ability to clear the whiteboard.
    *   Admin-controlled whiteboard permissions (granting/revoking drawing control for participants).
*   **User List & Presence:** Displays a list of participants currently in the room, along with their assigned color, profile picture, and role.
*   **Camera Status:** Users can toggle their camera, and this status is reflected to other participants.
*   **Active Meeting Tracking:** The backend tracks users' active meetings to prevent joining multiple meetings simultaneously from different sessions (unless an old session is stale).

### 2.5. Real-time Communication Backend
*   **Socket.IO:** Used for all real-time signaling, including:
    *   Joining/leaving rooms.
    *   User connection/disconnection events.
    *   WebRTC signaling for peer connections.
    *   Chat messages.
    *   Whiteboard drawing data and permission changes.
    *   Camera status updates.

## 3. Technologies Used

*   **Frontend:**
    *   React.js
    *   React Router DOM (for client-side routing)
    *   Axios (for HTTP API calls)
    *   Socket.IO Client
    *   PeerJS Client (for WebRTC)
    *   React Icons
    *   CSS (for styling)
    *   Context API (for state management, e.g., `AuthContext`)
*   **Backend:**
    *   Node.js
    *   Express.js (for REST APIs)
    *   MongoDB (with Mongoose ODM for database interactions)
    *   Socket.IO Server
    *   JSON Web Tokens (JWT) (for authentication)
    *   Bcrypt.js (for password hashing)
    *   Cloudinary (for cloud-based image storage - profile pictures)
    *   Nodemailer (or similar, via `sendEmail` utility for sending emails)
    *   `express-validator` (for input validation)
    *   `express-rate-limit` (for basic security against brute-force attacks)
    *   `dotenv` (for environment variable management)
*   **Database:**
    *   MongoDB (likely hosted on MongoDB Atlas for deployment)

## 4. Project Structure

The project is organized into a `client` directory for the frontend and a `server` directory for the backend.

