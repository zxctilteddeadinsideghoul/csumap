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
                const isNoSearchRoom = room.name?.toLowerCase().includes('/');
                

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

    return (
        <div className="route-menu">
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
            <button onClick={handleBuildRoute} disabled={!fromOption || !toOption}>
                Построить маршрут
            </button>
        </div>
    );
}

export default RouteMenu;