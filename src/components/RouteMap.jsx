// src/components/RouteMap.jsx
import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Shape, Text } from 'react-konva';
import useStore from './store.jsx';
import { buildGraph } from './graph.js';
import { findShortestPath } from './dijkstra.js';

// Отладочный флаг - установите в false, чтобы уменьшить количество логов в продакшене
const DETAILED_DEBUG = true;

function getPathWeight(graph, path) {
    // ... (код без изменений)
    if (!path || path.length < 2) return Infinity;
    let totalWeight = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const u = path[i];
        const v = path[i + 1];
        const edgeWeight = graph.get(u)?.get(v);
        if (edgeWeight === undefined || isNaN(edgeWeight)) {
            if (DETAILED_DEBUG) console.warn(`[getPathWeight] Ребро не найдено или вес некорректен между ${u} и ${v}.`);
            return Infinity;
        }
        totalWeight += edgeWeight;
    }
    return totalWeight;
}

function RouteMap({ currentFloorIndex, mapDataPath = "https://staticstorm.ru/map/map_data2" }) {
    const fromItem = useStore((state) => state.fromRoom);
    const toItem = useStore((state) => state.toRoom);
    const [graphData, setGraphData] = useState({ graph: new Map(), nodeCoords: new Map() });
    const [calculatedPath, setCalculatedPath] = useState(null);
    const [isLoadingGraph, setIsLoadingGraph] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    const getGraphNodeId = useCallback((item) => {
        // ... (код без изменений, setErrorMsg используется)
        if (!item || !item.id) {
            if (DETAILED_DEBUG) console.warn("[getGraphNodeId] Вызван с невалидным item:", item);
            return null;
        }
        const floorIndex = item.floorIndex;
        const nodeCoordsMap = graphData.nodeCoords;

        try {
            if ((item.type === 'room' || item.type === 'vectorized_room' || item.id.startsWith('r')) && item.type !== 'stair') {
                const doorNodeId = `icon-${item.id}_door`;
                if (nodeCoordsMap.has(doorNodeId)) return doorNodeId;
                const directIconNodeId = `icon-${item.id}`;
                if (nodeCoordsMap.has(directIconNodeId)) {
                    if (DETAILED_DEBUG) console.warn(`[getGraphNodeId] Используем прямую иконку ${directIconNodeId} как fallback для комнаты ${item.id}`);
                    return directIconNodeId;
                }
                const genericIconPrefix = `icon-${item.id}`;
                const relatedIconId = Array.from(nodeCoordsMap.keys()).find(key => key.startsWith(genericIconPrefix) && nodeCoordsMap.get(key)?.floorIndex === floorIndex);
                if (relatedIconId) {
                    if (DETAILED_DEBUG) console.warn(`[getGraphNodeId] Используем ОБЩУЮ иконку ${relatedIconId} как fallback для комнаты ${item.id}`);
                    return relatedIconId;
                }
                console.error(`[getGraphNodeId] Не могу найти узел для комнаты '${item.id}' на этаже ${floorIndex}.`);
                setErrorMsg(`Точка входа для '${item.name || item.id}' не найдена.`); // Установка ошибки здесь OK
                return null;
            } else if (item.type === 'icon') {
                const iconNodeId = `icon-${item.id}`;
                if (nodeCoordsMap.has(iconNodeId)) return iconNodeId;
                console.error(`[getGraphNodeId] Узел иконки '${iconNodeId}' не найден.`);
                setErrorMsg(`Точка '${item.name || item.id}' не найдена.`); // Установка ошибки здесь OK
                return null;
            } else if (item.type === 'stair') {
                const logicalId = item.id.replace(/_floor\d+$/, '');
                const stairIconId = Array.from(nodeCoordsMap.keys()).find(key => key.startsWith(`icon-ladder${logicalId}_`) && nodeCoordsMap.get(key)?.floorIndex === floorIndex);
                if (stairIconId) return stairIconId;
                const anyStairIconId = Array.from(nodeCoordsMap.keys()).find(key => key.startsWith(`icon-ladder${logicalId}_`));
                if (anyStairIconId) {
                    if (DETAILED_DEBUG) console.warn(`[getGraphNodeId] Не найдена иконка лестницы ${logicalId} на этаже ${floorIndex}. Используем fallback: ${anyStairIconId}`);
                    return anyStairIconId;
                }
                console.error(`[getGraphNodeId] Иконка лестницы для ID ${item.id} (логич. ${logicalId}) на этаже ${floorIndex} не найдена.`);
                setErrorMsg(`Лестница '${item.name || item.id}' не найдена на карте.`); // Установка ошибки здесь OK
                return null;
            } else {
                if (DETAILED_DEBUG) console.warn("[getGraphNodeId] Неизвестный тип элемента:", item);
                setErrorMsg(`Неизвестный тип точки: '${item.name || item.id}'.`); // Установка ошибки здесь OK
                return null;
            }
        } catch (err) {
            console.error("[getGraphNodeId] Критическая ошибка:", err, "для элемента:", item);
            setErrorMsg("Внутренняя ошибка при поиске точки."); // Установка ошибки здесь OK
            return null;
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [graphData.nodeCoords]); // Оставляем setErrorMsg вне зависимостей, т.к. он только устанавливается

    useEffect(() => {
        // ... (код загрузки графа без изменений)
        setIsLoadingGraph(true);
        setErrorMsg(null);
        setCalculatedPath(null); // Сброс пути при начале загрузки
        let isMounted = true;
        if (DETAILED_DEBUG) console.log("[Graph Load] Загрузка данных карты...");
        fetch(mapDataPath)
            .then((response) => {
                if (!response.ok) throw new Error(`HTTP ошибка! статус: ${response.status}`);
                if (DETAILED_DEBUG) console.log(`[Graph Load] Загрузка Fetch завершена: ${response.method} (${response.url}).`);
                return response.json();
            })
            .then((data) => {
                if (!isMounted) return;
                if (DETAILED_DEBUG) console.log("[Graph Load] Данные карты загружены.");
                if (!data || !Array.isArray(data.layers)) throw new Error("Неверная структура данных карты.");

                const processedLayers = data.layers.map((layer, index) => ({ ...layer, floorIndex: index }));
                if (DETAILED_DEBUG) console.log("[Graph Load] Построение графа...");
                console.time("buildGraph (RouteMap)");
                const { graph, nodeCoords } = buildGraph(processedLayers);
                console.timeEnd("buildGraph (RouteMap)");
                if (DETAILED_DEBUG) console.log("[Graph Load] Граф построен. Узлов:", nodeCoords.size, "Ребер (примерно):", graph.size);

                if (nodeCoords.size === 0 || graph.size === 0) {
                    console.error("[Graph Load] Построение графа привело к пустому графу или отсутствию узлов.");
                    setErrorMsg(nodeCoords.size === 0 ? "Ошибка карты: Нет узлов." : "Ошибка карты: Нет путей.");
                }
                setGraphData({ graph, nodeCoords });
            })
            .catch(error => {
                if (!isMounted) return;
                console.error("[Graph Load] Ошибка загрузки/парсинга/построения графа:", error);
                setErrorMsg(`Ошибка данных карты: ${error.message}`);
            }).finally(() => {
            if (isMounted) setIsLoadingGraph(false);
            if (DETAILED_DEBUG) console.log("[Graph Load] Загрузка завершена. isLoadingGraph =", false);
        });
        return () => { isMounted = false; };
    }, [mapDataPath]);

    useEffect(() => {
        if (DETAILED_DEBUG) console.log("[Path Effect] Запуск эффекта расчета пути. Зависимости:", { isLoadingGraph, fromItemId: fromItem?.id, toItemId: toItem?.id, graphSize: graphData.graph.size });

        // --- Начальные проверки и условия выхода ---
        if (isLoadingGraph) {
            if (DETAILED_DEBUG) console.log("[Path Effect] Выход: Граф еще грузится.");
            return;
        }
        if (!fromItem || !toItem) {
            if (DETAILED_DEBUG) console.log("[Path Effect] Выход: 'От' или 'До' не выбраны. Сброс.");
            // Сбрасываем здесь, если точки не выбраны ПОСЛЕ загрузки графа
            setCalculatedPath(null);
            setErrorMsg(null);
            return;
        }
        if (graphData.graph.size === 0) {
            // Если граф пуст, устанавливаем ошибку (если ее еще нет от загрузки) и выходим
            if (DETAILED_DEBUG) console.log("[Path Effect] Выход: Граф пуст.");
            if (!errorMsg) { // Только если нет ошибки от загрузки
                setErrorMsg("Карта маршрутов пуста.");
            }
            setCalculatedPath(null);
            return;
        }
        if (fromItem.id === toItem.id) {
            if (DETAILED_DEBUG) console.log("[Path Effect] Выход: Точки совпадают. Сброс.");
            setCalculatedPath(null);
            setErrorMsg(null);
            return;
        }

        // --- Начинаем активный расчет ---
        if (DETAILED_DEBUG) console.log("[Path Effect] Попытка рассчитать путь...");
        if (DETAILED_DEBUG) console.log("[Path Effect] Из:", fromItem.id, "В:", toItem.id);

        // БЕЗУСЛОВНО сбрасываем состояние перед расчетом, чтобы удовлетворить exhaustive-deps
        setCalculatedPath(null);
        setErrorMsg(null);

        const startNodeId = getGraphNodeId(fromItem);
        const endNodeId = getGraphNodeId(toItem);
        if (DETAILED_DEBUG) console.log(`[Path Effect] Сопоставленные ID: ${startNodeId} -> ${endNodeId}`);

        // Если getGraphNodeId вернул null, он УЖЕ установил setErrorMsg.
        // Мы только что сбросили errorMsg, так что здесь нужно проверить ID и выйти,
        // сообщение об ошибке будет установлено в следующем рендере из-за getGraphNodeId.
        if (!startNodeId || !endNodeId) {
            if (DETAILED_DEBUG) console.log("[Path Effect] Выход: ID узла null (ошибка будет установлена в getGraphNodeId).");
            // Не устанавливаем ошибку здесь повторно
            return;
        }

        // --- Проверки узлов ---
        if (!graphData.graph.has(startNodeId)) {
            console.error(`[Path Effect] Начальный узел '${startNodeId}' не найден в графе.`);
            setErrorMsg(`Начальная точка ('${fromItem.name || fromItem.id}') не найдена на карте.`);
            return;
        }
        if (!graphData.graph.has(endNodeId)) {
            console.error(`[Path Effect] Конечный узел '${endNodeId}' не найден в графе.`);
            setErrorMsg(`Конечная точка ('${toItem.name || toItem.id}') не найдена на карте.`);
            return;
        }
        const startNodeData = graphData.nodeCoords.get(startNodeId);
        const endNodeData = graphData.nodeCoords.get(endNodeId);
        if (!startNodeData || !endNodeData) {
            console.error(`[Path Effect] Координаты узла отсутствуют: start=${!!startNodeData}, end=${!!endNodeData}`);
            setErrorMsg("Ошибка данных карты: Координаты точки не найдены.");
            return;
        }
        const startFloor = startNodeData.floorIndex;
        const endFloor = endNodeData.floorIndex;
        if (startFloor === undefined || endFloor === undefined) {
            console.error(`[Path Effect] Не удалось определить этаж: ${startNodeId}(${startFloor}) / ${endNodeId}(${endFloor}).`);
            setErrorMsg("Ошибка данных карты: Этаж не определен.");
            return;
        }

        // --- Вызов Дейкстры ---
        if (DETAILED_DEBUG) console.log(`[Path Effect] Расчет пути из ${startNodeId} (Э${startFloor}) в ${endNodeId} (Э${endFloor})`);
        console.time(`findShortestPath (${startNodeId} -> ${endNodeId})`);
        try {
            const finalPath = findShortestPath(graphData.graph, graphData.nodeCoords, startNodeId, endNodeId);
            console.timeEnd(`findShortestPath (${startNodeId} -> ${endNodeId})`);

            if (!finalPath) {
                if (DETAILED_DEBUG) console.log("[Path Effect] Путь не найден алгоритмом Дейкстры.");
                setErrorMsg("Маршрут не найден.");
                // calculatedPath уже null
            } else {
                if (DETAILED_DEBUG) console.log("[Path Effect] Итоговый путь найден:", finalPath);
                const finalWeight = getPathWeight(graphData.graph, finalPath);
                if (DETAILED_DEBUG) console.log("[Path Effect] Итоговый вес пути:", finalWeight);

                if (finalWeight === Infinity) {
                    console.error("[Path Effect] Путь найден, но вес некорректен (Infinity).");
                    setErrorMsg("Ошибка расчета маршрута (неверный вес).");
                    // calculatedPath уже null
                } else {
                    if (DETAILED_DEBUG) console.log("[Path Effect] УСПЕХ: Установка calculatedPath.");
                    // errorMsg уже null
                    setCalculatedPath(finalPath);
                }
            }
        } catch (dijkstraError) {
            console.error("[Path Effect] Ошибка при выполнении findShortestPath:", dijkstraError);
            setErrorMsg(`Ошибка алгоритма: ${dijkstraError.message}`);
            // calculatedPath уже null
        }
        // Зависимости теперь корректны, т.к. нет чтения calculatedPath/errorMsg для их сброса
    }, [fromItem, toItem, graphData, isLoadingGraph, getGraphNodeId]);

    const renderedPathChevrons = useMemo(() => {
        const startMemoTime = performance.now();
        if (DETAILED_DEBUG) console.log('[Chevron Render] === Запуск useMemo ===', { pathLength: calculatedPath?.length, nodesCount: graphData.nodeCoords.size, currentFloorIndex, errorMsg });

        // ... (условия выхода без изменений)
        if (errorMsg) {
            if (DETAILED_DEBUG) console.log('[Chevron Render] Выход: присутствует errorMsg:', errorMsg);
            return [];
        }
        if (!calculatedPath) {
            if (DETAILED_DEBUG) console.log('[Chevron Render] Выход: calculatedPath is null/undefined.');
            return [];
        }
        if (calculatedPath.length < 2) {
            if (DETAILED_DEBUG) console.log('[Chevron Render] Выход: Длина пути < 2.');
            return [];
        }
        if (!graphData.nodeCoords || graphData.nodeCoords.size === 0) {
            if (DETAILED_DEBUG) console.warn('[Chevron Render] Выход: Отсутствуют координаты узлов (nodeCoords).');
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

        if (DETAILED_DEBUG) console.log('[Chevron Render] Обрабатываемый путь:', calculatedPath);
        if (DETAILED_DEBUG) console.log('[Chevron Render] Текущий этаж для рендера:', currentFloorIndex);

        // 1. Сборка НЕПРЕРЫВНЫХ участков пути на ТЕКУЩЕМ этаже
        const continuousSegmentsOnFloor = [];
        let currentPoints = [];
        if (DETAILED_DEBUG) console.groupCollapsed('[Chevron Render] Построение непрерывных сегментов на этаже');
        // ... (логика и логи построения сегментов без изменений)
        for (let i = 0; i < calculatedPath.length - 1; i++) {
            const n1Id = calculatedPath[i];
            const n2Id = calculatedPath[i + 1];
            const n1Data = nodeCoords.get(n1Id);
            const n2Data = nodeCoords.get(n2Id);
            let segmentIsDrawableOnThisFloor = false;
            let segmentLength = 0;

            if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${i}: ${n1Id} -> ${n2Id}`);

            if (!n1Data || !n2Data) {
                if (DETAILED_DEBUG) console.warn(`[Chevron Render] Сегмент ${i}: Данные узла отсутствуют! n1=${!!n1Data}, n2=${!!n2Data}`);
                if (currentPoints.length >= 2) {
                    if (DETAILED_DEBUG) console.log(`[Chevron Render] Завершаем предыдущий сегмент из-за отсутствия данных узла. Точек: ${currentPoints.length}`);
                    continuousSegmentsOnFloor.push([...currentPoints]);
                }
                currentPoints = [];
                continue;
            }

            if (isNaN(n1Data.x) || isNaN(n1Data.y) || isNaN(n2Data.x) || isNaN(n2Data.y)) {
                if (DETAILED_DEBUG) console.warn(`[Chevron Render] Сегмент ${i}: Невалидные координаты! n1=(${n1Data.x}, ${n1Data.y}), n2=(${n2Data.x}, ${n2Data.y})`);
                if (currentPoints.length >= 2) {
                    if (DETAILED_DEBUG) console.log(`[Chevron Render] Завершаем предыдущий сегмент из-за невалидных координат. Точек: ${currentPoints.length}`);
                    continuousSegmentsOnFloor.push([...currentPoints]);
                }
                currentPoints = [];
                continue;
            }

            const isOnCurrentFloor = n1Data.floorIndex === currentFloorIndex && n2Data.floorIndex === currentFloorIndex;
            if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${i}: Этажи (${n1Data.floorIndex}, ${n2Data.floorIndex}). На текущем (${currentFloorIndex})? ${isOnCurrentFloor}`);

            if (isOnCurrentFloor) {
                const isStairSegment = isStairNode(n1Id) && isStairNode(n2Id);
                if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${i}: Лестничный? ${isStairSegment}`);

                if (!isStairSegment) {
                    const dx = n2Data.x - n1Data.x;
                    const dy = n2Data.y - n1Data.y;
                    segmentLength = Math.sqrt(dx * dx + dy * dy);
                    if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${i}: Длина = ${segmentLength.toFixed(3)}`);
                    if (segmentLength >= MIN_SEGMENT_PART_LENGTH) {
                        segmentIsDrawableOnThisFloor = true;
                    } else {
                        if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${i}: Пропуск (слишком короткий).`);
                    }
                } else {
                    if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${i}: Пропуск (лестничный сегмент на одном этаже).`);
                }
            }

            if (segmentIsDrawableOnThisFloor) {
                const p1 = { x: n1Data.x, y: n1Data.y };
                const p2 = { x: n2Data.x, y: n2Data.y };
                if (currentPoints.length === 0) {
                    currentPoints.push(p1, p2);
                    if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${i}: Начало нового непрерывного сегмента. Добавлены точки:`, [p1, p2]);
                } else {
                    const lastPoint = currentPoints[currentPoints.length - 1];
                    if (Math.abs(lastPoint.x - p1.x) < 1e-6 && Math.abs(lastPoint.y - p1.y) < 1e-6) {
                        currentPoints.push(p2);
                        if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${i}: Продолжение сегмента. Добавлена точка:`, p2);
                    } else {
                        if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${i}: Разрыв! Предыдущая (${lastPoint.x.toFixed(1)}, ${lastPoint.y.toFixed(1)}), Текущая (${p1.x.toFixed(1)}, ${p1.y.toFixed(1)})`);
                        if (currentPoints.length >= 2) {
                            if (DETAILED_DEBUG) console.log(`[Chevron Render] Завершаем предыдущий сегмент из-за разрыва. Точек: ${currentPoints.length}`);
                            continuousSegmentsOnFloor.push([...currentPoints]);
                        }
                        currentPoints = [p1, p2];
                        if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${i}: Начало нового сегмента после разрыва. Добавлены точки:`, [p1, p2]);
                    }
                }
            } else {
                if (currentPoints.length >= 2) {
                    if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${i} не рисуется. Завершаем предыдущий непрерывный сегмент. Точек: ${currentPoints.length}`);
                    continuousSegmentsOnFloor.push([...currentPoints]);
                }
                currentPoints = [];
            }
        }
        if (currentPoints.length >= 2) {
            if (DETAILED_DEBUG) console.log(`[Chevron Render] Добавляем последний собранный сегмент. Точек: ${currentPoints.length}`);
            continuousSegmentsOnFloor.push([...currentPoints]);
        }

        if (DETAILED_DEBUG) console.log(`[Chevron Render] Итого непрерывных сегментов на этаже ${currentFloorIndex}:`, continuousSegmentsOnFloor.length);
        if (DETAILED_DEBUG) console.groupEnd();

        // 2. Отрисовка шевронов для КАЖДОГО непрерывного участка
        const allChevrons = [];
        if (DETAILED_DEBUG) console.groupCollapsed('[Chevron Render] Отрисовка шевронов для сегментов');

        continuousSegmentsOnFloor.forEach((points, segmentArrayIndex) => {
            if (DETAILED_DEBUG) console.group(`[Chevron Render] Обработка сегмента ${segmentArrayIndex} (${points.length} точек)`);
            if (points.length < 2) {
                // ... (пропуск без изменений)
                if (DETAILED_DEBUG) console.log('[Chevron Render] Пропуск сегмента (менее 2 точек).');
                if (DETAILED_DEBUG) console.groupEnd();
                return;
            }

            // ... (расчет длин частей и totalLengthOfThisSegment без изменений)
            const segmentPartLengths = [];
            let totalLengthOfThisSegment = 0;
            if (DETAILED_DEBUG) console.groupCollapsed(`[Chevron Render] Сегмент ${segmentArrayIndex}: Расчет длин частей`);
            for (let j = 0; j < points.length - 1; j++) {
                const p1 = points[j];
                const p2 = points[j + 1];
                if (!p1 || !p2 || isNaN(p1.x) || isNaN(p1.y) || isNaN(p2.x) || isNaN(p2.y)) {
                    if (DETAILED_DEBUG) console.warn(`[Chevron Render] Сегмент ${segmentArrayIndex}, часть ${j}: Невалидные точки! p1=${!!p1}, p2=${!!p2}`);
                    segmentPartLengths.push(0);
                    continue;
                }
                const dx = p2.x - p1.x;
                const dy = p2.y - p1.y;
                const length = Math.sqrt(dx * dx + dy * dy);
                if (length >= MIN_SEGMENT_PART_LENGTH) {
                    segmentPartLengths.push(length);
                    totalLengthOfThisSegment += length;
                    if (DETAILED_DEBUG) console.log(`[Chevron Render] Часть ${j}: (${p1.x.toFixed(1)}, ${p1.y.toFixed(1)}) -> (${p2.x.toFixed(1)}, ${p2.y.toFixed(1)}), Длина: ${length.toFixed(3)}`);
                } else {
                    segmentPartLengths.push(0);
                    if (DETAILED_DEBUG) console.log(`[Chevron Render] Часть ${j}: Длина < ${MIN_SEGMENT_PART_LENGTH}, считаем 0.`);
                }
            }
            if (DETAILED_DEBUG) console.groupEnd();
            if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${segmentArrayIndex}: Итоговая длина ${totalLengthOfThisSegment.toFixed(3)}, частей: ${segmentPartLengths.length}`);


            if (points.length !== segmentPartLengths.length + 1) {
                // ... (ошибка и пропуск без изменений)
                console.error(`[Chevron Render] ВНУТРЕННЯЯ ОШИБКА СЕГМЕНТА ${segmentArrayIndex}: Точек ${points.length}, Частей ${segmentPartLengths.length}. Пропуск отрисовки шевронов для этого сегмента.`);
                if (DETAILED_DEBUG) console.groupEnd();
                return;
            }
            if (totalLengthOfThisSegment < CHEVRON_SPACING * 0.1) {
                // ... (пропуск короткого сегмента без изменений)
                if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${segmentArrayIndex}: Пропуск отрисовки (слишком короткий, ${totalLengthOfThisSegment.toFixed(3)} < ${CHEVRON_SPACING * 0.1})`);
                if (DETAILED_DEBUG) console.groupEnd();
                return;
            }

            // ... (getPointAtDistanceLocal без изменений)
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
                            console.error(`[getPointAtDistanceLocal] Сегмент ${segmentArrayIndex}, часть ${i}: точки не найдены.`);
                            return { ...points[points.length - 1], partIndex: segmentPartLengths.length - 1, partRatio: 1 };
                        }
                        const distanceAlongPart = distance - accumulatedLength;
                        const ratio = (currentPartLength < MIN_SEGMENT_PART_LENGTH) ? 0 : Math.max(0, Math.min(1, distanceAlongPart / currentPartLength));
                        if (isNaN(startPoint.x) || isNaN(startPoint.y) || isNaN(endPoint.x) || isNaN(endPoint.y)) {
                            console.error(`[getPointAtDistanceLocal] Сегмент ${segmentArrayIndex}, часть ${i}: NaN координаты в точках!`);
                            return { ...points[points.length - 1], partIndex: segmentPartLengths.length - 1, partRatio: 1 };
                        }
                        const x = startPoint.x + (endPoint.x - startPoint.x) * ratio;
                        const y = startPoint.y + (endPoint.y - startPoint.y) * ratio;
                        if (isNaN(x) || isNaN(y)) {
                            console.error(`[getPointAtDistanceLocal] Сегмент ${segmentArrayIndex}, часть ${i}: Результат (x,y) = NaN! ratio=${ratio}`);
                            return { ...points[points.length - 1], partIndex: segmentPartLengths.length - 1, partRatio: 1 };
                        }
                        return { x, y, partIndex: i, partRatio: ratio };
                    }
                    accumulatedLength += currentPartLength;
                }
                console.warn(`[getPointAtDistanceLocal] Сегмент ${segmentArrayIndex}: Не удалось найти точку для distance ${distance} (total: ${totalLengthOfThisSegment}). Возврат последней точки.`);
                return { ...points[points.length - 1], partIndex: segmentPartLengths.length - 1, partRatio: 1 };
            };

            let currentDistance = CHEVRON_SPACING / 2;
            // ИСПРАВЛЕНО: const -> let
            let segmentChevronsCount = 0;
            if (DETAILED_DEBUG) console.groupCollapsed(`[Chevron Render] Сегмент ${segmentArrayIndex}: Генерация шевронов`);

            while (currentDistance < totalLengthOfThisSegment) {
                // ... (логика генерации одного шеврона без изменений, включая проверки на NaN)
                if (DETAILED_DEBUG) console.log(`[Chevron Render] Дистанция ${currentDistance.toFixed(2)} / ${totalLengthOfThisSegment.toFixed(2)}`);
                const tipPoint = getPointAtDistanceLocal(currentDistance);
                if (isNaN(tipPoint.x) || isNaN(tipPoint.y)) {
                    console.error(`[Chevron Render] Сегмент ${segmentArrayIndex}: Получена NaN точка для шеврона на дистанции ${currentDistance}. Пропуск шеврона.`);
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }

                let partIndex = tipPoint.partIndex;
                let ux = 0, uy = 0;
                let directionFound = false;

                const getDirection = (idx) => {
                    if (idx >= 0 && idx < segmentPartLengths.length && segmentPartLengths[idx] >= MIN_SEGMENT_PART_LENGTH) {
                        const p1 = points[idx];
                        const p2 = points[idx + 1];
                        if (p1 && p2 && !isNaN(p1.x) && !isNaN(p1.y) && !isNaN(p2.x) && !isNaN(p2.y)) {
                            const dx = p2.x - p1.x; const dy = p2.y - p1.y;
                            ux = dx / segmentPartLengths[idx]; uy = dy / segmentPartLengths[idx];
                            if (isNaN(ux) || isNaN(uy)) {
                                console.warn(`[Chevron Render][getDirection] NaN в векторе направления для части ${idx} сегмента ${segmentArrayIndex}`);
                                return false;
                            }
                            return true;
                        } else {
                            if (DETAILED_DEBUG) console.warn(`[Chevron Render][getDirection] Невалидные точки для части ${idx} сегмента ${segmentArrayIndex}`);
                            return false;
                        }
                    }
                    return false;
                };

                if (getDirection(partIndex)) { directionFound = true; }
                else {
                    for (let i = partIndex - 1; i >= 0; i--) if (getDirection(i)) { directionFound = true; break; }
                }
                if (!directionFound) {
                    for (let i = partIndex + 1; i < segmentPartLengths.length; i++) if (getDirection(i)) { directionFound = true; break; }
                }

                if (!directionFound) {
                    console.warn(`[Chevron Render] Сегмент ${segmentArrayIndex}: Не удалось найти направление для шеврона на дистанции ${currentDistance.toFixed(2)}. Пропуск шеврона.`);
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }

                if (DETAILED_DEBUG) console.log(`[Chevron Render] Направление найдено: (${ux.toFixed(3)}, ${uy.toFixed(3)})`);
                const angle = Math.atan2(uy, ux);
                const angle1 = angle - CHEVRON_ANGLE_RAD / 2;
                const angle2 = angle + CHEVRON_ANGLE_RAD / 2;
                const backPoint1 = { x: tipPoint.x - CHEVRON_SIZE * Math.cos(angle1), y: tipPoint.y - CHEVRON_SIZE * Math.sin(angle1) };
                const backPoint2 = { x: tipPoint.x - CHEVRON_SIZE * Math.cos(angle2), y: tipPoint.y - CHEVRON_SIZE * Math.sin(angle2) };

                if (isNaN(backPoint1.x) || isNaN(backPoint1.y) || isNaN(backPoint2.x) || isNaN(backPoint2.y)) {
                    console.error(`[Chevron Render] Сегмент ${segmentArrayIndex}: NaN в координатах точек шеврона! Пропуск шеврона.`, {tipPoint, angle, angle1, angle2, backPoint1, backPoint2});
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }

                if (DETAILED_DEBUG) console.log(`[Chevron Render] Геометрия шеврона: tip=(${tipPoint.x.toFixed(1)}, ${tipPoint.y.toFixed(1)}), back1=(${backPoint1.x.toFixed(1)}, ${backPoint1.y.toFixed(1)}), back2=(${backPoint2.x.toFixed(1)}, ${backPoint2.y.toFixed(1)})`);

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
                // ИСПРАВЛЕНО: инкремент переменной let
                segmentChevronsCount++;
                currentDistance += CHEVRON_SPACING;
            } // end while
            if (DETAILED_DEBUG) console.log(`[Chevron Render] Сегмент ${segmentArrayIndex}: Сгенерировано ${segmentChevronsCount} шевронов.`);
            if (DETAILED_DEBUG) console.groupEnd();
            if (DETAILED_DEBUG) console.groupEnd();
        }); // end forEach segment

        if (DETAILED_DEBUG) console.groupEnd();

        const duration = performance.now() - startMemoTime;
        if (DETAILED_DEBUG) console.log(`[Chevron Render] === Завершение useMemo (${duration.toFixed(2)}ms). Итого шевронов: ${allChevrons.length} ===`);

        return allChevrons;

    }, [calculatedPath, graphData.nodeCoords, currentFloorIndex, errorMsg]); // errorMsg остается в зависимостях useMemo

    // --- Рендер компонента ---
    // ... (логи и рендер без изменений)
    if (DETAILED_DEBUG) {
        const pathExists = calculatedPath && calculatedPath.length > 0;
        const chevronsExist = renderedPathChevrons && renderedPathChevrons.length > 0;
        console.log('[Render] Состояние перед рендером:', { isLoadingGraph, errorMsg, pathExists, calculatedPathLength: calculatedPath?.length, chevronsExist, renderedChevronsCount: renderedPathChevrons?.length });
    }

    if (isLoadingGraph) {
        if (DETAILED_DEBUG) console.log('[Render] Рендеринг: null (граф загружается)');
        return null;
    }

    if (errorMsg) {
        if (DETAILED_DEBUG) console.log('[Render] Рендеринг: Компонент Text с ошибкой:', errorMsg);
        return (
            <Text x={20} y={20} text={`Ошибка маршрута: ${errorMsg}`} fill="darkred" fontSize={16} fontStyle="bold" listening={false} wrap="char" width={400} />
        );
    }

    if (DETAILED_DEBUG) console.log(`[Render] Рендеринг: ${renderedPathChevrons.length} шевронов.`);
    return <>{renderedPathChevrons}</>;
}

export default RouteMap;