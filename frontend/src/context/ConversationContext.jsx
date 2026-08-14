import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import api from '../services/api.js';
import { useSocket } from './SocketContext.jsx';
import { useAuth } from './AuthContext.jsx';
import { toast } from 'react-toastify';

const ConversationContext = createContext();

export function ConversationProvider({ children }) {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();

  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [typingUsers, setTypingUsers] = useState({}); // Structure: { [conversationId]: { [userId]: username } }
  const [contacts, setContacts] = useState([]);
  const [contactsLoading, setContactsLoading] = useState(false);
  const [conversationsLoading, setConversationsLoading] = useState(false);
  const [messagesLoading, setMessagesLoading] = useState(false);
  const [highlightedMessageId, setHighlightedMessageId] = useState(null);

  // Keep references to prevent stale closures in socket events
  const activeConversationRef = useRef(activeConversation);
  useEffect(() => {
    activeConversationRef.current = activeConversation;
  }, [activeConversation]);

  const fetchConversations = async () => {
    if (!user) return;
    setConversationsLoading(true);
    try {
      const res = await api.get('/api/conversations');
      if (res.data.success) {
        setConversations(res.data.data);
      }
    } catch (err) {
      console.error('[Conversation Context] Fetch conversations failed:', err);
    } finally {
      setConversationsLoading(false);
    }
  };

  const fetchContacts = async () => {
    if (!user) return;
    setContactsLoading(true);
    try {
      const res = await api.get('/api/contacts');
      if (res.data.success) {
        setContacts(res.data.data);
      }
    } catch (err) {
      console.error('[Conversation Context] Fetch contacts failed:', err);
    } finally {
      setContactsLoading(false);
    }
  };

  const selectConversation = async (conv) => {
    setActiveConversation(conv);
    if (!conv) {
      setMessages([]);
      return;
    }

    setMessagesLoading(true);
    try {
      const res = await api.get(`/api/conversations/${conv.id}/messages`);
      if (res.data.success) {
        setMessages(res.data.data);

        // Clear local unread badge counts
        setConversations((prev) =>
          prev.map((c) => (c.id === conv.id ? { ...c, unread_count: 0 } : c))
        );

        // Notify socket peers that we are reading this conversation
        if (socket && isConnected) {
          socket.emit('message:read', { conversationId: conv.id });
        }
      }
    } catch (err) {
      console.error('[Conversation Context] Load messages failed:', err);
    } finally {
      setMessagesLoading(false);
    }
  };

  const startDirectChat = async (recipientId) => {
    try {
      const res = await api.post('/api/conversations/direct', { recipientId });
      if (res.data.success) {
        const newConv = res.data.data;
        setConversations((prev) => {
          const filtered = prev.filter((c) => c.id !== newConv.id);
          return [newConv, ...filtered];
        });
        await selectConversation(newConv);
        return newConv;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to start conversation.');
    }
  };

  const createGroupChat = async (name, memberIds, avatarUrl) => {
    try {
      const res = await api.post('/api/conversations/group', { name, avatar_url: avatarUrl, memberIds });
      if (res.data.success) {
        const newConv = res.data.data;
        setConversations((prev) => [newConv, ...prev]);
        await selectConversation(newConv);
        toast.success(`Group "${name}" established!`);
        return newConv;
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to create group.');
    }
  };

  // Socket sync bindings
  useEffect(() => {
    if (!socket || !isConnected) return;

    // Listen for new messages
    socket.on('message:new', (msg) => {
      const activeConv = activeConversationRef.current;

      // Update conversations list latest message
      setConversations((prev) => {
        const matched = prev.map((c) => {
          if (c.id === msg.conversation_id) {
            return {
              ...c,
              latest_message: msg,
              unread_count: activeConv && activeConv.id === msg.conversation_id ? 0 : c.unread_count + 1
            };
          }
          return c;
        });

        // Move active conversation to top of list
        const conversationIndex = matched.findIndex(c => c.id === msg.conversation_id);
        if (conversationIndex > 0) {
          const [movedConv] = matched.splice(conversationIndex, 1);
          return [movedConv, ...matched];
        }
        return matched;
      });

      // Append to active message history if chat is currently open
      if (activeConv && activeConv.id === msg.conversation_id) {
        setMessages((prev) => {
          const exists = prev.some((m) => m.id === msg.id || m.client_msg_id === msg.client_msg_id);
          return exists ? prev : [...prev, msg];
        });

        // Emit read and delivered status receipts immediately if message is not ours
        if (msg.sender_id !== user.id) {
          socket.emit('message:read', { conversationId: activeConv.id });
        }
      } else {
        // Emit delivery confirmation back to sender for passive unread inbox messages
        if (msg.sender_id !== user.id) {
          socket.emit('message:delivered', { messageId: msg.id, conversationId: msg.conversation_id });
        }
      }
    });

    // Listen for message status receipts updates (sent -> delivered -> read)
    socket.on('message:status', ({ messageId, status }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, status } : m))
      );
    });

    // Listen for read receipt syncs
    socket.on('message:read_sync', ({ conversationId, userId, messageIds }) => {
      if (activeConversationRef.current && activeConversationRef.current.id === conversationId) {
        setMessages((prev) =>
          prev.map((m) => (messageIds.includes(m.id) && m.sender_id !== userId ? { ...m, status: 'read' } : m))
        );
      }
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId && c.latest_message && messageIds.includes(c.latest_message.id)) {
            return {
              ...c,
              latest_message: { ...c.latest_message, status: 'read' }
            };
          }
          return c;
        })
      );
    });

    // Listen for message reactions
    socket.on('message:reaction', ({ messageId, conversationId, reactions }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === messageId ? { ...m, reactions } : m))
      );
      setConversations((prev) =>
        prev.map((c) => {
          if (c.id === conversationId && c.latest_message && c.latest_message.id === messageId) {
            return {
              ...c,
              latest_message: { ...c.latest_message, reactions }
            };
          }
          return c;
        })
      );
    });

    // Listen for typing events
    socket.on('typing:start', ({ conversationId, userId, username: typistName }) => {
      if (userId === user.id) return;
      setTypingUsers((prev) => ({
        ...prev,
        [conversationId]: {
          ...(prev[conversationId] || {}),
          [userId]: typistName
        }
      }));
    });

    socket.on('typing:stop', ({ conversationId, userId }) => {
      setTypingUsers((prev) => {
        const convTyping = { ...(prev[conversationId] || {}) };
        delete convTyping[userId];
        return {
          ...prev,
          [conversationId]: convTyping
        };
      });
    });

    // Listen for presence synchronization
    socket.on('user:online', ({ userId }) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          members: c.members.map((m) => (m.id === userId ? { ...m, is_online: 1 } : m))
        }))
      );
      setContacts((prev) =>
        prev.map((c) => (c.id === userId ? { ...c, is_online: 1 } : c))
      );
    });

    socket.on('user:offline', ({ userId, last_seen }) => {
      setConversations((prev) =>
        prev.map((c) => ({
          ...c,
          members: c.members.map((m) => (m.id === userId ? { ...m, is_online: 0, last_seen } : m))
        }))
      );
      setContacts((prev) =>
        prev.map((c) => (c.id === userId ? { ...c, is_online: 0, last_seen } : c))
      );
    });

    // Listen for new group created triggers
    socket.on('conversation:created', (newConv) => {
      setConversations((prev) => {
        const exists = prev.some((c) => c.id === newConv.id);
        return exists ? prev : [newConv, ...prev];
      });
    });

    // Listen for disappearing timer updates
    socket.on('conversation:disappearing-timer', ({ conversationId, disappearing_timer }) => {
      setConversations((prev) =>
        prev.map((c) => (c.id === conversationId ? { ...c, disappearing_timer } : c))
      );
      const activeConv = activeConversationRef.current;
      if (activeConv && activeConv.id === conversationId) {
        setActiveConversation((prev) => ({ ...prev, disappearing_timer }));
      }
    });

    return () => {
      socket.off('message:new');
      socket.off('message:status');
      socket.off('message:read_sync');
      socket.off('message:reaction');
      socket.off('typing:start');
      socket.off('typing:stop');
      socket.off('user:online');
      socket.off('user:offline');
      socket.off('conversation:created');
      socket.off('conversation:disappearing-timer');
    };
  }, [socket, isConnected, user]);

  // Reconnection reconciliation sync
  useEffect(() => {
    if (socket && isConnected && user) {
      console.log('[Conversation Context] Sync network connected. Reconciling client database state...');
      fetchConversations();
      fetchContacts();
      if (activeConversationRef.current) {
        selectConversation(activeConversationRef.current);
      }
    }
  }, [isConnected, socket, user]);

  // Initial load
  useEffect(() => {
    if (user) {
      fetchConversations();
      fetchContacts();
    } else {
      setConversations([]);
      setActiveConversation(null);
      setMessages([]);
      setContacts([]);
    }
  }, [user]);

  // Keyboard navigation for active chats
  useEffect(() => {
    const handleNavigationKeys = (e) => {
      if (e.altKey && (e.key === 'ArrowDown' || e.key === 'ArrowUp')) {
        e.preventDefault();
        if (conversations.length === 0) return;
        
        let currentIndex = -1;
        if (activeConversation) {
          currentIndex = conversations.findIndex(c => c.id === activeConversation.id);
        }
        
        let nextIndex = 0;
        if (e.key === 'ArrowDown') {
          nextIndex = (currentIndex + 1) % conversations.length;
        } else {
          nextIndex = currentIndex - 1;
          if (nextIndex < 0) nextIndex = conversations.length - 1;
        }
        
        const nextConv = conversations[nextIndex];
        if (nextConv) {
          selectConversation(nextConv);
        }
      }
    };

    window.addEventListener('keydown', handleNavigationKeys);
    return () => window.removeEventListener('keydown', handleNavigationKeys);
  }, [conversations, activeConversation]);

  return (
    <ConversationContext.Provider
      value={{
        conversations,
        activeConversation,
        messages,
        typingUsers,
        contacts,
        contactsLoading,
        conversationsLoading,
        messagesLoading,
        highlightedMessageId,
        setHighlightedMessageId,
        fetchConversations,
        fetchContacts,
        selectConversation,
        startDirectChat,
        createGroupChat,
        setMessages
      }}
    >
      {children}
    </ConversationContext.Provider>
  );
}

export function useConversations() {
  return useContext(ConversationContext);
}
