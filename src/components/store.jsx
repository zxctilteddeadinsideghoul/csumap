// src/components/store.jsx

import {create} from 'zustand';
import {findShortestPath, findAllDistances} from './dijkstra.js';

export const availableBuildings = [
    {id: 'building1', name: 'Корпус 1'},
    {id: 'building2', name: 'Корпус 2'},
    {id: 'building3', name: 'Корпус 3'},
];

const initialFloor = 1;

const useStore = create((set, get) => ({
    // --- ДАННЫЕ ---
    fromRoom: null,
    toRoom: null,
    rooms: [],
    faculties: [], // <--- НОВОЕ: для хранения факультетов
    activeMenu: null,
    selectedSearchRoom: null,
    buildRouteTrigger: null,
    isBuildingModalOpen: false,
    selectedBuilding: availableBuildings[0],
    isFeedbackFormOpen: false,
    graphData: { graph: null, nodeCoords: null },
    currentMapFloor: initialFloor,
    pendingFromRoomId: null,

    // --- НОВЫЕ СОСТОЯНИЯ ДЛЯ РЕЖИМОВ ---
    appMode: 'normal', // 'normal' | 'abiturient'
    isAbiturientModalOpen: false,

    // --- СОСТОЯНИЯ ДЛЯ НОВЫХ ФИЧ ---
    isRouteInstructionsVisible: false,
    routeInstructions: [],
    currentInstructionIndex: 0,
    calculatedPath: null,
    specialSearch: null,
    highlightedObjectIds: [],

    // --- ACTIONS ---

    setAppMode: (mode) => set({
        appMode: mode,
        // Сбрасываем все состояния при смене режима
        fromRoom: null,
        toRoom: null,
        calculatedPath: null,
        buildRouteTrigger: null,
        specialSearch: null,
        highlightedObjectIds: [],
        isAbiturientModalOpen: false,
    }),

    setFaculties: (faculties) => set({ faculties }),
    setIsAbiturientModalOpen: (isOpen) => set({ isAbiturientModalOpen: isOpen }),

    // Базовые
    setFromRoom: (room) => set({ fromRoom: room }),
    setToRoom: (room) => set({ toRoom: room }),
    setRooms: (rooms) => set({ rooms }),
    setActiveMenu: (menu) => set({ activeMenu: menu }),
    setSelectedSearchRoom: (room) => set({ selectedSearchRoom: room }),
    setCurrentMapFloor: (floorIndex) => set({ currentMapFloor: floorIndex }),
    setGraphData: (graph, nodeCoords) => set({ graphData: { graph, nodeCoords } }),
    setPendingFromRoomId: (roomId) => set({ pendingFromRoomId: roomId }),

    // Модальные окна
    setIsBuildingModalOpen: (isOpen) => set({ isBuildingModalOpen: isOpen }),
    setIsFeedbackFormOpen: (isOpen) => set({ isFeedbackFormOpen: isOpen }),

    // Управление маршрутом
    triggerRouteBuild: () => {
        if (get().fromRoom && get().toRoom) {
            set({ buildRouteTrigger: Date.now() });
        }
    },
    setCalculatedPath: (path) => set({ calculatedPath: path }),


    // Инструкции
    setIsRouteInstructionsVisible: (isVisible) => set({isRouteInstructionsVisible: isVisible}),
    setRouteInstructions: (instructions) => set({
        routeInstructions: instructions,
        currentInstructionIndex: 0,
        isRouteInstructionsVisible: !!(instructions && instructions.length > 0),
    }),

    goToNextInstruction: () => set(state => {
        const nextIndex = state.currentInstructionIndex + 1;
        if (nextIndex >= state.routeInstructions.length) return {};

        const nextInstruction = state.routeInstructions[nextIndex];
        const { nodeCoords } = state.graphData;
        const targetNodeInfo = nodeCoords.get(nextInstruction.nodeId);

        const newState = { currentInstructionIndex: nextIndex };

        if (targetNodeInfo) {
            // Центрируемся на конкретном узле (лестнице) следующего шага
            newState.selectedSearchRoom = {
                id: nextInstruction.nodeId,
                x: targetNodeInfo.x,
                y: targetNodeInfo.y,
                floorIndex: targetNodeInfo.floorIndex,
            };
            // И переключаем этаж, если он отличается
            if (targetNodeInfo.floorIndex !== state.currentMapFloor) {
                newState.currentMapFloor = targetNodeInfo.floorIndex;
            }
        }

        return newState;
    }),

    goToPreviousInstruction: () => set(state => {
        const prevIndex = state.currentInstructionIndex - 1;
        if (prevIndex < 0) return {};

        const newState = { currentInstructionIndex: prevIndex };
        const { fromRoom, routeInstructions, graphData } = state;
        const { nodeCoords } = graphData;

        // Если мы вернулись к самому первому шагу, центрируемся на fromRoom
        if (prevIndex === 0) {
            if (fromRoom) {
                newState.selectedSearchRoom = fromRoom;
                if (fromRoom.floorIndex !== state.currentMapFloor) {
                    newState.currentMapFloor = fromRoom.floorIndex;
                }
            }
        } else {
            // Для любого другого шага центрируемся на узле, к которому относится этот шаг
            const prevInstruction = routeInstructions[prevIndex];
            const targetNodeInfo = nodeCoords.get(prevInstruction.nodeId);

            if (targetNodeInfo) {
                newState.selectedSearchRoom = {
                    id: prevInstruction.nodeId,
                    x: targetNodeInfo.x,
                    y: targetNodeInfo.y,
                    floorIndex: targetNodeInfo.floorIndex,
                };
                if (targetNodeInfo.floorIndex !== state.currentMapFloor) {
                    newState.currentMapFloor = targetNodeInfo.floorIndex;
                }
            }
        }

        return newState;
    }),

    clearRouteAndInstructions: () => set({
        buildRouteTrigger: null,
        isRouteInstructionsVisible: false,
        routeInstructions: [],
        calculatedPath: null,
        fromRoom: null,
        toRoom: null,
    }),

    // Поиск ближайшего
    initiateSpecialSearch: (config) => set({
        fromRoom: null, toRoom: null, calculatedPath: null,
        specialSearch: {
            status: config.isFilterable ? 'pending_filters' : 'pending_start_point',
            config: config, activeFilterId: null, candidates: [], selectedIndex: 0,
        },
        highlightedObjectIds: [], activeMenu: null,
    }),
    setSpecialSearchFilter: (filterId) => set(state => {
        if (!state.specialSearch) return {};
        const newFilterId = state.specialSearch.activeFilterId === filterId ? null : filterId;
        return {specialSearch: {...state.specialSearch, activeFilterId: newFilterId}};
    }),
    setSpecialSearchCandidates: (candidates) => set(state => {
        if (!state.specialSearch) return {};
        return {specialSearch: {...state.specialSearch, status: 'selection', candidates, selectedIndex: 0}};
    }),
    setSpecialSearchStatus: (status) => set(state => {
        if (!state.specialSearch) return {};
        return {specialSearch: {...state.specialSearch, status}};
    }),
    setSpecialSearchIndex: (index) => set(state => {
        if (!state.specialSearch) return {};
        return {specialSearch: {...state.specialSearch, selectedIndex: index}};
    }),
    clearSpecialSearch: () => set({specialSearch: null}),
    setHighlightedObjectIds: (ids) => set({highlightedObjectIds: ids, activeMenu: null}),
    resetStartPointSelection: () => set(state => {
        if (!state.specialSearch) return {};
        return {
            fromRoom: null,
            specialSearch: {
                ...state.specialSearch,
                status: state.specialSearch.config.isFilterable ? 'pending_filters' : 'pending_start_point',
                candidates: [],
            }
        };
    }),

    calculateNearestObjects: async () => {
        const {fromRoom, specialSearch, rooms, graphData} = get();
        const {graph, nodeCoords} = graphData;
        if (!fromRoom || !specialSearch || !graph || !nodeCoords) return;

        const calculationContext = {
            fromId: fromRoom.id,
            filterId: specialSearch.activeFilterId,
        };
        get().setSpecialSearchStatus('calculating');
        await new Promise(resolve => setTimeout(resolve, 20));

        const getGraphNodeIdForCalc = (item) => {
            if (!item?.id || !nodeCoords) return null;

            // Порядок важен: сначала ищем специальную дверь (_door), потом сам объект как иконку.
            const possibleNodeIds = [
                `icon-${item.id}_door`,
                `icon-${item.id}`,      // Для простых иконок (выходы, фонтанчики)
                `${item.id}_door`,     // если у объекта нет префикса icon-
                item.id                // если id объекта и есть id узла
            ];

            for (const nodeId of possibleNodeIds) {
                if (nodeCoords.has(nodeId)) {
                    return nodeId;
                }
            }

            // Запасной вариант да
            const prefix = `icon-${item.id}`;
            const candidates = Array.from(nodeCoords.keys()).filter(key => key.startsWith(prefix));
            if (candidates.length > 0) {
                return candidates[0];
            }

            console.warn(`[calculateNearestObjects] Узел для объекта "${item.name || item.id}" не найден.`);
            return null;
        };

        const startNodeId = getGraphNodeIdForCalc(fromRoom);
        if (!startNodeId) {
            console.error("Стартовый узел не найден в графе:", fromRoom);
            get().setSpecialSearchCandidates([]);
            return;
        }

        const {distances} = findAllDistances(graph, startNodeId);
        if (!distances) {
            get().setSpecialSearchCandidates([]);
            return;
        }

        const {config, activeFilterId} = specialSearch;

        let potentialCandidates = rooms.filter(r => {
            const name = r.name?.toLowerCase() || '';
            const description = r.description?.toLowerCase() || '';
            const id = r.id?.toLowerCase() || '';

            // Ищем точное совпадение категории в одном из полей
            return name.includes(config.targetCategory) ||
                description.includes(config.targetCategory) ||
                id.includes(config.targetCategory);
        });

        if (activeFilterId && config.isFilterable) {
            const filterConfig = config.filterProperties.find(f => f.id === activeFilterId);
            if (filterConfig && filterConfig.searchKeyword) {
                const keyword = filterConfig.searchKeyword.toLowerCase();
                potentialCandidates = potentialCandidates.filter(room => {
                    const name = room.name?.toLowerCase() || '';
                    const description = room.description?.toLowerCase() || '';
                    return name.includes(keyword) || description.includes(keyword);
                });
            }
        }

        const results = potentialCandidates.map(room => {
            const endNodeId = getGraphNodeIdForCalc(room);
            const distance = endNodeId ? distances.get(endNodeId) : Infinity;
            return (distance !== Infinity && distance > 0) ? {room, distance} : null;
        }).filter(Boolean).sort((a, b) => a.distance - b.distance);

        const currentState = get();
        if (
            currentState.specialSearch &&
            currentState.fromRoom?.id === calculationContext.fromId &&
            currentState.specialSearch.activeFilterId === calculationContext.filterId
        ) {
            get().setSpecialSearchCandidates(results);
        }
    },
}));

export default useStore;