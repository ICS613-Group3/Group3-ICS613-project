import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { messagesApi } from '../api/messages';
import type { MessageResponse } from '../api/messages';
import { reservationsApi } from '../api/reservations';
import type { ReservationResponse } from '../types/api';
import { useAuth } from '../context/useAuth';
import { ApiRequestError } from '../api/client';

function MessageThreadPage() {
  const { reservationId } = useParams<{ reservationId: string }>();
  const { user } = useAuth();
  const [messages, setMessages] = useState<MessageResponse[]>([]);
  const [reservation, setReservation] = useState<ReservationResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  const isReadOnly = reservation
    ? ['RETURNED', 'DENIED', 'CANCELLED'].includes(reservation.state)
    : false;

  const loadMessages = useCallback(async () => {
    if (!reservationId) return;
    setIsLoading(true);
    setErrorMessage('');
    try {
      const data = await messagesApi.list(reservationId, { page_size: 100 });
      setMessages(data.items);
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.detail : 'Failed to load messages.');
    } finally {
      setIsLoading(false);
    }
  }, [reservationId]);

  const loadReservation = useCallback(async () => {
    if (!reservationId) return;
    try {
      const data = await reservationsApi.get(reservationId);
      setReservation(data);
    } catch {
      // Silently handle — reservation info is optional context.
    }
  }, [reservationId]);

  useEffect(() => {
    loadMessages();
    loadReservation();
  }, [loadMessages, loadReservation]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!reservationId || !newMessage.trim()) return;
    setIsSending(true);
    try {
      const msg = await messagesApi.send(reservationId, { body: newMessage.trim() });
      setMessages((prev) => [...prev, msg]);
      setNewMessage('');
    } catch (err) {
      setErrorMessage(err instanceof ApiRequestError ? err.detail : 'Failed to send message.');
    } finally {
      setIsSending(false);
    }
  };

  if (!reservationId) {
    return (
      <section className="page-section">
        <p className="form-error">No reservation specified.</p>
        <Link to="/reservations">Back to Reservations</Link>
      </section>
    );
  }

  if (isLoading) {
    return (
      <section className="page-section">
        <p>Loading messages...</p>
      </section>
    );
  }

  if (errorMessage && !reservation) {
    return (
      <section className="page-section">
        <p className="form-error">{errorMessage}</p>
        <Link to="/reservations">Back to Reservations</Link>
      </section>
    );
  }

  return (
    <section className="page-section">
      <div className="page-header">
        <div>
          <p className="eyebrow">US22 — Reservation Messages</p>
          <h1>Message Thread</h1>
          {reservation && (
            <p className="page-description">
              Reservation for {reservation.start_date} to {reservation.end_date}
              {' '}&middot;{' '}
              <span className={`workflow-status status-${reservation.state.toLowerCase()}`}>
                {reservation.state.replace(/_/g, ' ')}
              </span>
            </p>
          )}
        </div>
        <Link className="secondary-link header-action-link" to={`/reservations/${reservationId}`}>
          Back to Reservation
        </Link>
      </div>

      {errorMessage && <p className="form-error">{errorMessage}</p>}

      {/* Messages list */}
      <div className="form-card" style={{ maxHeight: '400px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
        {messages.length === 0 && (
          <p className="muted-text">No messages yet. Start the conversation.</p>
        )}
        {messages.map((msg) => {
          const isOwn = msg.sender_id === user?.id;
          return (
            <div
              key={msg.id}
              style={{
                display: 'flex',
                justifyContent: isOwn ? 'flex-end' : 'flex-start',
              }}
            >
              <div
                style={{
                  maxWidth: '70%',
                  padding: '0.6rem 0.9rem',
                  borderRadius: '0.75rem',
                  background: isOwn ? '#2563eb' : '#e5e7eb',
                  color: isOwn ? '#ffffff' : '#1f2937',
                }}
              >
                <p style={{ margin: 0, fontSize: '0.75rem', fontWeight: 600, opacity: 0.8 }}>
                  {msg.sender_name || 'User'} &middot;{' '}
                  {new Date(msg.created_at).toLocaleString()}
                </p>
                <p style={{ margin: '0.25rem 0 0', whiteSpace: 'pre-wrap' }}>{msg.body}</p>
              </div>
            </div>
          );
        })}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      {!isReadOnly ? (
        <div className="form-card" style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem' }}>
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            onKeyDown={(e) => { if (e.key === 'Enter') handleSend(); }}
            style={{ flex: 1 }}
            disabled={isSending}
          />
          <button
            type="button"
            className="primary-button"
            onClick={handleSend}
            disabled={isSending || !newMessage.trim()}
          >
            {isSending ? 'Sending...' : 'Send'}
          </button>
        </div>
      ) : (
        <p className="muted-text" style={{ marginTop: '1rem' }}>
          This reservation is {reservation?.state.toLowerCase().replace(/_/g, ' ')}. Messages are read-only.
        </p>
      )}
    </section>
  );
}

export default MessageThreadPage;
