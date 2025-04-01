// src/components/RouteMap.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Line } from 'react-konva';
import useStore from './store.jsx'; // Импортируем наш стор
import { buildGraph } from './graph.js'; // Импорт построителя графа
import { findShortestPath } from './dijkstra.js'; // Импорт алгоритма Дейкстры

function RouteMap({ currentFloorIndex, mapDataPath = "src/components/ALL_MAP_YUN_V0.2.json" }) {
    // Получаем точки старта и финиша из стора
    const fromItem = useStore((state) => state.fromRoom); // Теперь это может быть room ИЛИ icon
    const toItem = useStore((state) => state.toRoom);     // Теперь это может быть room ИЛИ icon

    // Состояния для графа и пути
    const [graphData, setGraphData] = useState({ graph: new Map(), nodeCoords: new Map() });
    const [calculatedPath, setCalculatedPath] = useState(null);
    const [isLoadingGraph, setIsLoadingGraph] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null); // Состояние для сообщений об ошибках

    // Функция для получения ID узла графа на основе выбранного элемента (комната, иконка, лестница)
    const getGraphNodeId = useCallback((item) => {
        if (!item || !item.id) {
            // console.warn("getGraphNodeId: Item or item.id is missing", item);
            return null;
        }

        // Если это комната (выбрана в RouteMenu или через RoomInfoModal), ищем ее дверь
        // Предполагаем, что ID комнат начинаются с 'r' (например, r123, r_a14)
        // И ее дверь будет иметь ID `${item.id}_door`
        if ((item.type === 'room' || item.type === 'vectorized_room' || item.id.startsWith('r')) && item.type !== 'stair') {
            const doorNodeId = `icon-${item.id}_door`;
            // Проверяем, существует ли узел для этой двери в графе
            if (graphData.nodeCoords.has(doorNodeId)) {
                return doorNodeId;
            } else {
                console.warn(`Door icon node '${doorNodeId}' not found for room '${item.id}'. Trying direct icon node.`);
                // Как запасной вариант, пытаемся найти иконку с ID самой комнаты (если есть)
                const directIconNodeId = `icon-${item.id}`;
                if (graphData.nodeCoords.has(directIconNodeId)) {
                    return directIconNodeId;
                }
                console.error(`Neither door icon '${doorNodeId}' nor direct icon '${directIconNodeId}' found for room '${item.id}'. Cannot route.`);
                setErrorMsg(`Точка входа для кабинета ${item.name || item.id} не найдена.`);
                return null; // Не нашли узел двери
            }
        }
        // Если это иконка (выбрана напрямую или через поиск иконки)
        else if (item.type === 'icon') {
            const iconNodeId = `icon-${item.id}`;
            if (graphData.nodeCoords.has(iconNodeId)) {
                return iconNodeId;
            } else {
                console.error(`Icon node '${iconNodeId}' not found in graph.`);
                setErrorMsg(`Точка ${item.name || item.id} не найдена на карте маршрутов.`);
                return null;
            }
        }
        // Если это лестница
        else if (item.type === 'stair') {
            const stairNodeId = `stair-${item.id}`;
            if (graphData.nodeCoords.has(stairNodeId)) {
                return stairNodeId;
            } else {
                console.error(`Stair node '${stairNodeId}' not found in graph.`);
                setErrorMsg(`Лестница ${item.name || item.id} не найдена на карте маршрутов.`);
                return null;
            }
        } else {
            console.warn("getGraphNodeId: Unknown item type for routing:", item);
            setErrorMsg(`Неизвестный тип точки: ${item.name || item.id}`);
            return null;
        }
    }, [graphData.nodeCoords]); // Зависимость от nodeCoords, чтобы функция обновлялась при загрузке графа


    // Загрузка и построение графа
    useEffect(() => {
        setIsLoadingGraph(true);
        setErrorMsg(null); // Сбрасываем ошибку при новой загрузке
        let isMounted = true;
        console.log("RouteMap: Fetching map data...");
        fetch(mapDataPath)
            .then((response) => {
                if (!response.ok) {
                    throw new Error(`HTTP error! status: ${response.status} while fetching ${mapDataPath}`);
                }
                const contentType = response.headers.get("content-type");
                if (!contentType || !contentType.includes("application/json")) {
                    throw new TypeError(`Expected JSON, but received ${contentType}`);
                }
                return response.json();
            })
            .then((data) => {
                if (!isMounted) return;
                console.log("RouteMap: Map data fetched.");
                if (!data || !Array.isArray(data.layers)) {
                    throw new Error("Invalid map data: 'layers' array not found.");
                }
                const processedLayers = data.layers.map((layer, index) => ({
                    ...layer,
                    floorIndex: index // Убедимся, что floorIndex есть
                }));
                console.log("RouteMap: Building graph...");
                console.time("buildGraph (RouteMap)");
                const { graph, nodeCoords } = buildGraph(processedLayers); // Строим граф
                console.timeEnd("buildGraph (RouteMap)");
                console.log("RouteMap: Graph built. Nodes:", nodeCoords.size);
                if (nodeCoords.size === 0) {
                    console.error("RouteMap: Graph built with zero nodes!");
                    setErrorMsg("Ошибка построения карты маршрутов: нет узлов.");
                }
                setGraphData({ graph, nodeCoords });
                setIsLoadingGraph(false);
            })
            .catch(error => {
                if (!isMounted) return;
                console.error("RouteMap: Error loading/parsing/building graph:", error);
                setErrorMsg(`Ошибка загрузки данных карты: ${error.message}`);
                setIsLoadingGraph(false);
            });

        return () => { isMounted = false; };
    }, [mapDataPath]);

    // Расчет маршрута при изменении точек старта/финиша или графа
    useEffect(() => {
        // Сбрасываем путь и ошибку при изменении входа
        setCalculatedPath(null);
        setErrorMsg(null);

        if (isLoadingGraph || !fromItem || !toItem || graphData.graph.size === 0) {
            return; // Выходим, если граф не готов или точки не выбраны
        }

        console.log(`RouteMap: Store updated, calculating path from item '${fromItem.id}' to item '${toItem.id}'`);

        // --- ИЗМЕНЕНИЕ: Используем getGraphNodeId для определения узлов ---
        const startGraphNodeId = getGraphNodeId(fromItem);
        const endGraphNodeId = getGraphNodeId(toItem);

        // Если не удалось определить узлы (например, нет двери для комнаты)
        if (!startGraphNodeId || !endGraphNodeId) {
            console.warn("RouteMap: Could not determine start or end node ID.");
            // Ошибка уже установлена в getGraphNodeId
            return;
        }

        // Проверяем наличие узлов в графе
        if (!graphData.graph.has(startGraphNodeId)) {
            console.error(`RouteMap: Start node '${startGraphNodeId}' (derived from item '${fromItem.id}') not found in graph.`);
            setErrorMsg(`Начальная точка (${fromItem.name || fromItem.id}) не найдена на карте маршрутов.`);
            return;
        }
        if (!graphData.graph.has(endGraphNodeId)) {
            console.error(`RouteMap: End node '${endGraphNodeId}' (derived from item '${toItem.id}') not found in graph.`);
            setErrorMsg(`Конечная точка (${toItem.name || toItem.id}) не найдена на карте маршрутов.`);
            return;
        }


        console.time("findShortestPath (RouteMap)");
        const path = findShortestPath(graphData.graph, graphData.nodeCoords, startGraphNodeId, endGraphNodeId);
        console.timeEnd("findShortestPath (RouteMap)");

        setCalculatedPath(path);

        if (!path) {
            console.log("RouteMap: Path not found.");
            setErrorMsg("Маршрут не найден.");
        } else {
            console.log("RouteMap: Path found:", path);
        }

    }, [fromItem, toItem, graphData, isLoadingGraph, getGraphNodeId]); // Добавили getGraphNodeId в зависимости


    // Рендеринг линии маршрута
    const renderedPathLines = useMemo(() => {
        if (!calculatedPath || !graphData.nodeCoords || calculatedPath.length < 2) {
            return [];
        }

        const lines = [];
        const nodeCoords = graphData.nodeCoords;

        for (let i = 0; i < calculatedPath.length - 1; i++) {
            const node1Id = calculatedPath[i];
            const node2Id = calculatedPath[i + 1];

            const node1Data = nodeCoords.get(node1Id);
            const node2Data = nodeCoords.get(node2Id);

            if (!node1Data || !node2Data) {
                console.warn(`Missing coords for nodes in path segment: ${node1Id} or ${node2Id}`);
                continue; // Пропускаем сегмент, если нет данных
            }

            // Проверка координат на NaN перед отрисовкой
            if (isNaN(node1Data.x) || isNaN(node1Data.y) || isNaN(node2Data.x) || isNaN(node2Data.y)) {
                console.warn(`Invalid coordinates for path segment: ${node1Id} (${node1Data.x},${node1Data.y}) to ${node2Id} (${node2Data.x},${node2Data.y}). Skipping.`);
                continue;
            }


            // --- ЛОГИКА ОТОБРАЖЕНИЯ ПО ЭТАЖАМ ---
            // Если узлы на разных этажах - это переход (лестница), не рисуем его
            if (node1Data.floorIndex !== node2Data.floorIndex) {
                continue;
            }

            // Рисуем сегмент, только если он принадлежит текущему отображаемому этажу
            if (node1Data.floorIndex === currentFloorIndex) {
                lines.push(
                    <Line
                        // key={`path-${node1Id}-${node2Id}`} // Используем ID для ключа
                        // --- ИЗМЕНЕНИЕ КЛЮЧА: Добавляем этаж для уникальности при переключении ---
                        key={`path-floor${currentFloorIndex}-${node1Id}-${node2Id}`}
                        points={[node1Data.x, node1Data.y, node2Data.x, node2Data.y]}
                        stroke="rgba(214, 50, 45, 0.9)" // Цвет маршрута D6322D
                        strokeWidth={7} // Увеличим толщину
                        lineCap="round"
                        lineJoin="round"
                        dash={[12, 8]} // Пунктир: 12 пикс линия, 8 пикс пробел
                        shadowColor="rgba(0, 0, 0, 0.4)" // Тень
                        shadowBlur={5}
                        shadowOpacity={0.7}
                        shadowOffsetX={2}
                        shadowOffsetY={2}
                        listening={false} // Не участвует в событиях мыши/касания
                        perfectDrawEnabled={false} // Оптимизация для линий
                    />
                );
            }
        }
        return lines;
    }, [calculatedPath, graphData.nodeCoords, currentFloorIndex]);

    // Отображаем ошибку, если она есть
    useEffect(() => {
        if (errorMsg) {
            // alert(errorMsg); // Можно использовать alert для отладки
            console.error("Routing Error:", errorMsg);
            // Можно отобразить сообщение пользователю более мягко,
            // например, через отдельный компонент или обновив состояние в родительском компоненте
        }
    }, [errorMsg]);


    if (isLoadingGraph) { return null; } // Не рендерим ничего во время загрузки графа
    return <>{renderedPathLines}</>; // Рендерим линии пути
}

export default RouteMap;