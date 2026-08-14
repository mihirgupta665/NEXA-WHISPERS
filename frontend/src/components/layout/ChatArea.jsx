import React, { useEffect, useRef, useState } from 'react';
import { useConversations } from '../../context/ConversationContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import api from '../../services/api.js';
import MessageBubble from '../chat/MessageBubble.jsx';
import MessageComposer from '../chat/MessageComposer.jsx';
import { Phone, Video, ArrowDown, ShieldAlert, ArrowLeft, X, Search, Info, MoreVertical } from 'lucide-react';
import { toast } from 'react-toastify';

export default function ChatArea() {
  const { user } = useAuth();
  const { socket, isConnected } = useSocket();
  const { 
    activeConversation, 
    messages, 
    setMessages, 
    typingUsers, 
    selectConversation,
    highlightedMessageId,
    setHighlightedMessageId,
    messagesLoading
  } = useConversations();

  const [showScrollButton, setShowScrollButton] = useState(false);
  const [activeReply, setActiveReply] = useState(null);
  const [showGroupInfo, setShowGroupInfo] = useState(false);
  const [showSettingsDropdown, setShowSettingsDropdown] = useState(false);
  const [chatSearchQuery, setChatSearchQuery] = useState('');
  const [isSearchActive, setIsSearchActive] = useState(false);
  const [hasNewMessages, setHasNewMessages] = useState(false);

  const scrollContainerRef = useRef(null);
  const messagesEndRef = useRef(null);
  const prevMessagesLength = useRef(messages.length);
  const failedFilesRef = useRef(new Map());

  // Scroll to bottom helper
  const scrollToBottom = (behavior = 'smooth') => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior });
    }
  };

  // Monitor scroll height changes and automatically scroll down if user is near bottom
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    
    const isLengthIncreased = messages.length > prevMessagesLength.current;
    prevMessagesLength.current = messages.length;
    
    if (isLengthIncreased) {
      const lastMessage = messages[messages.length - 1];
      const isMyMessage = lastMessage && lastMessage.sender_id === user.id;
      
      const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
      const isNearBottom = scrollHeight - scrollTop - clientHeight < 250;
      
      if (isNearBottom || isMyMessage) {
        scrollToBottom('smooth');
        setHasNewMessages(false);
      } else {
        setHasNewMessages(true);
      }
    }
  }, [messages]);

  // Scroll to bottom on conversation load
  useEffect(() => {
    if (!highlightedMessageId) {
      scrollToBottom('auto');
    }
    setShowScrollButton(false);
    setActiveReply(null);
    setShowGroupInfo(false);
    setShowSettingsDropdown(false);
    setIsSearchActive(false);
    setChatSearchQuery('');
    setHasNewMessages(false);
    prevMessagesLength.current = messages.length;
  }, [activeConversation?.id]);

  // Scroll to and highlight matching message from search result redirect
  useEffect(() => {
    if (highlightedMessageId && messages.length > 0) {
      const timer = setTimeout(() => {
        const element = document.getElementById(`message-${highlightedMessageId}`);
        if (element) {
          element.scrollIntoView({ behavior: 'smooth', block: 'center' });
          const bubble = element.querySelector('.msg-bubble-card');
          if (bubble) {
            bubble.classList.add('message-highlight-pulse');
            setTimeout(() => {
              bubble.classList.remove('message-highlight-pulse');
            }, 2000);
          }
          setHighlightedMessageId(null);
        }
      }, 400);
      return () => clearTimeout(timer);
    }
  }, [highlightedMessageId, messages]);

  const handleScrollEvent = () => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 150;
    setShowScrollButton(!isNearBottom);
    if (isNearBottom) {
      setHasNewMessages(false);
    }
  };

  const handleSend = async (content, file) => {
    if (!activeConversation) return;

    const clientMsgId = `client-${Date.now()}-${Math.round(Math.random() * 1E6)}`;
    const now = Date.now();

    // Create optimistic message representation to show "sending..." ticks immediately
    const optimisticMessage = {
      id: null,
      client_msg_id: clientMsgId,
      conversation_id: activeConversation.id,
      sender_id: user.id,
      sender_name: user.display_name,
      content: file ? file.name : content,
      message_type: file ? 'attachment' : 'text',
      status: 'sending',
      reply_to_message_id: activeReply ? activeReply.id : null,
      expires_at: null,
      created_at: now,
      updated_at: now,
      reactions: []
    };

    // Read conversation disappearing message timer
    const conversationTimer = activeConversation.disappearing_timer || 0;
    if (conversationTimer > 0) {
      optimisticMessage.expires_at = now + (conversationTimer * 1000);
    }

    setMessages(prev => [...prev, optimisticMessage]);
    setActiveReply(null);

    if (file) {
      failedFilesRef.current.set(clientMsgId, file);
    }

    // Prepare multipart data for file attachment or standard JSON
    try {
      let res;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('clientMsgId', clientMsgId);
        if (optimisticMessage.expires_at) {
          formData.append('expires_at', optimisticMessage.expires_at.toString());
        }
        if (optimisticMessage.reply_to_message_id) {
          formData.append('reply_to_message_id', optimisticMessage.reply_to_message_id.toString());
        }
        res = await api.post(`/api/conversations/${activeConversation.id}/messages`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setMessages(prev => prev.map(m => m.client_msg_id === clientMsgId ? { ...m, uploadProgress: percent } : m));
            }
          }
        });
      } else {
        res = await api.post(`/api/conversations/${activeConversation.id}/messages`, {
          content,
          clientMsgId,
          reply_to_message_id: optimisticMessage.reply_to_message_id,
          expires_at: optimisticMessage.expires_at
        });
      }

      if (res.data.success) {
        const savedMsg = res.data.data;
        failedFilesRef.current.delete(clientMsgId);
        // Replace the optimistic message with backend's confirmed persisted message
        setMessages(prev => prev.map(m => m.client_msg_id === clientMsgId ? savedMsg : m));
        
        // Broadcast new message over Socket.IO room for instant delivered statuses
        if (socket && isConnected) {
          socket.emit('message:status', { messageId: savedMsg.id, status: 'sent' });
        }
      }
    } catch (err) {
      toast.error('Failed to send message.');
      // Keep optimistic message but set status to failed
      setMessages(prev => prev.map(m => m.client_msg_id === clientMsgId ? { ...m, status: 'failed' } : m));
    }
  };

  const handleRetryMessage = async (clientMsgId) => {
    const failedMsg = messages.find(m => m.client_msg_id === clientMsgId);
    if (!failedMsg) return;

    setMessages(prev => prev.map(m => m.client_msg_id === clientMsgId ? { ...m, status: 'sending', uploadProgress: undefined } : m));

    const file = failedFilesRef.current.get(clientMsgId);
    try {
      let res;
      if (file) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('clientMsgId', clientMsgId);
        if (failedMsg.expires_at) {
          formData.append('expires_at', (failedMsg.expires_at).toString());
        }
        if (failedMsg.reply_to_message_id) {
          formData.append('reply_to_message_id', (failedMsg.reply_to_message_id).toString());
        }
        res = await api.post(`/api/conversations/${activeConversation.id}/messages`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: (progressEvent) => {
            if (progressEvent.total) {
              const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
              setMessages(prev => prev.map(m => m.client_msg_id === clientMsgId ? { ...m, uploadProgress: percent } : m));
            }
          }
        });
      } else {
        res = await api.post(`/api/conversations/${activeConversation.id}/messages`, {
          content: failedMsg.content,
          clientMsgId,
          reply_to_message_id: failedMsg.reply_to_message_id,
          expires_at: failedMsg.expires_at
        });
      }

      if (res.data.success) {
        const savedMsg = res.data.data;
        setMessages(prev => prev.map(m => m.client_msg_id === clientMsgId ? savedMsg : m));
        failedFilesRef.current.delete(clientMsgId);
        if (socket && isConnected) {
          socket.emit('message:status', { messageId: savedMsg.id, status: 'sent' });
        }
      }
    } catch (err) {
      toast.error('Failed to retry sending message.');
      setMessages(prev => prev.map(m => m.client_msg_id === clientMsgId ? { ...m, status: 'failed' } : m));
    }
  };

  const handleRemoveFailedMessage = (clientMsgId) => {
    setMessages(prev => prev.filter(m => m.client_msg_id !== clientMsgId));
    failedFilesRef.current.delete(clientMsgId);
  };

  const handleReact = async (messageId, emoji) => {
    try {
      if (emoji) {
        await api.post(`/api/messages/${messageId}/reactions`, { emoji });
      } else {
        await api.delete(`/api/messages/${messageId}/reactions`);
      }
    } catch (err) {
      toast.error('Failed to update reaction.');
    }
  };

  const handleDelete = async (messageId) => {
    // Coming soon placeholder dialog or delete
    toast.info('Message deletion is simulation placeholder. Coming Soon!');
  };

  const handleSelectDisappearingTimer = async (seconds) => {
    setShowSettingsDropdown(false);
    try {
      const res = await api.put(`/api/conversations/${activeConversation.id}/disappearing-timer`, { timer: seconds });
      if (res.data.success) {
        toast.success(`Disappearing message timer updated.`);
      }
    } catch (err) {
      toast.error('Failed to update disappearing timer.');
    }
  };

  // Keyboard shortcuts event listener
  useEffect(() => {
    const handleGlobalKeyDown = (e) => {
      // Focus Composer: Alt + C
      if (e.altKey && e.key?.toLowerCase() === 'c') {
        e.preventDefault();
        const textarea = document.getElementById('composer-textarea');
        if (textarea) textarea.focus();
      }

      // Focus Search: Ctrl + K or Alt + S
      if ((e.ctrlKey && e.key?.toLowerCase() === 'k') || (e.altKey && e.key?.toLowerCase() === 's')) {
        e.preventDefault();
        const searchInput = document.getElementById('sidebar-search-input');
        if (searchInput) searchInput.focus();
      }
    };

    document.addEventListener('keydown', handleGlobalKeyDown);
    return () => document.removeEventListener('keydown', handleGlobalKeyDown);
  }, []);

  const handleCallClick = () => {
    toast.info('Encrypted calling is a simulated feature. Coming Soon!');
  };

  // Render Date Separator line
  const renderDateSeparator = (timestamp) => {
    const date = new Date(timestamp);
    const now = new Date();
    const todayStr = now.toDateString();
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    
    const dateStr = date.toDateString();
    
    let displayString = '';
    if (dateStr === todayStr) {
      displayString = 'Today';
    } else if (dateStr === yesterdayStr) {
      displayString = 'Yesterday';
    } else {
      const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
      displayString = date.toLocaleDateString([], options);
    }
    
    return (
      <div key={`sep-${timestamp}`} style={styles.dateSeparator}>
        <span style={styles.dateSeparatorText}>{displayString}</span>
      </div>
    );
  };

  const formatLastSeen = (lastSeenTime) => {
    if (!lastSeenTime) return 'Offline';
    const date = new Date(lastSeenTime);
    const now = new Date();
    
    // Check if within 1 minute
    const diffMins = Math.floor((now - date) / 60000);
    if (diffMins < 1) return 'Online';
    
    if (date.toDateString() === now.toDateString()) {
      return `Last seen today at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return `Last seen yesterday at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    }
    
    return `Last seen ${date.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  };

  // Render unread typing indicator summary
  const getTypingText = () => {
    if (!activeConversation) return '';
    const typists = Object.values(typingUsers[activeConversation.id] || {});
    if (typists.length === 0) return '';
    if (typists.length === 1) return `${typists[0]} is typing...`;
    return `${typists.join(', ')} are typing...`;
  };

  const typingText = getTypingText();

  // Scroll to bottom on typing status updates
  useEffect(() => {
    if (!scrollContainerRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollContainerRef.current;
    const isNearBottom = scrollHeight - scrollTop - clientHeight < 200;
    if (isNearBottom && typingText) {
      scrollToBottom('smooth');
    }
  }, [typingText]);

  if (!activeConversation) {
    return (
      <div style={styles.emptyState}>
        <div style={styles.logoContainer}>N</div>
        <h3 style={styles.emptyTitle}>Select a Conversation</h3>
        <p style={styles.emptySubtitle}>Private conversations. Seamlessly connected.</p>
      </div>
    );
  }

  // Filter messages based on chat search query
  const filteredMessages = chatSearchQuery.trim()
    ? messages.filter(msg => msg.content && msg.content.toLowerCase().includes(chatSearchQuery.toLowerCase()))
    : messages;

  // Inject date separators and group consecutive messages
  const messageElements = [];
  let lastDate = null;
  
  const isSameSender = (m1, m2) => m1 && m2 && m1.sender_id === m2.sender_id && m1.sender_id !== 0 && m2.sender_id !== 0;
  const isWithinTime = (m1, m2) => m1 && m2 && Math.abs(m1.created_at - m2.created_at) < 5 * 60 * 1000;
  const isSameDate = (m1, m2) => m1 && m2 && new Date(m1.created_at).toDateString() === new Date(m2.created_at).toDateString();
  
  const isGroupedWithPrev = (idx) => {
    if (idx === 0) return false;
    const current = filteredMessages[idx];
    const prev = filteredMessages[idx - 1];
    return isSameSender(current, prev) && isWithinTime(current, prev) && isSameDate(current, prev);
  };
  
  const isGroupedWithNext = (idx) => {
    if (idx === filteredMessages.length - 1) return false;
    const current = filteredMessages[idx];
    const next = filteredMessages[idx + 1];
    return isSameSender(current, next) && isWithinTime(current, next) && isSameDate(current, next);
  };
  
  filteredMessages.forEach((msg, idx) => {
    const msgDate = new Date(msg.created_at).toDateString();
    if (msgDate !== lastDate) {
      messageElements.push(renderDateSeparator(msg.created_at));
      lastDate = msgDate;
    }
    
    const isGrpPrev = isGroupedWithPrev(idx);
    const isGrpNext = isGroupedWithNext(idx);
    
    let groupPosition = 'none';
    if (isGrpPrev && isGrpNext) {
      groupPosition = 'middle';
    } else if (isGrpPrev && !isGrpNext) {
      groupPosition = 'last';
    } else if (!isGrpPrev && isGrpNext) {
      groupPosition = 'first';
    }
    
    messageElements.push(
      <MessageBubble
        key={msg.id || msg.client_msg_id}
        message={msg}
        messagesList={messages}
        onReplyClick={setActiveReply}
        onReact={handleReact}
        onDelete={handleDelete}
        groupPosition={groupPosition}
        onRetry={handleRetryMessage}
        onRemoveFailed={handleRemoveFailedMessage}
      />
    );
  });
  
  // Subtitle presence indicators
  let statusText = '';
  let isOnline = false;
  if (activeConversation.type === 'direct') {
    const otherMember = activeConversation.members.find(m => m.id !== user.id);
    if (otherMember) {
      isOnline = otherMember.is_online === 1;
      statusText = isOnline ? 'Online' : formatLastSeen(otherMember.last_seen);
    }
  } else {
    const onlineCount = activeConversation.members.filter(m => m.is_online === 1).length;
    statusText = `${activeConversation.members.length} members${onlineCount > 0 ? `, ${onlineCount} online` : ''}`;
  }

  return (
    <div style={styles.container}>
      {/* Active Conversation Header */}
      <div style={styles.header}>
        {isSearchActive ? (
          <div style={styles.headerSearchWrapper}>
            <Search size={18} color="var(--text-muted)" style={{ marginRight: '8px' }} />
            <input
              type="text"
              placeholder="Search in this conversation..."
              value={chatSearchQuery}
              onChange={(e) => setChatSearchQuery(e.target.value)}
              style={styles.headerSearchInput}
              autoFocus
            />
            <button
              onClick={() => {
                setIsSearchActive(false);
                setChatSearchQuery('');
              }}
              style={styles.headerSearchClose}
            >
              <X size={18} />
            </button>
          </div>
        ) : (
          <div style={styles.chatInfo}>
            <button onClick={() => selectConversation(null)} style={styles.backButton} className="mobile-only" title="Back" aria-label="Back">
              <ArrowLeft size={20} />
            </button>
            <img src={activeConversation.avatar_url} alt={activeConversation.name} style={styles.avatar} />
            <div style={styles.titleMeta}>
              <span style={styles.titleText}>{activeConversation.name}</span>
              <span style={{
                ...styles.statusText,
                color: isOnline || activeConversation.type === 'group' ? 'var(--status-online)' : 'var(--text-secondary)'
              }}>{statusText}</span>
            </div>
          </div>
        )}
        <div style={{ display: 'flex', gap: '8px', position: 'relative', alignItems: 'center' }}>
          <button
            onClick={() => setIsSearchActive(!isSearchActive)}
            style={styles.headerActionButton}
            className="hover-action-btn"
            title="Search Messages"
            aria-label="Search Messages"
          >
            <Search size={18} color={isSearchActive ? 'var(--primary)' : 'var(--text-secondary)'} />
          </button>

          {activeConversation.type === 'group' && (
            <button
              onClick={() => {
                setShowGroupInfo(!showGroupInfo);
                setShowSettingsDropdown(false);
              }}
              style={styles.headerActionButton}
              className="hover-action-btn"
              title="Group Information"
              aria-label="Group Information"
            >
              <Info size={18} color={showGroupInfo ? 'var(--primary)' : 'var(--text-secondary)'} />
            </button>
          )}

          <button 
            onClick={() => {
              setShowSettingsDropdown(!showSettingsDropdown);
              setShowGroupInfo(false);
            }} 
            style={styles.headerActionButton} 
            className="hover-action-btn"
            title="Conversation Settings"
            aria-label="Conversation Settings"
          >
            <MoreVertical size={18} color={showSettingsDropdown ? 'var(--primary)' : 'var(--text-secondary)'} />
          </button>
          
          {showSettingsDropdown && (
            <div style={styles.disappearingDropdown} className="anim-scale-up">
              <div style={styles.dropdownHeader}>Disappearing Timer</div>
              {[
                { label: 'Off', val: 0 },
                { label: '5 seconds', val: 5 },
                { label: '10 seconds', val: 10 },
                { label: '30 seconds', val: 30 },
                { label: '1 minute', val: 60 },
                { label: '1 hour', val: 3600 },
                { label: '1 day', val: 86400 }
              ].map(opt => (
                <button
                  key={opt.val}
                  onClick={() => handleSelectDisappearingTimer(opt.val)}
                  className="hover-list-item"
                  style={{
                    ...styles.dropdownItem,
                    fontWeight: activeConversation.disappearing_timer === opt.val ? '700' : '500',
                    color: activeConversation.disappearing_timer === opt.val ? 'var(--primary)' : 'var(--text-primary)'
                  }}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          )}

          {showGroupInfo && activeConversation.type === 'group' && (
            <div style={styles.infoDropdown} className="anim-scale-up">
              <div style={styles.infoDropdownTitle}>Group Members</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                {activeConversation.members.map(member => (
                  <div key={member.id} style={styles.memberItem}>
                    <img src={member.avatar_url} alt={member.display_name} style={styles.memberAvatar} />
                    <span style={styles.memberName}>{member.display_name}</span>
                    {member.role === 'admin' && <span style={styles.memberRole}>Admin</span>}
                    <span style={{
                      ...styles.memberOnlineDot,
                      backgroundColor: member.is_online === 1 ? 'var(--status-online)' : 'var(--status-offline)'
                    }} />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button onClick={handleCallClick} style={styles.headerActionButton} title="Voice Call" aria-label="Voice Call" className="desktop-only hover-action-btn">
            <Phone size={18} />
          </button>
          <button onClick={handleCallClick} style={styles.headerActionButton} title="Video Call" aria-label="Video Call" className="desktop-only hover-action-btn">
            <Video size={18} />
          </button>
        </div>
      </div>

      {/* Message List Panel */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScrollEvent}
        style={styles.messagesPane}
      >
        <div style={styles.e2eBanner}>
          <ShieldAlert size={14} color="var(--primary)" />
          <span>Simulated Encryption Active. All discussions stored securely in local SQLite files.</span>
        </div>

        {messagesLoading ? (
          <div style={styles.messagesSkeletonContainer}>
            <div style={styles.skeletonBubbleLeft} className="skeleton-shimmer" />
            <div style={styles.skeletonBubbleRight} className="skeleton-shimmer" />
            <div style={{ ...styles.skeletonBubbleLeft, width: '45%' }} className="skeleton-shimmer" />
            <div style={{ ...styles.skeletonBubbleRight, width: '55%' }} className="skeleton-shimmer" />
            <div style={{ ...styles.skeletonBubbleLeft, width: '75%' }} className="skeleton-shimmer" />
          </div>
        ) : messageElements.length === 0 ? (
          <div style={styles.chatEmptyState} className="anim-fade-in">
            <div style={styles.chatEmptyIcon}>💬</div>
            <h4 style={styles.chatEmptyTitle}>
              {activeConversation.type === 'group' ? 'New Group Space' : 'Secure Connection Established'}
            </h4>
            <p style={styles.chatEmptyText}>
              {activeConversation.type === 'group'
                ? `Welcome to the secure group: ${activeConversation.name}. Say hello to start the conversation!`
                : `This is the start of your direct chat history. Your messages are protected.`}
            </p>
          </div>
        ) : (
          messageElements
        )}

        {/* Typing Dots Bubble */}
        {typingText && (
          <div style={styles.typingBubble} className="anim-fade-in">
            <span style={styles.typingText}>{typingText}</span>
            <div style={styles.typingDotsContainer}>
              <div style={styles.typingDot} className="typing-dot" />
              <div style={styles.typingDot} className="typing-dot" />
              <div style={styles.typingDot} className="typing-dot" />
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Scroll-to-Bottom controls */}
      {showScrollButton && (
        <button onClick={() => scrollToBottom()} style={styles.floatingScrollButton} className="hover-action-btn" title="Scroll to bottom" aria-label="Scroll to bottom">
          <ArrowDown size={16} />
        </button>
      )}

      {/* New Messages indicator banner */}
      {hasNewMessages && (
        <button
          onClick={() => {
            scrollToBottom('smooth');
            setHasNewMessages(false);
          }}
          className="new-messages-indicator"
        >
          <ArrowDown size={14} /> New Messages Below
        </button>
      )}

      {/* Active Quote/Reply Preview Bar */}
      {activeReply && (
        <div style={styles.replyPreviewBar} className="anim-fade-in">
          <div style={styles.replyPreviewContent}>
            <span style={styles.replyPreviewSender}>Replying to {activeReply.sender_name}</span>
            <span style={styles.replyPreviewSnippet}>
              {activeReply.message_type === 'attachment' ? '[Attachment]' : activeReply.content}
            </span>
          </div>
          <button onClick={() => setActiveReply(null)} style={styles.cancelReplyButton} title="Cancel reply" aria-label="Cancel reply">
            <X size={16} />
          </button>
        </div>
      )}

      {/* Composer panel */}
      <MessageComposer
        onSend={handleSend}
        conversationId={activeConversation.id}
      />
    </div>
  );
}

const styles = {
  container: {
    flex: 1,
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--bg-chat)',
    position: 'relative'
  },
  header: {
    height: '76px',
    backgroundColor: 'var(--surface)',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 24px',
    zIndex: 10,
    boxShadow: 'var(--shadow-sm)'
  },
  chatInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  backButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 'var(--radius-full)'
  },
  avatar: {
    height: '42px',
    width: '42px',
    borderRadius: 'var(--radius-full)',
    objectFit: 'cover'
  },
  titleMeta: {
    display: 'flex',
    flexDirection: 'column'
  },
  titleText: {
    fontSize: '15px',
    fontWeight: '700'
  },
  statusText: {
    fontSize: '12px',
    fontWeight: '600'
  },
  headerActions: {
    display: 'flex',
    gap: '8px'
  },
  headerActionButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '8px',
    borderRadius: 'var(--radius-full)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color var(--transition-fast)'
  },
  messagesPane: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'hidden',
    display: 'flex',
    flexDirection: 'column',
    padding: '16px 0',
    gap: '8px'
  },
  e2eBanner: {
    alignSelf: 'center',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    fontSize: '11px',
    fontWeight: '600',
    padding: '6px 16px',
    borderRadius: 'var(--radius-full)',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    marginBottom: '20px',
    marginTop: '4px',
    userSelect: 'none',
    boxShadow: 'var(--shadow-sm)'
  },
  dateSeparator: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    margin: '16px 0',
    userSelect: 'none'
  },
  dateSeparatorText: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--border)',
    padding: '4px 12px',
    borderRadius: 'var(--radius-full)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  typingBubble: {
    alignSelf: 'flex-start',
    marginLeft: '24px',
    marginTop: '4px',
    marginBottom: '4px',
    padding: '8px 12px',
    backgroundColor: 'var(--bubble-in)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    boxShadow: 'var(--shadow-sm)'
  },
  typingText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    fontStyle: 'italic'
  },
  typingDotsContainer: {
    display: 'flex',
    gap: '3px'
  },
  typingDot: {
    height: '6px',
    width: '6px',
    backgroundColor: 'var(--primary)',
    borderRadius: 'var(--radius-full)'
  },
  floatingScrollButton: {
    position: 'absolute',
    bottom: '90px',
    right: '24px',
    height: '36px',
    width: '36px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-md)',
    zIndex: 100,
    transition: 'all var(--transition-fast)'
  },
  replyPreviewBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 24px',
    backgroundColor: 'var(--bg-app)',
    borderTop: '1px solid var(--border)',
    zIndex: 5
  },
  replyPreviewContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    borderLeft: '3px solid var(--primary)',
    paddingLeft: '10px',
    fontSize: '12px'
  },
  replyPreviewSender: {
    fontWeight: '700',
    color: 'var(--primary)'
  },
  replyPreviewSnippet: {
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    maxWidth: '500px'
  },
  cancelReplyButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px'
  },
  emptyState: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: '14px',
    backgroundColor: 'var(--bg-chat)'
  },
  logoContainer: {
    height: '64px',
    width: '64px',
    borderRadius: '16px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontFamily: 'var(--font-heading)',
    fontSize: '32px',
    boxShadow: 'var(--shadow-lg)',
    marginBottom: '6px'
  },
  emptyTitle: {
    fontSize: '22px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading)'
  },
  emptySubtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)'
  },
  disappearingDropdown: {
    position: 'absolute',
    top: '46px',
    right: '84px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 100,
    width: '160px',
    padding: '6px 0',
    display: 'flex',
    flexDirection: 'column'
  },
  dropdownHeader: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    padding: '6px 12px',
    textTransform: 'uppercase',
    borderBottom: '1px solid var(--border)',
    marginBottom: '4px'
  },
  dropdownItem: {
    background: 'none',
    border: 'none',
    padding: '8px 12px',
    fontSize: '13px',
    textAlign: 'left',
    cursor: 'pointer',
    width: '100%',
    fontFamily: 'var(--font-sans)',
    transition: 'background-color var(--transition-fast)'
  },
  headerSearchWrapper: {
    display: 'flex',
    alignItems: 'center',
    flex: 1,
    maxWidth: '400px',
    backgroundColor: 'var(--bg-app)',
    borderRadius: 'var(--radius-md)',
    padding: '6px 12px',
    border: '1px solid var(--border)',
    marginRight: '12px'
  },
  headerSearchInput: {
    border: 'none',
    background: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontSize: '14px',
    width: '100%'
  },
  headerSearchClose: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  infoDropdown: {
    position: 'absolute',
    top: '46px',
    right: '84px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-lg)',
    zIndex: 100,
    width: '240px',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  infoDropdownTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    borderBottom: '1px solid var(--border)',
    paddingBottom: '6px',
    marginBottom: '4px'
  },
  memberItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 0'
  },
  memberAvatar: {
    height: '24px',
    width: '24px',
    borderRadius: 'var(--radius-full)',
    objectFit: 'cover'
  },
  memberName: {
    fontSize: '13px',
    fontWeight: '600',
    flex: 1,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  memberRole: {
    fontSize: '9px',
    color: 'var(--primary)',
    backgroundColor: 'var(--primary-light)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-full)',
    fontWeight: '700'
  },
  memberOnlineDot: {
    height: '8px',
    width: '8px',
    borderRadius: 'var(--radius-full)',
    flexShrink: 0
  },
  messagesSkeletonContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '24px'
  },
  skeletonBubbleLeft: {
    height: '42px',
    width: '60%',
    backgroundColor: 'var(--border)',
    borderRadius: '18px 18px 18px 4px',
    alignSelf: 'flex-start',
    opacity: 0.5
  },
  skeletonBubbleRight: {
    height: '42px',
    width: '50%',
    backgroundColor: 'var(--primary-light)',
    borderRadius: '18px 18px 4px 18px',
    alignSelf: 'flex-end',
    opacity: 0.4
  },
  chatEmptyState: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '60px 24px',
    textAlign: 'center',
    gap: '12px',
    flex: 1
  },
  chatEmptyIcon: {
    fontSize: '36px',
    opacity: 0.8
  },
  chatEmptyTitle: {
    fontSize: '16px',
    fontWeight: '700',
    color: 'var(--text-primary)'
  },
  chatEmptyText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    maxWidth: '320px',
    lineHeight: '1.5'
  }
};
