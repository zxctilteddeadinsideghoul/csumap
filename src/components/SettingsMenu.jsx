// src/components/SettingsMenu.jsx

import React, {useEffect, useState} from 'react';
import '../SettingsMenu.css';
import useStore from './store';
import "../FeedbackForm.css"

function SettingsMenu() {
    const [clickCount, setClickCount] = useState(0);
    const [showCat, setShowCat] = useState(false);

    const { setIsFeedbackFormOpen, showRoomDescriptions, toggleShowRoomDescriptions } = useStore();
    const setActiveMenu = useStore((state) => state.setActiveMenu);

    const handleAuthorClick = () => {
        const newClickCount = clickCount + 1;
        setClickCount(newClickCount);
    };

    useEffect(() => {
        if (clickCount >= 10) {
            setShowCat(true);
            setClickCount(0);
            const timer = setTimeout(() => {
                setShowCat(false);
            }, 3000);
            return () => clearTimeout(timer);
        }
    }, [clickCount]);

    const handleCloseButtonClick = () => setActiveMenu(null);
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            setActiveMenu(null);
        }
    }

    const handleFeedbackClick = () => {
        setIsFeedbackFormOpen(true)
    }

    return (
        <div className="settings-menu-overlay" onClick={handleOverlayClick}>
            <div className="settings-content" onClick={(e) => e.stopPropagation()}>
                <button
                    className="close-button"
                    onClick={handleCloseButtonClick}
                    aria-label="Закрыть"
                >
                    <span className="close-x">×</span>
                </button>
                <h2 className="settings-title">Настройки</h2>

                <div className="settings-section">
                    <h3 className="settings-section-title">Вид карты</h3>
                    <div className="settings-option">
                        <input
                            type="checkbox"
                            id="show-descriptions"
                            checked={showRoomDescriptions}
                            onChange={toggleShowRoomDescriptions}
                        />
                        <label htmlFor="show-descriptions">Показывать описания кабинетов (Бета)</label>
                    </div>
                </div>

                <div className="settings-divider"/>
                <div className="authors-section">
                    <h3
                        className="authors-heading"
                        onClick={handleAuthorClick}
                        style={{userSelect: 'none'}}
                        title={`Кликов для пасхалки: ${clickCount}/10`}
                    >
                        Авторы
                    </h3>
                    <div className="author-item"><p>Менеджер: <span className="author-name">Макарова Вероника</span></p>
                    </div>
                    <div className="author-item"><p>Дизайн сайта: <span className="author-name">Дударов Дмитрий</span>
                    </p></div>
                    <div className="author-item">
                        <p>
                            Разраб. системы навигации:{' '}
                            <span
                                className="author-name rickroll"
                                style={{cursor: 'pointer'}}
                                title="Нажми на меня!"
                            >
                Юнусов Александр
              </span>
                        </p>
                    </div>
                    <div className="author-item"><p>Разраб. части администрирования: <span className="author-name">Афанасьев Антон</span>
                    </p></div>
                </div>
                <div
                    className={"feedback"}
                    onClick={handleFeedbackClick}
                >
                    Обратная связь
                </div>
            </div>

            <div className={`cat-easter-egg ${showCat ? 'show' : ''}`}>
                <img src="https://media.tenor.com/4YCgHLAsE3UAAAAi/rick-roll.gif" alt="Рик Ролл"/>
            </div>

        </div>
    );
}

export default SettingsMenu;