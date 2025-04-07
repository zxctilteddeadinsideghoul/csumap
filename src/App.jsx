import {useState} from 'react';
import './App.css';
import BuildingMap from "./components/BuildingMap.jsx";
import BottomMenu from "./components/BottomMenu.jsx";
import useStore from './components/store.jsx';
import Header from './components/Header.jsx';
import RouteInstructionsModal from './components/RouteInstructionsModal.jsx';

function App() {
    const {activeMenu, setActiveMenu} = useStore();

    return (
        <>
            <Header/>
            {/* Передаем mapDataPath в BuildingMap, если он динамический */}
            <BuildingMap isMapActive={!activeMenu} />
            <BottomMenu/>
            <RouteInstructionsModal />
        </>
    );
}

export default App;