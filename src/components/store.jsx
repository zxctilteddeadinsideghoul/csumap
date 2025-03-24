import { create } from 'zustand';

const useStore = create((set) => ({
    fromRoom: null,
    toRoom: null,
    rooms: [], // Добавляем список всех кабинетов
    setFromRoom: (room) => set({ fromRoom: room }),
    setToRoom: (room) => set({ toRoom: room }),
    setRooms: (rooms) => set({ rooms }), // Функция для обновления списка кабинетов
}));

export default useStore;