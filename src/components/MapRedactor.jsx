import React, {useEffect, useMemo, useRef, useState} from "react";
import {Layer, Path, Rect, Stage, Text} from "react-konva";


function MapRedactor() {
  const stageRef = useRef(null)
  const [stageScale, setStageScale] = useState(0.3);
  const [stageX, setStageX] = useState(350);
  const [stageY, setStageY] = useState(0);

  const [data, setData] = useState({});

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

  const handleSave = () => {
    const paths = stageRef.current.find("Path");
    const rects = stageRef.current.find("Rect");

    const groups = {
      vectors: [],
      rooms: [],
      walls: [],
      roads: [],
      others: []
    };
    paths.forEach(path => {
      if (path.attrs.type === "icon") {
        groups.vectors.push({...path.attrs})
      }
      if (path.attrs.type === "walls") {
        groups.walls.push({...path.attrs})
      }
      if (path.attrs.type === "vectorized_room") {
        groups.rooms.push({...path.attrs})
      }
    });

    rects.forEach(rect => {
      if (rect.attrs.type === "room") {
        groups.rooms.push({
          ...rect.attrs,
          type: "room",
          name: rect.attrs.id,
          description: "",
          workingTime: ""
        });
      } else {
        groups.vectors.push({
          ...rect.attrs,
        });
      }
    });
    setLayers([groups,groups,groups,groups,groups]);
  };

  const sendData = async () => {
    const payload = {
      layer: curLayer,
      content: data,
    };

    try {
      const response = await fetch("https://staticstorm.ru/map/save", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();
      console.log(result);
    } catch (error) {
      console.error("Error:", error);
    }
  };

  const [curLayer, setCurLayer] = useState(0);


  const [layers, setLayers] = useState({});
  const [loading, setLoading] = useState(true);


  useEffect(() => {
    fetch("http://127.0.0.1:5000/map_data").then((response) => {
        response.json().then(
          (response) => {
            setLayers(response.layers)
            setLoading(false)
          }
        )
      }
    );
  }, []);

  const renderedWalls = useMemo(() =>
    (layers[curLayer]?.walls.map(wall => (
      <Path
        type={wall.type}
        key={wall.data}
        fill={"#E8E8E8"}
        x={wall.x}
        y={wall.y}
        data={wall.data}
        stroke={"black"}
      />
    ))),
  )

  const renderedIcons = useMemo(() => (
    layers[curLayer]?.vectors.map((vector) => (
      <Path
        type={vector.type}
        data={vector.data}
        stroke={"red"}
        strokeWidth={1}
        x={vector.x}
        y={vector.y}
      />
    ))
  ))

  const renderedRooms = useMemo(() => (
    layers[curLayer]?.rooms.map(room => {
      if (room.type === "vectorized_room") {
        return (

          <Path
            type={room.type}
            key={room.id}
            x={room.x || null}
            y={room.y || null}
            id={room.id}
            data={room.data}
            stroke={"black"}
            fill={"#D5D5D5"}
            strokeWidth={1}
            name={room.name}
            description={room.description}
            workingtime={room.workingtime}
            onClick={(e) => {console.log(e.target.attrs)}}
            onTap={(e) => {}}
          />

        )
      }
      return (
        <React.Fragment key={room.id}>
          <Rect
            type={room.type}
            id={room.id}
            x={room.x}
            y={room.y}
            width={room.width}
            height={room.height}
            stroke="black"
            fill={"#D5D5D5"}
            strokeWidth={1}
            name={room.name}
            description={room.description}
            workingtime={room.workingTime}
            onClick={(e) => {e.target.attrs.fill = "red"}}
            onTap={(e) => {}}
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

  return (
    <>
      <button onClick={() => layers[0].rooms.forEach((room) => console.log(room.x))}>
        print
      </button>
      <button onClick={handleSave}>
        save
      </button>
      <button onClick={()=>console.log(data)}>
        send
      </button>
      <button onClick={() => {setCurLayer(curLayer+1)}}>changeLayer</button>
      <Stage height={window.innerHeight}
             width={window.innerWidth}
             ref={stageRef} //(el) => {stageRef.current[curLayer] = el}
             onWheel={handleWheel}
             scaleX={stageScale}
             scaleY={stageScale}
             x={stageX}
             y={stageY}
             draggable>
        <Layer>
          {renderedWalls}
          {renderedRooms}
          {renderedIcons}
        </Layer>
      </Stage>
    </>
  );
}

export default MapRedactor;