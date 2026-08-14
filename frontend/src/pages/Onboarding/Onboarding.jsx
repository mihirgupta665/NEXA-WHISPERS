import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { toast } from 'react-toastify';
import { UserCheck, Sparkles, Loader2 } from 'lucide-react';

export default function Onboarding() {
  const { user, updateProfile } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState(user?.display_name || '');
  const [username, setUsername] = useState(user?.username || '');
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || '');
  const [submitting, setSubmitting] = useState(false);

  // Generate a random avatar seed based on username
  const handleRandomAvatar = () => {
    const seed = username.trim() || 'default';
    const rand = Math.round(Math.random() * 100);
    setAvatarUrl(`https://api.dicebear.com/7.x/adventurer/svg?seed=${encodeURIComponent(seed)}-${rand}`);
    toast.success('Generated random avatar suggestion!');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!displayName || !username) {
      return toast.error('Display Name and Username are required.');
    }

    setSubmitting(true);
    try {
      const res = await updateProfile({
        display_name: displayName,
        username,
        avatar_url: avatarUrl
      });
      if (res.success) {
        toast.success('Profile configuration finalized!');
        navigate('/chat');
      } else {
        toast.error(res.error || 'Failed to update profile.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Profile update failed.';
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container} className="page-transition">
      <div style={styles.card}>
        <div style={styles.header}>
          <UserCheck size={48} color="var(--primary)" />
          <h2 style={styles.title}>Configure your profile</h2>
          <p style={styles.subtitle}>Set up your visual identity on Nexa Whispers</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.avatarSection}>
            <img
              src={avatarUrl || 'https://api.dicebear.com/7.x/adventurer/svg?seed=placeholder'}
              alt="Avatar Preview"
              style={styles.avatarPreview}
            />
            <button
              type="button"
              onClick={handleRandomAvatar}
              style={styles.randomAvatarButton}
            >
              <Sparkles size={16} />
              <span>Random Avatar</span>
            </button>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Display Name</label>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Your display name"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Your username"
              style={styles.input}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Avatar Image URL</label>
            <input
              type="url"
              value={avatarUrl}
              onChange={(e) => setAvatarUrl(e.target.value)}
              placeholder="https://example.com/avatar.png"
              style={styles.input}
            />
          </div>

          <button type="submit" disabled={submitting} style={styles.submitButton}>
            {submitting ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Loader2 size={16} className="spinner" />
                Saving Profile...
              </span>
            ) : 'Complete Profile Setup'}
          </button>
        </form>
      </div>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    width: '100vw',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--bg-app)',
    padding: '20px'
  },
  card: {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-lg)',
    padding: '40px',
    width: '100%',
    maxWidth: '460px',
    boxShadow: 'var(--shadow-lg)',
    display: 'flex',
    flexDirection: 'column',
    gap: '30px'
  },
  header: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    textAlign: 'center',
    gap: '12px'
  },
  title: {
    fontFamily: 'var(--font-heading)',
    fontSize: '24px',
    fontWeight: '700'
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)'
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: '20px'
  },
  avatarSection: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    marginBottom: '10px'
  },
  avatarPreview: {
    height: '96px',
    width: '96px',
    borderRadius: 'var(--radius-full)',
    border: '2px solid var(--primary)',
    backgroundColor: 'var(--bg-app)',
    objectFit: 'cover'
  },
  randomAvatarButton: {
    background: 'none',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-sm)',
    padding: '6px 12px',
    color: 'var(--text-secondary)',
    fontSize: '13px',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    transition: 'background-color var(--transition-fast)'
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
    padding: '12px 14px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color var(--transition-fast)'
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
  }
};
