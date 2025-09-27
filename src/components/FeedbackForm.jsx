import React, { useState } from 'react';
import '../FeedbackForm.css';
import useStore from "./store.jsx";

function FeedbackForm() {
  const { isFeedbackFormOpen, setIsFeedbackFormOpen } = useStore();
  const [emailOrTelegram, setEmailOrTelegram] = useState('');
  const [message, setMessage] = useState('');
  const [submitStatus, setSubmitStatus] = useState(null); // 'success', 'error', null

  const handleSubmit = async (e) => {
    e.preventDefault();

    const feedbackData = {
      contact: emailOrTelegram || null,
      content: message,
    };

    try {
      const response = await fetch('https://map.csu.ru/api/feedback/saveFeedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(feedbackData),
      });

      if (response.status === 201) {
        setSubmitStatus('success');
      } else {
        setSubmitStatus('error');
      }
    } catch (error) {
      console.error('Ошибка при отправке:', error);
      setSubmitStatus('error');
    }
  };

  const handleClose = () => {
    setIsFeedbackFormOpen(false);
    setSubmitStatus(null); // сброс статуса при закрытии
    setEmailOrTelegram('');
    setMessage('');
  };

  if (!isFeedbackFormOpen) return null;

  // Отображение сообщения об успехе
  if (submitStatus === 'success') {
    return (
      <div className="feedback-modal-overlay" onClick={handleClose}>
        <div className="feedback-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={handleClose} aria-label="Закрыть">
            <span className="close-x">×</span>
          </button>
          <h2>Спасибо!</h2>
          <p>Ваше сообщение успешно отправлено.</p>
          <button className="feedback-submit" onClick={handleClose}>
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  // Отображение сообщения об ошибке
  if (submitStatus === 'error') {
    return (
      <div className="feedback-modal-overlay" onClick={handleClose}>
        <div className="feedback-modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="close-button" onClick={handleClose} aria-label="Закрыть">
            <span className="close-x">×</span>
          </button>
          <h2>Извините!</h2>
          <p>Что-то пошло не так. Пожалуйста, попробуйте отправить позже.</p>
          <button className="feedback-submit" onClick={handleClose}>
            Закрыть
          </button>
        </div>
      </div>
    );
  }

  // Основная форма
  return (
    <div className="feedback-modal-overlay" onClick={handleClose}>
      <div className="feedback-modal-content" onClick={(e) => e.stopPropagation()}>
        <button
          className="close-button"
          onClick={handleClose}
          aria-label="Закрыть"
        >
          <span className="close-x">×</span>
        </button>

        <h2>Обратная связь</h2>

        <form onSubmit={handleSubmit} className="feedback-form">
          <label htmlFor="emailOrTelegram" className="feedback-label">
            Email или Telegram (необязательно):
          </label>
          <input
            type="text"
            id="emailOrTelegram"
            value={emailOrTelegram}
            onChange={(e) => setEmailOrTelegram(e.target.value)}
            placeholder="Введите email или telegram"
            className="feedback-input"
          />

          <label htmlFor="message" className="feedback-label">
            Ваше сообщение:
          </label>
          <textarea
            id="message"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Введите ваше сообщение"
            required
            className="feedback-textarea"
          />

          <button type="submit" className="feedback-submit">
            Отправить
          </button>
        </form>
      </div>
    </div>
  );
}

export default FeedbackForm;