import React, { useState } from 'react';
import { useConversations } from '../../context/ConversationContext.jsx';
import Sidebar from '../../components/layout/Sidebar.jsx';
import ChatArea from '../../components/layout/ChatArea.jsx';
import NewChatModal from '../../components/modals/NewChatModal.jsx';
import SettingsModal from '../../components/modals/SettingsModal.jsx';
import StoriesModal from '../../components/modals/StoriesModal.jsx';

export default function Chat() {
  const { activeConversation } = useConversations();
  const [isNewChatOpen, setIsNewChatOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isStoriesOpen, setIsStoriesOpen] = useState(false);

  return (
    <div style={styles.layoutContainer} className="chat-layout page-transition">
      {/* Sidebar - Collapses on mobile when a chat is open */}
      <div 
        style={styles.sidebarWrapper} 
        className={activeConversation ? 'sidebar-collapsed' : ''}
      >
        <Sidebar
          onOpenNewChat={() => setIsNewChatOpen(true)}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenStories={() => setIsStoriesOpen(true)}
        />
      </div>

      {/* Chat Area - Collapses on mobile when list is active */}
      <div 
        style={styles.chatAreaWrapper} 
        className={!activeConversation ? 'chat-area-collapsed' : ''}
      >
        <ChatArea />
      </div>

      {/* Action overlay panels */}
      <NewChatModal isOpen={isNewChatOpen} onClose={() => setIsNewChatOpen(false)} />
      <SettingsModal isOpen={isSettingsOpen} onClose={() => setIsSettingsOpen(false)} />
      <StoriesModal isOpen={isStoriesOpen} onClose={() => setIsStoriesOpen(false)} />
    </div>
  );
}

const styles = {
  layoutContainer: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    overflow: 'hidden',
    backgroundColor: 'var(--bg-app)'
  },
  sidebarWrapper: {
    height: '100%',
    flexShrink: 0
  },
  chatAreaWrapper: {
    flex: 1,
    height: '100%',
    minWidth: 0
  }
};
