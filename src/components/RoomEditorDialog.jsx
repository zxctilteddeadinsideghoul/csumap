import React, { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import './RoomCanvas.css';

function RoomEditorDialog({ room, onClose, onSave, onDelete }) {
    const [editedRoom, setEditedRoom] = useState({ ...room });

    useEffect(() => {
        setEditedRoom({ ...room });
    }, [room]);

    const handleChange = (e) => {
        const { name, value } = e.target;
        setEditedRoom((prev) => ({ ...prev, [name]: value }));
    };

    const handleSave = () => {
        onSave(editedRoom);
        onClose();
    };

    const handleDelete = () => {
        onDelete(editedRoom.id);
        onClose();
    };

    if (!room) return null;

    return (
        <Dialog.Root open={!!room} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="dialog-overlay" />
                <Dialog.Content className="dialog-content">
                    <div className="dialog-header">
                        <Dialog.Title className="dialog-title">Редактировать комнату</Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="dialog-close">
                                <X size={20} />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="dialog-field">
                        <label>type</label>
                        <select name="type" value={editedRoom.type} onChange={handleChange}>
                            <option value="room">room</option>
                            <option value="icon">icon</option>
                            <option value="vectorized_room">vectorized_room</option>
                            <option value="wall">wall</option>
                        </select>
                    </div>

                    {['id', 'name', 'workingtime', 'description'].map((field) => (
                        <div className="dialog-field" key={field}>
                            <label>{field}</label>
                            <input
                                name={field}
                                value={editedRoom[field] || ''}
                                onChange={handleChange}
                            />
                        </div>
                    ))}

                    <div className="dialog-actions">
                        <button onClick={handleSave} className="btn-primary">Сохранить</button>
                        <button onClick={onClose} className="btn-secondary">Отмена</button>
                        <button onClick={handleDelete} className="btn-danger">Удалить</button>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
}

export default RoomEditorDialog;