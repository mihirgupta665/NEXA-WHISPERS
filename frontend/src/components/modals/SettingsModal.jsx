import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { toast } from 'react-toastify';
import { X, User, Shield, Palette, Smartphone, Phone, LogOut } from 'lucide-react';

export default function SettingsModal({ isOpen, onClose }) {
  const { user, updateProfile, logout } = useAuth();

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
  const { theme, toggleTheme } = useTheme();

  const [activeSection, setActiveSection] = useState('profile');

  // Profile Edit
  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [savingProfile, setSavingProfile] = useState(false);

  // Privacy Config (Disappearing messages default duration in seconds)
  const [disappearingDuration, setDisappearingDuration] = useState(() => {
    return parseInt(localStorage.getItem('default_disappearing_messages') || '0');
  });

  if (!isOpen) return null;

  const handleProfileSubmit = async (e) => {
    e.preventDefault();
    setSavingProfile(true);
    try {
      const res = await updateProfile({
        display_name: displayName,
        username,
        avatar_url: avatarUrl
      });
      if (res.success) {
        toast.success('Profile updated successfully!');
      }
    } catch (err) {
      toast.error(err.response?.data?.error || 'Profile update failed.');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleDisappearingChange = (e) => {
    const val = parseInt(e.target.value);
    setDisappearingDuration(val);
    localStorage.setItem('default_disappearing_messages', val.toString());
    toast.success('Default disappearing messages preference updated!');
  };

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully.');
    onClose();
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="anim-scale-up">
        {/* Settings Sidebar */}
        <div style={styles.sidebar}>
          <div style={styles.sidebarHeader}>Settings</div>
          <div style={styles.sidebarMenu}>
            <button
              onClick={() => setActiveSection('profile')}
              style={{ ...styles.menuItem, ...(activeSection === 'profile' ? styles.activeMenuItem : {}) }}
              className="hover-list-item"
            >
              <User size={18} />
              <span>Profile</span>
            </button>
            <button
              onClick={() => setActiveSection('privacy')}
              style={{ ...styles.menuItem, ...(activeSection === 'privacy' ? styles.activeMenuItem : {}) }}
              className="hover-list-item"
            >
              <Shield size={18} />
              <span>Privacy</span>
            </button>
            <button
              onClick={() => setActiveSection('appearance')}
              style={{ ...styles.menuItem, ...(activeSection === 'appearance' ? styles.activeMenuItem : {}) }}
              className="hover-list-item"
            >
              <Palette size={18} />
              <span>Appearance</span>
            </button>
            <button
              onClick={() => setActiveSection('linked')}
              style={{ ...styles.menuItem, ...(activeSection === 'linked' ? styles.activeMenuItem : {}) }}
              className="hover-list-item"
            >
              <Smartphone size={18} />
              <span>Linked Devices</span>
            </button>
            <button
              onClick={() => setActiveSection('calls')}
              style={{ ...styles.menuItem, ...(activeSection === 'calls' ? styles.activeMenuItem : {}) }}
              className="hover-list-item"
            >
              <Phone size={18} />
              <span>Calls & Video</span>
            </button>
          </div>

          <button onClick={handleLogout} style={styles.logoutButton} className="hover-logout-btn">
            <LogOut size={18} />
            <span>Logout</span>
          </button>
        </div>

        {/* Settings Body */}
        <div style={styles.body}>
          <div style={styles.bodyHeader}>
            <button onClick={onClose} style={styles.closeButton} title="Close" aria-label="Close">
              <X size={20} />
            </button>
          </div>

          <div style={styles.bodyContent}>
            {activeSection === 'profile' && (
              <form onSubmit={handleProfileSubmit} style={styles.form} className="anim-fade-in">
                <h3 style={styles.sectionTitle}>Profile Details</h3>
                
                <div style={styles.avatarContainer}>
                  <img src={avatarUrl} alt="Avatar" style={styles.avatar} />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Display Name</label>
                  <input
                    type="text"
                    value={displayName}
                    onChange={e => setDisplayName(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Username</label>
                  <input
                    type="text"
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    style={styles.input}
                    required
                  />
                </div>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Avatar Image URL</label>
                  <input
                    type="url"
                    value={avatarUrl}
                    onChange={e => setAvatarUrl(e.target.value)}
                    style={styles.input}
                  />
                </div>

                <button type="submit" disabled={savingProfile} style={styles.submitButton}>
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </form>
            )}

            {activeSection === 'privacy' && (
              <div style={styles.form} className="anim-fade-in">
                <h3 style={styles.sectionTitle}>Privacy & Disappearing Messages</h3>
                <p style={styles.description}>Configure disappearing messages. Expired messages will automatically delete from SQLite files after the timer ends.</p>

                <div style={styles.inputGroup}>
                  <label style={styles.label}>Default Disappearing Timer</label>
                  <select
                    value={disappearingDuration}
                    onChange={handleDisappearingChange}
                    style={styles.select}
                  >
                    <option value={0}>Off (Keep messages indefinitely)</option>
                    <option value={5}>5 seconds</option>
                    <option value={10}>10 seconds</option>
                    <option value={30}>30 seconds</option>
                    <option value={60}>1 minute</option>
                    <option value={3600}>1 hour</option>
                    <option value={86400}>1 day</option>
                  </select>
                </div>

                <div style={styles.simulatedSecurityBanner}>
                  <strong>Simulated E2E Security Notice</strong>
                  <p>In this development build, message encryption operations and OTP validations are mock-simulated to support local demo profiling. Real cryptography is not active.</p>
                </div>
              </div>
            )}

            {activeSection === 'appearance' && (
              <div style={styles.form} className="anim-fade-in">
                <h3 style={styles.sectionTitle}>Appearance settings</h3>
                <p style={styles.description}>Configure visual preferences.</p>

                <div style={styles.toggleRow}>
                  <span>Dark Mode Theme</span>
                  <button onClick={toggleTheme} style={styles.toggleButton}>
                    {theme === 'dark' ? 'Enabled' : 'Disabled'}
                  </button>
                </div>
              </div>
            )}

            {activeSection === 'linked' && (
              <div style={styles.comingSoonContainer} className="anim-fade-in">
                <Smartphone size={48} color="var(--text-muted)" />
                <h4>Linked Devices</h4>
                <p>Link additional desktop or mobile devices to your secure account.</p>
                <span style={styles.badge}>Coming Soon</span>
              </div>
            )}

            {activeSection === 'calls' && (
              <div style={styles.comingSoonContainer} className="anim-fade-in">
                <Phone size={48} color="var(--text-muted)" />
                <h4>Voice & Video Calls</h4>
                <p>Encrypted audio and video call functionality is currently in development stages.</p>
                <span style={styles.badge}>Coming Soon</span>
              </div>
            )}
          </div>
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
    maxWidth: '720px',
    height: '520px',
    display: 'flex',
    boxShadow: 'var(--shadow-lg)',
    overflow: 'hidden'
  },
  sidebar: {
    width: '220px',
    borderRight: '1px solid var(--border)',
    backgroundColor: 'var(--bg-app)',
    display: 'flex',
    flexDirection: 'column',
    padding: '24px 16px'
  },
  sidebarHeader: {
    fontFamily: 'var(--font-heading)',
    fontSize: '18px',
    fontWeight: '700',
    marginBottom: '24px',
    paddingLeft: '12px'
  },
  sidebarMenu: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    flex: 1
  },
  menuItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
    textAlign: 'left',
    transition: 'all var(--transition-fast)'
  },
  activeMenuItem: {
    backgroundColor: 'var(--surface)',
    color: 'var(--primary)',
    boxShadow: 'var(--shadow-sm)'
  },
  logoutButton: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '10px 12px',
    background: 'none',
    border: '1px solid transparent',
    color: '#ef4444',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
    borderRadius: 'var(--radius-md)',
    textAlign: 'left',
    marginTop: 'auto',
    transition: 'all var(--transition-fast)'
  },
  body: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    backgroundColor: 'var(--surface)'
  },
  bodyHeader: {
    display: 'flex',
    justifyContent: 'flex-end',
    padding: '16px 24px'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: 'var(--radius-full)'
  },
  bodyContent: {
    flex: 1,
    overflowY: 'auto',
    padding: '0 40px 40px 40px'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  sectionTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '20px',
    fontWeight: '700',
    marginBottom: '8px'
  },
  avatarContainer: {
    display: 'flex',
    justifyContent: 'center',
    marginBottom: '10px'
  },
  avatar: {
    height: '80px',
    width: '80px',
    borderRadius: 'var(--radius-full)',
    border: '2px solid var(--primary)',
    objectFit: 'cover'
  },
  inputGroup: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px'
  },
  label: {
    fontSize: '13px',
    fontWeight: '600',
    color: 'var(--text-secondary)'
  },
  input: {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    outline: 'none'
  },
  select: {
    width: '100%',
    padding: '10px 14px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    outline: 'none',
    cursor: 'pointer'
  },
  description: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5'
  },
  submitButton: {
    marginTop: '10px',
    padding: '10px 18px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    border: 'none',
    borderRadius: 'var(--radius-md)',
    fontWeight: '600',
    fontSize: '14px',
    cursor: 'pointer',
    alignSelf: 'flex-start',
    transition: 'background-color var(--transition-fast)'
  },
  simulatedSecurityBanner: {
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '13px',
    lineHeight: '1.5',
    color: 'var(--text-secondary)'
  },
  toggleRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '12px 0',
    borderBottom: '1px solid var(--border)',
    fontSize: '14px',
    fontWeight: '600'
  },
  toggleButton: {
    padding: '6px 14px',
    backgroundColor: 'var(--primary-light)',
    border: '1px solid var(--primary)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--primary)',
    fontWeight: '600',
    fontSize: '13px',
    cursor: 'pointer'
  },
  comingSoonContainer: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    textAlign: 'center',
    gap: '12px',
    paddingTop: '40px'
  },
  badge: {
    display: 'inline-block',
    padding: '4px 10px',
    backgroundColor: 'var(--primary-light)',
    color: 'var(--primary)',
    borderRadius: 'var(--radius-full)',
    fontSize: '12px',
    fontWeight: '600'
  }
};
