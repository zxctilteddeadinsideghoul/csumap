import React, { useState, useEffect } from 'react';
import useStore from './store';
import '../ModeNotification.css';

function ModeNotification() {
    const modeJustChanged = useStore(state => state.modeJustChanged);
    const appMode = useStore(state => state.appMode);

    const clearModeChangeFlag = useStore(state => state.clearModeChangeFlag);

    const [visible, setVisible] = useState(false);
    const [message, setMessage] = useState('');

    useEffect(() => {
        // Показываем уведомление, только если флаг установлен
        if (modeJustChanged) {
            const new_message = appMode === 'abiturient'
                ? 'Вы вошли в режим абитуриента'
                : 'Вы вошли в обычный режим';

            setMessage(new_message);
            setVisible(true);

            // Таймер, который скроет уведомление
            const timer = setTimeout(() => {
                setVisible(false);
            }, 2500); // 2.5 секунды

            // После того, как уведомление скрылось, сбрасываем флаг в сторе
            const resetTimer = setTimeout(() => {
                clearModeChangeFlag();
            }, 3000); // дольше, чем анимация скрытия

            return () => {
                clearTimeout(timer);
                clearTimeout(resetTimer);
            };
        }
    }, [modeJustChanged, appMode, clearModeChangeFlag]);

    // Если нет сообщения, не рендерим ничего, чтобы избежать пустого div
    if (!message) return null;

    return (
        <div className={`mode-notification ${visible ? 'show' : ''}`}>
            {message}
        </div>
    );
}

export default ModeNotification;