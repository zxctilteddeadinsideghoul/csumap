import React, {useEffect, useMemo, useRef, useState} from "react";
import {Layer, Line, Path, Rect, Stage, Text, Transformer} from "react-konva";
import RoomEditorDialog from "./RoomEditorDialog.jsx";


function MapRedactor() {
    const stageRef = useRef()
    const [stageScale, setStageScale] = useState(0.5);
    const [stageX, setStageX] = useState(250);
    const [stageY, setStageY] = useState(-150);

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
        const roads = stageRef.current.find("Line");

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
                });
            } else {
                groups.vectors.push({
                    ...rect.attrs,
                });
            }
        });

        roads.forEach(road => {
            console.log({...road.attrs})
            const points = road.attrs.points;
            groups.roads.push({...road.attrs, "x1" : points[0], "y1" : points[1], "x2" : points[2], "y2" : points[3]});
        })

        setData({...groups})
    };

    const [curLayer, setCurLayer] = useState(0);

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



    const [layers, setLayers] = useState({});
    const [loading, setLoading] = useState(true);

    const [hLines, setHLines] = useState([]);
    const [vLines, setVLines] = useState([]);
    const transformerRef = useRef();

    const formatToScale = (coordinate, isX) => {
        const stage = stageRef.current.getStage();
        const oldScale = stage.scaleX();

        if (isX) {
            return coordinate / oldScale - stage.x() / oldScale
        } else {
            return coordinate / oldScale - stage.y() / oldScale
        }

    }

    const getSnapLines = (excludedShape) => {
        const stage = stageRef.current;
        if (!stage) return;

        const vertical = [];
        const horizontal = [];
        stage.find("Rect").filter((node) => node.attrs.type === "room" || node.attrs.type === "vectorized_room").forEach((shape) => {
            if (shape === excludedShape) return;
            const box = shape.getClientRect();
            const x = box.x
            const y = box.y
            vertical.push([x, x + box.width, x + box.width / 2]);
            horizontal.push([y, y + box.height, +box.height / 2]);
        });

        return {
            vertical: vertical.flat(),
            horizontal: horizontal.flat(),
        };
    };

    const getShapeSnappingEdges = () => {
        const tr = transformerRef.current;
        const box = tr.findOne(".back").getClientRect();
        const absPos = tr.findOne(".back").getClientRect();
        const boxX = box.x
        const boxY = box.y
        const absPosX = absPos.x
        const absPosY = absPos.y

        return {
            vertical: [
                {
                    guide: boxX,
                    offset: absPosX - boxX,
                    snap: "start",
                },
                {
                    guide: boxX + box.width / 2,
                    offset: absPosX - boxX - box.width / 2,
                    snap: "center",
                },
                {
                    guide: boxX + box.width,
                    offset: absPosX - boxX - box.width,
                    snap: "end",
                },
            ],
            horizontal: [
                {
                    guide: boxY,
                    offset: absPosY - boxY,
                    snap: "start",
                },
                {
                    guide: boxY + box.height / 2,
                    offset: absPosY - boxY - box.height / 2,
                    snap: "center",
                },
                {
                    guide: boxY + box.height,
                    offset: absPosY - boxY - box.height,
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

    const [coords, setCoords] = useState({"x": 0, "y": 0});
    const [mode, setMode] = useState("move");
    const [drawingMode, setDrawingMode] = useState("room")
    const [isDrawing, setIsDrawing] = useState(false);
    const [newRect, setNewRect] = useState(null);


    const handleDrawing = () => {
        setNewRect({x: coords.x, y: coords.y, width: 0, height: 0});
        setIsDrawing(true);
    }

    const handleAddIcon = () =>{
        const newIcon = {
            id: crypto.randomUUID(),
            x: coords.x,
            y: coords.y,
            data: "M10 1H6V6L1 6V10H6V15H10V10H15V6L10 6V1Z",
            stroke: "black",
            fill: "red",
            description: "",
            type: "icon",
        };

        setLayers(prev => ({
            ...prev,
            [curLayer]: {
                ...prev[curLayer],
                vectors: [...prev[curLayer].vectors, newIcon],
            }
        }));
    }

    const handleMouseMove = () => {
        if (!isDrawing || !newRect) return;
        setNewRect((prevRect) => ({
            ...prevRect,
            width: coords.x - prevRect.x,
            height: coords.y - prevRect.y,
        }));
    };

    const addRectangle = (newRect) => {
        const newRoom = {
            id: crypto.randomUUID(),
            x: newRect.x,
            y: newRect.y,
            width: newRect.width,
            height: newRect.height,
            name: "",
            description: "",
            workingtime: "",
            type: "room",
        };

        setLayers(prev => ({
            ...prev,
            [curLayer]: {
                ...prev[curLayer],
                rooms: [...prev[curLayer].rooms, newRoom],
            }
        }));
    };


    const handleMouseUp = () => {
        if (newRect) {
            addRectangle(newRect)
            setNewRect(null);
        }
        setIsDrawing(false);
    };


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

    const [selectedRoom, setSelectedRoom] = useState(null);


    const handleSaveRoom = (updatedItem) => {
        const updatedLayers = {...layers};
        const layer = updatedLayers[curLayer];

        const collection = updatedItem.type === 'icon' ? 'vectors' : 'rooms';
        layer[collection] = layer[collection].map((r) =>
            r.id === updatedItem.id ? {...updatedItem} : r
        );
        setLayers(updatedLayers);
    };

    const handleDeleteRoom = (itemId) => {
        const updatedLayers = {...layers};
        updatedLayers[curLayer].rooms = updatedLayers[curLayer].rooms.filter((r) => r.id !== itemId);
        updatedLayers[curLayer].vectors = updatedLayers[curLayer].vectors.filter((v) => v.id !== itemId);
        setLayers(updatedLayers);
    };

    const renderedWalls = useMemo(() =>
        (layers[curLayer]?.walls.map(wall => (
            <Path
                type={"walls"}
                key={wall.data}
                fill={"#E8E8E8"}
                x={wall.x}
                y={wall.y}
                data={wall.data}
                stroke={"black"}
            />
        ))),
    )

    const renderedIcons = useMemo(() => {
        return layers[curLayer]?.vectors.map((vector) => (
            <Path
                key={vector.id}
                id={vector.id}
                type={vector.type}
                data={vector.data}
                stroke={vector.stroke || 'red'}
                strokeWidth={1}
                disabled
                x={vector.x}
                y={vector.y}
                scaleX={vector.scaleX}
                scaleY={vector.scaleY}
                onClick={() => mode === 'edit' && setSelectedRoom(vector)}
                onMouseDown={(e) => {
                    if (mode === 'move' && transformerRef.current) {
                        transformerRef.current.nodes([e.currentTarget]);
                    }
                }}
                draggable
                description={vector.description}
            />
        ));
    }, [layers, curLayer, mode]);

    const renderedRoads = useMemo(() => {
        const roads = layers[curLayer]?.roads || [];
        return roads.map((road, index) => {
            return (
                <Line
                    key={`road-${curLayer}-${road.id || index}`}
                    id={road.id}
                    points={[road.x1, road.y1, road.x2, road.y2]}
                    stroke={"transparent"}
                    type={"road"}
                    strokeWidth={road.strokeWidth ?? 2}
                    draggable
                    perfectDrawEnabled={false}
                />
            );
        }).filter(Boolean);
    }, [layers, curLayer]);


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
                        onClick={() => mode === "edit" && setSelectedRoom(room)}
                        draggable={mode === "move"}
                        onMouseDown={(e) => {
                            if (mode === "move") {
                                transformerRef.current.nodes([e.currentTarget])
                            }
                        }}
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
                        draggable={mode === "move"}
                        onClick={() => mode === "edit" && setSelectedRoom(room)}
                        onMouseDown={(e) => {
                            if (mode === "move" && transformerRef.current) {
                                transformerRef.current.nodes([e.currentTarget])
                            }
                        }}


                        description={room.description}
                        workingtime={room.workingtime}
                    />
                    <Text
                        x={room.x + room.width / 2}
                        y={room.y + room.height / 2}
                        offsetX={room.width / 4}
                        offsetY={7}
                        text={room.name}
                        fontSize={14}
                        fill="black"
                    />
                </React.Fragment>
            );
        })

    ), [curLayer, layers, mode]);


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
            <button onClick={sendData}>
                send
            </button>
            <div>x: {coords.x} y: {coords.y}</div>
            <button onClick={() => {
                curLayer !== 4 ? setCurLayer(curLayer + 1) : setCurLayer(0)
            }}>changeLayer
            </button>
            <button onClick={() => {
                setMode("edit");
            }}>Edit mode
            </button>
            <button onClick={() => {
                setMode("draw")
            }}>Drawing mode
            </button>
            <button onClick={() => {
                setMode("move");
            }}
            >Move mode
            </button>
            {mode === "draw" && (
                <>
                    <br/>
                    <button onClick={() => {setDrawingMode("room")}}>Рисовать комнату</button>
                    <button onClick={() => setDrawingMode("icon")}>Добавить иконку</button>

                </>
            )}
            <Stage height={window.innerHeight}
                   width={window.innerWidth}
                   ref={stageRef}
                   onClick={(e) => {
                       if (mode === "move")
                           e.target === stageRef.current && transformerRef.current.nodes([])
                   }}
                   onWheel={handleWheel}
                   scaleX={stageScale}
                   scaleY={stageScale}
                   x={stageX}
                   y={stageY}
                   draggable={mode === "move"}
                   onMouseDown={() => {
                       if (mode === "draw"){
                           if (drawingMode === "room") handleDrawing()
                           if (drawingMode === "icon") handleAddIcon()
                       }
                   }}
                   onMouseMove={(e) => {
                       const stage = e.target.getStage();
                       const oldScale = stage.scaleX();
                       setCoords({
                               "x": stage.getPointerPosition().x / oldScale - stage.x() / oldScale,
                               "y": stage.getPointerPosition().y / oldScale - stage.y() / oldScale
                           }
                       )
                       if (mode === "draw" && drawingMode === "room") handleMouseMove()
                   }}
                   onMouseUp={() => {
                       if (mode === "draw" && drawingMode === "room") handleMouseUp()
                   }}
            >
                <Layer>
                    {renderedWalls}
                    {renderedRooms}
                    {renderedIcons}
                    {renderedRoads}

                    {newRect && drawingMode === "room" && (
                        <Rect
                            x={newRect.x}
                            y={newRect.y}
                            width={newRect.width}
                            height={newRect.height}
                            stroke="red"
                            strokeWidth={2}

                            dash={[4, 4]}
                        />
                    )}
                    {mode === "move" && (
                        <>
                            <Transformer ref={transformerRef} onDragMove={() => onDragMove()} onDragEnd={() => {
                                setHLines([]);
                                setVLines([])
                            }}/>
                            {hLines.map((item, i) => (
                                <Line key={`h-${i}`} {...item} x={formatToScale(item.x, true)}
                                      y={formatToScale(item.y, false)}/>
                            ))}
                            {vLines.map((item, i) => (
                                <Line key={`v-${i}`} {...item} x={formatToScale(item.x, true)}
                                      y={formatToScale(item.y, false)}/>
                            ))}</>)}

                </Layer>
            </Stage>
            {mode === "edit" && selectedRoom && (
                <RoomEditorDialog
                    room={selectedRoom}
                    onClose={() => setSelectedRoom(null)}
                    onDelete={handleDeleteRoom}
                    onSave={handleSaveRoom}
                />)}
        </>
    );
}

export default MapRedactor;