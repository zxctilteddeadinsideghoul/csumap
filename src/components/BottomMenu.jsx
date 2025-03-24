import React from 'react';
import RouteMenu from './RouteMenu.jsx';
import SettingsMenu from './SettingsMenu.jsx';
import '../BottomMenu.css';

function BottomMenu({ activeMenu, setActiveMenu }) {
    const handleMapClick = () => {
        setActiveMenu(null); // Закрываем все меню
    };

    const handleRouteClick = () => {
        setActiveMenu(activeMenu === 'route' ? null : 'route'); // Переключаем меню маршрута
    };

    const handleSettingsClick = () => {
        setActiveMenu(activeMenu === 'settings' ? null : 'settings'); // Переключаем меню настроек
    };

    return (
        <>
            <div className="bottom-menu">
                <button onClick={handleMapClick}>Карта</button>
                <button onClick={handleRouteClick}>Маршрут</button>
                <button onClick={handleSettingsClick}>Настройки</button>
            </div>
            {activeMenu === 'route' && <RouteMenu />}
            {activeMenu === 'settings' && <SettingsMenu />}
        </>
    );
}

export default BottomMenu;