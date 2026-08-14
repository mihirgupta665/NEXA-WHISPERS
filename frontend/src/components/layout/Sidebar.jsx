import React, { useState, useEffect } from 'react';
import { useConversations } from '../../context/ConversationContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useSocket } from '../../context/SocketContext.jsx';
import api from '../../services/api.js';
import { Search, MessageSquarePlus, Settings, WifiOff, Shield, CircleDot, X, Loader2 } from 'lucide-react';

export default function Sidebar({ onOpenNewChat, onOpenSettings, onOpenStories }) {
  const { user } = useAuth();
  const { isConnected } = useSocket();
  const { 
    conversations, 
    activeConversation, 
    selectConversation, 
    conversationsLoading,
    contacts,
    startDirectChat,
    setHighlightedMessageId
  } = useConversations();

  const [searchVal, setSearchVal] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [messageSearchResults, setMessageSearchResults] = useState([]);

  // Debounced search logic for Conversations, Contacts, and Messages
  useEffect(() => {
    if (!searchVal.trim()) {
      setSearchQuery('');
      setMessageSearchResults([]);
      return;
    }

    setSearchLoading(true);
    const handler = setTimeout(async () => {
      setSearchQuery(searchVal);
      try {
        const res = await api.get(`/api/messages/search?q=${encodeURIComponent(searchVal.trim())}`);
        if (res.data.success) {
          setMessageSearchResults(res.data.data);
        }
      } catch (err) {
        console.error('[Sidebar Message Search] Error:', err);
      } finally {
        setSearchLoading(false);
      }
    }, 300);

    return () => clearTimeout(handler);
  }, [searchVal]);

  const filteredContacts = contacts.filter(c => 
    c.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const formatTime = (timestamp) => {
    if (!timestamp) return '';
    const date = new Date(timestamp);
    const now = new Date();
    
    // Check if same day
    if (date.toDateString() === now.toDateString()) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    
    // Check if yesterday
    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    }
    
  };

  const highlightText = (text, highlight) => {
    if (!text) return '';
    if (!highlight || !highlight.trim()) return text;
    const regex = new RegExp(`(${highlight.replace(/[-\/\\^$*+?.()|[\]{}]/g, '\\$&')})`, 'gi');
    const parts = text.split(regex);
    return parts.map((part, index) => 
      regex.test(part) ? (
        <mark key={index} style={styles.highlight}>
          {part}
        </mark>
      ) : (
        part
      )
    );
  };

  const handleStartContactChat = async (contactId) => {
    setSearchVal('');
    setSearchQuery('');
    await startDirectChat(contactId);
  };

  const handleSelectMessageResult = async (msg) => {
    setSearchVal('');
    setSearchQuery('');
    const conv = conversations.find(c => c.id === msg.conversation_id);
    if (conv) {
      setHighlightedMessageId(msg.id);
      await selectConversation(conv);
    } else {
      try {
        const res = await api.get(`/api/conversations/${msg.conversation_id}`);
        if (res.data.success) {
          const fetchedConv = res.data.data;
          setHighlightedMessageId(msg.id);
          await selectConversation(fetchedConv);
        }
      } catch (err) {
        console.error('Failed to load search result conversation:', err);
      }
    }
  };

  const sortedConversations = [...conversations]
    .filter(c => 
      c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (c.latest_message && c.latest_message.content.toLowerCase().includes(searchQuery.toLowerCase()))
    )
    .sort((a, b) => {
      const timeA = a.latest_message ? new Date(a.latest_message.created_at).getTime() : new Date(a.updated_at).getTime();
      const timeB = b.latest_message ? new Date(b.latest_message.created_at).getTime() : new Date(b.updated_at).getTime();
      return timeB - timeA;
    });

  return (
    <div style={styles.container}>
      {/* Sidebar Header */}
      <div style={styles.header}>
        <div style={styles.branding}>
          <div style={styles.logo}>N</div>
          <span style={styles.brandingText}>Nexa Whispers</span>
        </div>
        <div style={styles.actionButtons}>
          <button onClick={onOpenStories} title="Stories" aria-label="Stories" style={styles.actionButton} className="hover-action-btn">
            <CircleDot size={20} />
          </button>
          <button onClick={onOpenNewChat} title="New Chat" aria-label="New Chat" style={styles.actionButton} className="hover-action-btn">
            <MessageSquarePlus size={20} />
          </button>
          <button onClick={onOpenSettings} title="Settings" aria-label="Settings" style={styles.actionButton} className="hover-action-btn">
            <Settings size={20} />
          </button>
        </div>
      </div>

      {/* Reconnection Banner */}
      {!isConnected && (
        <div style={styles.offlineBanner}>
          <WifiOff size={14} />
          <span>Connecting to secure sync network...</span>
        </div>
      )}

      {/* Search Input */}
      <div style={styles.searchContainer}>
        <Search size={16} style={styles.searchIcon} />
        <input
          id="sidebar-search-input"
          type="text"
          placeholder="Search conversations, contacts, messages... (Ctrl+K)"
          value={searchVal}
          onChange={e => setSearchVal(e.target.value)}
          style={styles.searchInput}
        />
        {searchVal && (
          <button 
            onClick={() => { setSearchVal(''); setSearchQuery(''); }}
            style={styles.clearSearchBtn}
            className="hover-search-clear"
            title="Clear search"
            aria-label="Clear search"
          >
            <X size={14} />
          </button>
        )}
      </div>

      {/* Conversations List / Search Results */}
      <div style={styles.listContainer}>
        {conversationsLoading && conversations.length === 0 ? (
          <div style={styles.skeletonContainer}>
            {[1, 2, 3, 4].map(n => <div key={n} style={styles.skeletonItem} />)}
          </div>
        ) : searchVal ? (
          // Search Results View
          <div style={styles.searchResultsContainer}>
            {searchLoading ? (
              <div style={styles.searchLoadingState}>
                <Loader2 size={18} className="spinner" style={{ color: 'var(--primary)', marginRight: '8px' }} />
                <span>Searching secure sync database...</span>
              </div>
            ) : (
              <>
                {/* 1. Conversations Category */}
                <div style={styles.searchSection}>
                  <h4 style={styles.searchSectionTitle}>Conversations</h4>
                  {sortedConversations.length === 0 ? (
                    <div style={styles.searchEmptyText}>No matching conversations</div>
                  ) : (
                    sortedConversations.map(conv => {
                      const isActive = activeConversation && activeConversation.id === conv.id;
                      const isUnread = conv.unread_count > 0;
                      const lastMsg = conv.latest_message;

                      let otherParticipantOnline = false;
                      if (conv.type === 'direct') {
                        const otherMember = conv.members.find(m => m.id !== user.id);
                        otherParticipantOnline = otherMember ? otherMember.is_online === 1 : false;
                      }

                      return (
                        <div
                          key={conv.id}
                          tabIndex={0}
                          aria-label={`Chat with ${conv.name}`}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                              e.preventDefault();
                              setSearchVal('');
                              setSearchQuery('');
                              selectConversation(conv);
                            }
                          }}
                          onClick={() => {
                            setSearchVal('');
                            setSearchQuery('');
                            selectConversation(conv);
                          }}
                          style={{
                            ...styles.convItem,
                            ...(isActive ? styles.activeConvItem : {})
                          }}
                          className="hover-list-item"
                        >
                          <div style={styles.avatarWrapper}>
                            <img src={conv.avatar_url} alt={conv.name} style={styles.avatar} />
                            {conv.type === 'direct' && (
                              <span style={{
                                ...styles.statusIndicator,
                                backgroundColor: otherParticipantOnline ? 'var(--status-online)' : 'var(--status-offline)'
                              }} />
                            )}
                          </div>
                          <div style={styles.convDetails}>
                            <div style={styles.convRow}>
                              <span style={{
                                ...styles.convName,
                                fontWeight: isUnread ? '700' : '600'
                              }}>{highlightText(conv.name, searchQuery)}</span>
                              <span style={styles.convTime}>{formatTime(lastMsg ? lastMsg.created_at : conv.updated_at)}</span>
                            </div>
                            <div style={styles.convRow}>
                              <span style={{
                                ...styles.convLastMessage,
                                color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                                fontWeight: isUnread ? '600' : '400'
                              }}>
                                {lastMsg ? (
                                  <>
                                    {lastMsg.sender_id === user.id ? 'You: ' : `${lastMsg.sender_name}: `}
                                    {lastMsg.message_type === 'attachment' ? 'Sent an attachment' : highlightText(lastMsg.content, searchQuery)}
                                  </>
                                ) : (
                                  <span style={styles.noMessages}>No messages yet</span>
                                )}
                              </span>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* 2. Contacts Category */}
                <div style={styles.searchSection}>
                  <h4 style={styles.searchSectionTitle}>Contacts</h4>
                  {filteredContacts.length === 0 ? (
                    <div style={styles.searchEmptyText}>No matching contacts</div>
                  ) : (
                    filteredContacts.map(contact => (
                      <div
                        key={`contact-${contact.id}`}
                        tabIndex={0}
                        aria-label={`Start chat with contact ${contact.display_name}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleStartContactChat(contact.id);
                          }
                        }}
                        onClick={() => handleStartContactChat(contact.id)}
                        style={styles.searchResultItem}
                        className="hover-list-item"
                      >
                        <div style={styles.avatarWrapperSmall}>
                          <img src={contact.avatar_url} alt={contact.display_name} style={styles.avatarSmall} />
                          <span style={{
                            ...styles.statusIndicatorSmall,
                            backgroundColor: contact.is_online ? 'var(--status-online)' : 'var(--status-offline)'
                          }} />
                        </div>
                        <div style={styles.searchResultDetails}>
                          <span style={styles.searchResultName}>{highlightText(contact.display_name, searchQuery)}</span>
                          <span style={styles.searchResultSub}>@{highlightText(contact.username, searchQuery)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>

                {/* 3. Messages Category */}
                <div style={styles.searchSection}>
                  <h4 style={styles.searchSectionTitle}>Messages</h4>
                  {messageSearchResults.length === 0 ? (
                    <div style={styles.searchEmptyText}>No matching messages</div>
                  ) : (
                    messageSearchResults.map(msg => (
                      <div
                        key={`msg-${msg.id}`}
                        tabIndex={0}
                        aria-label={`Jump to message from ${msg.sender_name} in ${msg.conversation_name}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleSelectMessageResult(msg);
                          }
                        }}
                        onClick={() => handleSelectMessageResult(msg)}
                        style={styles.searchResultItem}
                        className="hover-list-item"
                      >
                        <img src={msg.sender_avatar || 'https://api.dicebear.com/7.x/identicon/svg'} alt={msg.sender_name} style={styles.avatarSmall} />
                        <div style={styles.searchResultDetails}>
                          <div style={styles.searchResultMeta}>
                            <span style={styles.searchResultSender}>{msg.sender_name}</span>
                            <span style={styles.searchResultTime}>{formatTime(msg.created_at)}</span>
                          </div>
                          <span style={styles.searchResultChatName}>in {msg.conversation_name}</span>
                          <span style={styles.searchResultContent}>{highlightText(msg.content, searchQuery)}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
          </div>
        ) : (
          // Standard Conversations List
          sortedConversations.length === 0 ? (
            <div style={styles.emptyState}>
              <span>No conversations yet.</span>
              <button onClick={onOpenNewChat} style={styles.emptyStateButton}>Start a conversation</button>
            </div>
          ) : (
            sortedConversations.map(conv => {
              const isActive = activeConversation && activeConversation.id === conv.id;
              const isUnread = conv.unread_count > 0;
              const lastMsg = conv.latest_message;

              // Check online state of other participant if direct
              let otherParticipantOnline = false;
              if (conv.type === 'direct') {
                const otherMember = conv.members.find(m => m.id !== user.id);
                otherParticipantOnline = otherMember ? otherMember.is_online === 1 : false;
              }

              return (
                <div
                  key={conv.id}
                  tabIndex={0}
                  aria-label={`Chat with ${conv.name}`}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      selectConversation(conv);
                    }
                  }}
                  onClick={() => selectConversation(conv)}
                  style={{
                    ...styles.convItem,
                    ...(isActive ? styles.activeConvItem : {})
                  }}
                  className="hover-list-item"
                >
                  {/* Avatar wrapper */}
                  <div style={styles.avatarWrapper}>
                    <img src={conv.avatar_url} alt={conv.name} style={styles.avatar} />
                    {conv.type === 'direct' && (
                      <span style={{
                        ...styles.statusIndicator,
                        backgroundColor: otherParticipantOnline ? 'var(--status-online)' : 'var(--status-offline)'
                      }} />
                    )}
                  </div>

                  {/* Meta details */}
                  <div style={styles.convDetails}>
                    <div style={styles.convRow}>
                      <span style={{
                        ...styles.convName,
                        fontWeight: isUnread ? '700' : '600'
                      }}>{conv.name}</span>
                      <span style={styles.convTime}>{formatTime(lastMsg ? lastMsg.created_at : conv.updated_at)}</span>
                    </div>
                    <div style={styles.convRow}>
                      <span style={{
                        ...styles.convLastMessage,
                        color: isUnread ? 'var(--text-primary)' : 'var(--text-secondary)',
                        fontWeight: isUnread ? '600' : '400'
                      }}>
                        {lastMsg ? (
                          <>
                            {lastMsg.sender_id === user.id ? 'You: ' : `${lastMsg.sender_name}: `}
                            {lastMsg.message_type === 'attachment' ? 'Sent an attachment' : lastMsg.content}
                          </>
                        ) : (
                          <span style={styles.noMessages}>No messages yet</span>
                        )}
                      </span>
                      {isUnread && (
                        <span style={styles.unreadBadge}>{conv.unread_count}</span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )
        )}
      </div>

      {/* User profile Summary at Bottom */}
      <div style={styles.profileSummary}>
        <img src={user?.avatar_url} alt="My profile" style={styles.profileAvatar} />
        <div style={styles.profileMeta}>
          <span style={styles.profileName}>{user?.display_name}</span>
          <div style={styles.simulatedE2EContainer}>
            <Shield size={10} color="var(--primary)" />
            <span style={styles.profileUsername}>Simulated E2E Secure</span>
          </div>
        </div>
      </div>
    </div>
  );
}

const styles = {
  container: {
    width: '320px',
    height: '100%',
    backgroundColor: 'var(--bg-sidebar)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    transition: 'background-color var(--transition-normal)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)'
  },
  branding: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  logo: {
    height: '28px',
    width: '28px',
    borderRadius: '8px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontFamily: 'var(--font-heading)',
    fontSize: '15px'
  },
  brandingText: {
    fontFamily: 'var(--font-heading)',
    fontSize: '17px',
    fontWeight: '700'
  },
  actionButtons: {
    display: 'flex',
    gap: '6px'
  },
  actionButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: 'var(--radius-full)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background-color var(--transition-fast)'
  },
  offlineBanner: {
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    color: '#ef4444',
    padding: '8px 16px',
    fontSize: '12px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    fontWeight: '600',
    borderBottom: '1px solid rgba(239, 68, 68, 0.2)'
  },
  searchContainer: {
    position: 'relative',
    padding: '16px 24px',
    display: 'flex',
    alignItems: 'center'
  },
  searchIcon: {
    position: 'absolute',
    left: '36px',
    color: 'var(--text-muted)'
  },
  searchInput: {
    width: '100%',
    padding: '8px 12px 8px 36px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    outline: 'none',
    transition: 'all var(--transition-fast)'
  },
  listContainer: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column'
  },
  convItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '14px',
    padding: '12px 24px',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)'
  },
  activeConvItem: {
    backgroundColor: 'var(--surface-hover)'
  },
  avatarWrapper: {
    position: 'relative',
    height: '46px',
    width: '46px',
    flexShrink: 0
  },
  avatar: {
    height: '46px',
    width: '46px',
    borderRadius: 'var(--radius-full)',
    objectFit: 'cover'
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    height: '11px',
    width: '11px',
    borderRadius: 'var(--radius-full)',
    border: '2px solid var(--surface)'
  },
  convDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    minWidth: 0
  },
  convRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: '8px'
  },
  convName: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  convTime: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    flexShrink: 0
  },
  convLastMessage: {
    fontSize: '13px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    minWidth: 0
  },
  noMessages: {
    color: 'var(--text-muted)',
    fontStyle: 'italic'
  },
  unreadBadge: {
    backgroundColor: 'var(--unread-badge)',
    color: 'white',
    fontSize: '10px',
    fontWeight: '700',
    minWidth: '18px',
    height: '18px',
    borderRadius: 'var(--radius-full)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '0 5px',
    flexShrink: 0
  },
  skeletonContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    padding: '16px 24px'
  },
  skeletonItem: {
    height: '60px',
    backgroundColor: 'var(--border)',
    borderRadius: 'var(--radius-md)',
    opacity: 0.5
  },
  emptyState: {
    textAlign: 'center',
    padding: '40px 24px',
    color: 'var(--text-muted)',
    fontSize: '14px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px'
  },
  emptyStateButton: {
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer'
  },
  profileSummary: {
    padding: '16px 24px',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    backgroundColor: 'var(--bg-app)'
  },
  profileAvatar: {
    height: '38px',
    width: '38px',
    borderRadius: 'var(--radius-full)',
    objectFit: 'cover'
  },
  profileMeta: {
    display: 'flex',
    flexDirection: 'column'
  },
  profileName: {
    fontSize: '13px',
    fontWeight: '600'
  },
  simulatedE2EContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    marginTop: '2px'
  },
  profileUsername: {
    fontSize: '10px',
    color: 'var(--text-muted)'
  },
  clearSearchBtn: {
    position: 'absolute',
    right: '30px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '4px',
    borderRadius: 'var(--radius-full)',
    zIndex: 10,
    outline: 'none'
  },
  highlight: {
    backgroundColor: 'var(--primary-glow)',
    color: 'var(--primary)',
    fontWeight: '700',
    borderRadius: '2px',
    padding: '0 2px'
  },
  searchResultsContainer: {
    flex: 1,
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '16px',
    padding: '16px 24px'
  },
  searchLoadingState: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 0',
    color: 'var(--text-muted)',
    fontSize: '13px'
  },
  searchSection: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  searchSectionTitle: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
    paddingBottom: '4px',
    borderBottom: '1px solid var(--border)'
  },
  searchEmptyText: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    padding: '4px 8px',
    fontStyle: 'italic'
  },
  searchResultItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)'
  },
  avatarWrapperSmall: {
    position: 'relative',
    height: '32px',
    width: '32px',
    flexShrink: 0
  },
  avatarSmall: {
    height: '32px',
    width: '32px',
    borderRadius: 'var(--radius-full)',
    objectFit: 'cover'
  },
  statusIndicatorSmall: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    height: '8px',
    width: '8px',
    borderRadius: 'var(--radius-full)',
    border: '1.5px solid var(--surface)'
  },
  searchResultDetails: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    minWidth: 0
  },
  searchResultName: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  searchResultSub: {
    fontSize: '11px',
    color: 'var(--text-muted)'
  },
  searchResultMeta: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center'
  },
  searchResultSender: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-primary)'
  },
  searchResultTime: {
    fontSize: '10px',
    color: 'var(--text-muted)'
  },
  searchResultChatName: {
    fontSize: '10px',
    fontWeight: '600',
    color: 'var(--primary)',
    textTransform: 'uppercase',
    letterSpacing: '0.2px'
  },
  searchResultContent: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  }
};
