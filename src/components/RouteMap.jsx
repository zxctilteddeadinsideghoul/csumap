// src/components/RouteMap.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Line } from 'react-konva';
import useStore from './store.jsx';
// --- ИСПРАВЛЕННЫЙ ПУТЬ ИМПОРТА ---
import { buildGraph } from './graph.js'; // Проверь, что этот путь верен для твоей структуры папок!
// ---------------------------------
import { findShortestPath } from './dijkstra.js';

// --- Функция для расчета веса пути (остается без изменений) ---
function getPathWeight(graph, path) {
    if (!path || path.length < 2) return Infinity;
    let totalWeight = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i + 1];
        const edgeWeight = graph.get(u)?.get(v);
        if (edgeWeight === undefined || isNaN(edgeWeight)) {
            console.warn(`Ребро не найдено или вес некорректен между ${u} и ${v} при расчете веса.`);
            return Infinity;
        }
        totalWeight += edgeWeight;
    }
    return totalWeight;
}


function RouteMap({ currentFloorIndex}) {
    const fromItem = useStore((state) => state.fromRoom);
    const toItem = useStore((state) => state.toRoom);

    const [graphData, setGraphData] = useState({ graph: new Map(), nodeCoords: new Map() });
    const [calculatedPath, setCalculatedPath] = useState(null);
    const [isLoadingGraph, setIsLoadingGraph] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    // --- Функция getGraphNodeId (остается без изменений, но добавим fallback) ---
    const getGraphNodeId = useCallback((item) => {
        if (!item || !item.id) return null;
        const floorIndex = item.floorIndex;

        if ((item.type === 'room' || item.type === 'vectorized_room' || item.id.startsWith('r')) && item.type !== 'stair') {
            const doorNodeId = `icon-${item.id}_door`;
            if (graphData.nodeCoords.has(doorNodeId)) return doorNodeId;
            const directIconNodeId = `icon-${item.id}`;
            if (graphData.nodeCoords.has(directIconNodeId)) {
                console.warn(`Используем прямую иконку ${directIconNodeId} как fallback для комнаты ${item.id}`);
                return directIconNodeId;
            }
            const genericIconPrefix = `icon-${item.id}`;
            const relatedIconId = Array.from(graphData.nodeCoords.keys()).find(key =>
                key.startsWith(genericIconPrefix) && graphData.nodeCoords.get(key)?.floorIndex === floorIndex
            );
            if(relatedIconId) {
                console.warn(`Используем ОБЩУЮ иконку ${relatedIconId} как fallback для комнаты ${item.id}`);
                return relatedIconId;
            }
            console.error(`Не могу найти узел для комнаты '${item.id}' на этаже ${floorIndex}. Отсутствует иконка двери или связанная иконка?`);
            setErrorMsg(`Точка входа для ${item.name || item.id} не найдена.`);
            return null;
        }
        else if (item.type === 'icon') {
            const iconNodeId = `icon-${item.id}`;
            if (graphData.nodeCoords.has(iconNodeId)) return iconNodeId;
            console.error(`Узел иконки '${iconNodeId}' не найден.`);
            setErrorMsg(`Точка ${item.name || item.id} не найдена.`);
            return null;
        }
        else if (item.type === 'stair') {
            const logicalId = item.id.replace(/_floor\d+$/, '');
            const stairIconId = Array.from(graphData.nodeCoords.keys()).find(key =>
                key.startsWith(`icon-ladder${logicalId}_`) &&
                graphData.nodeCoords.get(key)?.floorIndex === floorIndex
            );
            if (stairIconId) return stairIconId;
            console.error(`Иконка лестницы для логической лестницы ${item.id} (ID: ${logicalId}) на этаже ${floorIndex} не найдена.`);
            setErrorMsg(`Лестница ${item.name || item.id} не найдена на карте.`);
            return null;
        }
        else {
            console.warn("Неизвестный тип элемента для getGraphNodeId:", item);
            setErrorMsg(`Неизвестный тип точки: ${item.name || item.id}`);
            return null;
        }
    }, [graphData.nodeCoords]);


    // --- useEffect для Загрузки графа (остается без изменений) ---
    useEffect(() => {
        setIsLoadingGraph(true);
        setErrorMsg(null); // Сбрасываем ошибки при новой загрузке
        let isMounted = true;
        console.log("RouteMap: Загрузка данных карты...");
        fetch("https://staticstorm.ru/map/map_data2.json")
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ошибка! статус: ${response.status}`);
                return response.json();
            })
            .then((data) => {
                if (!isMounted) return;
                console.log("RouteMap: Данные карты загружены.");
                if (!data || !Array.isArray(data.layers)) throw new Error("Неверная структура данных карты: массив 'layers' не найден.");
                const processedLayers = data.layers.map((layer, index) => ({ ...layer, floorIndex: index }));
                console.log("RouteMap: Построение графа...");
                console.time("buildGraph (RouteMap)");
                const { graph, nodeCoords } = buildGraph(processedLayers); // Вызов импортированной функции
                console.timeEnd("buildGraph (RouteMap)");
                console.log("RouteMap: Граф построен. Узлов:", nodeCoords.size, "Ребер (примерно):", graph.size);
                if (nodeCoords.size === 0 || graph.size === 0) {
                    console.error("Построение графа привело к пустому графу или отсутствию узлов.");
                    if(nodeCoords.size === 0) setErrorMsg("Ошибка построения карты маршрутов: Нет узлов.");
                    else setErrorMsg("Ошибка построения карты маршрутов: Нет путей.");
                }
                setGraphData({ graph, nodeCoords });
            })
            .catch(error => {
                if (!isMounted) return;
                console.error("RouteMap: Ошибка загрузки/парсинга/построения графа:", error);
                setErrorMsg(`Ошибка данных карты: ${error.message}`);
            }).finally(() => {
            if(isMounted) setIsLoadingGraph(false);
        });
        return () => { isMounted = false; };
    }, []); // Зависимость только от mapDataPath

    // --- useEffect для Расчета маршрута (УБРАЛИ errorMsg из зависимостей) ---
    useEffect(() => {
        if (isLoadingGraph || !fromItem || !toItem || graphData.graph.size === 0) {
            setCalculatedPath(null);
            return;
        }

        setCalculatedPath(null);
        setErrorMsg(null);

        console.log("RouteMap: Попытка рассчитать путь...");
        console.log("Из:", fromItem);
        console.log("В:", toItem);

        const startNodeId = getGraphNodeId(fromItem);
        const endNodeId = getGraphNodeId(toItem);

        if (!startNodeId || !endNodeId) {
            console.log("RouteMap: ID начального или конечного узла null после getGraphNodeId. Прерываем.");
            // setErrorMsg уже установлен в getGraphNodeId
            return;
        }

        console.log(`RouteMap: Сопоставленные ID: ${startNodeId} -> ${endNodeId}`);

        if (!graphData.graph.has(startNodeId)) {
            console.error(`Начальный узел '${startNodeId}' (для ${fromItem.name || fromItem.id}) не найден в карте графа.`);
            setErrorMsg(`Начальная точка (${fromItem.name || fromItem.id}) не найдена в графе маршрутов.`);
            return;
        }
        if (!graphData.graph.has(endNodeId)) {
            console.error(`Конечный узел '${endNodeId}' (для ${toItem.name || toItem.id}) не найден в карте графа.`);
            setErrorMsg(`Конечная точка (${toItem.name || toItem.id}) не найдена в графе маршрутов.`);
            return;
        }
        if (!graphData.nodeCoords.has(startNodeId) || !graphData.nodeCoords.has(endNodeId)) {
            console.error(`Координаты начального или конечного узла отсутствуют: ${startNodeId} / ${endNodeId}`);
            setErrorMsg("Ошибка данных: Координаты для начальной или конечной точки не найдены.");
            return;
        }

        const startNodeData = graphData.nodeCoords.get(startNodeId);
        const endNodeData = graphData.nodeCoords.get(endNodeId);
        const startFloor = startNodeData?.floorIndex;
        const endFloor = endNodeData?.floorIndex;

        if (startFloor === undefined || endFloor === undefined) {
            console.error(`Не удалось определить индекс этажа для начального (${startNodeId}) или конечного (${endNodeId}) узла.`);
            setErrorMsg("Ошибка данных карты: не удалось определить этаж для точки маршрута.");
            return;
        }


        console.log(`RouteMap: Расчет пути из ${startNodeId} (Э${startFloor}) в ${endNodeId} (Э${endFloor})`);
        console.time(`findShortestPath (${startNodeId} -> ${endNodeId})`);

        const finalPath = findShortestPath(graphData.graph, graphData.nodeCoords, startNodeId, endNodeId);

        console.timeEnd(`findShortestPath (${startNodeId} -> ${endNodeId})`);

        setCalculatedPath(finalPath);

        if (!finalPath) {
            console.log("RouteMap: Путь не найден алгоритмом Дейкстры.");
            // Устанавливаем ошибку, только если она не была установлена ранее
            // if (!errorMsg) { // Эта проверка больше не нужна здесь, т.к. errorMsg нет в зависимостях
            setErrorMsg("Маршрут не найден.");
            // }
        } else {
            console.log("RouteMap: Итоговый путь найден:", finalPath);
            const finalWeight = getPathWeight(graphData.graph, finalPath);
            console.log("RouteMap: Итоговый вес пути:", finalWeight);
            if (finalWeight === Infinity) {
                console.error("RouteMap: Путь найден, но расчет веса вернул Infinity.");
                setErrorMsg("Ошибка расчета маршрута.");
                setCalculatedPath(null);
            }
        }
        // *** УБРАЛИ errorMsg ИЗ МАССИВА ЗАВИСИМОСТЕЙ ***
    }, [fromItem, toItem, graphData, isLoadingGraph, getGraphNodeId]); // Оставляем только реальные зависимости

    // --- useMemo для Рендеринга линии маршрута (остается без изменений) ---
    const renderedPathLines = useMemo(() => {
        if (!calculatedPath || !graphData.nodeCoords || calculatedPath.length < 2) return [];
        const lines = [];
        const nodeCoords = graphData.nodeCoords;
        for (let i = 0; i < calculatedPath.length - 1; i++) {
            const n1Id = calculatedPath[i];
            const n2Id = calculatedPath[i + 1];
            const n1Data = nodeCoords.get(n1Id);
            const n2Data = nodeCoords.get(n2Id);
            if (!n1Data || !n2Data || isNaN(n1Data.x) || isNaN(n1Data.y) || isNaN(n2Data.x) || isNaN(n2Data.y)) {
                console.warn(`Пропуск рендера сегмента ${n1Id}-${n2Id} из-за невалидных данных.`);
                continue;
            };
            if (n1Data.floorIndex !== n2Data.floorIndex) continue;
            if (n1Data.floorIndex === currentFloorIndex) {
                lines.push(
                    <Line
                        key={`path-floor${currentFloorIndex}-${n1Id}-${n2Id}`}
                        points={[n1Data.x, n1Data.y, n2Data.x, n2Data.y]}
                        stroke="rgba(214, 50, 45, 0.9)"
                        strokeWidth={7}
                        lineCap="round"
                        lineJoin="round"
                        dash={[12, 8]}

                        listening={false}
                        perfectDrawEnabled={false}
                    />
                );
            }
        }
        return lines;
    }, [calculatedPath, graphData.nodeCoords, currentFloorIndex]);

    // --- useEffect для Отображения ошибки (остается без изменений) ---
    useEffect(() => {
        if (errorMsg) {
            console.error("Отображена ошибка маршрутизации:", errorMsg);
            // alert(`Ошибка маршрута: ${errorMsg}`);
        }
    }, [errorMsg]); // Этот useEffect *должен* зависеть от errorMsg, чтобы реагировать на его появление

    if (isLoadingGraph) return null;

    return <>{renderedPathLines}</>;
}

export default RouteMap;