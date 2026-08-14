import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { Check, CheckCheck, CornerUpLeft, Copy, Trash2, FileText, Download, ChevronDown, Pin } from 'lucide-react';
import { toast } from 'react-toastify';
import api from '../../services/api.js';

export default function MessageBubble({ message, messagesList, onReplyClick, onReact, onDelete, groupPosition = 'none', onRetry, onRemoveFailed, onPinClick }) {
  const { user } = useAuth();
  const isMe = message.sender_id === user.id;

  const [showHoverActions, setShowHoverActions] = useState(false);
  const [isActionMenuOpen, setIsActionMenuOpen] = useState(false);

  const touchTimer = useRef(null);
  const bubbleRef = useRef(null);

  const [timeLeft, setTimeLeft] = useState(() => {
    if (!message.expires_at) return null;
    return Math.max(0, Math.ceil((message.expires_at - Date.now()) / 1000));
  });

  useEffect(() => {
    if (timeLeft === null || timeLeft <= 0) return;

    const timer = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((message.expires_at - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(timer);
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [message.expires_at, timeLeft]);

  useEffect(() => {
    const handlePointerDownOutside = (event) => {
      if (!bubbleRef.current?.contains(event.target)) {
        setIsActionMenuOpen(false);
      }
    };

    document.addEventListener('mousedown', handlePointerDownOutside);
    document.addEventListener('touchstart', handlePointerDownOutside);

    return () => {
      document.removeEventListener('mousedown', handlePointerDownOutside);
      document.removeEventListener('touchstart', handlePointerDownOutside);
    };
  }, []);

  if (timeLeft !== null && timeLeft <= 0) {
    return null;
  }

  if (message.sender_id === 0) {
    return (
      <div style={styles.systemContainer}>
        <span style={styles.systemText}>{message.content}</span>
      </div>
    );
  }

  // Retrieve reply parent message info if present
  const repliedMessage = message.reply_to_message_id
    ? messagesList.find(m => m.id === message.reply_to_message_id)
    : null;

  const handleScrollToParent = () => {
    if (!message.reply_to_message_id) return;
    const parentEl = document.getElementById(`message-${message.reply_to_message_id}`);
    if (parentEl) {
      parentEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Add a quick visual highlight class
      const bubble = parentEl.querySelector('.msg-bubble-card');
      if (bubble) {
        bubble.classList.add('message-highlight-pulse');
        setTimeout(() => {
          bubble.classList.remove('message-highlight-pulse');
        }, 1500);
      }
    } else {
      toast.warn('Original message is not loaded or has been deleted.');
    }
  };

  const handleCopyText = () => {
    navigator.clipboard.writeText(message.content);
    toast.success('Message content copied to clipboard.');
    setIsActionMenuOpen(false);
  };

  const handleDownload = async (e) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    if (!message.attachment) return;

    const fileName = message.attachment.file_name;
    const fileUrl = message.attachment.file_url;

    // If it's a data URL, we can download it directly
    if (fileUrl?.startsWith('data:')) {
      const link = document.createElement('a');
      link.href = fileUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setIsActionMenuOpen(false);
      return;
    }

    const toastId = toast.loading(`Downloading ${fileName}...`);
    try {
      let baseUrl = import.meta.env.VITE_API_URL || 'http://localhost:5001';
      if (baseUrl.endsWith('/')) {
        baseUrl = baseUrl.slice(0, -1);
      }
      const relativePath = fileUrl.startsWith('/') ? fileUrl : `/${fileUrl}`;
      const fullUrl = `${baseUrl}${relativePath}`;

      const response = await fetch(fullUrl, {
        method: 'GET',
        credentials: 'include' // include session cookie in request
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();

      document.body.removeChild(link);
      window.URL.revokeObjectURL(blobUrl);

      toast.update(toastId, {
        render: 'Download complete!',
        type: 'success',
        isLoading: false,
        autoClose: 2000
      });
    } catch (err) {
      console.error('[Download Error] Failed to download attachment:', err);
      toast.update(toastId, {
        render: 'Failed to download file.',
        type: 'error',
        isLoading: false,
        autoClose: 3000
      });
    }
    setIsActionMenuOpen(false);
  };

  const formatMessageTime = (timestamp) => {
    if (!timestamp) return '';
    return new Date(timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  // Render the message ticks
  const renderStatus = () => {
    if (!isMe) return null;

    switch (message.status) {
      case 'sending':
        return <span style={styles.sendingIndicator}>...</span>;
      case 'failed':
        return <span style={styles.failedIndicator} title="Sending failed. Click to retry/delete.">⚠️</span>;
      case 'sent':
        return <Check size={14} color="var(--text-muted)" style={styles.tickIcon} />;
      case 'delivered':
        return <CheckCheck size={14} color="var(--text-muted)" style={styles.tickIcon} />;
      case 'read':
        return <CheckCheck size={14} color="#34b7f1" style={styles.tickIcon} />; // Professional blue double check (WhatsApp style)
      default:
        return null;
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  const reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '🔥'];

  // Check if current user reacted with a specific emoji
  const hasUserReacted = (emoji) => {
    return message.reactions?.some(r => r.user_id === user.id && r.emoji === emoji);
  };

  // Group message reactions
  const groupedReactions = message.reactions
    ? message.reactions.reduce((acc, current) => {
      if (!acc[current.emoji]) {
        acc[current.emoji] = {
          emoji: current.emoji,
          count: 0,
          usernames: [],
          hasReacted: false
        };
      }
      acc[current.emoji].count += 1;
      acc[current.emoji].usernames.push(current.username);
      if (current.user_id === user.id) {
        acc[current.emoji].hasReacted = true;
      }
      return acc;
    }, {})
    : {};

  const handleContextMenuEvent = (e) => {
    e.preventDefault();
    setIsActionMenuOpen(true);
    setShowHoverActions(true);
  };

  // Touch handlers for long-press support
  const handleTouchStart = (e) => {
    const touch = e.touches[0];
    const clientX = touch.clientX;
    const clientY = touch.clientY;

    touchTimer.current = setTimeout(() => {
      setIsActionMenuOpen(true);
      setShowHoverActions(true);
    }, 550); // 550ms hold
  };

  const handleTouchEnd = () => {
    if (touchTimer.current) {
      clearTimeout(touchTimer.current);
    }
  };

  // Keyboard controls
  const handleKeyDown = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      setIsActionMenuOpen(prev => !prev);
      setShowHoverActions(true);
    }

    if (e.key === 'Escape') {
      setIsActionMenuOpen(false);
    }
  };

  // Dynamic message grouping bubble styles
  const getBubbleRadiiAndMargins = () => {
    let borderRadius = '';
    let marginTop = '6px';

    if (isMe) {
      // Outgoing message corner rounding
      switch (groupPosition) {
        case 'first':
          borderRadius = '18px 18px 4px 18px';
          marginTop = '8px';
          break;
        case 'middle':
          borderRadius = '18px 4px 4px 18px';
          marginTop = '2px';
          break;
        case 'last':
          borderRadius = '18px 4px 18px 18px';
          marginTop = '2px';
          break;
        default: // Standalone ('none')
          borderRadius = '18px 18px 4px 18px';
          marginTop = '8px';
      }
    } else {
      // Incoming message corner rounding
      switch (groupPosition) {
        case 'first':
          borderRadius = '18px 18px 18px 4px';
          marginTop = '8px';
          break;
        case 'middle':
          borderRadius = '4px 18px 18px 4px';
          marginTop = '2px';
          break;
        case 'last':
          borderRadius = '4px 18px 18px 18px';
          marginTop = '2px';
          break;
        default: // Standalone ('none')
          borderRadius = '18px 18px 18px 4px';
          marginTop = '8px';
      }
    }
    return { borderRadius, marginTop };
  };

  const { borderRadius, marginTop } = getBubbleRadiiAndMargins();
  const showSenderName = !isMe && message.sender_name && (groupPosition === 'first' || groupPosition === 'none');

  return (
    <div
      id={`message-${message.id || message.client_msg_id}`}
      ref={bubbleRef}
      tabIndex={0}
      className="anim-message-appear"
      onKeyDown={handleKeyDown}
      onContextMenu={handleContextMenuEvent}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      onMouseEnter={() => setShowHoverActions(true)}
      onMouseLeave={() => {
        setShowHoverActions(false);
      }}
      style={{
        ...styles.wrapper,
        justifyContent: isMe ? 'flex-end' : 'flex-start',
        marginTop
      }}
    >
      {/* Message Bubble Card */}
      <div
        className="msg-bubble-card"
        style={{
          ...styles.bubble,
          backgroundColor: isMe ? 'var(--bubble-out)' : 'var(--bubble-in)',
          color: isMe ? 'var(--bubble-out-text)' : 'var(--bubble-in-text)',
          borderRadius
        }}
      >
        {/* Desktop Hover Action Controls */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setIsActionMenuOpen(prev => !prev);
            setShowHoverActions(true);
          }}
          style={{
            ...styles.hoverMenuButton,
            left: isMe ? '-36px' : 'auto',
            right: isMe ? 'auto' : '-36px',
            opacity: showHoverActions || isActionMenuOpen ? 1 : 0,
            pointerEvents: showHoverActions || isActionMenuOpen ? 'auto' : 'none'
          }}
          className="hover-action-btn"
          title="Message Actions"
          aria-label="Message Actions"
          aria-expanded={isActionMenuOpen}
        >
          <ChevronDown size={14} />
        </button>

        {isActionMenuOpen && (
          <div
            className="premium-context-menu"
            style={{
              ...styles.inlineActionMenu,
              left: isMe ? 'auto' : '-6px',
              right: isMe ? '-6px' : 'auto'
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={styles.contextReactBar}>
              {reactionEmojis.map(emoji => (
                <button
                  key={emoji}
                  onClick={() => {
                    onReact(message.id, hasUserReacted(emoji) ? null : emoji);
                    setIsActionMenuOpen(false);
                  }}
                  className="hover-emoji-btn"
                  style={{
                    ...styles.contextEmojiBtn,
                    backgroundColor: hasUserReacted(emoji) ? 'var(--primary-light)' : 'transparent'
                  }}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {message.status === 'failed' ? (
              <>
                <button className="premium-context-menu-item" style={{ color: 'var(--primary)', fontWeight: 'bold' }} onClick={() => { onRetry(message.client_msg_id); setIsActionMenuOpen(false); }}>
                  Retry Sending
                </button>
                <button className="premium-context-menu-item danger" onClick={() => { onRemoveFailed(message.client_msg_id); setIsActionMenuOpen(false); }}>
                  Remove Message
                </button>
              </>
            ) : (
              <>
                <button className="premium-context-menu-item" onClick={() => { onPinClick(message); setIsActionMenuOpen(false); }}>
                  <Pin size={14} /> Pin Message
                </button>
                <button className="premium-context-menu-item" onClick={() => { onReplyClick(message); setIsActionMenuOpen(false); }}>
                  <CornerUpLeft size={14} /> Reply
                </button>
                {message.message_type === 'attachment' && message.attachment && (
                  <button className="premium-context-menu-item" onClick={handleDownload}>
                    <Download size={14} /> Download File
                  </button>
                )}
                <button className="premium-context-menu-item" onClick={handleCopyText}>
                  <Copy size={14} /> Copy Text
                </button>
                {isMe && (
                  <button className="premium-context-menu-item danger" onClick={() => { onDelete(message.id); setIsActionMenuOpen(false); }}>
                    <Trash2 size={14} /> Delete Message
                  </button>
                )}
              </>
            )}
          </div>
        )}
        {/* Group Chat Sender Name */}
        {showSenderName && (
          <span style={styles.senderName}>{message.sender_name}</span>
        )}

        {/* Quoted Reply Message visualization */}
        {repliedMessage && (
          <div onClick={handleScrollToParent} style={styles.replyQuote}>
            <span style={styles.replySender}>{repliedMessage.sender_name}</span>
            <span style={styles.replySnippet}>
              {repliedMessage.message_type === 'attachment' ? '[Attachment]' : repliedMessage.content}
            </span>
          </div>
        )}

        {/* File / Image Attachment View */}
        {message.message_type === 'attachment' && (
          <div style={styles.attachmentContainer}>
            {message.attachment ? (
              (() => {
                const attachmentUrl = message.attachment.file_url?.startsWith('data:')
                  ? message.attachment.file_url
                  : `${import.meta.env.VITE_API_URL || 'http://localhost:5001'}${message.attachment.file_url}`;

                return message.attachment.file_type.startsWith('image/') ? (
                  <img
                    src={attachmentUrl}
                    alt={message.attachment.file_name}
                    style={{ ...styles.attachmentImage, cursor: 'pointer' }}
                    onClick={handleDownload}
                    title="Click to download image"
                  />
                ) : (
                  <div 
                    style={{ ...styles.fileCard, cursor: 'pointer' }}
                    onClick={handleDownload}
                    title="Click to download file"
                  >
                    <FileText size={24} color="var(--primary)" />
                    <div style={styles.fileCardMeta}>
                      <span style={styles.fileName}>{message.attachment.file_name}</span>
                      <span style={styles.fileSize}>{formatFileSize(message.attachment.file_size)}</span>
                    </div>
                    <a
                      href="#"
                      onClick={handleDownload}
                      style={styles.downloadButton}
                      title="Download file"
                    >
                      <Download size={16} />
                    </a>
                  </div>
                );
              })()
            ) : (
              <div style={styles.fileCard}>
                <FileText size={24} color="var(--text-muted)" />
                <div style={styles.fileCardMeta}>
                  <span style={styles.fileName}>{message.content}</span>
                  <span style={styles.fileSize}>
                    {message.uploadProgress !== undefined
                      ? `Uploading: ${message.uploadProgress}%`
                      : 'Uploading...'}
                  </span>
                </div>
                {message.uploadProgress !== undefined && (
                  <div style={styles.progressCircle}>
                    <span style={styles.progressCircleText}>{message.uploadProgress}%</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Text Message Content */}
        {message.message_type !== 'attachment' && (
          <p style={styles.contentText}>{message.content}</p>
        )}

        {/* Timestamp and Receipt indicators */}
        <div style={styles.bubbleFooter}>
          {timeLeft !== null && (
            <span style={{
              ...styles.timerText,
              color: isMe ? 'var(--bubble-out-status)' : 'var(--bubble-in-status)'
            }}>⏳ {timeLeft}s</span>
          )}
          <span style={{
            ...styles.timestamp,
            color: isMe ? 'var(--bubble-out-status)' : 'var(--bubble-in-status)'
          }}>{formatMessageTime(message.created_at)}</span>
          {renderStatus()}
        </div>

        {/* Grouped Message Reactions summary */}
        {message.reactions && message.reactions.length > 0 && (
          <div style={styles.reactionsSummary}>
            {Object.values(groupedReactions).map(group => (
              <span
                key={group.emoji}
                title={group.usernames.join(', ')}
                style={{
                  ...styles.reactionBadge,
                  backgroundColor: group.hasReacted ? 'var(--primary-light)' : 'var(--surface)',
                  borderColor: group.hasReacted ? 'var(--primary)' : 'var(--border)'
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onReact(message.id, group.hasReacted ? null : group.emoji);
                }}
                className="reaction-pop"
              >
                <span>{group.emoji}</span>
                {group.count > 1 && <span className="reaction-count">{group.count}</span>}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  wrapper: {
    display: 'flex',
    width: '100%',
    padding: '0 24px',
    position: 'relative',
    transition: 'background-color 0.2s ease',
    outline: 'none'
  },
  bubble: {
    padding: '10px 14px',
    maxWidth: '65%',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    position: 'relative',
    wordBreak: 'break-word',
    transition: 'all 0.2s ease'
  },
  senderName: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--primary)',
    marginBottom: '2px',
    fontFamily: 'var(--font-heading)'
  },
  replyQuote: {
    padding: '6px 10px',
    borderLeft: '3px solid var(--primary)',
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    flexDirection: 'column',
    gap: '2px',
    cursor: 'pointer',
    marginBottom: '6px',
    fontSize: '12px',
    userSelect: 'none'
  },
  replySender: {
    fontWeight: '700',
    color: 'var(--primary)'
  },
  replySnippet: {
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  attachmentContainer: {
    borderRadius: 'var(--radius-sm)',
    overflow: 'hidden',
    marginTop: '2px',
    marginBottom: '2px'
  },
  attachmentImage: {
    maxWidth: '100%',
    maxHeight: '260px',
    borderRadius: 'var(--radius-sm)',
    objectFit: 'contain'
  },
  fileCard: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px',
    backgroundColor: 'var(--bg-app)',
    borderRadius: 'var(--radius-md)',
    minWidth: '220px',
    border: '1px solid var(--border)'
  },
  fileCardMeta: {
    display: 'flex',
    flexDirection: 'column',
    flex: 1,
    minWidth: 0
  },
  fileName: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  fileSize: {
    fontSize: '11px',
    color: 'var(--text-muted)'
  },
  downloadButton: {
    padding: '8px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-full)',
    color: 'var(--text-secondary)',
    display: 'flex',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)'
  },
  contentText: {
    fontSize: '14px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap'
  },
  bubbleFooter: {
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: '4px',
    marginTop: '2px',
    alignSelf: 'flex-end'
  },
  timestamp: {
    fontSize: '10px',
    userSelect: 'none'
  },
  tickIcon: {
    flexShrink: 0
  },
  sendingIndicator: {
    fontSize: '10px',
    color: 'var(--text-muted)',
    animation: 'pulse 1s infinite'
  },
  hoverActionBar: {
    position: 'absolute',
    top: '50%',
    transform: 'translateY(-50%)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    zIndex: 10,
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-full)',
    padding: '2px',
    boxShadow: 'var(--shadow-sm)',
    animation: 'fadeIn var(--transition-fast) forwards'
  },
  hoverBtn: {
    height: '26px',
    width: '26px',
    borderRadius: 'var(--radius-full)',
    border: 'none',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)'
  },
  quickReactPanel: {
    display: 'flex',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-full)',
    padding: '2px 6px',
    boxShadow: 'var(--shadow-md)',
    gap: '2px',
    position: 'absolute',
    bottom: '32px',
    left: '0',
    zIndex: 15
  },
  quickEmoji: {
    background: 'none',
    border: 'none',
    fontSize: '16px',
    padding: '2px 4px',
    cursor: 'pointer',
    borderRadius: 'var(--radius-full)',
    transition: 'transform 0.1s ease'
  },
  reactionsSummary: {
    display: 'flex',
    flexWrap: 'wrap',
    gap: '4px',
    position: 'absolute',
    bottom: '-12px',
    right: '12px',
    zIndex: 2
  },
  reactionBadge: {
    fontSize: '11px',
    padding: '2px 6px',
    borderWidth: '1px',
    borderStyle: 'solid',
    borderRadius: 'var(--radius-full)',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    userSelect: 'none',
    transition: 'all var(--transition-fast)'
  },
  progressCircle: {
    height: '32px',
    width: '32px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'var(--primary-light)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: '8px',
    flexShrink: 0
  },
  progressCircleText: {
    fontSize: '9px',
    fontWeight: '700',
    color: 'var(--primary)'
  },
  systemContainer: {
    display: 'flex',
    justifyContent: 'center',
    width: '100%',
    margin: '8px 0',
    padding: '0 24px',
    userSelect: 'none'
  },
  systemText: {
    fontSize: '11px',
    fontWeight: '600',
    color: 'var(--text-muted)',
    backgroundColor: 'var(--border)',
    padding: '4px 12px',
    borderRadius: 'var(--radius-full)',
    textAlign: 'center',
    boxShadow: 'var(--shadow-sm)'
  },
  timerText: {
    fontSize: '10px',
    marginRight: '6px',
    display: 'flex',
    alignItems: 'center',
    fontWeight: '600',
    userSelect: 'none'
  },
  contextReactBar: {
    display: 'flex',
    gap: '4px',
    padding: '4px',
    borderBottom: '1px solid var(--border)',
    marginBottom: '4px'
  },
  contextEmojiBtn: {
    border: 'none',
    fontSize: '16px',
    padding: '4px',
    cursor: 'pointer',
    borderRadius: 'var(--radius-sm)',
    transition: 'transform 0.1s ease'
  },
  failedIndicator: {
    color: '#ef4444',
    fontSize: '12px',
    fontWeight: 'bold',
    marginLeft: '6px',
    cursor: 'pointer',
    userSelect: 'none'
  },
  hoverMenuButton: {
    position: 'absolute',
    top: '10px',
    height: '24px',
    width: '24px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
    color: 'var(--text-secondary)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    boxShadow: 'var(--shadow-sm)',
    zIndex: 12,
    transition: 'opacity var(--transition-fast), transform var(--transition-fast), background-color var(--transition-fast)'
  },
  inlineActionMenu: {
    position: 'absolute',
    top: '38px',
    minWidth: '184px',
    zIndex: 14
  }
};
