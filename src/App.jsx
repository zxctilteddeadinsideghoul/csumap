// src/App.jsx
import React, { useEffect } from 'react';
import './App.css';
import BuildingMap from "./components/BuildingMap.jsx";
import BottomMenu from "./components/BottomMenu.jsx";
import useStore from './components/store.jsx';
import Header from './components/Header.jsx';
import RouteInstructionsModal from './components/RouteInstructionsModal.jsx';
import SpecialSearchUI from './components/SpecialSearchUI.jsx';
import HighlightOverlay from './components/HighlightOverlay.jsx';
import AbiturientSelectionModal from "./components/AbiturientSelectionModal.jsx";

function App() {
    // Получаем actions и данные из стора
    const activeMenu = useStore(state => state.activeMenu);
    const rooms = useStore(state => state.rooms);
    const appMode = useStore(state => state.appMode);
    const pendingFromRoomId = useStore(state => state.pendingFromRoomId);
    const {
        setAppMode,
        setPendingFromRoomId,
        setFromRoom,
        setSelectedSearchRoom,
        setIsAbiturientModalOpen,
        setActiveMenu
    } = useStore.getState();

    // Этот useEffect остается без изменений. Он только считывает URL.
    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const mode = urlParams.get('mode');
        setAppMode(mode === 'abiturient' ? 'abiturient' : 'normal');

        const fromRoomId = urlParams.get('fromRoomId');
        if (fromRoomId) {
            console.log(`[App] Found fromRoomId in URL: ${fromRoomId}`);
            setPendingFromRoomId(fromRoomId);
            const newUrl = `${window.location.pathname}${mode ? `?mode=${mode}` : ''}`;
            window.history.replaceState({}, document.title, newUrl);
            console.log('[App] Cleaned fromRoomId parameter.');
        }
    }, [setAppMode, setPendingFromRoomId]);

    // --- НОВЫЙ useEffect ДЛЯ ОБРАБОТКИ QR-кода ---
    // Этот эффект срабатывает, когда `pendingFromRoomId` установлен и `rooms` загружены
    useEffect(() => {
        // Условие: есть ID из QR и список комнат уже не пустой
        if (pendingFromRoomId && rooms.length > 0) {
            const foundRoom = rooms.find(r => r.id === pendingFromRoomId);

            if (foundRoom) {
                console.log('[App] Processing pending room:', foundRoom.name);

                // 1. Устанавливаем комнату "Откуда"
                setFromRoom(foundRoom);
                // 2. Устанавливаем комнату для центрирования карты
                setSelectedSearchRoom(foundRoom);

                // 3. В зависимости от режима, открываем модалку или меню маршрута
                if (appMode === 'abiturient') {
                    setIsAbiturientModalOpen(true);
                } else {
                    setActiveMenu('route');
                }
            } else {
                console.warn(`[App] Pending room ID ${pendingFromRoomId} not found.`);
            }

            // 4. Важно: сбрасываем pending ID, чтобы этот эффект не сработал снова
            setPendingFromRoomId(null);
        }
    }, [
        pendingFromRoomId,
        rooms,
        appMode,
        setFromRoom,
        setSelectedSearchRoom,
        setIsAbiturientModalOpen,
        setActiveMenu,
        setPendingFromRoomId
    ]);
    // ---------------------------------------------

    // Этот useEffect тоже без изменений
    const currentRouteNodeId = useStore(state => state.currentRouteNodeId);
    const graphData = useStore(state => state.graphData);
    useEffect(() => {
        if (currentRouteNodeId && graphData.nodeCoords) {
            const nodeInfo = graphData.nodeCoords.get(currentRouteNodeId);
            if (nodeInfo) {
                useStore.getState().setSelectedSearchRoom({
                    ...nodeInfo,
                    id: currentRouteNodeId,
                });
            }
        }
    }, [currentRouteNodeId, graphData.nodeCoords]);

    return (
        <>
            <Header />
            <BuildingMap isMapActive={!activeMenu} />
            <BottomMenu />
            <RouteInstructionsModal />
            <HighlightOverlay />
            <SpecialSearchUI />
            <AbiturientSelectionModal />
        </>
    );
}

export default App;