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
      const id = path.attrs.id?.trim() || "undefined";

      if (
        /^(Vector|vector)(\s\d+|_\d+(_\d+)?)?$/.test(id) ||
        /^t\d+_[wm]\d+_\d+$/.test(id) ||
        /^t\d+_w\d+$/.test(id) ||
        /^t\d+_m\d+$/.test(id) ||
        /^museum_\d+$/.test(id) ||
        /^cash_\d+$/.test(id)
      ) {
        groups.vectors.push(path.attrs); // Используем только attrs
      } else if (
        /^(rt\d+_m\d+_\d+|t\d+_m\d+_\d+|[ar]_[a-z\d]+|r\d+[a-z\d]*|rt\d+_[wm]\d+|t\d+_w\d+_\d+)$/.test(id)
      ) {
        groups.rooms.push({
          ...path.attrs,
          name: id,
          description: "",
          workingtime: ""
        });
      } else if (/^(a_walls\d+|grates\d*|undefined|walls\d+)$/.test(id)) {
        groups.walls.push(path.attrs);
      } else if (/^inside_roads\d*$/.test(id)) {
        groups.roads.push(path.attrs);
      } else {
        groups.others.push(path.attrs);
      }
    });

    rects.forEach((rect) => {
      if (rect.attrs.id) {
        groups.rooms.push({
          ...rect.attrs,
          name: rect.attrs.id,
          description: "",
          workingTime: ""
        });
      } else {
        groups.vectors.push(rect.attrs);
      }
    });

    setData(groups);
  };

  const sendData = async () => {
    const payload = {
      layer: curLayer,
      content: data,
    };

    try {
      const response = await fetch("http://localhost:5000/save", {
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
  const containerRef = useRef(null);

  const [layers, setLayers] = useState({});
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
        stroke={"gray"}
        strokeWidth={1}
        draggable
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

  return (
    <>
      <button onClick={() => layers[0].rooms.forEach((room) => console.log(room.x))}>
        print
      </button>
      <button onClick={() => {}}></button>
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