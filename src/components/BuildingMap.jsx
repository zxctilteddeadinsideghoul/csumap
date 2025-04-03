import { Layer, Path, Rect, Stage, Text, Group, Line } from "react-konva";
import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import RoomInfoModal from "./RoomInfoModal.jsx";
import '../BuildingMap.css';
import useStore from './store.jsx';
import RouteMap from "./RouteMap.jsx";

const MAP_DATA_PATH = 'https://staticstorm.ru/map/map_data';

function BuildingMap({ isMapActive }) {
    // Utility function to detect mobile devices
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    // State for stage scale and position, adjusted for mobile
    const [stageScale, setStageScale] = useState(isMobileDevice() ? 0.3 : 0.5);
    const [stageX, setStageX] = useState(isMobileDevice() ? -80 : 250);
    const [stageY, setStageY] = useState(isMobileDevice() ? 0 : -150);

    const [isZooming, setIsZooming] = useState(false);
    const [curLayer, setCurLayer] = useState(0);
    const [layers, setLayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState(null);

    // Store interactions
    const setRoomsForStore = useStore((state) => state.setRooms);
    const fromRoom = useStore((state) => state.fromRoom); // For route start
    const toRoom = useStore((state) => state.toRoom);     // For route end
    const selectedSearchRoom = useStore((state) => state.selectedSearchRoom); // For centering

    // Refs for multi-touch and stage
    const lastCenterRef = useRef(null);
    const lastDistRef = useRef(0);
    const stageRef = useRef(null);

    // Utility functions for multi-touch
    const getCenter = (p1, p2) => ({ x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 });
    const getDistance = (p1, p2) => Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));

    // Multi-touch handler for zooming
    const handleMultiTouch = useCallback((e) => {
        if (!isMapActive) return;
        e.evt.preventDefault();
        const touch1 = e.evt.touches[0];
        const touch2 = e.evt.touches[1];
        const stage = e.target.getStage();

        if (touch1 && touch2 && stage) {
            if (!isZooming) { stage.stopDrag(); setIsZooming(true); }
            const p1 = { x: touch1.clientX, y: touch1.clientY };
            const p2 = { x: touch2.clientX, y: touch2.clientY };
            if (!lastCenterRef.current) {
                lastCenterRef.current = getCenter(p1, p2);
                lastDistRef.current = getDistance(p1, p2);
                if (lastDistRef.current === 0) return;
                return;
            }
            const newCenter = getCenter(p1, p2);
            const newDist = getDistance(p1, p2);
            if (lastDistRef.current === 0) {
                lastDistRef.current = newDist;
                if (newDist === 0) return;
            }
            const oldScale = stage.scaleX();
            const pointTo = {
                x: (newCenter.x - stage.x()) / oldScale,
                y: (newCenter.y - stage.y()) / oldScale,
            };
            let scale = oldScale * (newDist / (lastDistRef.current || newDist));
            const minScale = 0.3;
            const maxScale = 3;
            scale = Math.max(minScale, Math.min(scale, maxScale));
            setStageScale(scale);
            const dx = newCenter.x - lastCenterRef.current.x;
            const dy = newCenter.y - lastCenterRef.current.y;
            const newPos = {
                x: newCenter.x - pointTo.x * scale + dx,
                y: newCenter.y - pointTo.y * scale + dy,
            };
            setStageX(newPos.x);
            setStageY(newPos.y);
            lastDistRef.current = newDist;
            lastCenterRef.current = newCenter;
        }
    }, [isMapActive, isZooming]);

    const multiTouchEnd = useCallback(() => {
        lastCenterRef.current = null;
        lastDistRef.current = 0;
        setIsZooming(false);
    }, []);

    // Wheel handler for zooming with mouse
    const handleWheel = useCallback((e) => {
        if (!isMapActive) return;
        e.evt.preventDefault();
        const scaleBy = 1.1;
        const stage = e.target.getStage();
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        if (!pointer) return;
        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };
        const direction = e.evt.deltaY > 0 ? -1 : 1;
        const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;
        const minScale = 0.4;
        const maxScale = 3;
        const clampedScale = Math.max(minScale, Math.min(newScale, maxScale));
        setStageScale(clampedScale);
        setStageX(pointer.x - mousePointTo.x * clampedScale);
        setStageY(pointer.y - mousePointTo.y * clampedScale);
    }, [isMapActive]);

    // Fetch and process map data
    useEffect(() => {
        let isMounted = true;
        console.log("RouteMap: Загрузка данных карты...");
        fetch("https://staticstorm.ru/map/map_data2")
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                return response.json();
            })
            .then((data) => {
                if (!isMounted) return;
                if (!data || !Array.isArray(data.layers)) {
                    throw new Error("Invalid map data structure: 'layers' array not found.");
                }
                const processedLayers = data.layers.map((layer, index) => ({
                    ...layer,
                    floorIndex: index,
                    rooms: (layer.rooms || []).map(r => ({ ...r, floorIndex: index })),
                    roads: (layer.roads || []).map(r => ({ ...r, floorIndex: index })),
                    walls: (layer.walls || []).map(w => ({ ...w, floorIndex: index })),
                    vectors: (layer.vectors || []).map(v => ({ ...v, floorIndex: index })),
                }));
                setLayers(processedLayers);
                const allRoomsForStore = processedLayers
                    .flatMap(layer => layer.rooms || [])
                    .filter(item => item.type !== 'stair');
                setRoomsForStore(allRoomsForStore);
                setLoading(false);
            })
            .catch(error => {
                if (!isMounted) return;
                console.error("Error loading map data:", error);
                setLoading(false);
            });
        return () => { isMounted = false; };
    }, [setRoomsForStore]);

    // Drag handlers
    const handleDragStart = useCallback((e) => {
        if (!isMapActive || isZooming) {
            e.target.getStage().stopDrag();
        }
    }, [isMapActive, isZooming]);

    const handleDragEnd = useCallback((e) => {
        if (!isMapActive) return;
        setStageX(e.target.x());
        setStageY(e.target.y());
    }, [isMapActive]);

    // Room selection handlers
    const handleRoomClick = useCallback((room) => {
        if (!isMapActive) return;
        setSelectedRoom(room);
    }, [isMapActive]);

    const handleTouchRoom = useCallback((e, room) => {
        if (!isMapActive) return;
        e.evt.preventDefault();
        handleRoomClick(room);
    }, [isMapActive, handleRoomClick]);

    // Floor change handler
    const handleLayerChange = useCallback((layerIndex) => {
        if (!isMapActive || !layers[layerIndex]) return;
        setCurLayer(layerIndex);
    }, [isMapActive, layers]);

    const handleIconClick = (icon) => {
        if (!isMapActive || !icon.name) return; // Добавлена проверка на наличие name
        setSelectedRoom({
            id: icon.id,
            name: icon.name,
            type: "icon"
        });
    };

    // Function to calculate bounding box for Path elements
    const getPathBoundingBox = (data) => {
        const points = [];
        const commands = data.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
        let currentX = 0;
        let currentY = 0;
        commands.forEach((cmd) => {
            const type = cmd[0];
            const args = cmd.slice(1).trim().split(/[\s,]+/).map(parseFloat);
            switch (type) {
                case 'M':
                case 'L':
                    currentX = args[0];
                    currentY = args[1];
                    points.push({ x: currentX, y: currentY });
                    break;
                case 'H':
                    currentX = args[0];
                    points.push({ x: currentX, y: currentY });
                    break;
                case 'V':
                    currentY = args[0];
                    points.push({ x: currentX, y: currentY });
                    break;
            }
        });
        if (points.length === 0) return null;
        const xs = points.map(p => p.x);
        const ys = points.map(p => p.y);
        return {
            minX: Math.min(...xs),
            minY: Math.min(...ys),
            maxX: Math.max(...xs),
            maxY: Math.max(...ys),
        };
    };

    // Center map on selectedSearchRoom
    useEffect(() => {
        if (selectedSearchRoom) {
            const targetLayer = selectedSearchRoom.floorIndex;
            if (targetLayer !== undefined && layers[targetLayer]) {
                setCurLayer(targetLayer);
            }
            let centerX, centerY;
            if (selectedSearchRoom.data) {
                const bbox = getPathBoundingBox(selectedSearchRoom.data);
                if (bbox) {
                    centerX = (bbox.minX + bbox.maxX) / 2;
                    centerY = (bbox.minY + bbox.maxY) / 2;
                }
            } else {
                centerX = selectedSearchRoom.x + (selectedSearchRoom.width || 0) / 2;
                centerY = selectedSearchRoom.y + (selectedSearchRoom.height || 0) / 2;
            }
            if (centerX !== undefined && centerY !== undefined) {
                const scale = 2.5;
                const screenCenterX = window.innerWidth / 2;
                const screenCenterY = window.innerHeight / 2;
                const newX = screenCenterX - centerX * scale;
                const newY = screenCenterY - centerY * scale;
                setStageScale(scale);
                setStageX(newX);
                setStageY(newY);
            }
        }
    }, [selectedSearchRoom, layers]);

    const currentLayerData = layers[curLayer] || {};

    // Memoized rendering functions
    const renderedWalls = useMemo(() =>
            (currentLayerData.walls?.map((wall, index) => (
                <Path
                    key={`wall-${curLayer}-${index}-${wall.data?.slice(0,10)}`}
                    data={wall.data}
                    x={wall.x}
                    y={wall.y}
                    stroke={wall.stroke || "black"}
                    strokeWidth={wall.strokeWidth || 1}
                    listening={false}
                    perfectDrawEnabled={false}
                />
            )) || []),
        [currentLayerData, curLayer]
    );

    const renderedRoads = useMemo(() =>
            (currentLayerData.roads?.map(road => (
                <Line
                    key={road.id}
                    points={[road.x1, road.y1, road.x2, road.y2]}
                    stroke={road.stroke || 'transparent'}
                    strokeWidth={road.strokeWidth || 2}
                    listening={false}
                    perfectDrawEnabled={false}
                />
            )) || []),
        [currentLayerData]
    );

    const renderedIcons = useMemo(() => (
        layers[curLayer]?.vectors.map((vector) => (
            <Path
                key={vector.id}
                data={vector.data}
                stroke={"black"}
                strokeWidth={1}
                hitStrokeWidth={vector.name ? 10 : 0}
                x={vector.x}
                y={vector.y}
                onClick={() => handleIconClick(vector)}
                onTap={(e) => {
                    e.evt.preventDefault();
                    handleIconClick(vector);
                }}
            />
        ))
    ), [curLayer, layers]);

    const renderedRooms = useMemo(() =>
            (currentLayerData.rooms?.map(room => {
                const isStartSelected = fromRoom?.id === room.id;
                const isEndSelected = toRoom?.id === room.id;
                let fillColor = 'rgba(200, 200, 200, 0.3)';
                if (room.type === 'stair') fillColor = 'rgba(100, 100, 255 esetben, 0.6)';
                if (isStartSelected) fillColor = 'rgba(255, 0, 0, 0.4)';
                if (isEndSelected) fillColor = 'rgba(255, 0, 0, 0.4)';
                if (isStartSelected && isEndSelected) fillColor = 'rgba(255, 165, 0, 0.7)';

                if (room.type === 'stair') {
                    return (
                        <Group key={room.id}>
                            <Rect
                                id={room.id}
                                x={room.x}
                                y={room.y}
                                width={room.width || 15}
                                height={room.height || 15}
                                fill={fillColor}
                                stroke="black"
                                strokeWidth={1}
                                onClick={() => handleRoomClick(room)}
                                onTap={(e) => handleTouchRoom(e, room)}
                                perfectDrawEnabled={false}
                            />
                            <Text
                                x={room.x + (room.width || 15) / 2}
                                y={room.y + (room.height || 15) / 2}
                                offsetX={7}
                                offsetY={7}
                                text={room.name || room.id}
                                fontSize={14}
                                fill="black"
                                listening={false}
                                perfectDrawEnabled={false}
                            />
                        </Group>
                    );
                } else if (room.data) {
                    const bbox = getPathBoundingBox(room.data);
                    if (!bbox) return null;
                    const centerX = (bbox.minX + bbox.maxX) / 2 ;
                    const centerY = (bbox.minY + bbox.maxY) / 2 ;
                    return (
                        <Group key={room.id}>
                            <Path
                                id={room.id}
                                data={room.data}
                                fill={fillColor}
                                stroke="black"
                                strokeWidth={1}
                                onClick={() => handleRoomClick(room)}
                                onTap={(e) => handleTouchRoom(e, room)}
                                perfectDrawEnabled={false}
                            />
                            <Text
                                x={centerX-20}
                                y={centerY}
                                width={40}
                                height={40}
                                text={room.name}
                                fontSize={12}
                                fill="black"
                                listening={false}
                                perfectDrawEnabled={false}
                            />
                        </Group>
                    );
                } else {
                    return (
                        <Group key={room.id}>
                            <Rect
                                id={room.id}
                                x={room.x}
                                y={room.y}
                                width={room.width}
                                height={room.height}
                                fill={fillColor}
                                stroke="black"
                                strokeWidth={1}
                                onClick={() => handleRoomClick(room)}
                                onTap={(e) => handleTouchRoom(e, room)}
                                perfectDrawEnabled={false}
                            />
                            <Text
                                x={room.x}
                                y={room.y}
                                width={room.width}
                                height={room.height}
                                align={'center'}
                                verticalAlign={'middle'}
                                text={room.name}
                                fontSize={14}
                                fill="black"
                                listening={false}
                                perfectDrawEnabled={false}
                            />
                        </Group>
                    );
                }
            }) || []),
        [currentLayerData, curLayer, fromRoom, toRoom, handleRoomClick, handleTouchRoom]
    );

    // Loading state
    if (loading) {
        return <div>Loading...</div>;
    }

    return (
        <>
            <div className="floor-buttons">
                {[4, 0, 1, 2, 3].map((layerIndex) => (
                    layers[layerIndex] ? (
                        <button
                            key={layerIndex}
                            className={`floor-button ${curLayer === layerIndex ? 'active' : ''}`}
                            onClick={() => handleLayerChange(layerIndex)}
                        >
                            {layerIndex === 4 ? '0' : `${layerIndex + 1}`}
                        </button>
                    ) : null
                ))}
            </div>
            <Stage
                height={window.innerHeight}
                width={window.innerWidth}
                onWheel={handleWheel}
                onTouchMove={handleMultiTouch}
                onTouchEnd={multiTouchEnd}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
                scaleX={stageScale}
                scaleY={stageScale}
                x={stageX}
                y={stageY}
                draggable={isMapActive && !isZooming}
                ref={stageRef}
                style={{ background: "#F3F3F4" }}
            >
                <Layer>
                    {renderedWalls}
                    {renderedRoads}
                    {renderedRooms}
                    {renderedIcons}
                    <RouteMap currentFloorIndex={curLayer} mapDataPath={MAP_DATA_PATH} />
                </Layer>
            </Stage>
            <RoomInfoModal room={selectedRoom} onClose={() => setSelectedRoom(null)} />
        </>
    );
}

export default BuildingMap;