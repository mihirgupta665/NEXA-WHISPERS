import React, { useEffect, useState } from 'react';
import { useConversations } from '../../context/ConversationContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';
import { toast } from 'react-toastify';
import { X, ShieldAlert, UserMinus, UserCheck, AlertTriangle, Trash2, UserPlus, Compass, MessageSquare, Phone, Info, Search } from 'lucide-react';

export default function DetailsSidebar({ onClose }) {
  const { user: currentUser } = useAuth();
  const { activeConversation, conversations, selectConversation, contacts } = useConversations();

  const [profileData, setProfileData] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);
  const [isBlocked, setIsBlocked] = useState(false);

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
  
  // Reporting state
  const [showReportForm, setShowReportForm] = useState(false);
  const [reportReason, setReportReason] = useState('');
  const [submittingReport, setSubmittingReport] = useState(false);

  // Group member adding state
  const [memberSearchQuery, setMemberSearchQuery] = useState('');
  const [showAddMemberSection, setShowAddMemberSection] = useState(false);
  const [addingMemberId, setAddingMemberId] = useState(null);

  // Determine other participant for direct chats
  const otherMember = activeConversation?.type === 'direct'
    ? activeConversation.members.find(m => m.id !== currentUser.id) || activeConversation.members[0]
    : null;

  // Fetch target user's details (about, mutual groups, block status) if direct conversation
  const fetchOtherUserProfile = async () => {
    if (!otherMember) return;
    setLoadingProfile(true);
    try {
      const res = await api.get(`/api/users/profile/${otherMember.id}`);
      if (res.data.success) {
        setProfileData(res.data.data);
        setIsBlocked(res.data.data.isBlocked);
      }
    } catch (err) {
      console.error('[DetailsSidebar] Failed to load profile:', err);
      toast.error('Failed to load user profile details.');
    } finally {
      setLoadingProfile(false);
    }
  };

  useEffect(() => {
    fetchOtherUserProfile();
    setShowReportForm(false);
    setReportReason('');
    setShowAddMemberSection(false);
    setMemberSearchQuery('');
  }, [activeConversation?.id]);

  if (!activeConversation) return null;

  const handleBlockToggle = async () => {
    try {
      if (isBlocked) {
        const res = await api.post('/api/users/unblock', { blocked_id: otherMember.id });
        if (res.data.success) {
          setIsBlocked(false);
          toast.success(`Unblocked ${otherMember.display_name}.`);
        }
      } else {
        const res = await api.post('/api/users/block', { blocked_id: otherMember.id });
        if (res.data.success) {
          setIsBlocked(true);
          toast.success(`Blocked ${otherMember.display_name}.`);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to update block status.');
    }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportReason.trim()) return;

    setSubmittingReport(true);
    try {
      const res = await api.post('/api/users/report', {
        reported_id: otherMember.id,
        reason: reportReason.trim()
      });
      if (res.data.success) {
        toast.success(`Report submitted for ${otherMember.display_name} (Simulation).`);
        setShowReportForm(false);
        setReportReason('');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to submit report.');
    } finally {
      setSubmittingReport(false);
    }
  };

  const handleSwitchToConversation = async (mutualGroup) => {
    const matched = conversations.find(c => c.id === mutualGroup.id);
    if (matched) {
      selectConversation(matched);
    } else {
      try {
        const res = await api.get(`/api/conversations/${mutualGroup.id}`);
        if (res.data.success) {
          selectConversation(res.data.data);
        }
      } catch (err) {
        toast.error('Failed to open group.');
      }
    }
  };

  // Group member controls (for admins)
  const isCurrentUserAdmin = activeConversation.type === 'group' && 
    activeConversation.members.find(m => m.id === currentUser.id)?.role === 'admin';

  const handleRemoveMember = async (memberId) => {
    const memberName = activeConversation.members.find(m => m.id === memberId)?.display_name || 'Member';
    if (!window.confirm(`Are you sure you want to remove ${memberName} from this group?`)) return;

    try {
      const res = await api.delete(`/api/conversations/${activeConversation.id}/members/${memberId}`);
      if (res.data.success) {
        toast.success(`Removed ${memberName} from group.`);
        // Refresh local details immediately
        const updateRes = await api.get(`/api/conversations/${activeConversation.id}`);
        if (updateRes.data.success) {
          selectConversation(updateRes.data.data);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove member.');
    }
  };

  const handleAddMember = async (contactId) => {
    setAddingMemberId(contactId);
    try {
      const res = await api.post(`/api/conversations/${activeConversation.id}/members`, {
        targetUserId: contactId
      });
      if (res.data.success) {
        toast.success('Member added successfully.');
        setShowAddMemberSection(false);
        setMemberSearchQuery('');
        // Refresh local details immediately
        const updateRes = await api.get(`/api/conversations/${activeConversation.id}`);
        if (updateRes.data.success) {
          selectConversation(updateRes.data.data);
        }
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add member.');
    } finally {
      setAddingMemberId(null);
    }
  };

  // Filter contacts to show only those who are NOT already in the group
  const nonGroupContacts = contacts.filter(c => 
    !activeConversation.members.some(m => m.id === c.id) &&
    (c.display_name.toLowerCase().includes(memberSearchQuery.toLowerCase()) ||
     c.username.toLowerCase().includes(memberSearchQuery.toLowerCase()))
  );

  return (
    <div style={styles.sidebar} className="anim-scale-up">
      {/* Sidebar Header */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>
          {activeConversation.type === 'group' ? 'Group Details' : 'Contact Info'}
        </span>
        <button onClick={onClose} style={styles.closeButton} title="Close info sidebar" aria-label="Close info sidebar">
          <X size={20} />
        </button>
      </div>

      <div style={styles.scrollContent}>
        {/* Profile Card Hero */}
        <div style={styles.profileHero}>
          <img
            src={activeConversation.type === 'group' ? activeConversation.avatar_url : (otherMember?.avatar_url || '')}
            alt="Profile Avatar"
            style={styles.largeAvatar}
          />
          <h3 style={styles.profileName}>
            {activeConversation.type === 'group' ? activeConversation.name : (otherMember?.display_name || '')}
          </h3>
          <span style={styles.profileStatus}>
            {activeConversation.type === 'group'
              ? `${activeConversation.members.length} members`
              : (otherMember?.is_online === 1 ? 'Online' : formatLastSeen(otherMember?.last_seen || profileData?.user?.last_seen))}
          </span>
        </div>

        {/* Direct Conversation Details */}
        {activeConversation.type === 'direct' && (
          <div style={styles.sectionContainer}>
            {loadingProfile ? (
              <div style={styles.loaderContainer}>
                <div className="skeleton-shimmer" style={{ height: '16px', width: '80%', marginBottom: '8px', borderRadius: '4px' }} />
                <div className="skeleton-shimmer" style={{ height: '16px', width: '60%', borderRadius: '4px' }} />
              </div>
            ) : (
              <>
                {/* About & Phone Section */}
                <div style={styles.infoBox}>
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>About</span>
                    <span style={styles.infoValue}>{profileData?.user?.about || 'Hey there! I am using Nexa Whispers.'}</span>
                  </div>
                  <div style={styles.divider} />
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Phone Number</span>
                    <span style={styles.infoValue}>{profileData?.user?.phone || 'No phone number provided'}</span>
                  </div>
                  <div style={styles.divider} />
                  <div style={styles.infoRow}>
                    <span style={styles.infoLabel}>Username</span>
                    <span style={styles.infoValue}>@{profileData?.user?.username || 'user'}</span>
                  </div>
                </div>

                {/* Mutual Groups */}
                <div style={styles.sectionTitle}>Groups in Common ({profileData?.mutualGroups?.length || 0})</div>
                {profileData?.mutualGroups && profileData.mutualGroups.length > 0 ? (
                  <div style={styles.mutualGroupsContainer}>
                    {profileData.mutualGroups.map(group => (
                      <button
                        key={group.id}
                        onClick={() => handleSwitchToConversation(group)}
                        style={styles.mutualGroupItem}
                        className="hover-list-item"
                      >
                        <img src={group.avatar_url} alt={group.name} style={styles.mutualGroupAvatar} />
                        <span style={styles.mutualGroupName}>{group.name}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div style={styles.emptyLabel}>No mutual groups found.</div>
                )}

                {/* Actions Block */}
                <div style={{ marginTop: '24px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <button
                    onClick={handleBlockToggle}
                    style={{
                      ...styles.actionButton,
                      backgroundColor: isBlocked ? 'var(--primary-light)' : '#fee2e2',
                      color: isBlocked ? 'var(--primary)' : '#dc2626',
                      border: isBlocked ? '1px solid var(--primary)' : '1px solid #fca5a5'
                    }}
                  >
                    {isBlocked ? <UserCheck size={16} /> : <UserMinus size={16} />}
                    <span>{isBlocked ? 'Unblock Contact' : 'Block Contact'}</span>
                  </button>

                  {!showReportForm ? (
                    <button
                      onClick={() => setShowReportForm(true)}
                      style={{
                        ...styles.actionButton,
                        backgroundColor: 'var(--bg-app)',
                        color: 'var(--text-secondary)',
                        border: '1px solid var(--border)'
                      }}
                    >
                      <AlertTriangle size={16} />
                      <span>Report Abuse</span>
                    </button>
                  ) : (
                    <form onSubmit={handleReportSubmit} style={styles.reportForm} className="anim-fade-in">
                      <label style={styles.reportLabel}>Reason for report:</label>
                      <textarea
                        value={reportReason}
                        onChange={e => setReportReason(e.target.value)}
                        placeholder="Provide details about the report..."
                        style={styles.reportTextarea}
                        required
                        rows={3}
                      />
                      <div style={styles.reportButtons}>
                        <button
                          type="submit"
                          disabled={submittingReport || !reportReason.trim()}
                          style={styles.reportSubmitBtn}
                        >
                          {submittingReport ? 'Submitting...' : 'Submit'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setShowReportForm(false);
                            setReportReason('');
                          }}
                          style={styles.reportCancelBtn}
                        >
                          Cancel
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Group Conversation Details */}
        {activeConversation.type === 'group' && (
          <div style={styles.sectionContainer}>
            <div style={styles.groupMetaInfo}>
              <Info size={16} color="var(--text-muted)" style={{ flexShrink: 0 }} />
              <span>Created by group admin. Admin privileges allow adding or removing members.</span>
            </div>

            {/* Admin add members panel */}
            {isCurrentUserAdmin && (
              <div style={{ marginBottom: '16px' }}>
                {!showAddMemberSection ? (
                  <button
                    onClick={() => setShowAddMemberSection(true)}
                    style={styles.addMemberTriggerBtn}
                  >
                    <UserPlus size={16} />
                    <span>Add New Member</span>
                  </button>
                ) : (
                  <div style={styles.addMemberBox} className="anim-fade-in">
                    <div style={styles.addMemberHeader}>
                      <span>Select Contact</span>
                      <button onClick={() => setShowAddMemberSection(false)} style={styles.iconOnlyBtn}>
                        <X size={16} />
                      </button>
                    </div>
                    <div style={styles.searchWrapper}>
                      <Search size={14} color="var(--text-muted)" style={{ marginLeft: '8px' }} />
                      <input
                        type="text"
                        placeholder="Search contacts..."
                        value={memberSearchQuery}
                        onChange={e => setMemberSearchQuery(e.target.value)}
                        style={styles.searchInput}
                      />
                    </div>
                    <div style={styles.contactsListScroll}>
                      {nonGroupContacts.length > 0 ? (
                        nonGroupContacts.map(contact => (
                          <div key={contact.id} style={styles.contactPickerRow}>
                            <img src={contact.avatar_url} alt={contact.display_name} style={styles.smallAvatarIcon} />
                            <div style={{ flex: 1, minWidth: 0, paddingLeft: '8px' }}>
                              <div style={styles.contactNameText}>{contact.display_name}</div>
                              <div style={styles.contactUsernameText}>@{contact.username}</div>
                            </div>
                            <button
                              disabled={addingMemberId === contact.id}
                              onClick={() => handleAddMember(contact.id)}
                              style={styles.addActionButton}
                              title="Add to group"
                            >
                              {addingMemberId === contact.id ? '...' : '+'}
                            </button>
                          </div>
                        ))
                      ) : (
                        <div style={styles.noContactsText}>No eligible contacts found</div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Group Members List */}
            <div style={styles.sectionTitle}>Group Members ({activeConversation.members.length})</div>
            <div style={styles.membersListContainer}>
              {activeConversation.members.map(member => (
                <div key={member.id} style={styles.memberItemRow}>
                  <img src={member.avatar_url} alt={member.display_name} style={styles.memberAvatarIcon} />
                  <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <span style={styles.memberDisplayName}>{member.display_name}</span>
                      {member.role === 'admin' && (
                        <span style={styles.adminRoleBadge}>Admin</span>
                      )}
                    </div>
                    <span style={styles.memberSubText}>
                      {member.phone} • @{member.username}
                    </span>
                  </div>
                  
                  {/* Remove control visible to admins to remove members (excludes removing self) */}
                  {isCurrentUserAdmin && member.id !== currentUser.id && (
                    <button
                      onClick={() => handleRemoveMember(member.id)}
                      style={styles.removeMemberBtn}
                      title="Remove from group"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = {
  sidebar: {
    width: '320px',
    height: '100%',
    backgroundColor: 'var(--bg-sidebar)',
    borderLeft: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    flexShrink: 0,
    zIndex: 10,
    overflow: 'hidden'
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid var(--border)',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: 'var(--bg-sidebar)'
  },
  headerTitle: {
    fontSize: '16px',
    fontWeight: '700',
    fontFamily: 'var(--font-heading)',
    color: 'var(--text-primary)'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: 'var(--radius-full)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background var(--transition-fast)'
  },
  scrollContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '20px 16px'
  },
  profileHero: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    marginBottom: '24px'
  },
  largeAvatar: {
    width: '90px',
    height: '90px',
    borderRadius: 'var(--radius-full)',
    objectFit: 'cover',
    border: '3px solid var(--primary-light)',
    marginBottom: '12px',
    boxShadow: 'var(--shadow-md)'
  },
  profileName: {
    fontSize: '18px',
    fontWeight: '700',
    color: 'var(--text-primary)',
    marginBottom: '4px'
  },
  profileStatus: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontWeight: '500'
  },
  sectionContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '16px'
  },
  loaderContainer: {
    padding: '12px',
    display: 'flex',
    flexDirection: 'column'
  },
  infoBox: {
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px 14px',
    display: 'flex',
    flexDirection: 'column',
    gap: '10px'
  },
  infoRow: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px'
  },
  infoLabel: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: '0.05em'
  },
  infoValue: {
    fontSize: '14px',
    color: 'var(--text-primary)',
    wordBreak: 'break-word',
    fontWeight: '500'
  },
  divider: {
    height: '1px',
    backgroundColor: 'var(--border)'
  },
  sectionTitle: {
    fontSize: '13px',
    fontWeight: '700',
    textTransform: 'uppercase',
    color: 'var(--text-muted)',
    letterSpacing: '0.05em',
    marginBottom: '4px',
    marginTop: '10px'
  },
  emptyLabel: {
    fontSize: '13px',
    color: 'var(--text-muted)',
    fontStyle: 'italic',
    paddingLeft: '4px'
  },
  mutualGroupsContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  mutualGroupItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 10px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    cursor: 'pointer',
    width: '100%',
    textAlign: 'left',
    transition: 'all var(--transition-fast)'
  },
  mutualGroupAvatar: {
    width: '32px',
    height: '32px',
    borderRadius: 'var(--radius-full)',
    objectFit: 'cover'
  },
  mutualGroupName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  actionButton: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    width: '100%',
    padding: '10px 14px',
    borderRadius: 'var(--radius-md)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'opacity var(--transition-fast)'
  },
  reportForm: {
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px',
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  reportLabel: {
    fontSize: '12px',
    fontWeight: '600',
    color: 'var(--text-secondary)'
  },
  reportTextarea: {
    width: '100%',
    padding: '8px 10px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    resize: 'none',
    outline: 'none'
  },
  reportButtons: {
    display: 'flex',
    gap: '8px'
  },
  reportSubmitBtn: {
    flex: 1,
    padding: '6px 12px',
    backgroundColor: '#dc2626',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  reportCancelBtn: {
    padding: '6px 12px',
    backgroundColor: 'transparent',
    color: 'var(--text-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    fontSize: '12px',
    fontWeight: '600',
    cursor: 'pointer'
  },
  groupMetaInfo: {
    backgroundColor: 'var(--primary-light)',
    border: '1px solid var(--primary-glow)',
    borderRadius: 'var(--radius-md)',
    padding: '10px 12px',
    display: 'flex',
    gap: '8px',
    fontSize: '12px',
    lineHeight: '1.4',
    color: 'var(--text-secondary)'
  },
  addMemberTriggerBtn: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    width: '100%',
    padding: '8px 12px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    transition: 'background var(--transition-fast)'
  },
  addMemberBox: {
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '12px'
  },
  addMemberHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    fontSize: '13px',
    fontWeight: '700',
    marginBottom: '8px',
    color: 'var(--text-primary)'
  },
  iconOnlyBtn: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  searchWrapper: {
    display: 'flex',
    alignItems: 'center',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '4px 6px',
    marginBottom: '8px'
  },
  searchInput: {
    flex: 1,
    border: 'none',
    background: 'none',
    outline: 'none',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '13px',
    marginLeft: '6px'
  },
  contactsListScroll: {
    maxHeight: '140px',
    overflowY: 'auto',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  contactPickerRow: {
    display: 'flex',
    alignItems: 'center',
    padding: '4px 6px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--surface)'
  },
  smallAvatarIcon: {
    width: '28px',
    height: '28px',
    borderRadius: 'var(--radius-full)',
    objectFit: 'cover'
  },
  contactNameText: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  contactUsernameText: {
    fontSize: '11px',
    color: 'var(--text-muted)'
  },
  addActionButton: {
    width: '24px',
    height: '24px',
    borderRadius: 'var(--radius-sm)',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    border: '1px solid var(--primary)',
    fontWeight: '700',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '14px'
  },
  noContactsText: {
    fontSize: '12px',
    color: 'var(--text-muted)',
    textAlign: 'center',
    padding: '8px 0',
    fontStyle: 'italic'
  },
  membersListContainer: {
    display: 'flex',
    flexDirection: 'column',
    gap: '8px'
  },
  memberItemRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '8px 10px',
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    minWidth: 0
  },
  memberAvatarIcon: {
    width: '36px',
    height: '36px',
    borderRadius: 'var(--radius-full)',
    objectFit: 'cover'
  },
  memberDisplayName: {
    fontSize: '14px',
    fontWeight: '600',
    color: 'var(--text-primary)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  adminRoleBadge: {
    fontSize: '9px',
    fontWeight: '700',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    padding: '2px 6px',
    borderRadius: 'var(--radius-full)',
    border: '1px solid var(--primary)',
    textTransform: 'uppercase'
  },
  memberSubText: {
    fontSize: '11px',
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  removeMemberBtn: {
    background: 'none',
    border: 'none',
    color: '#ef4444',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: 'var(--radius-sm)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    transition: 'background var(--transition-fast)',
    ':hover': {
      backgroundColor: '#fee2e2'
    }
  }
};
