import React, { useState, useEffect, useMemo } from 'react';
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
    const triggerRouteBuild = useStore((state) => state.triggerRouteBuild);

    const setSelectedSearchRoom = useStore((state) => state.setSelectedSearchRoom);

    const roomOptions = useMemo(() => {
        console.log('[RouteMenu] Recalculating roomOptions...');
        return rooms
            .filter(room => room && room.id && (room.name || room.description))
            .map((room) => ({
                value: room.id,
                label: room.description ? `${room.name} (${room.description})` : (room.name || `ID: ${room.id}`),
                searchKey: `${room.name || ''} ${room.description || ''} ${room.id}`.toLowerCase()
            }));
    }, [rooms]);

    useEffect(() => {
        if (fromRoom) {
            const option = roomOptions.find(opt => opt.value === fromRoom.id);
            if (from?.value !== option?.value) {
                setFrom(option || null);
            }
        } else {
            if (from !== null) setFrom(null);
        }
    }, [fromRoom, roomOptions]);

    useEffect(() => {
        if (toRoom) {
            const option = roomOptions.find(opt => opt.value === toRoom.id);
            if (to?.value !== option?.value) {
                setTo(option || null);
            }
        } else {
            if (to !== null) setTo(null);
        }
    }, [toRoom, roomOptions]);

    // Обработчик нажатия кнопки "Построить маршрут"
    const handleBuildRoute = () => {
        const startRoom = from ? rooms.find(r => r.id === from.value) : null;
        const endRoom = to ? rooms.find(r => r.id === to.value) : null;

        console.log('[RouteMenu] handleBuildRoute: From:', startRoom?.id, 'To:', endRoom?.id);
        setFromRoom(startRoom);
        setToRoom(endRoom);
        triggerRouteBuild();

        if (startRoom) {
            console.log('[RouteMenu] Centering camera on:', startRoom.id);
            setSelectedSearchRoom(startRoom); // Используем существующий механизм центрирования
        }

        setActiveMenu(null); // Закрываем меню маршрута
    };

    const filterOption = (option, inputValue) => {
        if (!inputValue) return true;

        const lowerInput = inputValue.toLowerCase();

        const labelMatch = option && typeof option.label === 'string'
            ? option.label.toLowerCase().includes(lowerInput)
            : false;

        const searchKeyMatch = option && typeof option.searchKey === 'string'
            ? option.searchKey.includes(lowerInput)
            : false;

        return labelMatch || searchKeyMatch;
    };

    return (
        <div className="route-menu">
            <h2>Построение маршрута</h2>
            <div className="route-inputs">
                <Select
                    placeholder="Откуда"
                    options={roomOptions}
                    value={from}
                    onChange={setFrom}
                    filterOption={filterOption}
                    className="route-select"
                    classNamePrefix="route-select"
                    isClearable
                    noOptionsMessage={() => 'Не найдено'}
                />
                <Select
                    placeholder="Куда"
                    options={roomOptions}
                    value={to}
                    onChange={setTo}
                    filterOption={filterOption}
                    className="route-select"
                    classNamePrefix="route-select"
                    isClearable
                    noOptionsMessage={() => 'Не найдено'}
                />
            </div>
            <button onClick={handleBuildRoute} disabled={!from || !to}>
                Построить маршрут
            </button>
        </div>
    );
}

export default RouteMenu;