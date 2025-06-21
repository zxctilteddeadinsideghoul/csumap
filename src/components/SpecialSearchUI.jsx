// src/components/SpecialSearchUI.jsx
import React, { useEffect } from 'react';
import useStore from './store.jsx';
import '../SpecialSearchUI.css';

// Уберем стили из компонента

const FilterBar = ({ config, activeFilterId, onFilterChange }) => (
    <div className="filter-bar"> {/* <-- Добавим классы */}
        {config.filterProperties.map(filter => (
            <button
                key={filter.id}
                onClick={() => onFilterChange(filter.id)}
                className={activeFilterId === filter.id ? 'active' : ''}
            >
                {filter.label}
            </button>
        ))}
    </div>
);

const NearestObjectSelector = ({ candidates, selectedIndex, onSelect, onConfirm }) => (
    <div className="nearest-object-selector"> {/* <-- Добавим классы */}
        <button onClick={() => onSelect(selectedIndex - 1)} disabled={selectedIndex <= 0}>{'<'}</button>
        <div className="candidate-info">
            <div>{candidates[selectedIndex]?.room.name || candidates[selectedIndex]?.room.description}</div>
            <div className="distance-info">~{Math.round(candidates[selectedIndex]?.distance / 25)} м</div>
        </div>
        <button onClick={() => onSelect(selectedIndex + 1)} disabled={selectedIndex >= candidates.length - 1}>{'>'}</button>
        <button onClick={onConfirm} className="confirm-button">Маршрут</button>
    </div>
);

function SpecialSearchUI() {
    const specialSearch = useStore(state => state.specialSearch);
    const fromRoom = useStore(state => state.fromRoom);

    const {
        calculateNearestObjects,
        setSpecialSearchFilter,
        resetStartPointSelection,
        setSpecialSearchIndex,
        setToRoom,
        triggerRouteBuild,
        clearSpecialSearch,
        setSelectedSearchRoom,
    } = useStore.getState();

    const activeFilterId = specialSearch?.activeFilterId;
    const status = specialSearch?.status;
    const selectedIndex = specialSearch?.selectedIndex;
    const candidates = specialSearch?.candidates;

    useEffect(() => {
        if (fromRoom && status?.startsWith('pending')) {
            calculateNearestObjects();
        }
    }, [fromRoom, status, calculateNearestObjects]);

    useEffect(() => {
        if (status === 'selection' && candidates?.length > 0) {
            const selectedCandidateRoom = candidates[selectedIndex]?.room;
            if (selectedCandidateRoom) {
                setSelectedSearchRoom(selectedCandidateRoom);
            }
        }
    }, [selectedIndex, status, candidates, setSelectedSearchRoom]);

    if (!specialSearch) return null;

    const handleConfirmSelection = () => {
        const selectedRoom = candidates[selectedIndex]?.room;
        if (selectedRoom && fromRoom) {
            setToRoom(selectedRoom);
            triggerRouteBuild();
            setSelectedSearchRoom(fromRoom);
            clearSpecialSearch();
        }
    };

    return (
        <div className="special-search-container">
            {status === 'pending_filters' && (
                <>
                    <p>Куда вы хотите пойти?</p>
                    <FilterBar config={specialSearch.config} activeFilterId={activeFilterId} onFilterChange={setSpecialSearchFilter} />
                    <p className="prompt-text">Выберите фильтр, а затем укажите ваше местоположение на карте или воспользуйтесь поиском.</p>
                </>
            )}

            {status === 'pending_start_point' && (
                <>
                    <p>Откуда начать поиск?</p>
                    {!fromRoom ? (
                        <p className="prompt-text">Укажите ваше местоположение на карте или воспользуйтесь поиском.</p>
                    ) : (
                        <div className="start-point-info">
                            <span>{fromRoom.name || fromRoom.description}</span>
                            <button onClick={resetStartPointSelection}>Изменить</button>
                        </div>
                    )}
                </>
            )}

            {status === 'calculating' && <div>Идет поиск...</div>}

            {status === 'selection' && (
                candidates.length > 0 ? (
                    <NearestObjectSelector candidates={candidates} selectedIndex={selectedIndex} onSelect={setSpecialSearchIndex} onConfirm={handleConfirmSelection} />
                ) : (
                    <div>
                        <p>Объекты не найдены с учетом фильтров.</p>
                        <button onClick={resetStartPointSelection}>Попробовать снова</button>
                    </div>
                )
            )}
            <button onClick={clearSpecialSearch} className="close-button-special">✕</button>
        </div>
    );
}

export default SpecialSearchUI;