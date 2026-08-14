import React, { useState, useRef, useEffect } from 'react';
import { useSocket } from '../../context/SocketContext.jsx';
import { Paperclip, Send, Smile, X, FileText, Image } from 'lucide-react';
import { toast } from 'react-toastify';

export default function MessageComposer({ onSend, conversationId }) {
  const { socket, isConnected } = useSocket();

  const [content, setContent] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const [filePreview, setFilePreview] = useState('');
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);

  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);

  // Auto-expand input height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
    }
  }, [content]);

  // Reset composer state on conversation toggle
  useEffect(() => {
    setContent('');
    setSelectedFile(null);
    setFilePreview('');
    setShowEmojiPicker(false);
    
    // Clear typing states
    if (isTypingRef.current && socket && isConnected) {
      socket.emit('typing:stop', { conversationId });
    }
    isTypingRef.current = false;
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
    }
  }, [conversationId]);

  // Handle typing status emission
  const handleInputChange = (e) => {
    setContent(e.target.value);

    if (socket && isConnected) {
      // If not already typing, trigger typing:start
      if (!isTypingRef.current) {
        isTypingRef.current = true;
        socket.emit('typing:start', { conversationId });
      }

      // Reset typing debouncer timeout
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }

      typingTimeoutRef.current = setTimeout(() => {
        socket.emit('typing:stop', { conversationId });
        isTypingRef.current = false;
      }, 2000); // 2 seconds idle threshold
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Strict whitelisted extensions check
    const allowedExtensions = [
      'png', 'jpg', 'jpeg', 'gif', 'webp', 
      'pdf', 'doc', 'docx', 'txt', 'xls', 'xlsx', 
      'mp3', 'wav', 'mp4', 'mov', 'zip', 'rar'
    ];
    const fileExtension = file.name.split('.').pop().toLowerCase();
    if (!allowedExtensions.includes(fileExtension)) {
      return toast.error(`Unsupported file type. Supported types: ${allowedExtensions.join(', ')}`);
    }

    // Strict 10MB client check matching backend uploads
    if (file.size > 10 * 1024 * 1024) {
      return toast.error('File size cannot exceed 10MB.');
    }

    setSelectedFile(file);

    // Create preview URL if it's an image
    if (file.type.startsWith('image/')) {
      const url = URL.createObjectURL(file);
      setFilePreview(url);
    } else {
      setFilePreview('');
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFilePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSendSubmit = (e) => {
    if (e) e.preventDefault();
    if (!content.trim() && !selectedFile) return;

    // Halt typing notification instantly
    if (isTypingRef.current && socket && isConnected) {
      socket.emit('typing:stop', { conversationId });
      isTypingRef.current = false;
      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
    }

    onSend(content.trim(), selectedFile);

    // Clear state
    setContent('');
    handleRemoveFile();
    if (textareaRef.current) {
      textareaRef.current.focus();
    }
  };

  const handleKeyDown = (e) => {
    // Send message on Enter key (without Shift key)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendSubmit();
    }
  };

  const handleAddEmoji = (emoji) => {
    setContent(prev => prev + emoji);
    setShowEmojiPicker(false);
  };

  const emojis = [
    '👍', '👎', '❤️', '🔥', '😂', '😮', '😢', '🙏', '👏', '🎉',
    '😊', '🤣', '😍', '😒', '😘', '😎', '🥳', '🤔', '🙄', '😴',
    '💡', '✨', '🚀', '👀', '💯', '✔️', '❌', '📌', '💬', '🔔'
  ];

  return (
    <div style={styles.container}>
      {/* File Upload Attachment Preview Banner */}
      {selectedFile && (
        <div style={styles.previewBanner} className="anim-fade-in">
          {filePreview ? (
            <img src={filePreview} alt="Preview" style={styles.imagePreview} />
          ) : (
            <div style={styles.docPreview}>
              <FileText size={24} color="var(--primary)" />
              <div style={styles.docMeta}>
                <span style={styles.docName}>{selectedFile.name}</span>
                <span style={styles.docSize}>{(selectedFile.size / 1024).toFixed(1)} KB</span>
              </div>
            </div>
          )}
          <button onClick={handleRemoveFile} style={styles.removeFileButton}>
            <X size={16} />
          </button>
        </div>
      )}

      {/* Emoji Picker Overlay Bar */}
      {showEmojiPicker && (
        <div style={styles.emojiPicker} className="anim-scale-up">
          {emojis.map((emoji) => (
            <button
              key={emoji}
              onClick={() => handleAddEmoji(emoji)}
              style={styles.emojiButton}
              className="hover-list-item"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Core Input controls */}
      <form onSubmit={handleSendSubmit} style={styles.composerForm}>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          style={styles.iconButton}
          className="hover-action-btn"
          title="Add Attachment"
          aria-label="Add Attachment"
        >
          <Paperclip size={20} />
        </button>
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          style={styles.hiddenInput}
        />

        <div style={styles.textareaWrapper}>
          <textarea
            id="composer-textarea"
            ref={textareaRef}
            rows="1"
            value={content}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Write a message... (Alt+C)"
            style={styles.textarea}
          />
          <button
            type="button"
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            style={styles.textareaEmojiButton}
            className="hover-action-btn"
            title="Smileys and Emojis"
            aria-label="Smileys and Emojis"
          >
            <Smile size={20} />
          </button>
        </div>

        <button
          type="submit"
          disabled={!content.trim() && !selectedFile}
          title="Send message"
          aria-label="Send message"
          className="hover-composer-btn"
          style={{
            ...styles.sendButton,
            opacity: (!content.trim() && !selectedFile) ? 0.5 : 1
          }}
        >
          <Send size={18} />
        </button>
      </form>
    </div>
  );
}

const styles = {
  container: {
    padding: '16px 24px',
    backgroundColor: 'var(--surface)',
    borderTop: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    position: 'relative'
  },
  previewBanner: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    width: 'fit-content',
    position: 'relative',
    maxWidth: '300px'
  },
  imagePreview: {
    height: '60px',
    width: '60px',
    objectFit: 'cover',
    borderRadius: 'var(--radius-sm)'
  },
  docPreview: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  docMeta: {
    display: 'flex',
    flexDirection: 'column',
    maxWidth: '180px'
  },
  docName: {
    fontSize: '13px',
    fontWeight: '600',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  docSize: {
    fontSize: '11px',
    color: 'var(--text-muted)'
  },
  removeFileButton: {
    background: 'var(--border)',
    border: 'none',
    color: 'var(--text-secondary)',
    borderRadius: 'var(--radius-full)',
    height: '20px',
    width: '20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    position: 'absolute',
    top: '-8px',
    right: '-8px',
    boxShadow: 'var(--shadow-sm)'
  },
  emojiPicker: {
    position: 'absolute',
    bottom: '76px',
    left: '24px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px',
    boxShadow: 'var(--shadow-lg)',
    display: 'grid',
    gridTemplateColumns: 'repeat(6, 1fr)',
    gap: '8px',
    zIndex: 100,
    width: '240px'
  },
  emojiButton: {
    background: 'none',
    border: 'none',
    fontSize: '20px',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: 'var(--radius-sm)',
    transition: 'background-color var(--transition-fast)'
  },
  composerForm: {
    display: 'flex',
    alignItems: 'flex-end',
    gap: '12px'
  },
  iconButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '10px',
    borderRadius: 'var(--radius-full)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '42px',
    width: '42px',
    transition: 'background-color var(--transition-fast)'
  },
  hiddenInput: {
    display: 'none'
  },
  textareaWrapper: {
    flex: 1,
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  textarea: {
    width: '100%',
    minHeight: '42px',
    maxHeight: '120px',
    padding: '10px 42px 10px 16px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    lineHeight: '1.4',
    outline: 'none',
    resize: 'none',
    overflowY: 'auto'
  },
  textareaEmojiButton: {
    position: 'absolute',
    right: '12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
  },
  sendButton: {
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-full)',
    height: '42px',
    width: '42px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    flexShrink: 0,
    transition: 'background-color var(--transition-fast)'
  }
};
