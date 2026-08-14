import React, { useState, useEffect } from 'react';
import { X, Play, Pause, Sparkles, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import api from '../../services/api.js';

export default function StoriesModal({ isOpen, onClose }) {
  const { user } = useAuth();
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeStoryIdx, setActiveStoryIdx] = useState(null);
  const [progress, setProgress] = useState(0);
  const [isPaused, setIsPaused] = useState(false);

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

  const fetchStories = async () => {
    try {
      setLoading(true);
      const res = await api.get('/api/stories');
      if (res.data.success) {
        // Map the current logged-in user's story name to 'My Story' if it matches
        const mappedStories = res.data.data.map(s => {
          return {
            id: s.id,
            user_id: s.user_id,
            name: s.user_id === user?.id ? 'My Story' : s.name,
            avatar: s.avatar,
            gradient: s.gradient,
            text: s.content
          };
        });
        setStories(mappedStories);
      }
    } catch (err) {
      console.error('[Stories Modal] Failed to fetch active stories:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchStories();
    }
  }, [isOpen]);

  useEffect(() => {
    if (activeStoryIdx === null || isPaused) return;

    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) {
          if (activeStoryIdx < stories.length - 1) {
            setActiveStoryIdx(activeStoryIdx + 1);
            return 0;
          } else {
            setActiveStoryIdx(null);
            return 0;
          }
        }
        return prev + 1;
      });
    }, 40);

    return () => clearInterval(timer);
  }, [activeStoryIdx, isPaused]);

  useEffect(() => {
    if (activeStoryIdx !== null) {
      setProgress(0);
    }
  }, [activeStoryIdx]);

  if (!isOpen) return null;

  const handleOpenStory = (idx) => {
    setActiveStoryIdx(idx);
    setProgress(0);
    setIsPaused(false);
  };

  const handlePrevStory = (e) => {
    e.stopPropagation();
    if (activeStoryIdx > 0) {
      setActiveStoryIdx(activeStoryIdx - 1);
    }
  };

  const handleNextStory = (e) => {
    e.stopPropagation();
    if (activeStoryIdx < stories.length - 1) {
      setActiveStoryIdx(activeStoryIdx + 1);
    } else {
      setActiveStoryIdx(null);
    }
  };

  return (
    <div style={styles.overlay} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()} className="anim-scale-up">
        {activeStoryIdx === null ? (
          <div style={styles.listContainer}>
            <div style={styles.header}>
              <h3 style={styles.title}>Stories</h3>
              <button onClick={onClose} style={styles.closeButton} title="Close" aria-label="Close">
                <X size={20} />
              </button>
            </div>
            
            <p style={styles.subtitle}>Updates that disappear after 24 hours.</p>

            <div style={styles.circlesRow}>
              {loading ? (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', padding: '16px 0' }}>
                  <Loader2 size={24} className="spinner" color="var(--primary)" />
                </div>
              ) : stories.length === 0 ? (
                <div style={{ color: 'var(--text-secondary)', fontSize: '13px', fontStyle: 'italic', padding: '16px 0', width: '100%', textAlign: 'center' }}>
                  No active stories
                </div>
              ) : (
                stories.map((story, idx) => (
                  <div
                    key={story.id}
                    tabIndex={0}
                    aria-label={`View story of ${story.name}`}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleOpenStory(idx);
                      }
                    }}
                    onClick={() => handleOpenStory(idx)}
                    style={styles.storyCircleWrapper}
                  >
                    <div style={styles.avatarRing}>
                      <img src={story.avatar} alt={story.name} style={styles.circleAvatar} />
                    </div>
                    <span style={styles.circleName}>{story.name}</span>
                  </div>
                ))
              )}
            </div>

            <div style={styles.comingSoonPanel}>
              <Sparkles size={36} color="var(--primary)" />
              <h4 style={styles.comingSoonTitle}>Ephemeral Stories Pipeline Active</h4>
              <p style={styles.comingSoonText}>
                Active stories are fetched dynamically from the database and automatically expire after 24 hours. The self-healing server boots fresh stories for testing when none exist!
              </p>
              <span style={styles.badge}>Live Preview Mode</span>
            </div>
          </div>
        ) : (
          <div 
            style={{ 
              ...styles.playerContainer, 
              background: stories[activeStoryIdx].gradient 
            }}
            onClick={() => setIsPaused(!isPaused)}
          >
            <div style={styles.progressHeader}>
              <div style={styles.progressBarBg}>
                <div style={{ ...styles.progressBarFill, width: `${progress}%` }} />
              </div>
            </div>

            <div style={styles.playerHeader}>
              <div style={styles.userInfo}>
                <img src={stories[activeStoryIdx].avatar} alt="" style={styles.playerAvatar} />
                <span style={styles.playerName}>{stories[activeStoryIdx].name}</span>
              </div>
              <div style={styles.playerControls} onClick={(e) => e.stopPropagation()}>
                <button onClick={() => setIsPaused(!isPaused)} style={styles.controlButton}>
                  {isPaused ? <Play size={16} /> : <Pause size={16} />}
                </button>
                <button onClick={() => setActiveStoryIdx(null)} style={styles.controlButton}>
                  <X size={16} />
                </button>
              </div>
            </div>

            <button 
              onClick={handlePrevStory} 
              style={{ ...styles.navButton, left: '16px' }}
              disabled={activeStoryIdx === 0}
            >
              <ChevronLeft size={20} />
            </button>
            
            <button 
              onClick={handleNextStory} 
              style={{ ...styles.navButton, right: '16px' }}
            >
              <ChevronRight size={20} />
            </button>

            <div style={styles.playerContent}>
              <p style={styles.playerText}>{stories[activeStoryIdx].text}</p>
            </div>

            <div style={styles.overlayGlass} onClick={(e) => e.stopPropagation()}>
              <h4 style={styles.overlayTitle}>Simulated Stories Experience</h4>
              <p style={styles.overlayText}>
                Signal Stories are ephemeral. Real crypto-secured publication pipelines are currently simulated in this development build.
              </p>
              <span style={styles.overlayBadge}>Stories (Coming Soon)</span>
            </div>
          </div>
        )}
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
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
    backdropFilter: 'blur(4px)',
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
    maxWidth: '440px',
    height: '620px',
    boxShadow: 'var(--shadow-xl)',
    overflow: 'hidden',
    position: 'relative'
  },
  listContainer: {
    padding: '24px',
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    backgroundColor: 'var(--bg-app)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: '4px'
  },
  title: {
    fontFamily: 'var(--font-heading)',
    fontSize: '20px',
    fontWeight: '700'
  },
  subtitle: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    marginBottom: '24px'
  },
  closeButton: {
    background: 'none',
    border: 'none',
    color: 'var(--text-secondary)',
    cursor: 'pointer',
    padding: '4px',
    borderRadius: 'var(--radius-full)',
    display: 'flex'
  },
  circlesRow: {
    display: 'flex',
    gap: '16px',
    overflowX: 'auto',
    paddingBottom: '16px',
    marginBottom: '24px',
    borderBottom: '1px solid var(--border)',
    scrollbarWidth: 'none'
  },
  storyCircleWrapper: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '6px',
    cursor: 'pointer',
    flexShrink: 0
  },
  avatarRing: {
    height: '56px',
    width: '56px',
    borderRadius: 'var(--radius-full)',
    border: '2.5px solid var(--primary)',
    padding: '2px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'var(--surface)'
  },
  circleAvatar: {
    height: '100%',
    width: '100%',
    borderRadius: 'var(--radius-full)',
    objectFit: 'cover'
  },
  circleName: {
    fontSize: '12px',
    fontWeight: '600',
    maxWidth: '64px',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  },
  comingSoonPanel: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: '12px',
    backgroundColor: 'var(--surface)',
    borderRadius: 'var(--radius-lg)',
    border: '1px dashed var(--border)',
    padding: '24px'
  },
  comingSoonTitle: {
    fontSize: '16px',
    fontWeight: '700',
    marginTop: '8px'
  },
  comingSoonText: {
    fontSize: '13px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5'
  },
  badge: {
    fontSize: '11px',
    fontWeight: '700',
    color: 'var(--primary)',
    backgroundColor: 'var(--primary-light)',
    padding: '4px 10px',
    borderRadius: 'var(--radius-full)',
    marginTop: '6px'
  },
  playerContainer: {
    height: '100%',
    width: '100%',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'space-between',
    padding: '16px',
    color: 'white',
    userSelect: 'none',
    cursor: 'pointer'
  },
  progressHeader: {
    width: '100%',
    paddingTop: '4px',
    marginBottom: '12px'
  },
  progressBarBg: {
    height: '4px',
    width: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 'var(--radius-full)',
    overflow: 'hidden'
  },
  progressBarFill: {
    height: '100%',
    backgroundColor: 'white',
    transition: 'width 0.04s linear'
  },
  playerHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    zIndex: 10
  },
  userInfo: {
    display: 'flex',
    alignItems: 'center',
    gap: '10px'
  },
  playerAvatar: {
    height: '36px',
    width: '36px',
    borderRadius: 'var(--radius-full)',
    border: '1.5px solid white',
    backgroundColor: 'rgba(0,0,0,0.1)'
  },
  playerName: {
    fontWeight: '700',
    fontSize: '14px',
    textShadow: '0 1px 3px rgba(0,0,0,0.4)'
  },
  playerControls: {
    display: 'flex',
    gap: '8px'
  },
  controlButton: {
    background: 'none',
    border: 'none',
    color: 'white',
    cursor: 'pointer',
    padding: '6px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'rgba(0, 0, 0, 0.25)',
    display: 'flex',
    transition: 'background-color 0.2s ease'
  },
  navButton: {
    position: 'absolute',
    top: '40%',
    height: '36px',
    width: '36px',
    borderRadius: 'var(--radius-full)',
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    border: 'none',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    zIndex: 10,
    transition: 'background-color 0.2s ease',
    '&:disabled': {
      opacity: 0.3,
      cursor: 'not-allowed'
    }
  },
  playerContent: {
    flex: 1,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    textAlign: 'center',
    zIndex: 5
  },
  playerText: {
    fontSize: '20px',
    fontWeight: '700',
    lineHeight: '1.4',
    textShadow: '0 2px 4px rgba(0, 0, 0, 0.6)'
  },
  overlayGlass: {
    backdropFilter: 'blur(12px)',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    border: '1px solid rgba(255, 255, 255, 0.25)',
    borderRadius: 'var(--radius-md)',
    padding: '14px',
    textAlign: 'center',
    zIndex: 10,
    boxShadow: '0 4px 30px rgba(0, 0, 0, 0.1)',
    marginBottom: '8px'
  },
  overlayTitle: {
    fontSize: '13px',
    fontWeight: '700',
    color: 'white',
    marginBottom: '4px'
  },
  overlayText: {
    fontSize: '11px',
    color: 'rgba(255,255,255,0.85)',
    lineHeight: '1.4',
    marginBottom: '8px'
  },
  overlayBadge: {
    fontSize: '10px',
    fontWeight: '700',
    color: 'white',
    backgroundColor: 'var(--primary)',
    padding: '2px 8px',
    borderRadius: 'var(--radius-full)',
    display: 'inline-block'
  }
};
