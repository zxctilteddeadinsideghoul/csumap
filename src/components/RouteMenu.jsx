import React, {useState} from 'react';
import Select from 'react-select';
import '../RouteMenu.css';
import useStore from './store.jsx';

function RouteMenu() {
    const [from, setFrom] = useState(null);
    const [to, setTo] = useState(null);
    const rooms = useStore((state) => state.rooms);

    const setFromRoom = useStore((state) => state.setFromRoom);
    const setToRoom = useStore((state) => state.setToRoom);

    const roomOptions = rooms.map((room) => ({
        value: room.id,
        label: room.name ? `${room.name} (${room.id})` : room.id,
    }));

    const handleBuildRoute = () => {
        const findRoomById = (id) => rooms.find(r => r.id === id);

        //СТАРОЕ__________________________________________________________________________
        // const startRoomObject = from ? findRoomById(from.value) : null;
        // const endRoomObject = to ? findRoomById(to.value) : null;
        //СТАРОЕ__________________________________________________________________________
        const startRoomObject = from ? rooms.find(r => r.id === from.value) : null;
        const endRoomObject = to ? rooms.find(r => r.id === to.value) : null;
        setFromRoom(startRoomObject);
        setToRoom(endRoomObject);
    };

    return (
        <div className="route-menu">
            <h2>Построение маршрута</h2>
            <div className="route-inputs">
                <Select
                    placeholder="Откуда"
                    options={roomOptions}
                    value={from}
                    // onChange={(selected) => setFrom(selected)} -----------------------------------------------
                    onChange={setFrom}
                    className="route-select"
                    classNamePrefix="route-select"
                />
                <Select
                    placeholder="Куда"
                    options={roomOptions}
                    value={to}
                    // onChange={(selected) => setTo(selected)}----------------------------------------------
                    onChange={setTo}
                    className="route-select"
                    classNamePrefix="route-select"
                />
            </div>
            <button onClick={() =>{handleBuildRoute(); alert(`Маршрут из ${from?.value} в ${to?.value}`)}}>
                Построить маршрут
            </button>
        </div>
    );
}

export default RouteMenu;