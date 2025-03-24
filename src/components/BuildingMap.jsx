import {Layer, Path, Rect, Stage, Text} from "react-konva";
import {useEffect, useMemo, useRef, useState} from "react";
import RoomInfoModal from "./RoomInfoModal.jsx";
import '../BuildingMap.css'
import useStore from './store.jsx';


function BuildingMap({ isMapActive }) {
  const [stageScale, setStageScale] = useState(0.5);
  const [stageX, setStageX] = useState(0);
  const [stageY, setStageY] = useState(0);

  const [isZooming, setIsZooming] = useState(false);
  const [coords, setCoords] = useState({})
  const [curLayer, setCurLayer] = useState(0)

  function getCenter(p1, p2) {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
    };
  }

  const lastCenterRef = useRef(null);
  const lastDistRef = useRef(0);

  const handleMultiTouch = (e) => {
    if (!isMapActive) return;
    e.evt.preventDefault();

    var touch1 = e.evt.touches[0];
    var touch2 = e.evt.touches[1];
    const stage = e.target.getStage();

    if (touch1 && touch2) {
        stage.stopDrag();
      setIsZooming(true);

      const p1 = {
        x: touch1.clientX,
        y: touch1.clientY,
      };
      const p2 = {
        x: touch2.clientX,
        y: touch2.clientY,
      };

        if (!lastCenterRef.current || !lastDistRef.current) {
            lastCenterRef.current = getCenter(p1, p2);
            lastDistRef.current = getDistance(p1, p2);
            return;
        }
      const newCenter = getCenter(p1, p2);

      function getDistance(p1, p2) {
        return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
      }

      const dist = getDistance(p1, p2);

      if (!lastDistRef.current) {
        lastDistRef.current = dist;
      }

      // local coordinates of center point
      var pointTo = {
        x: (newCenter.x - stage.x()) / stage.scaleX(),
        y: (newCenter.y - stage.y()) / stage.scaleX(),
      };

      var scale = stage.scaleX() * (dist / lastDistRef.current);

      stage.scaleX(scale);
      stage.scaleY(scale);

      // calculate new position of the stage
      const dx = newCenter.x - lastCenterRef.current.x;
      const dy = newCenter.y - lastCenterRef.current.y;

      const newPos = {
        x: newCenter.x - pointTo.x * scale + dx,
        y: newCenter.y - pointTo.y * scale + dy,
      };

      stage.position(newPos);
      stage.batchDraw();

      lastDistRef.current = dist;
      lastCenterRef.current = newCenter;
    }
  };

  const multiTouchEnd = () => {
    lastCenterRef.current = null;
    lastDistRef.current = 0;
    setIsZooming(false);
  };

  const handleWheel = (e) => {
    if (!isMapActive) return;
    e.evt.preventDefault();

    const scaleBy = 1.2;
    const stage = e.target.getStage();
    const oldScale = stage.scaleX();
    const mousePointTo = {
      x: stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
      y: stage.getPointerPosition().y / oldScale - stage.y() / oldScale,
    };

    const newScale =
      e.evt.deltaY < 0
        ? oldScale > 3
          ? oldScale
          : oldScale * scaleBy
        : oldScale < 0.2
          ? oldScale
          : oldScale / scaleBy;

    setStageScale(newScale);
    setStageX(
      -(mousePointTo.x - stage.getPointerPosition().x / newScale) * newScale
    );
    setStageY(
      -(mousePointTo.y - stage.getPointerPosition().y / newScale) * newScale
    );
  };

  const [layers, setLayers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedRoom, setSelectedRoom] = useState(null);


  useEffect(() => {
    fetch("https://staticstorm.ru/map/map_data").then((response) => {
      response.json().then((response) => {
        setLayers([...response.buildings]);
        setLoading(false);

        // Сохраняем все кабинеты в глобальное состояние
        const allRooms = response.buildings.flatMap(building =>
            building.floors.flatMap(floor => floor.rooms)
        );
        useStore.getState().setRooms(allRooms);
      });
    });
  }, []);

  const handleDragStart = (e) => {
    if (!isMapActive) return;
    const stage = e.target.getStage();

    if (isZooming) {
      stage.stopDrag();
    }

    console.log(stage.isDragging());
  };

  //темка для модалки
  const handleRoomClick = (room) => {
    if (!isMapActive) return;
    setSelectedRoom(room);
  };

  const handleTouchRoom = (e, room) => {
    if (!isMapActive) return;
    e.evt.preventDefault(); // Предотвращаем стандартное поведение на мобильных устройствах
    handleRoomClick(room);
  };

  const handleLayerChange = (layerIndex) => {
    if (!isMapActive) return;
    setCurLayer(layerIndex);
  };

  const renderedLayers = useMemo(() => (
    layers[curLayer]?.floors.map(floor => (
      floor.rooms.map(room => (
        <Rect key={room.id}
              x={room.x}
              y={room.y}
              fill="white"
              width={room.width}
              height={room.height}
              stroke="black"
              strokeWidth={1}
              onClick={() => handleRoomClick(room)}
              onTap={(e) => handleTouchRoom(e, room)}
        />
      ))
    ))
  ), [curLayer, layers]);


  if (loading) {
    return <div>Loading...</div>;
  }
  

  return (
    <>
      <div className="floor-buttons">
        {[4, 0, 1, 2, 3].map((layerIndex) => (
            <button
                key={layerIndex}
                className={`floor-button ${curLayer === layerIndex ? 'active' : ''}`}
                onClick={() => handleLayerChange(layerIndex)}
            >
              {layerIndex === 4 ? '0' : `${layerIndex + 1}`}
            </button>
        ))}
      </div>
      <Stage height={window.innerHeight}
             width={window.innerWidth}
             onWheel={handleWheel}
             onTouchMove={handleMultiTouch}
             onTouchEnd={multiTouchEnd}
             onDragStart={handleDragStart}
             scaleX={stageScale}
             scaleY={stageScale}
             x={stageX}
             y={stageY}
             draggable
      >
        <Layer>
          {renderedLayers}
        </Layer>
      </Stage>
      <RoomInfoModal room={selectedRoom} onClose={() => setSelectedRoom(null)} />
    </>
  );

}

export default BuildingMap;