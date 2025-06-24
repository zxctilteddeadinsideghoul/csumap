// src/components/RouteMenu.jsx

import React, {useEffect, useMemo, useState} from 'react';
import Select from 'react-select';
import '../RouteMenu.css';
import useStore from './store.jsx';

function RouteMenu() {
    // Локальное состояние для хранения ВЫБРАННЫХ опций (объектов {value, label})
    const [fromOption, setFromOption] = useState(null);
    const [toOption, setToOption] = useState(null);

    const rooms = useStore((state) => state.rooms);
    // Читаем комнаты из стора
    const fromRoom = useStore((state) => state.fromRoom);
    const toRoom = useStore((state) => state.toRoom);
    // Получаем actions для записи в стор
    const setFromRoomAction = useStore((state) => state.setFromRoom);
    const setToRoomAction = useStore((state) => state.setToRoom);
    const setActiveMenu = useStore((state) => state.setActiveMenu);
    const triggerRouteBuild = useStore((state) => state.triggerRouteBuild);
    const setSelectedSearchRoom = useStore((state) => state.setSelectedSearchRoom);

    // Генерация опций для селектов
    const roomOptions = useMemo(() => {
        return rooms
            .filter(room => {
                // Условия фильтрации
                const isValidRoom = room && room.id && (room.name || room.description);
                const hasTexInId = room.id.toLowerCase().includes('tex');
                const isTechnical = room.description?.toLowerCase().includes('техническое помещение');
                const isNoSearchRoom = room.name?.toLowerCase().includes('###');


                return isValidRoom && !hasTexInId && !isTechnical && !isNoSearchRoom;
            })
            .map((room) => {
                // Оригинальная логика формирования label
                let label = '';
                if (room.name) {
                    label = room.name;
                    if (room.description && room.name !== room.description) {
                        label += ` (${room.description})`;
                    }
                } else if (room.description) {
                    label = room.description;
                } else {
                    label = `ID: ${room.id}`;
                }
                return {value: room.id, label: label, data: room};
            })
            .sort((a, b) => a.label.localeCompare(b.label));
    }, [rooms]);

    // Синхронизация ЛОКАЛЬНОГО состояния с ГЛОБАЛЬНЫМ (Store -> Local)
    useEffect(() => {
        if (fromRoom) {
            const correspondingOption = roomOptions.find(opt => opt.value === fromRoom.id);
            // Сравниваем value, чтобы избежать лишних обновлений
            if (fromOption?.value !== correspondingOption?.value) {
                setFromOption(correspondingOption || null);
            }
        } else {
            // Если в сторе null, сбрасываем локальную опцию
            if (fromOption !== null) {
                setFromOption(null);
            }
        }
        // Реагируем только на изменение в сторе или списке опций
    }, [fromRoom, roomOptions]);

    useEffect(() => {
        if (toRoom) {
            const correspondingOption = roomOptions.find(opt => opt.value === toRoom.id);
            if (toOption?.value !== correspondingOption?.value) {
                setToOption(correspondingOption || null);
            }
        } else {
            if (toOption !== null) {
                setToOption(null);
            }
        }
        // Реагируем только на изменение в сторе или списке опций
    }, [toRoom, roomOptions]);

    // Обработчик нажатия кнопки "Построить маршрут"
    const handleBuildRoute = () => {
        // Находим ПОЛНЫЕ объекты комнат по ID из ЛОКАЛЬНОГО состояния селектов
        const startRoom = fromOption ? rooms.find(r => r.id === fromOption.value) : null;
        const endRoom = toOption ? rooms.find(r => r.id === toOption.value) : null;

        console.log('[RouteMenu] handleBuildRoute: From:', startRoom?.id, 'To:', endRoom?.id);

        // Обновляем ГЛОБАЛЬНОЕ состояние (вызываем actions стора)
        if (startRoom) setFromRoomAction(startRoom);
        if (endRoom) setToRoomAction(endRoom);

        // Только если обе точки выбраны, запускаем построение и центрирование
        if (startRoom && endRoom) {
            triggerRouteBuild();
            console.log('[RouteMenu] Centering camera on:', startRoom.id);
            setSelectedSearchRoom(startRoom); // Центрируемся на начальной точке
        } else {
            console.warn("[RouteMenu] Невозможно построить маршрут: не выбраны обе точки.");
        }

        setActiveMenu(null); // Закрываем меню маршрута
    };

    // Закрытие по клику на фон
    const handleOverlayClick = (e) => {
        if (e.target === e.currentTarget) {
            setActiveMenu(null);
        }
    };

    // Закрытие по кнопке
    const handleClose = () => {
        setActiveMenu(null);
    };

    return (
        <div className="route-menu-overlay" onClick={handleOverlayClick}>
            <div className="route-menu-content" onClick={(e) => e.stopPropagation()}>
                <button className="route-menu-close-button" onClick={handleClose}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M7.5 8.3685L1.06477 14.8037C0.950278 14.9182 0.809617 14.9796 0.642787 14.9877C0.475956 14.9959 0.327118 14.9346 0.196271 14.8037C0.0654234 14.6729 0 14.5281 0 14.3695C0 14.2108 0.0654234 14.0661 0.196271 13.9352L6.6315 7.5L0.196271 1.06477C0.0817793 0.950278 0.0204446 0.809617 0.0122666 0.642787C0.00408867 0.475956 0.0654234 0.327118 0.196271 0.196271C0.327118 0.0654234 0.471868 0 0.63052 0C0.789172 0 0.933922 0.0654234 1.06477 0.196271L7.5 6.6315L13.9352 0.196271C14.0497 0.0817793 14.1908 0.0204446 14.3584 0.0122666C14.5245 0.00408867 14.6729 0.0654234 14.8037 0.196271C14.9346 0.327118 15 0.471868 15 0.63052C15 0.789172 14.9346 0.933922 14.8037 1.06477L8.3685 7.5L14.8037 13.9352C14.9182 14.0497 14.9796 14.1908 14.9877 14.3584C14.9959 14.5245 14.9346 14.6729 14.8037 14.8037C14.6729 14.9346 14.5281 15 14.3695 15C14.2108 15 14.0661 14.9346 13.9352 14.8037L7.5 8.3685Z" fill="#343434"/>
                    </svg>
                </button>
                <h2>Построение маршрута</h2>
                <div className="route-inputs">
                    <Select
                        placeholder="Откуда"
                        options={roomOptions}
                        value={fromOption}
                        onChange={setFromOption}
                        className="route-select"
                        classNamePrefix="route-select"
                        isClearable
                        noOptionsMessage={() => 'Не найдено'}
                    />
                    <Select
                        placeholder="Куда"
                        options={roomOptions}
                        value={toOption}
                        onChange={setToOption}
                        className="route-select"
                        classNamePrefix="route-select"
                        isClearable
                        noOptionsMessage={() => 'Не найдено'}
                    />
                </div>
                {/* Кнопка активна, только если выбраны обе опции */}
                <button
                    onClick={handleBuildRoute}
                    disabled={!fromOption || !toOption}
                    className="build-route-button"
                >
                    Построить маршрут
                </button>
            </div>
        </div>
    );
}

export default RouteMenu;