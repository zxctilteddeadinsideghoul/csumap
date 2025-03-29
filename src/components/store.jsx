import {create} from 'zustand';

const useStore = create((set) => ({
    fromRoom: null,
    toRoom: null,
    rooms: [],
    activeMenu: null,
    setFromRoom: (room) => set({fromRoom: room}),
    setToRoom: (room) => set({toRoom: room}),
    setRooms: (rooms) => set({rooms}),
    setActiveMenu: (menu) => set({activeMenu: menu}),
}));

export default useStore;