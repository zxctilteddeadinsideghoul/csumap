import React, {useState, useEffect} from 'react';
import Select from 'react-select';
import '../RouteMenu.css';
import useStore from './store.jsx';

function RouteMenu() {
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);
    const rooms = useStore((state) => state.rooms);
    const fromRoom = useStore((state) => state.fromRoom);
    const toRoom = useStore((state) => state.toRoom);

    // только те, у которых есть name
    const roomOptions = rooms
        .filter(room => room.name !== null && room.name !== undefined && room.name !== '')
        .map((room) => ({
            value: room.id,
            label: room.name || room.id,
        }));

    useEffect(() => {
        if (fromRoom) {
            setFrom({value: fromRoom.id, label: fromRoom.name || fromRoom.id});
        }
    }, [fromRoom]);

    useEffect(() => {
        if (toRoom) {
            setTo({value: toRoom.id, label: toRoom.name || toRoom.id});
        }
    }, [toRoom]);

    return (
        <div className="route-menu">
            <h2>Построение маршрута</h2>
            <div className="route-inputs">
                <Select
                    placeholder="Откуда"
                    options={roomOptions}
                    value={from}
                    onChange={(selected) => {
                        const room = rooms.find(r => r.id === selected.value);
                        setFrom({value: room.id, label: room.name || room.id});
                    }}
                    className="route-select"
                    classNamePrefix="route-select"
                />
                <Select
                    placeholder="Куда"
                    options={roomOptions}
                    value={to}
                    onChange={(selected) => {
                        const room = rooms.find(r => r.id === selected.value);
                        setTo({value: room.id, label: room.name || room.id});
                    }}
                    className="route-select"
                    classNamePrefix="route-select"
                />
            </div>
            <button onClick={() => alert(`Маршрут из ${from?.label} в ${to?.label}`)}>
                Построить маршрут
            </button>
        </div>
    );
}

export default RouteMenu;