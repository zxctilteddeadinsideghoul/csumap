import React from 'react';
import useStore from './store.jsx';
// Используем стили от другого модального окна, чтобы не писать новые
import '../BuildingSelectionModal.css';

function AbiturientSelectionModal() {
    // Получаем каждую часть состояния отдельно (атомарно) - это более стабильно
    const isAbiturientModalOpen = useStore(state => state.isAbiturientModalOpen);
    const faculties = useStore(state => state.faculties);
    const { setToRoom, triggerRouteBuild, setIsAbiturientModalOpen } = useStore.getState();

    const handleSelectFaculty = (faculty) => {
        setToRoom(faculty);
        triggerRouteBuild();
        setIsAbiturientModalOpen(false); // Закрываем окно после выбора
    };

    if (!isAbiturientModalOpen) {
        return null;
    }

    // Модальное окно не закрывается по клику на оверлей
    return (
        <div className="building-modal-overlay">
            <div className="building-modal-content" onClick={(e) => e.stopPropagation()}>
                <h2>Куда вы хотите пройти?</h2>
                <div className="building-options">
                    {faculties.length > 0 ? (
                        faculties.map((faculty) => (
                            <button
                                key={faculty.id}
                                className="building-option-button" // Стили как у выбора корпуса
                                onClick={() => handleSelectFaculty(faculty)}
                            >
                                {faculty.name}
                            </button>
                        ))
                    ) : (
                        <p>Факультеты не найдены в данных карты.</p>
                    )}
                </div>
            </div>
        </div>
    );
}

export default AbiturientSelectionModal;