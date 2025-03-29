// src/components/map/RouteMap.jsx
import React, { useEffect, useState, useMemo } from 'react';
import { Line } from 'react-konva';
import useStore from './store.jsx';
import { buildGraph } from './graph.js';
import { findShortestPath } from './dijkstra.js';

// Используйте правильный путь к JSON файлу в папке public
// const MAP_DATA_PATH = 'src/components/ALL_MAP_YUN_V0.1.json';

function RouteMap({ currentFloorIndex, mapDataPath = "src/components/ALL_MAP_YUN_V0.1.json" }) { // Убедитесь что путь правильный
    const fromRoom = useStore((state) => state.fromRoom);
    const toRoom = useStore((state) => state.toRoom);

    const [graphData, setGraphData] = useState({ graph: new Map(), nodeCoords: new Map() });
    const [calculatedPath, setCalculatedPath] = useState(null);
    const [isLoadingGraph, setIsLoadingGraph] = useState(true);


    useEffect(() => {
        setIsLoadingGraph(true);
        let isMounted = true;
        console.log("RouteMap: Fetching map data...");
        fetch(mapDataPath) // <--- ИСПРАВЛЕННЫЙ ПУТЬ
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} while fetching ${mapDataPath}`);
                }
                return response.json(); // Парсим как JSON
            })
            .then((data) => {
                if (!isMounted) return;
                console.log("RouteMap: Map data fetched.");
                const processedLayers = data.layers.map((layer, index) => {
                    layer.floorIndex = index;
                    (layer.rooms || []).forEach(room => room.floorIndex = index);
                    (layer.roads || []).forEach(road => road.floorIndex = index);
                    return layer;
                });
                console.log("RouteMap: Building graph...");
                console.time("buildGraph (RouteMap)");
                const { graph, nodeCoords } = buildGraph(processedLayers);
                console.timeEnd("buildGraph (RouteMap)");
                console.log("RouteMap: Graph built. Nodes:", nodeCoords.size);
                setGraphData({ graph, nodeCoords });
                setIsLoadingGraph(false);
            })
            .catch(error => {
                if (!isMounted) return;
                // Ошибка будет либо при fetch (сеть), либо при response.json() (невалидный JSON)
                console.error("RouteMap: Error loading/parsing/building graph:", error);
                setIsLoadingGraph(false);
            });

        return () => { isMounted = false; };
    }, [mapDataPath]); // Загружаем граф один раз

    // Расчет маршрута
    useEffect(() => {
        if (isLoadingGraph || !fromRoom || !toRoom || graphData.graph.size === 0) {
            // Если граф не готов или точки не выбраны, сбрасываем путь, если он был
            if (calculatedPath !== null) { // Сбрасываем только если надо
                setCalculatedPath(null);
            }
            return; // Выходим, если условия не выполнены
        }
        console.log(`RouteMap: Store updated, calculating path from ${fromRoom.id} to ${toRoom.id}`);

        const startPrefix = fromRoom.type === 'stair' ? 'stair' : 'room';
        const endPrefix = toRoom.type === 'stair' ? 'stair' : 'room';
        const startGraphNodeId = `${startPrefix}-${fromRoom.id}`;
        const endGraphNodeId = `${endPrefix}-${toRoom.id}`;

        if (!graphData.graph.has(startGraphNodeId) || !graphData.graph.has(endGraphNodeId)) {
            console.warn(`RouteMap: Start (${startGraphNodeId}) or End (${endGraphNodeId}) node not found in graph.`);
            // Сбрасываем путь, если узлы не найдены
            if (calculatedPath !== null) {
                setCalculatedPath(null);
            }
            return; // Выходим
        }

        console.time("findShortestPath (RouteMap)");
        const path = findShortestPath(graphData.graph, graphData.nodeCoords, startGraphNodeId, endGraphNodeId);
        console.timeEnd("findShortestPath (RouteMap)");

        // Обновляем путь ТОЛЬКО если он действительно изменился
        // (сравнение массивов требует более сложной логики, но для простоты пока так)
        // Или можно просто вызывать setCalculatedPath(path) без calculatedPath в зависимостях
        setCalculatedPath(path);

        if (!path) {
            console.log("RouteMap: Path not found.");
            // alert("Маршрут не найден."); // Можно раскомментировать для отладки
        } else {
            console.log("RouteMap: Path found:", path);
        }


    }, [fromRoom, toRoom, graphData, isLoadingGraph]);


    // Рендеринг линии маршрута
    const renderedPathLines = useMemo(() => {
        if (!calculatedPath || !graphData.nodeCoords || calculatedPath.length < 2) return [];

        const lines = [];
        const nodeCoords = graphData.nodeCoords;
        // Функция для получения "правильных" координат комнаты/лестницы
        // (центр для Rect, первая точка для Path или явно заданные entryX/Y)

        const getRoomCoords = (room) => {
            if (!room) return null;

            // Координаты для лестниц или комнат типа Rect
            if (room.type === 'stair' || (room.type === 'room' && room.x !== undefined)) {
                // Используем центр прямоугольника
                return {
                    x: room.x + (room.width ? room.width / 2 : 0),
                    y: room.y + (room.height ? room.height / 2 : 0),
                    floorIndex: room.floorIndex // Этаж важен!
                };
            }
            // Координаты для комнат типа Path (векторных)
            else if ((room.type === 'room_vectorized' || room.x === undefined) && room.data) {
                // Пытаемся извлечь первую точку из SVG path data (M x y ...)
                const points = room.data.match(/M\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)/i)
                    || room.data.match(/M\s*([-+]?\d*\.?\d+)\s+([-+]?\d*\.?\d+)/i); // С пробелом
                if (points && points.length >= 3) {
                    return {
                        x: parseFloat(points[1]),
                        y: parseFloat(points[2]),
                        floorIndex: room.floorIndex
                    };
                } else {
                    console.warn(`Could not parse entry point from Path data for room: ${room.id}`);
                    // Можно вернуть null или центр bounding box, если он доступен
                    return null;
                }
            }
            console.warn("Could not determine coordinates for room/stair:", room.id, room);
            return null;
        };

        const startCoords = getRoomCoords(fromRoom);
        const endCoords = getRoomCoords(toRoom);

        // Если не удалось получить координаты старта или финиша, не рисуем путь
        if (!startCoords || !endCoords) {
            console.error("Could not get coordinates for start or end room. Path rendering aborted.");
            return [];
        }

        // Итерируем по узлам пути для создания сегментов линии

        for (let i = 0; i < calculatedPath.length - 1; i++) {
            const node1Id = calculatedPath[i];
            const node2Id = calculatedPath[i + 1];

            const node1Data = nodeCoords.get(node1Id);
            const node2Data = nodeCoords.get(node2Id);

            // Пропускаем сегмент, если данных для узлов нет
            if (!node1Data || !node2Data) {
                console.warn(`Missing coords for nodes: ${node1Id} or ${node2Id}`);
                continue;
            }

            // --- ЛОГИКА ВЫБОРА ТОЧЕК ДЛЯ ЛИНИИ ---
            let p1, p2;
            let segmentFloor; // Этаж, которому принадлежит сегмент

            if (i === 0) {
                // Первый сегмент: от настоящих координат СТАРТА до координат ВТОРОГО узла пути
                p1 = startCoords;
                p2 = node2Data;
                // Сегмент принадлежит этажу стартовой точки (и виртуального узла)
                segmentFloor = p1.floorIndex;
                // Доп. проверка, что второй узел на том же этаже (должно быть так)
                if (p1.floorIndex !== p2.floorIndex) {
                    console.warn(`First path segment connects different floors: ${node1Id} (${p1.floorIndex}) to ${node2Id} (${p2.floorIndex})`);
                    // Возможно, не рисовать этот сегмент или обработать особо
                    // continue; // Пока пропустим, если этажи разные
                }

            } else if (i === calculatedPath.length - 2) {
                // Последний сегмент: от ПРЕДПОСЛЕДНЕГО узла пути до настоящих координат ФИНИША
                p1 = node1Data;
                p2 = endCoords;
                // Сегмент принадлежит этажу конечной точки (и предп. виртуального узла)
                segmentFloor = p2.floorIndex;
                // Доп. проверка
                if (p1.floorIndex !== p2.floorIndex) {
                    console.warn(`Last path segment connects different floors: ${node1Id} (${p1.floorIndex}) to ${node2Id} (${p2.floorIndex})`);
                    // continue; // Пока пропустим
                }
            } else {
                // Промежуточные сегменты: между двумя узлами пути
                p1 = node1Data;
                p2 = node2Data;
                // Проверяем, находятся ли ОБА узла на одном этаже
                if (p1.floorIndex !== p2.floorIndex) {
                    // Это сегмент перехода между этажами (лестница), не рисуем его
                    continue;
                }
                segmentFloor = p1.floorIndex; // Этаж сегмента
            }

            // --- ФИЛЬТРАЦИЯ ПО ЭТАЖУ ---
            // Рисуем линию ТОЛЬКО если ее этаж совпадает с текущим отображаемым
            if (segmentFloor === currentFloorIndex) {
                if (!p1 || !p2) { // Доп. проверка на случай, если getRoomCoords вернул null
                    console.error("Missing coordinates for path segment drawing", node1Id, node2Id);
                    continue;
                }
                lines.push(
                    <Line
                        key={`path-${node1Id}-${node2Id}`} // Уникальный ключ
                        points={[p1.x, p1.y, p2.x, p2.y]} // Используем p1 и p2
                        stroke="rgba(255, 0, 0, 0.9)" // Ярко-красный
                        strokeWidth={6}
                        tension={0}
                        lineCap="round"
                        lineJoin="round"
                        dash={[10, 7]} // Пунктир
                        shadowColor="black"
                        shadowBlur={8}
                        shadowOpacity={0.6}
                        shadowOffsetX={1}s
                        shadowOffsetY={1}
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                );
            }
        }
        return lines;
    }, [calculatedPath, graphData.nodeCoords, currentFloorIndex, fromRoom, toRoom]);

    if (isLoadingGraph) { return null; }
    return <>{renderedPathLines}</>;
}



export default RouteMap;