import {Layer, Path, Rect, Stage, Text} from "react-konva";
import {use, useEffect, useMemo, useRef, useState} from "react";
import RoomInfoModal from "./RoomInfoModal.jsx";

function BuildingMap() {
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
        response.json().then(
          (response) => {
            setLayers([...response.buildings])
            setLoading(false)
          }
        )
      }
    );
  }, []);
  const handleDragStart = (e) => {
    const stage = e.target.getStage();

    if (isZooming) {
      stage.stopDrag();
    }

    console.log(stage.isDragging());
  };

  //темка для модалки
  const handleRoomClick = (room) => {
    setSelectedRoom(room);
  };

  const handleTouchRoom = (e, room) => {
    e.evt.preventDefault(); // Предотвращаем стандартное поведение на мобильных устройствах
    handleRoomClick(room);
  };

  const handleLayerChange = (event) => {
    setCurLayer(parseInt(event.target.value, 10)); // Обновляем текущий этаж
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
      <div>
        <label htmlFor="layer-select">Выберите этаж: </label>
        <select
            id="layer-select"
            value={curLayer}
            onChange={handleLayerChange} // Обработчик изменения этажа
        >
          <option value="4">0 этаж</option>
          <option value="0" selected="selected">1 этаж</option>
          <option value="1">2 этаж</option>
          <option value="2">3 этаж</option>
          <option value="3">4 этаж</option>
        </select>
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