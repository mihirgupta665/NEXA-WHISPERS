import React, { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import { toast } from 'react-toastify';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function OTP() {
  const { verifyOtp } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const phoneFromState = location.state?.phone || '';
  const [phone, setPhone] = useState(phoneFromState);
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!phone) {
      return toast.error('Phone number is required.');
    }
    if (code.length !== 6) {
      return toast.error('OTP code must be 6 digits.');
    }

    setVerifying(true);
    try {
      const res = await verifyOtp(phone, code);
      if (res.success) {
        toast.success('Phone verified successfully! Signed in.');
        navigate('/chat');
      } else {
        toast.error(res.error || 'Verification failed.');
      }
    } catch (err) {
      const errMsg = err.response?.data?.error || 'Verification failed. Try again.';
      toast.error(errMsg);
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div style={styles.container} className="page-transition">
      <div style={styles.card}>
        <div style={styles.header}>
          <ShieldCheck size={48} color="var(--primary)" />
          <h2 style={styles.title}>Enter verification code</h2>
          <p style={styles.subtitle}>
            A mock verification code has been generated for your phone number.
          </p>
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <div style={styles.inputGroup}>
            <label style={styles.label}>Phone Number</label>
            <input
              type="tel"
              placeholder="+919999999999"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              style={styles.input}
              disabled={!!phoneFromState}
              required
            />
          </div>

          <div style={styles.inputGroup}>
            <label style={styles.label}>Verification Code</label>
            <input
              type="text"
              maxLength="6"
              placeholder="123456"
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              style={{ ...styles.input, ...styles.monoInput }}
              required
            />
            <span style={styles.helpText}>
              * Simulated Security: Enter dev OTP <strong>123456</strong>.
            </span>
          </div>

          <button type="submit" disabled={verifying} style={styles.submitButton}>
            {verifying ? (
              <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                <Loader2 size={16} className="spinner" />
                Verifying...
              </span>
            ) : 'Verify Phone'}
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
  title: {
    fontFamily: 'var(--font-heading)',
    fontSize: '24px',
    fontWeight: '700'
  },
  subtitle: {
    fontSize: '14px',
    color: 'var(--text-secondary)',
    lineHeight: '1.5'
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
  monoInput: {
    fontFamily: 'var(--font-mono)',
    fontSize: '20px',
    letterSpacing: '8px',
    textAlign: 'center'
  },
  helpText: {
    fontSize: '12px',
    color: 'var(--text-secondary)',
    marginTop: '4px'
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
