import React, {useState, useEffect} from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import {X} from 'lucide-react';
import './RoomCanvas.css';

function RoomEditorDialog({room, onClose, onSave, onDelete}) {
    const [editedRoom, setEditedRoom] = useState({...room});

    useEffect(() => {
        setEditedRoom({...room});
    }, [room]);

    const handleChange = (e) => {
        const {name, value} = e.target;
        setEditedRoom((prev) => ({...prev, [name]: value}));
    };

    const handleSave = () => {
        onSave(editedRoom);
        onClose();
    };

    const handleDelete = () => {
        onDelete(editedRoom.id);
        onClose();
    };

    const handleFileUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (evt) => {
            const svgText = evt.target.result;
            const pathMatch = svgText.match(/<path[^>]*d="([^"]+)"/i);
            if (pathMatch) {
                setEditedRoom((prev) => ({...prev, data: pathMatch[1]}));
            } else {
                alert("SVG не содержит путь (path с атрибутом d)");
            }
        };
        reader.readAsText(file);
    };

    if (!room) return null;

    return (
        <Dialog.Root open={!!room} onOpenChange={onClose}>
            <Dialog.Portal>
                <Dialog.Overlay className="dialog-overlay"/>
                <Dialog.Content className="dialog-content">
                    <div className="dialog-header">
                        <Dialog.Title
                            className="dialog-title">Редактировать {room.type === "room" ? "комнату" : "иконку"}</Dialog.Title>
                        <Dialog.Close asChild>
                            <button className="dialog-close">
                                <X size={20}/>
                            </button>
                        </Dialog.Close>
                    </div>
                    {(room.type === "room" || room.type === "vectorized_room") && (
                        <>
                            <div className="dialog-field">
                                <label>type</label>
                                <select name="type" value={editedRoom.type} onChange={handleChange}>
                                    <option value="room">room</option>
                                    <option value="icon">icon</option>
                                    <option value="vectorized_room">vectorized_room</option>
                                    <option value="wall">wall</option>
                                </select>
                            </div>

                            <div className="dialog-field">
                                <label>id</label>
                                <input
                                    name={"id"}
                                    value={editedRoom["id"]}
                                    disabled={true}
                                />
                            </div>

                            {['name', 'workingtime', 'description'].map((field) => (
                                <div className="dialog-field" key={field}>
                                    <label>{field}</label>
                                    <input
                                        name={field}
                                        value={editedRoom[field] || ''}
                                        onChange={handleChange}
                                    />
                                </div>
                            ))}
                        </>
                    )}
                    {editedRoom.type === 'icon' && (
                        <>
                            <div className="dialog-field">
                                <label>id</label>
                                <input
                                    name={"id"}
                                    value={editedRoom["id"]}
                                    disabled={true}
                                />
                            </div>

                            <div className="dialog-field">
                                <label>Описание</label>
                                <input
                                    name={"description"}
                                    value={editedRoom["description"] || ''}
                                    onChange={handleChange}
                                />
                            </div>

                            <div className="dialog-field">
                                <label>Цвет обводки</label>
                                <input name="stroke" type="color" value={editedRoom.stroke || '#ff0000'}
                                       onChange={handleChange}/>
                            </div>


                            <div className="dialog-field">
                                <label>SVG Path (data)</label>
                                <textarea
                                    name="data"
                                    rows={4}
                                    value={editedRoom.data || ''}
                                    onChange={handleChange}
                                    style={{fontFamily: 'monospace', width: '100%'}}
                                />
                            </div>

                            <div className="dialog-field">
                                <label>Загрузить SVG</label>
                                <input type="file" accept=".svg" onChange={handleFileUpload}/>
                            </div>
                        </>
                    )}
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