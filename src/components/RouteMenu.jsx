import React, {useState} from 'react';
import Select from 'react-select';
import '../RouteMenu.css';
import useStore from './store.jsx';

function RouteMenu() {
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);
    const rooms = useStore((state) => state.rooms);

    const roomOptions = rooms.map((room) => ({
        value: room.id,
        label: room.id,
    }));

    return (
        <div className="route-menu">
            <h2>Построение маршрута</h2>
            <div className="route-inputs">
                <Select
                    placeholder="Откуда"
                    options={roomOptions}
                    value={from}
                    onChange={(selected) => setFrom(selected)}
                    className="route-select"
                    classNamePrefix="route-select"
                />
                <Select
                    placeholder="Куда"
                    options={roomOptions}
                    value={to}
                    onChange={(selected) => setTo(selected)}
                    className="route-select"
                    classNamePrefix="route-select"
                />
            </div>
            <button onClick={() => alert(`Маршрут из ${from?.value} в ${to?.value}`)}>
                Построить маршрут
            </button>
        </div>
    );
}

export default RouteMenu;