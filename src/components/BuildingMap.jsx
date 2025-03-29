import { Layer, Path, Rect, Stage, Text, Group, Line } from "react-konva";
import React, {useEffect, useMemo, useRef, useState, useCallback} from "react"; // Исправленный импорт
import RoomInfoModal from "./RoomInfoModal.jsx";
import '../BuildingMap.css'
import useStore from './store.jsx';
import RouteMap from "./RouteMap.jsx";

const MAP_DATA_PATH = 'src/components/ALL_MAP_YUN_V0.1.json';

function BuildingMap({isMapActive}) {
    function isMobileDevice() {
        return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    }

    const [stageScale, setStageScale] = useState(isMobileDevice() ? 0.3 : 0.5);
    const [stageX, setStageX] = useState(isMobileDevice() ? -80 : 250);
    const [stageY, setStageY] = useState(isMobileDevice()? 0 : -150);

    const [isZooming, setIsZooming] = useState(false);
    const [curLayer, setCurLayer] = useState(0)

    const [layers, setLayers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedRoom, setSelectedRoom] = useState(null);

    // function getCenter(p1, p2) {
    //     return {
    //         x: (p1.x + p2.x) / 2,
    //         y: (p1.y + p2.y) / 2,
    //     };
    // }

    const setRoomsForStore = useStore((state) => state.setRooms);
    const fromRoom = useStore((state) => state.fromRoom); // Для подсветки
    const toRoom = useStore((state) => state.toRoom);

    const lastCenterRef = useRef(null);
    const lastDistRef = useRef(0);
    //const stageRef = useRef(null);

    function getCenter(p1, p2) { return { x: (p1.x + p2.x) / 2, y: (p1.y + p2.y) / 2 }; }
    function getDistance(p1, p2) { return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2)); }
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
                y: (newCenter.y - stage.y()) / oldScale, // <-- Исправлено на oldScale
            };

            // Используем || newDist для случая, если lastDistRef.current === 0
            let scale = oldScale * (newDist / (lastDistRef.current || newDist));

            const minScale = 0.1; // Уменьшил минимальный масштаб
            const maxScale = 5.0; // Увеличил максимальный масштаб
            scale = Math.max(minScale, Math.min(scale, maxScale));

            setStageScale(scale); // Обновляем state

            const dx = newCenter.x - lastCenterRef.current.x;
            const dy = newCenter.y - lastCenterRef.current.y;

            const newPos = {
                x: newCenter.x - pointTo.x * scale + dx,
                y: newCenter.y - pointTo.y * scale + dy,
            };

            // Обновляем state вместо прямого вызова stage.position()
            setStageX(newPos.x);
            setStageY(newPos.y);
            // stage.batchDraw(); // Konva сделает это сама при обновлении state

            lastDistRef.current = newDist;
            lastCenterRef.current = newCenter;
        }
    }, [isMapActive, isZooming, stageX, stageY]);

    const multiTouchEnd = useCallback(() => {
        lastCenterRef.current = null;
        lastDistRef.current = 0;
        setIsZooming(false);
    }, []);


    const handleWheel = useCallback((e) => {
        if (!isMapActive) return;
        e.evt.preventDefault();

        const scaleBy = 1.1; // Немного уменьшил шаг
        const stage = e.target.getStage();
        const oldScale = stage.scaleX();
        const pointer = stage.getPointerPosition();
        // Проверка, что pointer не null
        if (!pointer) return;

        const mousePointTo = {
            x: (pointer.x - stage.x()) / oldScale,
            y: (pointer.y - stage.y()) / oldScale,
        };

        const direction = e.evt.deltaY > 0 ? -1 : 1; // Стандартное направление прокрутки
        const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

        const minScale = 0.1;
        const maxScale = 5.0;
        const clampedScale = Math.max(minScale, Math.min(newScale, maxScale)); // Ограничиваем масштаб

        setStageScale(clampedScale);
        setStageX(pointer.x - mousePointTo.x * clampedScale);
        setStageY(pointer.y - mousePointTo.y * clampedScale);
    }, [isMapActive, stageX, stageY]);

    // useEffect(() => {
    //     fetch("https://staticstorm.ru/map/map_data2").then((response) => {
    //             response.json().then(
    //                 (response) => {
    //                     setLayers(response.layers)
    //                     setLoading(false)
    //                 }
    //             )
    //         }
    //     );
    // }, []);

    // useEffect(() => {
    //     fetch("src/components/ALL_MAP_YUN_V0.1.json").then((response) => {
    //             response.json().then(
    //                 (response) => {
    //                     setLayers(response.layers);
    //                     setLoading(false);
    //
    //                     const allRooms = response.layers.flatMap(layer => layer.rooms);
    //                     useStore.getState().setRooms(allRooms);
    //                 }
    //             )
    //         }
    //     );
    // }, []);

    useEffect(() => {
        let isMounted = true;
        setLoading(true);
        console.log("BuildingMap: Fetching map data...");
        fetch(MAP_DATA_PATH) // <-- ИСПОЛЬЗУЕМ ПУТЬ В PUBLIC
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP error! status: ${response.status} fetching ${MAP_DATA_PATH}`);
                const contentType = response.headers.get("content-type");
                if (!contentType || contentType.indexOf("application/json") === -1) {
                    return response.text().then(text => {
                        throw new Error(`Expected JSON, but got ${contentType}. Content: ${text.slice(0, 100)}...`);
                    });
                }
                return response.json();
            })
            .then((data) => {
                if (!isMounted) return;
                console.log("BuildingMap: Map data fetched and parsed.");
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
                    .filter(item => item.type !== 'stair'); // Убираем лестницы из списка выбора
                setRoomsForStore(allRoomsForStore);
                setLoading(false);
            })
            .catch(error => {
                if (!isMounted) return;
                console.error("BuildingMap: Error loading or processing map data:", error);
                setLoading(false);
            });
        return () => { isMounted = false; };
    }, [setRoomsForStore]);

    const handleDragStart = useCallback((e) => {
        if (!isMapActive) return;
        const stage = e.target.getStage();

        if (isZooming) {
            stage.stopDrag();
        }

         console.log(stage.isDragging()); // Убрали, чтобы не засорять консоль
    }, [isMapActive, isZooming]);

    const handleDragEnd = useCallback((e) => {
        if (!isMapActive) return;
        setStageX(e.target.x());
        setStageY(e.target.y());
    }, [isMapActive]);

    //темка для модалки
    const handleRoomClick = useCallback((room) => {
        if (!isMapActive) return;
        setSelectedRoom(room);
    }, [isMapActive]);

    const handleTouchRoom = useCallback((e, room) => {
        if (!isMapActive) return;
        e.evt.preventDefault();
        handleRoomClick(room);
    }, [isMapActive, handleRoomClick]);

    const handleLayerChange = useCallback((layerIndex) => {
        if (!isMapActive) return;
        // Проверяем, существует ли такой слой *по индексу массива*
        if (layers[layerIndex]) {
            setCurLayer(layerIndex);
        } else if (layers[0]) { // Если запрошенный слой не найден, переключаемся на первый (0)
            console.warn(`Layer index ${layerIndex} not found, switching to index 0.`);
            setCurLayer(0);
        } else {
            console.warn(`Layer index ${layerIndex} not found, and no layers available.`);
        }
    }, [isMapActive, layers]);

    const currentLayerData = layers[curLayer];

    const renderedWalls = useMemo(() =>
        (currentLayerData?.walls.map((wall, index) => (
            <Path
                key={`wall-${curLayer}-${index}-${wall.data?.slice(0,10)}`}
                data={wall.data}
                stroke={wall.stroke || "black"}
                strokeWidth={wall.strokeWidth || 1}
                listening={false}
                perfectDrawEnabled={false}
            />
        ))) || [], // Возвращаем пустой массив, если данных нет
        [currentLayerData, curLayer]); // Зависимость от текущего слоя



    const renderedRoads = useMemo(() => (
        currentLayerData?.roads?.map(road => ( // Используем ?. для безопасного доступа
            <Line
                key={road.id} // Используем уникальный id дороги как ключ
                points={[road.x1, road.y1, road.x2, road.y2]} // Массив точек [x1, y1, x2, y2]
                stroke={road.stroke || 'grey'} // Цвет линии (или серый по умолчанию)
                strokeWidth={road.strokeWidth || 2} // Толщина линии (или 2 по умолчанию)
               // opacity={0}
                listening={false}
                perfectDrawEnabled={false}
                // Можно добавить обработчики событий onClick/onTap, если нужно
                // onClick={() => handleRoadClick(road)}
                // onTap={(e) => handleTouchRoad(e, road)}
            />
        ))) || [],
        [currentLayerData]); // Зависимости для useMemo

    const renderedIcons = useMemo(() => (
        currentLayerData?.vectors.map((vector, index) => (
            <Path
                key={vector.id || `icon-${curLayer}-${index}`}
                data={vector.data}
                stroke={"black"}
                strokeWidth={vector.strokeWidth || 1}
                fill={vector.fill}
                listening={false}
                perfectDrawEnabled={false}
            />
        ))) || [],
        [currentLayerData, curLayer]);


    const renderedRooms = useMemo(() =>
            (currentLayerData?.rooms?.map(room => {
                const isStartSelected = fromRoom?.id === room.id;
                const isEndSelected = toRoom?.id === room.id;
                let fillColor = 'rgba(200, 200, 200, 0.3)';
                if (room.type === 'stair') fillColor = 'rgba(100, 100, 255, 0.6)';
                if (isStartSelected) fillColor = 'rgba(0, 255, 0, 0.6)';
                if (isEndSelected) fillColor = 'rgba(255, 0, 0, 0.6)';
                if (isStartSelected && isEndSelected) fillColor = 'rgba(255, 165, 0, 0.7)';

                // --- Рендер лестниц как Rect ---
                if (room.type === 'stair') {
                    return (
                        <Rect
                            key={room.id}
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
                    );
                }
                // --- Рендер комнат Path ---
                else if (room.x === undefined && room.data) {
                    return (
                        <Path
                            key={room.id} // KEY
                            id={room.id}
                            data={room.data}
                            fill={fillColor} // Подсветка
                            stroke={"black"}
                            strokeWidth={1}
                            onClick={() => handleRoomClick(room)}
                            onTap={(e) => handleTouchRoom(e, room)}
                            perfectDrawEnabled={false}
                        />
                    )
                }
                // --- Рендер комнат Rect + Text ---
                else if (room.x !== undefined && room.y !== undefined) {
                    return (
                        // Используем Group как контейнер с общим ключом
                        <Group key={room.id}>
                            <Rect
                                id={room.id} // ID для Konva
                                x={room.x}
                                y={room.y}
                                width={room.width}
                                height={room.height}
                                fill={fillColor} // Подсветка
                                stroke="black"
                                strokeWidth={1}
                                onClick={() => handleRoomClick(room)}
                                onTap={(e) => handleTouchRoom(e, room)}
                                perfectDrawEnabled={false}
                            />
                            {/* ВОЗВРАЩАЕМ КОМПОНЕНТ TEXT ИЗ KONVA */}
                            <Text
                                // key не нужен, т.к. он есть у родительского Group
                                x={room.x + room.width / 2}
                                y={room.y + room.height / 2}
                                offsetX={room.width / 4} // Ваши смещения
                                offsetY={7}            // Ваши смещения
                                text={room.name || room.id} // Отображаем имя или ID
                                fontSize={14}
                                fill="black"
                                listening={false} // Текст не интерактивен
                                perfectDrawEnabled={false}
                            />
                        </Group>
                    );
                }
                return null; // Для неизвестных типов
            })) || [],
        [currentLayerData, curLayer, fromRoom, toRoom, handleRoomClick, handleTouchRoom]);

    if (loading) {
        return <div>Loading...</div>;
    }


    return (
        <>
            <div className="floor-buttons">
                {[4, 0, 1, 2, 3].map((layerIndex) => (
                    layers[layerIndex] ? (
                    <button
                        key={layerIndex} // Используем индекс как ключ (как было у вас)
                        className={`floor-button ${curLayer === layerIndex ? 'active' : ''}`}
                        onClick={() => handleLayerChange(layerIndex)}
                    >
                        {/* Ваша логика отображения номера этажа */}
                        {layerIndex === 4 ? '0' : `${layerIndex + 1}`}
                    </button>
                ) : null
                ))}
            </div>
            <Stage height={window.innerHeight}
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
            >
                <Layer>
                    {renderedWalls}
                    {renderedRoads}
                    {renderedRooms}
                    {renderedIcons}
                    <RouteMap currentFloorIndex={curLayer} mapDataPath={MAP_DATA_PATH} />
                </Layer>
            </Stage>
            <RoomInfoModal room={selectedRoom} onClose={() => setSelectedRoom(null)}/>
        </>
    );

}

export default BuildingMap;