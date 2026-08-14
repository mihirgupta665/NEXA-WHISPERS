import React from 'react';
import { Link } from 'react-router-dom';
import { Shield, MessageSquare, Key, Users } from 'lucide-react';

export default function Landing() {
  return (
    <div style={styles.container} className="page-transition">
      <header style={styles.header}>
        <div style={styles.logoContainer}>
          <div style={styles.logoIcon}>N</div>
          <span style={styles.logoText}>Nexa Whispers</span>
        </div>
        <div style={styles.headerButtons}>
          <Link to="/login" style={styles.linkButton}>Sign In</Link>
          <Link to="/register" style={styles.primaryButton}>Get Started</Link>
        </div>
      </header>

      <main style={styles.main}>
        <section style={styles.heroSection}>
          <h1 style={styles.title}>Private conversations.<br />Seamlessly connected.</h1>
          <p style={styles.subtitle}>
            Nexa Whispers is a premium, Signal-inspired communication platform built for private messaging. 
            Enjoy encrypted discussions, group coordination, and instant updates.
          </p>
          <div style={styles.ctaGroup}>
            <Link to="/register" style={styles.largePrimaryButton}>Create Secure Account</Link>
            <span style={styles.disclaimer}>* Development version features simulated end-to-end security validations.</span>
          </div>
        </section>

        <section style={styles.featuresSection}>
          <div style={styles.featureCard}>
            <Shield size={32} color="var(--primary)" style={styles.featureIcon} />
            <h3 style={styles.featureTitle}>Simulated E2E Security</h3>
            <p style={styles.featureDescription}>State-of-the-art authentication lifecycle designed to prevent token spoofing or interception.</p>
          </div>
          <div style={styles.featureCard}>
            <MessageSquare size={32} color="var(--primary)" style={styles.featureIcon} />
            <h3 style={styles.featureTitle}>Real-Time Flow</h3>
            <p style={styles.featureDescription}>Instant message delivery, typing states, and receipt synchronization powered by Socket.IO.</p>
          </div>
          <div style={styles.featureCard}>
            <Users size={32} color="var(--primary)" style={styles.featureIcon} />
            <h3 style={styles.featureTitle}>Flexible Group Coordination</h3>
            <p style={styles.featureDescription}>Create conversation circles, delegate group admins, and coordinate team discussions seamlessly.</p>
          </div>
        </section>
      </main>

      <footer style={styles.footer}>
        <span>&copy; {new Date().getFullYear()} Nexa Whispers. All rights reserved. Private demo build.</span>
      </footer>
    </div>
  );
}

const styles = {
  container: {
    display: 'flex',
    flexDirection: 'column',
    height: '100vh',
    width: '100vw',
    overflowY: 'auto',
    backgroundColor: 'var(--bg-app)',
    color: 'var(--text-primary)',
    transition: 'background-color var(--transition-normal)'
  },
  header: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '24px 8%',
    borderBottom: '1px solid var(--border)',
    backgroundColor: 'var(--surface)',
    zIndex: 10
  },
  logoContainer: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px'
  },
  logoIcon: {
    height: '36px',
    width: '36px',
    borderRadius: '10px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontFamily: 'var(--font-heading)',
    fontSize: '20px'
  },
  logoText: {
    fontFamily: 'var(--font-heading)',
    fontSize: '20px',
    fontWeight: '700',
    letterSpacing: '-0.5px'
  },
  headerButtons: {
    display: 'flex',
    alignItems: 'center',
    gap: '20px'
  },
  linkButton: {
    textDecoration: 'none',
    color: 'var(--text-secondary)',
    fontWeight: '600',
    fontSize: '15px',
    transition: 'color var(--transition-fast)'
  },
  primaryButton: {
    textDecoration: 'none',
    padding: '8px 18px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    borderRadius: 'var(--radius-sm)',
    fontWeight: '600',
    fontSize: '15px',
    transition: 'background-color var(--transition-fast)'
  },
  main: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '40px 8%',
    gap: '60px'
  },
  heroSection: {
    textAlign: 'center',
    maxWidth: '800px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '24px',
    marginTop: '20px'
  },
  title: {
    fontSize: '48px',
    lineHeight: '1.15',
    fontWeight: '800',
    fontFamily: 'var(--font-heading)',
    letterSpacing: '-1.5px'
  },
  subtitle: {
    fontSize: '17px',
    color: 'var(--text-secondary)',
    lineHeight: '1.6',
    maxWidth: '640px'
  },
  ctaGroup: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '12px',
    marginTop: '10px'
  },
  largePrimaryButton: {
    textDecoration: 'none',
    padding: '14px 32px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    borderRadius: 'var(--radius-md)',
    fontWeight: '600',
    fontSize: '17px',
    boxShadow: 'var(--shadow-md)',
    transition: 'background-color var(--transition-fast)'
  },
  disclaimer: {
    fontSize: '12px',
    color: 'var(--text-muted)'
  },
  featuresSection: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
    gap: '30px',
    width: '100%',
    maxWidth: '1100px',
    marginTop: '20px'
  },
  featureCard: {
    backgroundColor: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    padding: '30px',
    display: 'flex',
    flexDirection: 'column',
    gap: '14px',
    boxShadow: 'var(--shadow-sm)'
  },
  featureIcon: {
    marginBottom: '6px'
  },
  featureTitle: {
    fontFamily: 'var(--font-heading)',
    fontSize: '18px',
    fontWeight: '700'
  },
  featureDescription: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5'
  },
  footer: {
    textAlign: 'center',
    padding: '24px',
    fontSize: '13px',
    color: 'var(--text-muted)',
    borderTop: '1px solid var(--border)',
    backgroundColor: 'var(--surface)'
  }
};
