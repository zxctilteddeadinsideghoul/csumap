import React, { useState, useEffect } from 'react';
import Select from 'react-select';
import '../RouteMenu.css';
import useStore from './store.jsx';

function RouteMenu() {
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);
    const rooms = useStore((state) => state.rooms);
    const fromRoom = useStore((state) => state.fromRoom);
    const toRoom = useStore((state) => state.toRoom);
    const setFromRoom = useStore((state) => state.setFromRoom);
    const setToRoom = useStore((state) => state.setToRoom);
    const setActiveMenu = useStore((state) => state.setActiveMenu);

    // Фильтрация только тех комнат, у которых есть name
    const roomOptions = rooms
        .filter(room => room.name !== null && room.name !== undefined && room.name !== '')
        .map((room) => ({
            value: room.id,
            label: room.description ? `${room.name} (${room.description})` : room.name
        }));

    useEffect(() => {
        if (fromRoom) {
            setFrom({
                value: fromRoom.id,
                label: fromRoom.description ? `${fromRoom.name} (${fromRoom.description})` : fromRoom.name
            });
        }
    }, [fromRoom]);

    useEffect(() => {
        if (toRoom) {
            setTo({
                value: toRoom.id,
                label: toRoom.description ? `${toRoom.name} (${toRoom.description})` : toRoom.name
            });
        }
    }, [toRoom]);

    const handleBuildRoute = () => {
        const startRoom = from ? rooms.find(r => r.id === from.value) : null;
        const endRoom = to ? rooms.find(r => r.id === to.value) : null;
        setFromRoom(startRoom);
        setToRoom(endRoom);
        setActiveMenu(null)
    };

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
                        setFrom({
                            value: room.id,
                            label: room.description ? `${room.name} (${room.description})` : room.name
                        });
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
                        setTo({
                            value: room.id,
                            label: room.description ? `${room.name} (${room.description})` : room.name
                        });
                    }}
                    className="route-select"
                    classNamePrefix="route-select"
                />
            </div>
            <button onClick={handleBuildRoute}>
                Построить маршрут
            </button>
        </div>
    );
}

export default RouteMenu;
