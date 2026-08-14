import React, { createContext, useContext, useState, useEffect } from 'react';
import { io } from 'socket.io-client';
import { useAuth } from './AuthContext.jsx';

const SocketContext = createContext();

export function SocketProvider({ children }) {
  const { user } = useAuth();
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    // If no authenticated user, close any existing sockets
    if (!user) {
      if (socket) {
        socket.disconnect();
        setSocket(null);
        setIsConnected(false);
      }
      return;
    }

    const socketUrl = import.meta.env.VITE_SOCKET_URL || 'http://localhost:5001';
    console.log(`[Socket Client] Instantiating socket connection: ${socketUrl}`);

    // Set connection with credentials (transfers HTTP-only JWT cookies)
    const newSocket = io(socketUrl, {
      withCredentials: true,
      autoConnect: true,
      reconnectionAttempts: 15,
      reconnectionDelay: 1500
    });

    newSocket.on('connect', () => {
      console.log(`[Socket Client] Socket connected (ID: ${newSocket.id})`);
      setIsConnected(true);
    });

    newSocket.on('disconnect', (reason) => {
      console.log(`[Socket Client] Socket disconnected. Reason: ${reason}`);
      setIsConnected(false);
    });

    newSocket.on('connect_error', (err) => {
      console.error('[Socket Client] Connection error event:', err.message);
      setIsConnected(false);
    });

    setSocket(newSocket);

    return () => {
      newSocket.disconnect();
    };
  }, [user]);

  return (
    <SocketContext.Provider value={{ socket, isConnected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket() {
  return useContext(SocketContext);
}
