import {create} from 'zustand';

export const availableBuildings = [
    { id: 'building1', name: 'Корпус 1' },
    { id: 'building2', name: 'Корпус 2' },
    { id: 'building3', name: 'Корпус 3' },
];

const useStore = create((set, get) => ({
    fromRoom: null,
    toRoom: null,
    rooms: [ ],
    activeMenu: null,
    selectedSearchRoom: null, // Будем использовать для центрирования
    buildRouteTrigger: null,

    isRouteInstructionsVisible: false,
    routeInstructions: [],
    currentInstructionIndex: 0,


    // Actions
    setFromRoom: (room) => set({
        fromRoom: room,
        buildRouteTrigger: null,
        isRouteInstructionsVisible: false,
        routeInstructions: [],
        currentInstructionIndex: 0,
    }),
    setToRoom: (room) => set({
        toRoom: room,
        buildRouteTrigger: null,
        isRouteInstructionsVisible: false,
        routeInstructions: [],
        currentInstructionIndex: 0,
    }),
    setRooms: (rooms) => set({rooms}),
    setActiveMenu: (menu) => set({activeMenu: menu}),
    setSelectedSearchRoom: (room) => set({selectedSearchRoom: room}),
    setIsBuildingModalOpen: (isOpen) => set({ isBuildingModalOpen: isOpen }),
    setSelectedBuilding: (building) => set({
        selectedBuilding: building,
        // Сброс маршрута при смене корпуса
        fromRoom: null,
        toRoom: null,
        buildRouteTrigger: null,
        isRouteInstructionsVisible: false,
        routeInstructions: [],
        currentInstructionIndex: 0,
    }),
    triggerRouteBuild: () => set({
        buildRouteTrigger: Date.now(),
        isRouteInstructionsVisible: false, // Скрыть старые инструкции перед построением
        routeInstructions: [],
        currentInstructionIndex: 0
    }),

    // Actions для инструкций
    setIsRouteInstructionsVisible: (isVisible) => set({ isRouteInstructionsVisible: isVisible }),
    setRouteInstructions: (instructions) => set({
        routeInstructions: instructions,
        currentInstructionIndex: 0, // Всегда начинаем с первого шага
        isRouteInstructionsVisible: instructions && instructions.length > 0, // Показываем, только если есть шаги
    }),
    setCurrentInstructionIndex: (index) => set({ currentInstructionIndex: index }),
    goToNextInstruction: () => set((state) => {
        const nextIndex = state.currentInstructionIndex + 1;
        if (nextIndex < state.routeInstructions.length) {
            return { currentInstructionIndex: nextIndex };
        }
        return {}; // Не меняем состояние, если это последний шаг
    }),
    goToPreviousInstruction: () => set((state) => {
        const prevIndex = state.currentInstructionIndex - 1;
        if (prevIndex >= 0) {
            return { currentInstructionIndex: prevIndex };
        }
        return {}; // Не меняем состояние, если это первый шаг
    }),

    // Очистка маршрута и инструкций
    clearRouteAndInstructions: () => set({
        buildRouteTrigger: null,
        isRouteInstructionsVisible: false,
        routeInstructions: [],
        currentInstructionIndex: 0,
        fromRoom: null,
        toRoom: null,
    }),

    isBuildingModalOpen: false,
    selectedBuilding: availableBuildings[0],
}));

export default useStore;