import React from "react";
import '../RoomInfoModal.css';

function RoomInfoModal({room, onClose}) {
    if (!room) return null

    //этаж инфа пока так
    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <button className="close-button" onClick={onClose}>X</button>
                <h2>Информация о аудитории</h2>
                <p><strong>Аудитория:</strong> {room.id}</p>
                <p><strong>Этаж:</strong> {room.floor}</p>
                <p><strong>Информация:</strong> {room.info}</p>
            </div>
        </div>
    );
}

export default RoomInfoModal;
