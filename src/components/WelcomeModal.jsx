import React, { useState, useEffect } from 'react';
import useStore from './store.jsx';
import '../BuildingSelectionModal.css';

function WelcomeModal() {
    const appMode = useStore(state => state.appMode);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        // Проверяем, нужно ли показать окно
        const shouldShow = sessionStorage.getItem('abiturientWelcomeShown') !== 'true';

        if (appMode === 'abiturient' && shouldShow) {
            setIsOpen(true);
            // Отмечаем, что окно было показано в этой сессии
            sessionStorage.setItem('abiturientWelcomeShown', 'true');
        }
    }, [appMode]); // Эффект сработает при изменении режима

    const handleClose = () => {
        setIsOpen(false);
    };

    if (!isOpen) {
        return null;
    }

    return (
        // Используем классы от существующего модального окна
        <div className="building-modal-overlay" onClick={handleClose}>
            <div className="building-modal-content" onClick={(e) => e.stopPropagation()}>
                <button className="building-modal-close-button" onClick={handleClose}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7.5 8.3685L1.06477 14.8037C0.950278 14.9182 0.809617 14.9796 0.642787 14.9877C0.475956 14.9959 0.327118 14.9346 0.196271 14.8037C0.0654234 14.6729 0 14.5281 0 14.3695C0 14.2108 0.0654234 14.0661 0.196271 13.9352L6.6315 7.5L0.196271 1.06477C0.0817793 0.950278 0.0204446 0.809617 0.0122666 0.642787C0.00408867 0.475956 0.0654234 0.327118 0.196271 0.196271C0.327118 0.0654234 0.471868 0 0.63052 0C0.789172 0 0.933922 0.0654234 1.06477 0.196271L7.5 6.6315L13.9352 0.196271C14.0497 0.0817793 14.1908 0.0204446 14.3584 0.0122666C14.5245 0.00408867 14.6729 0.0654234 14.8037 0.196271C14.9346 0.327118 15 0.471868 15 0.63052C15 0.789172 14.9346 0.933922 14.8037 1.06477L8.3685 7.5L14.8037 13.9352C14.9182 14.0497 14.9796 14.1908 14.9877 14.3584C14.9959 14.5245 14.9346 14.6729 14.8037 14.8037C14.6729 14.9346 14.5281 15 14.3695 15C14.2108 15 14.0661 14.9346 13.9352 14.8037L7.5 8.3685Z" fill="#343434"/>
                    </svg>
                </button>
                <h2>Добро пожаловать, Абитуриент👋</h2>

                {/* Текст приветствия */}
                <div style={{ textAlign: 'left', width: '100%', color: '#343434', fontSize: '16px', lineHeight: '1.5', marginTop: '10px' }}>
                    <p style={{ margin: '0 0 10px 0' }}>
                        Вы вошли в специальный режим для абитуриентов.
                    </p>
                    <ul style={{ paddingLeft: '20px', margin: '0 0 20px 0' }}>
                        <li>Используйте <strong>поиск вверху</strong>, чтобы найти стол нужного факультета или кабинет.</li>
                        <li>Если вы отсканировали QR-код, мы уже определили ваше местоположение.</li>
                        <li>Просто выберите факультет, и мы построим маршрут!</li>
                    </ul>
                </div>

                <button
                    className="building-option-button active" // Стиль как у активной кнопки
                    onClick={handleClose}
                >
                    Понятно
                </button>
            </div>
        </div>
    );
}

export default WelcomeModal;