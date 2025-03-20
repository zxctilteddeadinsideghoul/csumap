import { create } from 'zustand';

//хранилище для глобального состояния
const useStore = create((set) => ({
    fromRoom: null,
    toRoom: null,
    setFromRoom: (room) => set({ fromRoom: room }),
    setToRoom: (room) => set({ toRoom: room }),
}));

export default useStore;