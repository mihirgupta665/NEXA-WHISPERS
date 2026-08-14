import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { toast } from 'react-toastify';
import { User, Lock, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!username || !password) {
      return toast.error('All fields are required.');
    }

    setSubmitting(true);
    try {
      const res = await login(username, password);
      if (res.success) {
        toast.success('Credentials verified. Proceeding to OTP verification.');
        navigate('/otp', { state: { phone: res.data.phone } });
      } else {
        toast.error(res.error || 'Invalid credentials.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Login failed. Check your credentials.';
      toast.error(errMsg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div style={styles.container} className="page-transition">
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo}>N</div>
          <h2 style={styles.title}>Sign in to Nexa Whispers</h2>
          <p style={styles.subtitle}>Enter your credentials to access your secure conversations</p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Username or Phone Number</label>
            <div style={styles.inputWrapper}>
              <User size={18} style={styles.icon} />
              <input
                type="text"
                placeholder="e.g. mihir or +919999999999"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                style={styles.input}
                required
              />
            </div>
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Password</label>
            <div style={styles.inputWrapper}>
              <Lock size={18} style={styles.icon} />
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={styles.input}
                required
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                style={styles.eyeButton}
              >
                {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
              </button>
            </div>
          </div>

          <button type="submit" disabled={submitting} style={styles.submitButton}>
            {submitting ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Loader2 size={16} className="spinner" />
                Verifying...
              </span>
            ) : 'Continue to OTP'}
          </button>

          <span style={styles.helpText}>
            Mock OTP for development: <strong>123456</strong>
          </span>
        </form>

        <div style={styles.footer}>
          <span>Don't have an account? <Link to="/register" style={styles.link}>Sign Up</Link></span>
          <br />
          <span style={styles.demoCredentials}>
            Demo Login: <strong>mihir</strong> / <strong>password123</strong>
          </span>
        </div>
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
    maxWidth: '440px',
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
  logo: {
    height: '48px',
    width: '48px',
    borderRadius: '12px',
    backgroundColor: 'var(--primary)',
    color: 'white',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: '800',
    fontFamily: 'var(--font-heading)',
    fontSize: '24px'
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
  inputWrapper: {
    position: 'relative',
    display: 'flex',
    alignItems: 'center'
  },
  icon: {
    position: 'absolute',
    left: '14px',
    color: 'var(--text-muted)'
  },
  input: {
    width: '100%',
    padding: '12px 14px 12px 42px',
    backgroundColor: 'var(--bg-app)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--radius-md)',
    color: 'var(--text-primary)',
    fontFamily: 'var(--font-sans)',
    fontSize: '14px',
    outline: 'none',
    transition: 'border-color var(--transition-fast)'
  },
  eyeButton: {
    position: 'absolute',
    right: '14px',
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center'
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
  secondaryButton: {
    padding: '12px',
    backgroundColor: 'transparent',
    color: 'var(--primary)',
    border: '1px solid var(--primary)',
    borderRadius: 'var(--radius-md)',
    fontWeight: '600',
    fontSize: '15px',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)'
  },
  helpText: {
    textAlign: 'center',
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '-6px'
  },
  footer: {
    textAlign: 'center',
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.8'
  },
  link: {
    textDecoration: 'none',
    color: 'var(--primary)',
    fontWeight: '600'
  },
  demoCredentials: {
    fontSize: '12px',
    color: 'var(--text-muted)'
  }
};
