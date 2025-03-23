import {Circle, Layer, Line, Path, Rect, Stage, Text} from "react-konva";
import React from "react";
import {useEffect, useMemo, useRef, useState} from "react";

function BuildingMap() {
  const [stageScale, setStageScale] = useState(0.3);
  const [stageX, setStageX] = useState(350);
  const [stageY, setStageY] = useState(0);

  const [isZooming, setIsZooming] = useState(false);
  const [curLayer, setCurLayer] = useState(4)

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
      setIsZooming(true);

      const p1 = {
        x: touch1.clientX,
        y: touch1.clientY,
      };
      const p2 = {
        x: touch2.clientX,
        y: touch2.clientY,
      };

      if (!lastCenterRef.current) {
        lastCenterRef.current = getCenter(p1, p2);
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

      const pointTo = {
        x: (newCenter.x - stage.x()) / stage.scaleX(),
        y: (newCenter.y - stage.y()) / stage.scaleX(),
      };

      const scale = stage.scaleX() * (dist / lastDistRef.current);

      stage.scaleX(scale);
      stage.scaleY(scale);

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
      e.evt.deltaY > 0
        ? oldScale < 0.2
          ? oldScale
          : oldScale / scaleBy
        : oldScale > 3
          ? oldScale
          : oldScale * scaleBy;

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

  useEffect(() => {
    fetch("https://staticstorm.ru/map/map_data2").then((response) => {
        response.json().then(
          (response) => {
            setLayers(response.layers)
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
  };


  const [selectedRoom, setSelectedRoom] = useState("")

  const stageRef = useRef(null)



  const handleRoomSelect = (data) => {
    setSelectedRoom(data)
  }

  const renderedWalls = useMemo(() =>
    (layers[curLayer]?.walls.map(wall => (
      <Path
        data={wall.data}
        stroke={"black"}
      />
    ))),
  )

  const renderedIcons = useMemo(() => (
    layers[curLayer]?.vectors.map((vector) => (
      <Path
        data={vector.data}
        stroke={"black"}
        strokeWidth={1}
      />
    ))
  ))


  const renderedRooms = useMemo(() => (
    layers[curLayer]?.rooms.map(room => {
      if (room.x === undefined) {
        return (

          <Path
            key={room.id}
            id={room.id}
            data={room.data}
            stroke={"black"}
            strokeWidth={1}
          />

        )
      }
      return (
        <React.Fragment key={room.id}>
          <Rect
            id={room.id}
            x={room.x}
            y={room.y}
            width={room.width}
            height={room.height}
            stroke="black"
            strokeWidth={1}
            onClick={() => {}}
            onTouchStart={() => alert(room.id)}
          />
          <Text
            x={room.x + room.width / 2}
            y={room.y + room.height / 2}
            offsetX={room.width / 4}
            offsetY={7}
            text={room.id}
            fontSize={14}
            fill="black"
          />
        </React.Fragment>
      );
    })

  ), [curLayer, layers]);


  if (loading) {
    return <div>Loading...</div>;
  }


  const floorSwitchHandler = () => {
    if (curLayer === 4) {
      setCurLayer(0)
    } else {
      setCurLayer(curLayer + 1);
    }
  }


  return (
    <>
      <div>selected room: {selectedRoom}</div>
      <button onClick={floorSwitchHandler}>change layer</button>
      <Stage height={window.innerHeight}
             width={window.innerWidth}
             ref={stageRef}
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
          {renderedWalls}
          {renderedRooms}
          {renderedIcons}
        </Layer>
      </Stage>
    </>
  );

}

export default BuildingMap;