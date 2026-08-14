import React, { useState, useEffect } from 'react';

const STATUS_MESSAGES = [
  "Securing connection...",
  "Authenticating session...",
  "Decrypting keys...",
  "Syncing channels...",
  "Launching Nexa Whispers..."
];

export default function LoadingScreen() {
  const [statusIndex, setStatusIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIndex((prev) => (prev + 1) % STATUS_MESSAGES.length);
    }, 900);

    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      width: '100vw',
      height: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: 'var(--bg-app)',
      zIndex: 9999,
      overflow: 'hidden'
    }}>
      {/* Background Animated Blobs */}
      <div className="loading-bg-container">
        <div className="loading-blob loading-blob-1" />
        <div className="loading-blob loading-blob-2" />
        <div className="loading-blob loading-blob-3" />
      </div>

      {/* Main Glassmorphic Card Container */}
      <div className="loading-glass-card">
        {/* Animated Custom SVG Logo */}
        <div style={{ position: 'relative', width: '120px', height: '120px', marginBottom: '24px' }}>
          <svg
            width="120"
            height="120"
            viewBox="0 0 120 120"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            style={{ overflow: 'visible' }}
          >
            {/* Ripple circles radiating outward */}
            <circle cx="60" cy="60" r="35" stroke="var(--primary)" strokeWidth="1.5" opacity="0.3" className="logo-ripple-circle" />
            <circle cx="60" cy="60" r="45" stroke="url(#rippleGradient)" strokeWidth="1" opacity="0.2" className="logo-ripple-circle" />
            
            {/* Outer dotted decorative ring */}
            <circle
              cx="60"
              cy="60"
              r="52"
              stroke="var(--text-muted)"
              strokeWidth="1.5"
              strokeDasharray="4 8"
              opacity="0.25"
              className="logo-spin-ring"
            />

            {/* Orbiting indicator dot */}
            <g className="logo-orbit-dot">
              <circle cx="112" cy="60" r="4.5" fill="var(--primary)" style={{ filter: 'drop-shadow(0 0 4px var(--primary))' }} />
            </g>

            {/* Base definitions */}
            <defs>
              <linearGradient id="rippleGradient" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="#8b5cf6" />
              </linearGradient>
              <linearGradient id="logoBgGrad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="var(--primary)" />
                <stop offset="100%" stopColor="#4f46e5" />
              </linearGradient>
              <filter id="logoGlow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="6" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>

            {/* Glowing Logo Base Shape (Shield/Speech Bubble shape) */}
            <path
              d="M36 40C36 33.3726 41.3726 28 48 28H72C78.6274 28 84 33.3726 84 40V68C84 74.6274 78.6274 80 72 80H52.5L39.3 89.9C37.8485 90.9886 36 89.9535 36 88.1333V80C36 80 36 80 36 80C36 80 36 80 36 80V40Z"
              fill="url(#logoBgGrad)"
              style={{ filter: 'drop-shadow(0 8px 16px var(--primary-glow))' }}
            />

            {/* Stylized letter 'N' in the center */}
            <path
              d="M48.5 68V42H54.5L65.5 58V42H70.5V68H64.5L53.5 52V68H48.5Z"
              fill="white"
              style={{ filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.15))' }}
            />
          </svg>
        </div>

        {/* Brand Name with modern design */}
        <span className="shimmer-text">Nexa Whispers</span>

        {/* Minimalist Linear Progress Bar */}
        <div className="loading-progress-container">
          <div className="loading-progress-bar" />
        </div>

        {/* Dynamic status text description */}
        <div className="loading-status-text" key={statusIndex}>
          {STATUS_MESSAGES[statusIndex]}
        </div>
      </div>
    </div>
  );
}
