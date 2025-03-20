import React, { useState } from 'react';
import '../RouteMenu.css';

function RouteMenu() {
    const [from, setFrom] = useState('');
    const [to, setTo] = useState('');

    return (
        <div className="route-menu">
            <h2>Построение маршрута</h2>
            <div className="route-inputs">
                <input
                    type="text"
                    placeholder="Откуда"
                    value={from}
                    onChange={(e) => setFrom(e.target.value)}
                />
                <input
                    type="text"
                    placeholder="Куда"
                    value={to}
                    onChange={(e) => setTo(e.target.value)}
                />
            </div>
            <button onClick={() => alert(`Маршрут из ${from} в ${to}`)}>Построить маршрут</button>
        </div>
    );
}

export default RouteMenu;