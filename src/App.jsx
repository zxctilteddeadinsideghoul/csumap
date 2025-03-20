import { useState } from 'react';
import './App.css';
import BuildingMap from "./components/BuildingMap.jsx";
import BottomMenu from "./components/BottomMenu.jsx";

function App() {
    const [activeMenu, setActiveMenu] = useState(null); // null, 'route', или 'settings'

    return (
        <>
            <BuildingMap isMapActive={!activeMenu} />
            <BottomMenu
                activeMenu={activeMenu}
                setActiveMenu={setActiveMenu}
            />
        </>
    );
}

export default App;