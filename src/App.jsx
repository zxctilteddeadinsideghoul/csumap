import {useState} from 'react';
import './App.css';
import BuildingMap from "./components/BuildingMap.jsx";
import BottomMenu from "./components/BottomMenu.jsx";
import useStore from './components/store.jsx';
import Header from './components/Header.jsx';

function App() {
    const {activeMenu, setActiveMenu} = useStore();
    const {fromRoom, toRoom} = useStore();

    return (
        <>
            <Header/>
            <BuildingMap isMapActive={!activeMenu}/>
            <BottomMenu
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
            />
        </>
    );
}

export default App;