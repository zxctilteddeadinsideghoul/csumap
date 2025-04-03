// src/components/RouteMap.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
// Убрали неиспользуемый Line, добавили Text для ошибок
import { Shape, Text } from 'react-konva';
import useStore from './store.jsx'; // Убедись, что путь правильный
import { buildGraph } from './graph.js'; // Убедись, что путь правильный
import { findShortestPath } from './dijkstra.js'; // Убедись, что путь правильный

// --- Вспомогательная функция для расчета веса пути (остается внутри, не экспортируется) ---
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

// --- Основной компонент ---
function RouteMap({ currentFloorIndex, mapDataPath = "src/components/ALL_MAP_YUN_V0.2.json" }) {
    // --- Стейты ---
    const fromItem = useStore((state) => state.fromRoom);
    const toItem = useStore((state) => state.toRoom);
    const [graphData, setGraphData] = useState({ graph: new Map(), nodeCoords: new Map() });
    const [calculatedPath, setCalculatedPath] = useState(null);
    const [isLoadingGraph, setIsLoadingGraph] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null); // Этот стейт теперь используется для вывода ошибки

    // --- Функция getGraphNodeId ---
    const getGraphNodeId = useCallback((item) => {
        // Сбрасываем ошибку ПЕРЕД попыткой найти узел
        // setErrorMsg(null); // НЕ сбрасываем здесь, чтобы не перетирать ошибки из других мест

        if (!item || !item.id) {
            console.warn("getGraphNodeId вызван с невалидным item:", item);
            return null;
        }
        const floorIndex = item.floorIndex;
        const nodeCoordsMap = graphData.nodeCoords; // Для краткости

        try { // Добавим try...catch для большей надежности
            if ((item.type === 'room' || item.type === 'vectorized_room' || item.id.startsWith('r')) && item.type !== 'stair') {
                const doorNodeId = `icon-${item.id}_door`;
                if (nodeCoordsMap.has(doorNodeId)) return doorNodeId;

                const directIconNodeId = `icon-${item.id}`;
                if (nodeCoordsMap.has(directIconNodeId)) {
                    console.warn(`Используем прямую иконку ${directIconNodeId} как fallback для комнаты ${item.id}`);
                    return directIconNodeId;
                }

                const genericIconPrefix = `icon-${item.id}`;
                const relatedIconId = Array.from(nodeCoordsMap.keys()).find(key =>
                    key.startsWith(genericIconPrefix) && nodeCoordsMap.get(key)?.floorIndex === floorIndex
                );
                if (relatedIconId) {
                    console.warn(`Используем ОБЩУЮ иконку ${relatedIconId} как fallback для комнаты ${item.id}`);
                    return relatedIconId;
                }

                console.error(`Не могу найти узел для комнаты '${item.id}' на этаже ${floorIndex}. Отсутствует иконка двери или связанная иконка.`);
                setErrorMsg(`Точка входа для '${item.name || item.id}' не найдена.`);
                return null;

            } else if (item.type === 'icon') {
                const iconNodeId = `icon-${item.id}`;
                if (nodeCoordsMap.has(iconNodeId)) return iconNodeId;

                console.error(`Узел иконки '${iconNodeId}' не найден.`);
                setErrorMsg(`Точка '${item.name || item.id}' не найдена.`);
                return null;

            } else if (item.type === 'stair') {
                const logicalId = item.id.replace(/_floor\d+$/, '');
                const stairIconId = Array.from(nodeCoordsMap.keys()).find(key => {
                    const nodeData = nodeCoordsMap.get(key);
                    return key.startsWith(`icon-ladder${logicalId}_`) &&
                        nodeData?.floorIndex === floorIndex;
                });
                if (stairIconId) return stairIconId;

                // Fallback на любую иконку этой лестницы (менее предпочтительно)
                const anyStairIconId = Array.from(nodeCoordsMap.keys()).find(key => key.startsWith(`icon-ladder${logicalId}_`));
                if (anyStairIconId) {
                    console.warn(`Не найдена иконка лестницы ${logicalId} на этаже ${floorIndex}. Используем fallback: ${anyStairIconId}, но это может быть неверный этаж!`);
                    // НЕ устанавливаем ошибку здесь, чтобы позволить расчету пути найти ее, если нужно
                    return anyStairIconId;
                }


                console.error(`Иконка лестницы для ID ${item.id} (логич. ${logicalId}) на этаже ${floorIndex} не найдена.`);
                setErrorMsg(`Лестница '${item.name || item.id}' не найдена на карте.`);
                return null;

            } else {
                console.warn("Неизвестный тип элемента для getGraphNodeId:", item);
                setErrorMsg(`Неизвестный тип точки: '${item.name || item.id}'.`);
                return null;
            }
        } catch (err) {
            console.error("Критическая ошибка в getGraphNodeId:", err, "для элемента:", item);
            setErrorMsg("Внутренняя ошибка при поиске точки.");
            return null;
        }

    }, [graphData.nodeCoords]); // Убрали setErrorMsg из зависимостей

    // --- useEffect для Загрузки графа ---
    useEffect(() => {
        setIsLoadingGraph(true);
        setErrorMsg(null); // Сброс ошибки при *начале* загрузки
        let isMounted = true;
        console.log("RouteMap: Загрузка данных карты...");
        fetch(mapDataPath)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ошибка! статус: ${response.status}`);
                console.log(`Загрузка Fetch завершена: ${response.method} (${response.url}).`);
                return response.json();
            })
            .then((data) => {
                if (!isMounted) return;
                console.log("RouteMap: Данные карты загружены.");
                if (!data || !Array.isArray(data.layers)) throw new Error("Неверная структура данных карты: массив 'layers' не найден.");

                const processedLayers = data.layers.map((layer, index) => ({ ...layer, floorIndex: index }));
                console.log("RouteMap: Построение графа...");
                console.time("buildGraph (RouteMap)");
                const { graph, nodeCoords } = buildGraph(processedLayers);
                console.timeEnd("buildGraph (RouteMap)");
                console.log("RouteMap: Граф построен. Узлов:", nodeCoords.size, "Ребер (примерно):", graph.size);

                if (nodeCoords.size === 0 || graph.size === 0) {
                    console.error("Построение графа привело к пустому графу или отсутствию узлов.");
                    // Устанавливаем ошибку здесь, если граф пуст
                    setErrorMsg(nodeCoords.size === 0 ? "Ошибка построения карты маршрутов: Нет узлов." : "Ошибка построения карты маршрутов: Нет путей.");
                }
                setGraphData({ graph, nodeCoords });
            })
            .catch(error => {
                if (!isMounted) return;
                console.error("RouteMap: Ошибка загрузки/парсинга/построения графа:", error);
                // Устанавливаем ошибку здесь при ошибке загрузки/обработки
                setErrorMsg(`Ошибка данных карты: ${error.message}`);
            }).finally(() => {
            if (isMounted) setIsLoadingGraph(false);
        });
        return () => { isMounted = false; };
    }, [mapDataPath]); // Зависимость только от пути к данным

    // --- useEffect для Расчета маршрута ---
    useEffect(() => {
        // Условия для НЕрасчета пути
        if (isLoadingGraph || !fromItem || !toItem || graphData.graph.size === 0) {
            setCalculatedPath(null);
            // Не сбрасываем ошибку здесь, она могла быть установлена при загрузке графа
            return;
        }

        setCalculatedPath(null); // Сброс предыдущего пути
        setErrorMsg(null);      // Сброс ошибки ПЕРЕД новым расчетом

        console.log("RouteMap: Попытка рассчитать путь...");
        console.log("Из:", fromItem);
        console.log("В:", toItem);

        const startNodeId = getGraphNodeId(fromItem);
        const endNodeId = getGraphNodeId(toItem);

        // Если getGraphNodeId вернул null, он уже должен был установить errorMsg
        if (!startNodeId || !endNodeId) {
            console.log("RouteMap: ID начального или конечного узла null. Расчет прерван.");
            return; // Ошибка уже установлена в getGraphNodeId
        }

        console.log(`RouteMap: Сопоставленные ID: ${startNodeId} -> ${endNodeId}`);

        // Проверки на существование узлов в графе и координатах
        if (!graphData.graph.has(startNodeId)) {
            console.error(`Начальный узел '${startNodeId}' (для ${fromItem.name || fromItem.id}) не найден в карте графа.`);
            setErrorMsg(`Начальная точка ('${fromItem.name || fromItem.id}') не найдена в графе маршрутов.`);
            return;
        }
        if (!graphData.graph.has(endNodeId)) {
            console.error(`Конечный узел '${endNodeId}' (для ${toItem.name || toItem.id}) не найден в карте графа.`);
            setErrorMsg(`Конечная точка ('${toItem.name || toItem.id}') не найдена в графе маршрутов.`);
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
            console.error(`Не удалось определить индекс этажа для узлов: ${startNodeId} (Эт. ${startFloor}) / ${endNodeId} (Эт. ${endFloor}).`);
            setErrorMsg("Ошибка данных: не удалось определить этаж для точки маршрута.");
            return;
        }

        console.log(`RouteMap: Расчет пути из ${startNodeId} (Э${startFloor}) в ${endNodeId} (Э${endFloor})`);
        console.time(`findShortestPath (${startNodeId} -> ${endNodeId})`);
        try {
            const finalPath = findShortestPath(graphData.graph, graphData.nodeCoords, startNodeId, endNodeId);
            console.timeEnd(`findShortestPath (${startNodeId} -> ${endNodeId})`);

            setCalculatedPath(finalPath); // Устанавливаем путь (может быть null)

            if (!finalPath) {
                console.log("RouteMap: Путь не найден алгоритмом Дейкстры.");
                // Устанавливаем ошибку, только если ее еще нет
                if (!errorMsg) {
                    setErrorMsg("Маршрут не найден.");
                }
            } else {
                console.log("RouteMap: Итоговый путь найден:", finalPath);
                const finalWeight = getPathWeight(graphData.graph, finalPath);
                console.log("RouteMap: Итоговый вес пути:", finalWeight);
                if (finalWeight === Infinity) {
                    console.error("RouteMap: Путь найден, но расчет веса вернул Infinity.");
                    setErrorMsg("Ошибка расчета маршрута (неверный вес).");
                    setCalculatedPath(null); // Сбрасываем путь, если вес некорректен
                }
                // Если путь и вес в порядке, errorMsg остается null
            }
        } catch (dijkstraError) {
            console.error("Ошибка при выполнении findShortestPath:", dijkstraError);
            setErrorMsg(`Ошибка алгоритма поиска пути: ${dijkstraError.message}`);
            setCalculatedPath(null);
        }

    }, [fromItem, toItem, graphData, isLoadingGraph, getGraphNodeId, errorMsg]); // Добавили errorMsg в зависимости, чтобы не перезатирать ошибку Дейкстры при повторном рендере

    // --- useMemo для Рендеринга ШЕВРОНОВ '>>>' маршрута (Версия 3: Исправлено лестницы + разрывы) ---
    const renderedPathChevrons = useMemo(() => {
        // Не рендерим шевроны, если есть ошибка или нет пути
        if (errorMsg || !calculatedPath || !graphData.nodeCoords || calculatedPath.length < 2) {
            return [];
        }

        const nodeCoords = graphData.nodeCoords;
        const CHEVRON_COLOR = 'red';
        const CHEVRON_SIZE = 8;
        const CHEVRON_ANGLE_DEG = 50;
        const CHEVRON_SPACING = 15;
        const CHEVRON_STROKE_WIDTH = 2.5;
        const MIN_SEGMENT_PART_LENGTH = 1e-3;
        const CHEVRON_ANGLE_RAD = CHEVRON_ANGLE_DEG * (Math.PI / 180);
        const isStairNode = (nodeId) => nodeId && nodeId.startsWith('icon-ladder');

        // 1. Сборка НЕПРЕРЫВНЫХ участков пути на ТЕКУЩЕМ этаже
        const continuousSegmentsOnFloor = [];
        let currentPoints = [];

        for (let i = 0; i < calculatedPath.length - 1; i++) {
            const n1Id = calculatedPath[i];
            const n2Id = calculatedPath[i + 1];
            const n1Data = nodeCoords.get(n1Id);
            const n2Data = nodeCoords.get(n2Id);
            let segmentIsDrawableOnThisFloor = false;
            let segmentLength = 0;

            if (n1Data && n2Data && !isNaN(n1Data.x) && !isNaN(n1Data.y) && !isNaN(n2Data.x) && !isNaN(n2Data.y) &&
                n1Data.floorIndex === currentFloorIndex && n2Data.floorIndex === currentFloorIndex)
            {
                if (!(isStairNode(n1Id) && isStairNode(n2Id))) {
                    const dx = n2Data.x - n1Data.x;
                    const dy = n2Data.y - n1Data.y;
                    segmentLength = Math.sqrt(dx * dx + dy * dy);
                    if (segmentLength >= MIN_SEGMENT_PART_LENGTH) {
                        segmentIsDrawableOnThisFloor = true;
                    }
                }
            }

            if (segmentIsDrawableOnThisFloor) {
                const p1 = { x: n1Data.x, y: n1Data.y };
                const p2 = { x: n2Data.x, y: n2Data.y };
                if (currentPoints.length === 0) {
                    currentPoints.push(p1, p2);
                } else {
                    const lastPoint = currentPoints[currentPoints.length - 1];
                    if (Math.abs(lastPoint.x - p1.x) < 1e-6 && Math.abs(lastPoint.y - p1.y) < 1e-6) {
                        currentPoints.push(p2);
                    } else {
                        if (currentPoints.length >= 2) continuousSegmentsOnFloor.push([...currentPoints]);
                        currentPoints = [p1, p2];
                    }
                }
            } else {
                if (currentPoints.length >= 2) continuousSegmentsOnFloor.push([...currentPoints]);
                currentPoints = [];
            }
        }
        if (currentPoints.length >= 2) continuousSegmentsOnFloor.push([...currentPoints]);

        // 2. Отрисовка шевронов для КАЖДОГО непрерывного участка
        const allChevrons = [];
        continuousSegmentsOnFloor.forEach((points, segmentArrayIndex) => {
            if (points.length < 2) return;

            const segmentPartLengths = [];
            let totalLengthOfThisSegment = 0;
            for (let j = 0; j < points.length - 1; j++) {
                const p1 = points[j];
                const p2 = points[j + 1];
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                if (length >= MIN_SEGMENT_PART_LENGTH) {
                    segmentPartLengths.push(length);
                    totalLengthOfThisSegment += length;
                } else {
                    segmentPartLengths.push(0);
                }
            }

            if (points.length !== segmentPartLengths.length + 1) {
                console.error(`!!! ВНУТРЕННЯЯ ОШИБКА УЧАСТКА ${segmentArrayIndex}: Точек ${points.length}, Частей ${segmentPartLengths.length}`);
                return;
            }
            if (totalLengthOfThisSegment < CHEVRON_SPACING * 0.1) return;

            const getPointAtDistanceLocal = (distance) => {
                distance = Math.max(0, Math.min(distance, totalLengthOfThisSegment));
                if (totalLengthOfThisSegment < 1e-6) return { ...points[0], partIndex: 0, partRatio: 0 };
                if (distance <= 1e-6) return { ...points[0], partIndex: 0, partRatio: 0 };
                if (distance >= totalLengthOfThisSegment - 1e-6) return { ...points[points.length - 1], partIndex: segmentPartLengths.length - 1, partRatio: 1 };

                let accumulatedLength = 0;
                for (let i = 0; i < segmentPartLengths.length; i++) {
                    const currentPartLength = segmentPartLengths[i];
                    if (distance >= accumulatedLength - 1e-6 && distance <= accumulatedLength + currentPartLength + 1e-6) {
                        const startPoint = points[i];
                        const endPoint = points[i + 1];
                        if (!startPoint || !endPoint) {
                            console.error(`GetPointAtDistanceLocal: точки части ${i} участка ${segmentArrayIndex} не найдены.`);
                            return { ...points[points.length - 1], partIndex: segmentPartLengths.length - 1, partRatio: 1 };
                        }
                        const distanceAlongPart = distance - accumulatedLength;
                        const ratio = (currentPartLength < MIN_SEGMENT_PART_LENGTH) ? 0 : Math.max(0, Math.min(1, distanceAlongPart / currentPartLength));
                        const x = startPoint.x + (endPoint.x - startPoint.x) * ratio;
                        const y = startPoint.y + (endPoint.y - startPoint.y) * ratio;
                        return { x, y, partIndex: i, partRatio: ratio };
                    }
                    accumulatedLength += currentPartLength;
                }
                console.warn("getPointAtDistanceLocal не смогла найти точку для distance", distance, "на участке", segmentArrayIndex);
                return { ...points[points.length - 1], partIndex: segmentPartLengths.length - 1, partRatio: 1 };
            };

            let currentDistance = CHEVRON_SPACING / 2;
            while (currentDistance < totalLengthOfThisSegment) {
                const tipPoint = getPointAtDistanceLocal(currentDistance);
                let partIndex = tipPoint.partIndex;
                let ux = 0, uy = 0;
                let directionFound = false;

                const getDirection = (idx) => {
                    if (idx >= 0 && idx < segmentPartLengths.length && segmentPartLengths[idx] >= MIN_SEGMENT_PART_LENGTH) {
                        const p1 = points[idx]; const p2 = points[idx + 1];
                        if(p1 && p2) {
                            const dx = p2.x - p1.x; const dy = p2.y - p1.y;
                            ux = dx / segmentPartLengths[idx]; uy = dy / segmentPartLengths[idx];
                            return true;
                        }
                    } return false;
                };

                if (getDirection(partIndex)) { directionFound = true; }
                else { for (let i = partIndex - 1; i >= 0; i--) if (getDirection(i)) { directionFound = true; break; } }
                if (!directionFound) { for (let i = partIndex + 1; i < segmentPartLengths.length; i++) if (getDirection(i)) { directionFound = true; break; } }

                if (!directionFound) {
                    console.warn(`Не найдено направление (участок ${segmentArrayIndex}) на дистанции ${currentDistance}`);
                    currentDistance += CHEVRON_SPACING; continue;
                }

                const angle = Math.atan2(uy, ux);
                const angle1 = angle - CHEVRON_ANGLE_RAD / 2;
                const angle2 = angle + CHEVRON_ANGLE_RAD / 2;
                const backPoint1 = { x: tipPoint.x - CHEVRON_SIZE * Math.cos(angle1), y: tipPoint.y - CHEVRON_SIZE * Math.sin(angle1) };
                const backPoint2 = { x: tipPoint.x - CHEVRON_SIZE * Math.cos(angle2), y: tipPoint.y - CHEVRON_SIZE * Math.sin(angle2) };

                allChevrons.push(
                    <Shape
                        key={`chevron-seg${segmentArrayIndex}-dist-${currentDistance.toFixed(2)}`}
                        sceneFunc={(context, shape) => {
                            context.beginPath();
                            context.moveTo(backPoint1.x, backPoint1.y);
                            context.lineTo(tipPoint.x, tipPoint.y);
                            context.lineTo(backPoint2.x, backPoint2.y);
                            context.fillStrokeShape(shape);
                        }}
                        stroke={CHEVRON_COLOR} strokeWidth={CHEVRON_STROKE_WIDTH}
                        lineCap="round" lineJoin="round"
                        listening={false} perfectDrawEnabled={false}
                    />
                );
                currentDistance += CHEVRON_SPACING;
            }
        });
        return allChevrons;

        // Добавили errorMsg в зависимости useMemo, чтобы очищать шевроны при появлении ошибки
    }, [calculatedPath, graphData.nodeCoords, currentFloorIndex, errorMsg]);

    // --- Рендер компонента ---

    // Пока грузится граф, ничего не рисуем (или можно показать индикатор)
    if (isLoadingGraph) {
        // Можно вернуть индикатор загрузки Konva, если нужно
        // return <Text x={10} y={10} text="Загрузка карты..." fill="grey" />;
        return null;
    }

    // Если есть ошибка, показываем ее ТЕКСТОМ
    if (errorMsg) {
        console.error("RouteMap рендерит ошибку:", errorMsg); // Лог ошибки все еще полезен
        return (
            <Text
                x={20} // Настройте позицию текста ошибки
                y={20}
                text={`Ошибка маршрута: ${errorMsg}`}
                fill="darkred" // Сделаем цвет потемнее
                fontSize={16}
                fontStyle="bold"
                listening={false} // Текст не должен перехватывать клики
                wrap="char" // Перенос по символам, если текст длинный
                width={400} // Задайте ширину для переноса
            />
        );
    }

    // Если загрузка завершена И ошибки нет, рендерим шевроны
    // renderedPathChevrons будет пустым массивом, если from/to не выбраны или путь не найден (но ошибки нет)
    return <>{renderedPathChevrons}</>;
}

// Экспортируем компонент по умолчанию (для Fast Refresh и использования в других местах)
export default RouteMap;