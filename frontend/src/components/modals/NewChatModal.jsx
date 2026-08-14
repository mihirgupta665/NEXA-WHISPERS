import React, { useState, useEffect } from 'react';
import { useConversations } from '../../context/ConversationContext.jsx';
import api from '../../services/api.js';
import { toast } from 'react-toastify';
import { X, UserPlus, Search, Users, MessageSquare } from 'lucide-react';

export default function NewChatModal({ isOpen, onClose }) {
  const { contacts, contactsLoading, fetchContacts, startDirectChat, createGroupChat } = useConversations();

  // Close modal on Escape key press
  useEffect(() => {
    const handleEscapeKey = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    if (isOpen) {
      window.addEventListener('keydown', handleEscapeKey);
    }
    return () => window.removeEventListener('keydown', handleEscapeKey);
  }, [isOpen, onClose]);

  const [activeTab, setActiveTab] = useState('direct'); // 'direct' or 'group'
  
  // Add Contact fields
  const [showAddContact, setShowAddContact] = useState(false);
  const [newContactUsername, setNewContactUsername] = useState('');
  const [addingContact, setAddingContact] = useState(false);

  // Group creation fields
  const [groupName, setGroupName] = useState('');
  const [selectedMembers, setSelectedMembers] = useState([]);

  // Search contacts locally
  const [searchQuery, setSearchQuery] = useState('');

  if (!isOpen) return null;

  const handleAddContactSubmit = async (e) => {
    e.preventDefault();
    if (!newContactUsername.trim()) return;

    setAddingContact(true);
    try {
      const res = await api.post('/api/contacts', { contactUsername: newContactUsername.trim() });
      if (res.data.success) {
        toast.success(`Contact "${res.data.data.username}" added successfully!`);
        setNewContactUsername('');
        setShowAddContact(false);
        await fetchContacts();
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add contact.');
    } finally {
      setAddingContact(false);
    }
  };

  const handleStartDirect = async (contactId) => {
    await startDirectChat(contactId);
    onClose();
  };

  const handleToggleMember = (contactId) => {
    setSelectedMembers(prev => 
      prev.includes(contactId) ? prev.filter(id => id !== contactId) : [...prev, contactId]
    );
  };

  const handleCreateGroupSubmit = async (e) => {
    e.preventDefault();
    if (!groupName.trim()) {
      return toast.error('Group name is required.');
    }
    if (selectedMembers.length === 0) {
      return toast.error('Please select at least one group member.');
    }

    const created = await createGroupChat(groupName.trim(), selectedMembers);
    if (created) {
      setGroupName('');
      setSelectedMembers([]);
      onClose();
    }
  };

  const filteredContacts = contacts.filter(c => 
    c.display_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    c.username.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="anim-scale-up">
        {/* Modal Header */}
        <div style={styles.header}>
          <h3 style={styles.title}>New Conversation</h3>
          <button onClick={onClose} style={styles.closeButton} title="Close" aria-label="Close">
            <X size={20} />
          </button>
        </div>

        {/* Tab Selection */}
        <div style={styles.tabContainer}>
          <button
            onClick={() => setActiveTab('direct')}
            style={{ ...styles.tab, ...(activeTab === 'direct' ? styles.activeTab : {}) }}
          >
            <MessageSquare size={16} />
            <span>Direct Chat</span>
          </button>
          <button
            onClick={() => setActiveTab('group')}
            style={{ ...styles.tab, ...(activeTab === 'group' ? styles.activeTab : {}) }}
          >
            <Users size={16} />
            <span>New Group</span>
          </button>
        </div>

        {/* Tab Content */}
        <div style={styles.content}>
          {activeTab === 'direct' && (
            <div style={styles.tabBody}>
              {/* Add Contact Toggle */}
              {!showAddContact ? (
                <button onClick={() => setShowAddContact(true)} style={styles.addContactToggle}>
                  <UserPlus size={16} />
                  <span>Add Contact by Username</span>
                </button>
              ) : (
                <form onSubmit={handleAddContactSubmit} style={styles.addContactForm} className="anim-fade-in">
                  <input
                    type="text"
                    placeholder="Enter username (e.g. rahul)"
                    value={newContactUsername}
                    onChange={e => setNewContactUsername(e.target.value)}
                    style={styles.input}
                    required
                  />
                  <div style={styles.formButtonGroup}>
                    <button type="submit" disabled={addingContact} style={styles.formSubmitButton}>
                      {addingContact ? 'Adding...' : 'Add'}
                    </button>
                    <button type="button" onClick={() => setShowAddContact(false)} style={styles.formCancelButton}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}

              {/* Search contacts bar */}
              <div style={styles.searchWrapper}>
                <Search size={16} style={styles.searchIcon} />
                <input
                  type="text"
                  placeholder="Search contacts..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  style={styles.searchInput}
                />
              </div>

              {/* Contacts List */}
              <div style={styles.contactListContainer}>
                <h4 style={styles.sectionTitle}>Contacts</h4>
                {contactsLoading ? (
                  <div style={styles.skeletonContainer}>
                    {[1, 2, 3].map(n => (
                      <div key={n} style={styles.skeletonItem} className="skeleton-shimmer" />
                    ))}
                  </div>
                ) : filteredContacts.length === 0 ? (
                  <div style={styles.emptyState}>No contacts found. Add one above!</div>
                ) : (
                  filteredContacts.map(contact => (
                    <div
                      key={contact.id}
                      tabIndex={0}
                      aria-label={`Start direct chat with ${contact.display_name}`}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          handleStartDirect(contact.id);
                        }
                      }}
                      onClick={() => handleStartDirect(contact.id)}
                      style={styles.contactItem}
                      className="hover-list-item"
                    >
                      <div style={styles.avatarWrapper}>
                        <img src={contact.avatar_url} alt={contact.display_name} style={styles.avatar} />
                        <span style={{
                          ...styles.statusIndicator,
                          backgroundColor: contact.is_online ? 'var(--status-online)' : 'var(--status-offline)'
                        }} />
                      </div>
                      <div style={styles.contactMeta}>
                        <span style={styles.contactName}>{contact.display_name}</span>
                        <span style={styles.contactUsername}>@{contact.username}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {activeTab === 'group' && (
            <form onSubmit={handleCreateGroupSubmit} style={styles.tabBody}>
              {/* Group Name input */}
              <div style={styles.inputGroup}>
                <label style={styles.label}>Group Name</label>
                <input
                  type="text"
                  placeholder="e.g. Project Development"
                  value={groupName}
                  onChange={e => setGroupName(e.target.value)}
                  style={styles.input}
                  required
                />
              </div>

              {/* Contacts checklist */}
              <div style={styles.contactListContainer}>
                <label style={styles.label}>Select Group Members</label>
                <div style={styles.searchWrapper}>
                  <Search size={16} style={styles.searchIcon} />
                  <input
                    type="text"
                    placeholder="Search contacts..."
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    style={styles.searchInput}
                  />
                </div>

                <div style={styles.checklist}>
                  {filteredContacts.length === 0 ? (
                    <div style={styles.emptyState}>No contacts to select.</div>
                  ) : (
                    filteredContacts.map(contact => (
                      <div
                        key={contact.id}
                        tabIndex={0}
                        aria-label={`Toggle selection for ${contact.display_name}`}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' || e.key === ' ') {
                            e.preventDefault();
                            handleToggleMember(contact.id);
                          }
                        }}
                        onClick={() => handleToggleMember(contact.id)}
                        style={styles.checkItem}
                        className="hover-list-item"
                      >
                        <div style={styles.avatarWrapper}>
                          <img src={contact.avatar_url} alt={contact.display_name} style={styles.avatar} />
                        </div>
                        <div style={styles.contactMeta}>
                          <span style={styles.contactName}>{contact.display_name}</span>
                          <span style={styles.contactUsername}>@{contact.username}</span>
                        </div>
                        <input
                          type="checkbox"
                          checked={selectedMembers.includes(contact.id)}
                          onChange={() => {}} // toggled by row click
                          style={styles.checkbox}
                        />
                      </div>
                    ))
                  )}
                </div>
              </div>

              <button type="submit" style={styles.submitButton}>
                Create Group Chat
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

const styles = {
  overlay: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    backdropFilter: 'blur(3px)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000
  },
  modal: {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    width: '100%',
    maxWidth: '480px',
    maxHeight: '85vh',
    display: 'flex',
    flexDirection: 'column',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '20px 24px',
    borderBottom: '1px solid var(--border)'
  },
  title: {
    fontSize: '18px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading)'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: 'var(--radius-full)',
    transition: 'background-color var(--transition-fast)'
  },
  tabContainer: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--bg-app)'
  },
  tab: {
    flex: 1,
    padding: '12px',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    borderBottom: '2px solid transparent',
    transition: 'all var(--transition-fast)'
  },
  activeTab: {
    color: 'var(--primary)',
    borderBottomColor: 'var(--primary)',
    backgroundColor: 'var(--surface)'
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '24px'
  },
  tabBody: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px',
    height: '100%'
  },
  addContactToggle: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    padding: '10px',
    backgroundColor: 'var(--primary-light)',
    border: '1px dashed var(--primary)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--primary)',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)'
  },
  addContactForm: {
    display: 'flex',
    flexDirection: 'column',
    gap: '10px',
    padding: '12px',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    backgroundColor: 'var(--bg-app)'
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    outline: 'none'
  },
  formButtonGroup: {
    display: 'flex',
    gap: '10px',
    justifyContent: 'flex-end'
  },
  formSubmitButton: {
    padding: '6px 14px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer'
  },
  formCancelButton: {
    padding: '6px 14px',
    backgroundColor: 'transparent',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer'
  },
  searchWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  searchIcon: {
    position: 'absolute',
    left: '12px',
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
    outline: 'none'
  },
  contactListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
    flex: 1
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: '0.5px'
  },
  contactItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)'
  },
  avatarWrapper: {
    position: 'relative',
    height: '40px',
    width: '40px'
  },
  avatar: {
    height: '40px',
    width: '40px',
    borderRadius: 'var(--radius-full)',
    objectFit: 'cover'
  },
  statusIndicator: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    height: '10px',
    width: '10px',
    borderRadius: 'var(--radius-full)',
    border: '2px solid var(--surface)'
  },
  contactMeta: {
    display: 'flex',
    flexDirection: 'column'
  },
  contactName: {
    fontSize: '14px',
    fontWeight: '600'
  },
  contactUsername: {
    fontSize: '12px',
    color: 'var(--text-muted)'
  },
  emptyState: {
    textAlign: 'center',
    padding: '20px',
    color: 'var(--text-muted)',
    fontSize: '13px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-secondary)'
  },
  checklist: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    maxHeight: '260px',
    overflowY: 'auto',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '8px'
  },
  checkItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 12px',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)'
  },
  checkbox: {
    marginLeft: 'auto',
    height: '16px',
    width: '16px',
    cursor: 'pointer'
  },
  submitButton: {
    marginTop: '10px',
    padding: '12px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontWeight: '600',
    fontSize: '15px',
    cursor: 'pointer',
    transition: 'background-color var(--transition-fast)'
  },
  skeletonContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px',
    padding: '8px 0'
  },
  skeletonItem: {
    height: '48px',
    backgroundColor: 'var(--border)',
    borderRadius: 'var(--radius-md)',
    opacity: 0.5
  }
};
