import { useState } from 'react';

const SUPABASE_URL = 'https://fyxrnlonaptoqwsuxmql.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_3Wqn0906Eg3PJcTfpd-MrQ_cbsktW5T';

interface Props {
  open: boolean;
  onClose: () => void;
  product: string;
}

export function FeedbackModal({ open, onClose, product }: Props) {
  const [type, setType] = useState<'Bug' | 'Feature Request' | 'General'>('General');
  const [message, setMessage] = useState('');
  const [professionalUse, setProfessionalUse] = useState('');
  const [discovery, setDiscovery] = useState('');
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');

  if (!open) return null;

  const reset = () => {
    setStatus('idle');
    setMessage('');
    setProfessionalUse('');
    setDiscovery('');
    setEmail('');
    setType('General');
  };

  const handleSubmit = async () => {
    if (!message.trim()) return;
    setStatus('sending');
    try {
      const res = await fetch(`${SUPABASE_URL}/rest/v1/feedback`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: SUPABASE_ANON_KEY,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          product,
          type,
          message: message.trim(),
          professional_use: professionalUse.trim() || null,
          discovery: discovery || null,
          email: email.trim() || null,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setStatus('success');
      setTimeout(() => { onClose(); reset(); }, 2000);
    } catch {
      setStatus('error');
    }
  };

  if (status === 'success') {
    return (
      <div className="modal-overlay" onClick={onClose}>
        <div className="modal-content" onClick={e => e.stopPropagation()}>
          <p style={{ fontSize: '1.5rem', textAlign: 'center', margin: '2rem 0' }}>✅ Thank you!</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={e => e.stopPropagation()}>
        <h2>Send Feedback</h2>

        <div className="radio-group">
          {(['Bug', 'Feature Request', 'General'] as const).map(t => (
            <label key={t} className={type === t ? 'active' : ''}>
              <input type="radio" name="fb-type" value={t} checked={type === t} onChange={() => setType(t)} />
              {t === 'Bug' ? '🐛' : t === 'Feature Request' ? '✨' : '💬'} {t}
            </label>
          ))}
        </div>

        <textarea
          placeholder="Your feedback… *"
          value={message}
          onChange={e => setMessage(e.target.value)}
          rows={4}
          required
        />

        <textarea
          placeholder="Would you use this tool professionally? If not, what's missing? (optional)"
          value={professionalUse}
          onChange={e => setProfessionalUse(e.target.value)}
          rows={2}
        />

        <select value={discovery} onChange={e => setDiscovery(e.target.value)}>
          <option value="">How did you find this tool? (optional)</option>
          <option value="Search">Search</option>
          <option value="Reddit">Reddit</option>
          <option value="Colleague">Colleague</option>
          <option value="GitHub">GitHub</option>
          <option value="Other">Other</option>
        </select>

        <input
          type="email"
          placeholder="Email (optional, for follow-up)"
          value={email}
          onChange={e => setEmail(e.target.value)}
        />

        <div className="modal-actions">
          <button onClick={onClose}>Cancel</button>
          <button className="primary" onClick={handleSubmit} disabled={!message.trim() || status === 'sending'}>
            {status === 'sending' ? 'Sending…' : 'Send'}
          </button>
        </div>

        {status === 'error' && (
          <p style={{ color: '#e63946', fontSize: '0.85rem', marginTop: 8 }}>
            Failed to send. Please try again.
          </p>
        )}
      </div>
    </div>
  );
}
