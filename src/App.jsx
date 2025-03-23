import { useState } from 'react'
import './App.css'
import BuildingMap from "./components/BuildingMap.jsx";
import MapRedactor from "./components/MapRedactor.jsx";

function App() {

  const [isOnMap, setIsOnMap] = useState(true);

  return (
    <>
      <button onClick={() => {setIsOnMap(!isOnMap)}}>change</button>
      {isOnMap ? <BuildingMap/> : <MapRedactor/>}

    </>
  );
}

export default App
