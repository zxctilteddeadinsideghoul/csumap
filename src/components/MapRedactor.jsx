import React, {use, useEffect, useMemo, useRef, useState} from "react";
import {Layer, Line, Path, Rect, Stage, Text, Transformer} from "react-konva";


function MapRedactor() {
  const stageRef = useRef()
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
    setLayers([groups, groups, groups, groups, groups]);
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

  const [hLines, setHLines] = useState([]);
  const [vLines, setVLines] = useState([]);
  const transformerRef = useRef();

  const getSnapLines = (excludedShape) => {
    const stage = stageRef.current;
    if (!stage) return;

    const vertical = [];
    const horizontal = [];
    stage.find("Rect").filter((node) => node.attrs.type === "room" || node.attrs.type === "vectorized_room").forEach((shape) => {
      if (shape === excludedShape) return;
      const box = shape.getClientRect();
      vertical.push([box.x, box.x + box.width, box.x + box.width / 2]);
      horizontal.push([box.y, box.y + box.height, box.y + box.height / 2]);
    });

    return {
      vertical: vertical.flat(),
      horizontal: horizontal.flat(),
    };
  };

  const getShapeSnappingEdges = () => {
    const stage = stageRef.current;
    const tr = transformerRef.current;
    const box = tr.findOne(".back").getClientRect();
    const absPos = tr.findOne(".back").getClientRect();

    return {
      vertical: [
        {
          guide: box.x,
          offset: absPos.x - box.x,
          snap: "start",
        },
        {
          guide: box.x + box.width / 2,
          offset: absPos.x - box.x - box.width / 2,
          snap: "center",
        },
        {
          guide: box.x + box.width,
          offset: absPos.x - box.x - box.width,
          snap: "end",
        },
      ],
      horizontal: [
        {
          guide: box.y,
          offset: absPos.y - box.y,
          snap: "start",
        },
        {
          guide: box.y + box.height / 2,
          offset: absPos.y - box.y - box.height / 2,
          snap: "center",
        },
        {
          guide: box.y + box.height,
          offset: absPos.y - box.y - box.height,
          snap: "end",
        },
      ],
    };
  };

  const SNAP_THRESHOLD = 15;

  const getClosestSnapLines = (possibleSnapLines, shapeSnappingEdges) => {
    const getAllSnapLines = (direction) => {
      const result = [];
      possibleSnapLines[direction].forEach((snapLine) => {
        shapeSnappingEdges[direction].forEach((snappingEdge) => {
          const diff = Math.abs(snapLine - snappingEdge.guide);
          if (diff > SNAP_THRESHOLD) return;
          const {snap, offset} = snappingEdge;
          result.push({snapLine, diff, snap, offset});
        });
      });
      return result;
    };

    const resultV = getAllSnapLines("vertical");
    const resultH = getAllSnapLines("horizontal");
    const closestSnapLines = [];

    const getSnapLine = ({snapLine, offset, snap}, orientation) => {
      return {snapLine, offset, orientation, snap};
    };

    const [minV] = resultV.sort((a, b) => a.diff - b.diff);
    const [minH] = resultH.sort((a, b) => a.diff - b.diff);

    if (minV) closestSnapLines.push(getSnapLine(minV, "V"));
    if (minH) closestSnapLines.push(getSnapLine(minH, "H"));

    return closestSnapLines;
  };

  const drawLines = (lines = []) => {
    if (lines.length > 0) {
      const lineStyle = {
        stroke: "red",
        strokeWidth: 1,
        name: "guid-line",
        visible: false
      };

      const hLines = [];
      const vLines = [];

      lines.forEach((l) => {
        if (l.orientation === "H") {
          const line = {
            points: [-6000, 0, 6000, 0],
            x: 0,
            y: l.snapLine,
            ...lineStyle,
          };
          hLines.push(line);
        } else if (l.orientation === "V") {
          const line = {
            points: [0, -6000, 0, 6000],
            x: l.snapLine,
            y: 0,
            ...lineStyle,
          };
          vLines.push(line);
        }
      });

      setHLines(hLines);
      setVLines(vLines);
    }
  };

  const onDragMove = () => {
    const target = transformerRef.current;
    const [selectedNode] = target.getNodes();
    if (!selectedNode) return;

    const possibleSnappingLines = getSnapLines(selectedNode);
    const selectedShapeSnappingEdges = getShapeSnappingEdges();
    const closestSnapLines = getClosestSnapLines(
      possibleSnappingLines,
      selectedShapeSnappingEdges
    );

    if (closestSnapLines.length === 0) {
      setHLines([]);
      setVLines([]);
      return;
    }

    drawLines(closestSnapLines);

    const orgAbsPos = target.absolutePosition();
    const absPos = target.absolutePosition();

    closestSnapLines.forEach((l) => {
      const position = l.snapLine + l.offset;
      if (l.orientation === "V") {
        absPos.x = position;
      } else if (l.orientation === "H") {
        absPos.y = position;
      }
    });

    const vecDiff = {
      x: orgAbsPos.x - absPos.x,
      y: orgAbsPos.y - absPos.y,
    };

    const nodeAbsPos = selectedNode.getAbsolutePosition();
    const newPos = {
      x: nodeAbsPos.x - vecDiff.x,
      y: nodeAbsPos.y - vecDiff.y,
    };

    selectedNode.setAbsolutePosition(newPos);
  };


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
            onClick={(e) => {
              console.log(e.target.attrs)
            }}
            draggable
            onMouseDown={(e) =>
              transformerRef.current.nodes([e.currentTarget])
            }
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
            draggable
            onMouseDown={(e) =>
              transformerRef.current.nodes([e.currentTarget])
            }
            description={room.description}
            workingtime={room.workingTime}
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

  const [coords, setCoords] = useState({"x": 0, "y": 0});
  const [rects, setRects] = useState([])
  const [firstTapCoords, setFirstTapCoords] = useState({});
  const [firstTap, setFirstTap] = useState(true)
  const [isDrawing, setIsDrawing] = useState(false);

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
      <div>x: {coords.x} y: {coords.y}</div>
      <button onClick={() => {
        setCurLayer(curLayer + 1)
      }}>changeLayer
      </button>
      <button onClick={() => {
        setIsDrawing(!isDrawing)
        setFirstTap(true)
      }}>changeDrawing
      </button>
      <Stage height={window.innerHeight}
             width={window.innerWidth}
             ref={stageRef}
             onClick={(e) => {
               e.target === stageRef.current && transformerRef.current.nodes([])
               if (isDrawing) {
                 if (firstTap) {
                   setFirstTapCoords({"x": coords.x, "y": coords.y})
                   setFirstTap(false)
                 } else {
                   setRects([...rects, {
                     "x": firstTapCoords.x,
                     "y": firstTapCoords.y,
                     "width": coords.x - firstTapCoords.x,
                     "height": coords.y - firstTapCoords.y
                   }])
                   setFirstTap(true)
                 }
               }
             }}
             onWheel={handleWheel}
             scaleX={stageScale}
             scaleY={stageScale}
             x={stageX}
             y={stageY}
             draggable={!isDrawing}
             onMouseMove={(e) => {
               const stage = e.target.getStage();
               const oldScale = stage.scaleX();
               setCoords({
                   "x": stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
                   "y": stage.getPointerPosition().y / oldScale - stage.y() / oldScale
                 }
               )
             }}
      >
        <Layer>
          {renderedWalls}
          {renderedRooms}
          {renderedIcons}
          {rects.map((rect, index) => (
            <Rect
              key={index}
              x={rect.x}
              y={rect.y}
              width={rect.width}
              height={rect.height}
              fill={"red"}
              draggable
              onMouseDown={(e) =>
                transformerRef.current.nodes([e.currentTarget])
              }
              type={"room"}
            />
          ))}
          <Transformer ref={transformerRef} onDragMove={onDragMove}/>
          {hLines.map((item, i) => (
            <Line key={`h-${i}`} {...item} />
          ))}
          {vLines.map((item, i) => (
            <Line key={`v-${i}`} {...item} />
          ))}
        </Layer>
      </Stage>
    </>
  );
}

export default MapRedactor;