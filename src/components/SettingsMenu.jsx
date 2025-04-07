import React from 'react';
import '../SettingsMenu.css';

function SettingsMenu() {
    return (
        <div className="settings-menu">
            <h2>Настройки</h2>
            <p>Авторы</p>
            <p>Руководитель: Макарова Вероника</p>
            <p>Дизайн сайта: Дударов Дмитрий</p>
            <p>Разработчик системы навигации: Юнусов Александр</p>
            <p>Разработчик части администрирования: Афанасьев Антон</p>
        </div>
    );
}

export default SettingsMenu;