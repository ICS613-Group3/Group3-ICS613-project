import { useCallback, useEffect, useState } from 'react';
import { messagesApi, type MessageItem } from '../api/messages';
import { ApiRequestError } from '../api/client';
import type { ReservationState } from '../types/api';

// States where the thread accepts new messages (matches backend ACTIVE_STATES).
const OPEN_STATES: ReservationState[] = ['REQUESTED', 'APPROVED', 'PICKED_UP'];

interface MessageThreadProps {
  reservationId: string;
  state: ReservationState;
  canSend: boolean; // if borrower, owner, or admin
}

function MessageThread({ reservationId, state, canSend }: MessageThreadProps) {
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [draft, setDraft] = useState('');
  const [isSending, setIsSending] = useState(false);

  const isThreadOpen = OPEN_STATES.includes(state);

  const loadMessages = useCallback(async () => {
    setIsLoading(true);
    setError('');
    try {
      const res = await messagesApi.list(reservationId);
      setMessages(res.items);
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : 'Failed to load messages');
    } finally {
      setIsLoading(false);
    }
  }, [reservationId]);

  useEffect(() => {
    loadMessages();
  }, [loadMessages]);

  const handleSend = async () => {
    const body = draft.trim();
    if (!body) return;

    setIsSending(true);
    setError('');
    try {
      const sent = await messagesApi.send(reservationId, { body });
      setMessages((prev) => [...prev, sent]);
      setDraft('');
    } catch (err) {
      setError(err instanceof ApiRequestError ? err.detail : 'Failed to send message');
    } finally {
      setIsSending(false);
    }
  };

  return (
    <section className="message-thread">
      <h3>Messages</h3>

      {isLoading && <p>Loading messages...</p>}
      {error && <p className="closed-workflow-message">{error}</p>}

      {!isLoading && messages.length === 0 && <p>No messages yet.</p>}

      <ul className="message-list">
        {messages.map((message) => (
          <li key={message.id} className="message-item">
            <div className="message-item-header">
              <span className="message-sender">{message.sender_name ?? 'Unknown'}</span>
              <span className="message-timestamp">
                {new Date(message.created_at).toLocaleString()}
              </span>
            </div>
            <p className="message-body">{message.body}</p>
          </li>
        ))}
      </ul>

      {canSend && isThreadOpen && (
        <div className="message-input">
          <label htmlFor="message-draft" style={{ display: 'block', marginTop: '0.5rem' }}>
            New message:
            <textarea
              id="message-draft"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Write a message..."
            />
          </label>
          <button
            type="button"
            className="action-button approve-button"
            disabled={isSending || !draft.trim()}
            onClick={handleSend}
          >
            Send
          </button>
        </div>
      )}

      {canSend && !isThreadOpen && (
        <p className="closed-workflow-message">This thread is read-only.</p>
      )}
    </section>
  );
}

export default MessageThread;
