// src/components/RouteMap.jsx
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { Shape, Text } from 'react-konva';
import useStore from './store.jsx';
import { buildGraph } from './graph.js';
import { findShortestPath } from './dijkstra.js';

const DETAILED_DEBUG = false;

function getFloorDisplayName(floorIndex) {
    if (floorIndex === 4) return '0';
    if (floorIndex >= 0 && floorIndex <= 3) return String(floorIndex + 1);
    return `Неизв. (${floorIndex})`;
}

function getTransitionVerb(fromIndex, toIndex) {
    if (fromIndex === 4 && toIndex === 0) return "Поднимитесь"; // 0 -> 1
    if (fromIndex === 0 && toIndex === 4) return "Спуститесь"; // 1 -> 0
    if (fromIndex < toIndex) return "Поднимитесь";
    if (fromIndex > toIndex) return "Спуститесь";
    return "";
}

function getPathWeight(graph, path) {
    if (!graph || !path || !Array.isArray(path) || path.length < 2) return Infinity;
    let totalWeight = 0;
    for (let i = 0; i < path.length - 1; i++) {
        const u = path[i]; const v = path[i + 1];
        const neighborsOfU = graph.get(u);
        const edgeWeight = neighborsOfU instanceof Map ? neighborsOfU.get(v) : undefined;
        if (edgeWeight === undefined || isNaN(edgeWeight) || edgeWeight < 0) {
            console.error(`[getPathWeight] ПРОБЛЕМА С РЕБРОМ: ${u} -> ${v}. Вес: ${edgeWeight}.`);
            return Infinity;
        }
        totalWeight += edgeWeight;
    }
    if (DETAILED_DEBUG) console.log('[getPathWeight] Итоговый вес:', totalWeight);
    return totalWeight;
}

// Получение точки на полилинии на заданной дистанции
function getPointAtDistance(points, distance) {
    if (!points || points.length < 2) return null;
    if (typeof distance !== 'number' || isNaN(distance) || distance < 0) return null;
    if (distance <= 1e-6) return points[0] ? { ...points[0], segmentIndex: 0 } : null;

    let cumulativeLength = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i]; const p2 = points[i + 1];
        if (!p1 || !p2 || typeof p1.x !== 'number' || typeof p1.y !== 'number' || typeof p2.x !== 'number' || typeof p2.y !== 'number') continue;
        const dx = p2.x - p1.x; const dy = p2.y - p1.y;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);
        if (segmentLength < 1e-6) continue;
        if (cumulativeLength + segmentLength >= distance - 1e-6) {
            const remainingDistance = distance - cumulativeLength;
            const clampedRemaining = Math.max(0, Math.min(remainingDistance, segmentLength));
            const ratio = clampedRemaining / segmentLength;
            if (isNaN(ratio) || !isFinite(ratio)) return points[i] ? { ...points[i], segmentIndex: i } : null;
            const x = p1.x + dx * ratio; const y = p1.y + dy * ratio;
            if (isNaN(x) || isNaN(y)) return points[i] ? { ...points[i], segmentIndex: i } : null;
            return { x, y, segmentIndex: i };
        }
        cumulativeLength += segmentLength;
    }
    const lastPoint = points[points.length - 1];
    return lastPoint ? { ...lastPoint, segmentIndex: points.length - 2 } : null;
}


// --- Основной компонент ---
function RouteMap({ currentFloorIndex, mapDataPath}) {
    if (DETAILED_DEBUG) console.log(`%c[RouteMap Render (WITH TRIGGER)] Floor: ${currentFloorIndex}`, 'color: orange; font-weight: bold;');

    // Состояния компонента
    const [graphData, setGraphData] = useState({ graph: null, nodeCoords: null });
    const [calculatedPath, setCalculatedPath] = useState(null);
    const [isLoadingGraph, setIsLoadingGraph] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);

    // Zustand state/actions
    const buildRouteTrigger = useStore((state) => state.buildRouteTrigger);
    const setIsRouteInstructionsVisible = useStore((state) => state.setIsRouteInstructionsVisible);
    const setRouteInstructions = useStore((state) => state.setRouteInstructions);

    // Ref для отслеживания обработанного триггера
    const processedTriggerRef = useRef(null);

    // --- Логирование изменений состояния (для отладки) ---
    useEffect(() => { if (DETAILED_DEBUG) console.log(`%c[RM State] isLoadingGraph: ${isLoadingGraph}`, 'color: #aaa;'); }, [isLoadingGraph]);
    useEffect(() => { if (DETAILED_DEBUG) console.log(`%c[RM State] calculatedPath: ${calculatedPath ? `[...${calculatedPath.length}]` : 'null'}`, 'color: #aaa;'); }, [calculatedPath]);
    useEffect(() => { if (DETAILED_DEBUG) console.log(`%c[RM State] errorMsg: ${errorMsg ? `'${errorMsg}'` : 'null'}`, 'color: red;'); }, [errorMsg]);
    useEffect(() => { if (DETAILED_DEBUG) console.log(`%c[RM State] buildRouteTrigger changed: ${buildRouteTrigger}`, 'color: magenta;'); }, [buildRouteTrigger]);
    useEffect(() => { if (DETAILED_DEBUG) console.log(`%c[RM State] graphData updated: Nodes ${graphData.nodeCoords?.size ?? 'null'}`, 'color: green;'); }, [graphData]);

    // --- Функция получения ID узла графа ---
    const getGraphNodeId = useCallback((item, nodeCoordsMap, localSetErrorMsg = setErrorMsg) => {
        if (!item || typeof item !== 'object' || item.id === undefined || item.id === null) { console.warn("[getGraphNodeId] Invalid item:", item); return null; }
        if (!nodeCoordsMap || !(nodeCoordsMap instanceof Map) || nodeCoordsMap.size === 0) { console.error("[getGraphNodeId] nodeCoordsMap invalid."); localSetErrorMsg("Ошибка карты: Координаты не готовы."); return null; }

        const { id, type, floorIndex, name } = item;
        const expectedNodeIdBase = `icon-${id}`;
        if (DETAILED_DEBUG) console.log(`[getGraphNodeId] Search: id='${id}', type='${type}', floor=${floorIndex}. Base expecting: '${expectedNodeIdBase}'`);

        try {
            // Комнаты
            if (type === 'room' || type === 'vectorized_room') {
                const doorNodeId = `${expectedNodeIdBase}_door`;
                if (nodeCoordsMap.has(doorNodeId) && nodeCoordsMap.get(doorNodeId)?.floorIndex === floorIndex) return doorNodeId;
                if (nodeCoordsMap.has(expectedNodeIdBase) && nodeCoordsMap.get(expectedNodeIdBase)?.floorIndex === floorIndex) return expectedNodeIdBase;
                const prefixDoorFallbackId = Array.from(nodeCoordsMap.keys()).find(key => key.startsWith(expectedNodeIdBase + "_") && nodeCoordsMap.get(key)?.floorIndex === floorIndex);
                if (prefixDoorFallbackId) return prefixDoorFallbackId;
                localSetErrorMsg(`Нет точки входа для '${name || id}'.`); return null;
            }
            // Иконки
            else if (type === 'icon') {
                if (nodeCoordsMap.has(expectedNodeIdBase) && nodeCoordsMap.get(expectedNodeIdBase)?.floorIndex === floorIndex) return expectedNodeIdBase;
                const prefixFallbackId = Array.from(nodeCoordsMap.keys()).find(key => key.startsWith(expectedNodeIdBase) && nodeCoordsMap.get(key)?.floorIndex === floorIndex);
                if (prefixFallbackId) return prefixFallbackId;
                localSetErrorMsg(`Точка '${name || id}' не найдена.`); return null;
            }
            // Лестницы
            else if (type === 'stair') {
                const match = String(id).match(/^ladder(\d+)/); if (!match) { localSetErrorMsg(`ID лестницы '${id}'?`); return null; }
                const logicalId = match[1], prefix = `icon-ladder${logicalId}_`;
                const stairId = Array.from(nodeCoordsMap.keys()).find(k => k.startsWith(prefix) && nodeCoordsMap.get(k)?.floorIndex === floorIndex); if (stairId) return stairId;
                const anyStairId = Array.from(nodeCoordsMap.keys()).find(k => k.startsWith(prefix)); if (anyStairId) return anyStairId;
                localSetErrorMsg(`Лестница '${name || id}' не найдена.`); return null;
            }
            // Неизвестный тип
            else { localSetErrorMsg(`Неизвестный тип точки: '${type}'`); return null; }
        } catch (err) { console.error("[getGraphNodeId] Error:", err); localSetErrorMsg("Ошибка поиска узла."); return null; }
    }, []);

    // --- Эффект загрузки графа ---
    useEffect(() => {
        console.log("%c[RM Effect Load] Загрузка графа...", 'color: purple;');
        setIsLoadingGraph(true); setErrorMsg(null); setCalculatedPath(null);
        let isMounted = true;
        setIsRouteInstructionsVisible(false);
        setRouteInstructions([]);
        fetch(mapDataPath)
            .then(res => { if (!res.ok) throw new Error(`HTTP ${res.status}`); return res.json(); })
            .then(data => { if (!isMounted) return; if (!data?.layers) throw new Error("Нет data.layers"); const pLayers = data.layers.map((l, i) => ({ ...l, floorIndex: i })); console.time("buildGraph"); const { graph, nodeCoords } = buildGraph(pLayers); console.timeEnd("buildGraph"); if (!(graph?.size > 0) || !(nodeCoords?.size > 0)) throw new Error("Граф пуст."); setGraphData({ graph, nodeCoords }); })
            .catch(error => { if (!isMounted) return; console.error("[RM Effect Load] Error:", error); setErrorMsg(`Ошибка данных: ${error.message}`); setGraphData({ graph: null, nodeCoords: null }); })
            .finally(() => { if (!isMounted) return; processedTriggerRef.current = null; setIsLoadingGraph(false); console.log("%c[RM Effect Load] Загрузка завершена.", 'color: purple;'); });
        return () => { isMounted = false; };
    }, [mapDataPath]);

    // --- Эффект расчета пути по триггеру ---
    useEffect(() => {
        if (DETAILED_DEBUG) console.log("%c[RM Effect Path (WITH TRIGGER)] Проверка триггера...", 'color: orange;');
        if (isLoadingGraph) return;

        if (buildRouteTrigger === null || processedTriggerRef.current === buildRouteTrigger) {
            if (buildRouteTrigger === null && useStore.getState().isRouteInstructionsVisible) {
                setIsRouteInstructionsVisible(false);
                setRouteInstructions([]);
                setCalculatedPath(null);
                setErrorMsg(null);
            }
            return;
        }

        if (!graphData.graph || !graphData.nodeCoords || graphData.nodeCoords.size === 0) {
            setErrorMsg("Ошибка карты: Данные для маршрута не готовы.");
            processedTriggerRef.current = buildRouteTrigger; return;
        }

        // Начинаем обработку
        console.log(`%c[RM Effect Path] Обработка триггера ${buildRouteTrigger}...`, 'color: #1a73e8; font-weight: bold;');
        setCalculatedPath(null); setErrorMsg(null);
        setIsRouteInstructionsVisible(false);
        setRouteInstructions([]);


        const currentFromItem = useStore.getState().fromRoom;
        const currentToItem = useStore.getState().toRoom;
        const { graph, nodeCoords } = graphData;

        if (!currentFromItem || !currentToItem) {
            processedTriggerRef.current = buildRouteTrigger; return;
        }
        if (currentFromItem.id === currentToItem.id) {
            setIsRouteInstructionsVisible(false);
            setRouteInstructions([]);
            processedTriggerRef.current = buildRouteTrigger; return;
        }

        let tempError = null;
        const localSetError = (msg) => { tempError = msg; };
        const startNodeId = getGraphNodeId(currentFromItem, nodeCoords, localSetError);
        if (tempError) { setErrorMsg(tempError); processedTriggerRef.current = buildRouteTrigger; return; }
        const endNodeId = getGraphNodeId(currentToItem, nodeCoords, localSetError);
        if (tempError) { setErrorMsg(tempError); processedTriggerRef.current = buildRouteTrigger; return; }

        if (!startNodeId || !endNodeId) {
            setErrorMsg(tempError || "Не удалось определить узлы для маршрута.");
            processedTriggerRef.current = buildRouteTrigger; return;
        }
        if (startNodeId === endNodeId) {
            setIsRouteInstructionsVisible(false);
            setRouteInstructions([]);
            processedTriggerRef.current = buildRouteTrigger; return;
        }

        console.time(`Dijkstra ${startNodeId}->${endNodeId}`);
        try {
            const finalPath = findShortestPath(graph, nodeCoords, startNodeId, endNodeId);
            console.log(`[RM Effect Path] Dijkstra Result (finalPath):`, finalPath);

            if (!finalPath || !Array.isArray(finalPath) || finalPath.length < 2) {
                setErrorMsg("Маршрут не найден."); setCalculatedPath(null);
                setIsRouteInstructionsVisible(false);
                setRouteInstructions([]);
            } else {
                const weight = getPathWeight(graph, finalPath);
                if(weight === Infinity) {
                    setErrorMsg("Ошибка расчета маршрута (разрыв)."); setCalculatedPath(null);
                    setIsRouteInstructionsVisible(false);
                    setRouteInstructions([]);
                } else {
                    if (DETAILED_DEBUG) console.log(`[RM Effect Path] УСПЕХ! Путь найден (${finalPath.length} узлов), вес: ${weight.toFixed(1)}`);
                    setCalculatedPath(finalPath);
                    setErrorMsg(null);

                    const instructionsArray = [];
                    let lastSignificantNodeIndex = 0; // Индекс узла, где начался/закончился значимый сегмент или переход
                    let currentInstructionFloorIndex = nodeCoords.get(startNodeId)?.floorIndex; // Этаж, на котором происходит текущий сегмент

                    if (currentInstructionFloorIndex === undefined) {
                        throw new Error("Не удалось определить этаж начального узла.");
                    }

                    for (let i = 1; i < finalPath.length; i++) {
                        const prevNodeData = nodeCoords.get(finalPath[i - 1]);
                        const currNodeData = nodeCoords.get(finalPath[i]);

                        if (!prevNodeData || !currNodeData) continue;

                        // Обнаружена смена этажа
                        if (prevNodeData.floorIndex !== currNodeData.floorIndex) {
                            // 1. Добавляем инструкцию "Следуйте..." для предыдущего сегмента, если он был значимым
                            if (i - lastSignificantNodeIndex > 1) {
                                instructionsArray.push(`Следуйте по маршруту на ${getFloorDisplayName(prevNodeData.floorIndex)} этаже`);
                            } else if (instructionsArray.length === 0) {
                                // Если самый первый шаг - это переход
                                instructionsArray.push(`Начните движение на ${getFloorDisplayName(prevNodeData.floorIndex)} этаже`);
                            }

                            // 2. Определяем КОНЕЧНЫЙ этаж этой серии переходов
                            let finalTransitionNodeIndex = i;
                            let initialDirection = getTransitionVerb(prevNodeData.floorIndex, currNodeData.floorIndex); // up or down
                            let usesStairs = finalPath[i-1].includes('ladder') || finalPath[i].includes('ladder');

                            while (finalTransitionNodeIndex + 1 < finalPath.length) {
                                const nextNodeData = nodeCoords.get(finalPath[finalTransitionNodeIndex + 1]);
                                const currentTransitionNodeData = nodeCoords.get(finalPath[finalTransitionNodeIndex]);
                                if (!nextNodeData || !currentTransitionNodeData) break; // Ошибка данных

                                // Проверяем, продолжается ли смена этажа В ТОМ ЖЕ НАПРАВЛЕНИИ
                                if (currentTransitionNodeData.floorIndex !== nextNodeData.floorIndex) {
                                    const nextDirection = getTransitionVerb(currentTransitionNodeData.floorIndex, nextNodeData.floorIndex);
                                    if (nextDirection === initialDirection) {
                                        // Переход продолжается
                                        finalTransitionNodeIndex++;
                                        if (finalPath[finalTransitionNodeIndex].includes('ladder')) usesStairs = true;
                                    } else {
                                        // Направление сменилось или переход закончился
                                        break;
                                    }
                                } else {
                                    // Переход закончился, началось движение по этажу
                                    break;
                                }
                            }

                            // 3. Генерируем ОДНУ инструкцию для всего перехода
                            const targetFloorIndex = nodeCoords.get(finalPath[finalTransitionNodeIndex]).floorIndex;
                            const targetFloorName = getFloorDisplayName(targetFloorIndex);
                            const verb = getTransitionVerb(prevNodeData.floorIndex, targetFloorIndex); // Глагол для ВСЕГО перехода

                            if (verb) {
                                let step = `${verb} на ${targetFloorName} этаж`;
                                if (usesStairs) {
                                    step += " по лестнице";
                                }
                                instructionsArray.push(step);
                            }

                            // 4. Обновляем состояние для следующей итерации
                            currentInstructionFloorIndex = targetFloorIndex;
                            lastSignificantNodeIndex = finalTransitionNodeIndex;
                            i = finalTransitionNodeIndex; // Пропускаем промежуточные узлы перехода
                        }
                        // Если смена этажа не обнаружена, цикл продолжается
                    }

                    // Добавляем финальную инструкцию "Следуйте до пункта назначения" для последнего сегмента
                    if (finalPath.length - 1 - lastSignificantNodeIndex > 0) {
                        const finalSegmentFloor = nodeCoords.get(finalPath[lastSignificantNodeIndex])?.floorIndex;
                        if (finalSegmentFloor !== undefined) {
                            instructionsArray.push(`Следуйте по маршруту на ${getFloorDisplayName(finalSegmentFloor)} этаже до пункта назначения`);
                        }
                    } else if (instructionsArray.length === 0 && finalPath.length > 0) {
                        // Весь маршрут на одном этаже
                        const floorIndex = nodeCoords.get(finalPath[0])?.floorIndex;
                        if (floorIndex !== undefined) {
                            instructionsArray.push(`Следуйте по маршруту на ${getFloorDisplayName(floorIndex)} этаже до пункта назначения`);
                        }
                    } else if (instructionsArray.length > 0 && finalPath.length -1 === lastSignificantNodeIndex) {
                        // Если последний шаг был переход
                        const finalFloorIdx = nodeCoords.get(finalPath[finalPath.length-1])?.floorIndex;
                        if (finalFloorIdx !== undefined) {
                            instructionsArray.push(`Вы прибыли на ${getFloorDisplayName(finalFloorIdx)} этаж`);
                        }
                    }


                    if (DETAILED_DEBUG) console.log("[RM Effect Path] Сгенерированные инструкции (v2):", instructionsArray);

                    setRouteInstructions(instructionsArray.length > 0 ? instructionsArray : ["Маршрут построен."]);
                }
            }
        } catch (dijkstraError) {
            console.error("[RM Effect Path] Ошибка Дейкстры:", dijkstraError);
            setErrorMsg(`Ошибка поиска пути: ${dijkstraError.message}`);
            setCalculatedPath(null);
            setIsRouteInstructionsVisible(false);
            setRouteInstructions([]);
        } finally {
            console.timeEnd(`Dijkstra ${startNodeId}->${endNodeId}`);
            processedTriggerRef.current = buildRouteTrigger; // Помечаем обработанным
        }
    }, [graphData, isLoadingGraph, buildRouteTrigger, getGraphNodeId, setIsRouteInstructionsVisible, setRouteInstructions]);


    const renderedPathChevrons = useMemo(() => {
        const startMemoTime = performance.now();
        if (DETAILED_DEBUG) console.log('%c[RM Memo Chevrons] Запуск...', 'color: #2a9d8f;');

        const routeIsActive = useStore.getState().buildRouteTrigger !== null;
        if (!routeIsActive || errorMsg || !calculatedPath || calculatedPath.length < 2) return [];

        const nodeCoords = graphData.nodeCoords;
        if (!nodeCoords || nodeCoords.size === 0) return [];

        const CHEVRON_COLOR = 'red';
        const CHEVRON_SIZE = 8;
        const CHEVRON_ANGLE_DEG = 50;
        const CHEVRON_SPACING = 15;
        const CHEVRON_STROKE_WIDTH = 5; // Увеличена толщина линии
        const MIN_SEGMENT_PART_LENGTH = 1e-3;
        const CHEVRON_ANGLE_RAD = CHEVRON_ANGLE_DEG * (Math.PI / 180);

        // Шаг 1: Сборка сегментов
        const pathPointsOnFloor = calculatedPath.map(id => {
            const d = nodeCoords.get(id);
            return (d?.floorIndex === currentFloorIndex && typeof d.x === 'number') ? { x: d.x, y: d.y } : null;
        });
        const continuousSegmentsOnFloor = [];
        let currentSegmentPoints = [];
        for (const p of pathPointsOnFloor) {
            if (p) currentSegmentPoints.push(p);
            else {
                if (currentSegmentPoints.length >= 2) continuousSegmentsOnFloor.push([...currentSegmentPoints]);
                currentSegmentPoints = [];
            }
        }
        if (currentSegmentPoints.length >= 2) continuousSegmentsOnFloor.push([...currentSegmentPoints]);
        if (DETAILED_DEBUG) console.log(`[RM Memo Chevrons] Шаг 1: Найдено сегментов: ${continuousSegmentsOnFloor.length}`);

        // Шаг 2: Отрисовка
        const allChevrons = [];
        let firstChevronLogged = false;
        continuousSegmentsOnFloor.forEach((points, segmentIndex) => {
            let totalLength = 0;
            const partLengths = [];
            try {
                for (let j = 0; j < points.length - 1; j++) {
                    const p1 = points[j], p2 = points[j + 1];
                    if (!p1 || !p2) continue;
                    const len = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
                    const vLen = len >= MIN_SEGMENT_PART_LENGTH ? len : 0;
                    partLengths.push(vLen);
                    totalLength += vLen;
                }
            } catch (e) {
                console.error(`[RM Memo Chevrons] Ошибка при расчете длины сегмента ${segmentIndex}:`, e);
            }
            if (totalLength < MIN_SEGMENT_PART_LENGTH) return;
            if (DETAILED_DEBUG) console.log(`[RM Memo Chevrons] Сегмент ${segmentIndex}: Длина ${totalLength.toFixed(1)}, Генерация...`);

            let currentDistance = CHEVRON_SPACING / 2;
            let chevronsInSegment = 0;

            while (currentDistance < totalLength) {
                const tipPointData = getPointAtDistance(points, currentDistance);
                if (!tipPointData || isNaN(tipPointData.x) || tipPointData.segmentIndex === undefined) {
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }
                const tipPoint = { x: tipPointData.x, y: tipPointData.y };
                const segIdx = tipPointData.segmentIndex;
                if (segIdx < 0 || segIdx >= partLengths.length) {
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }
                const pS = points[segIdx], pE = points[segIdx + 1];
                const segLen = partLengths[segIdx];
                if (!pS || !pE || segLen < 1e-6) {
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }
                const dx = pE.x - pS.x, dy = pE.y - pS.y;
                const ux = dx / segLen, uy = dy / segLen;
                if (isNaN(ux) || !isFinite(ux)) {
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }
                const angle = Math.atan2(uy, ux);
                const a1 = angle - CHEVRON_ANGLE_RAD / 2;
                const a2 = angle + CHEVRON_ANGLE_RAD / 2;
                const bp1 = { x: tipPoint.x - CHEVRON_SIZE * Math.cos(a1), y: tipPoint.y - CHEVRON_SIZE * Math.sin(a1) };
                const bp2 = { x: tipPoint.x - CHEVRON_SIZE * Math.cos(a2), y: tipPoint.y - CHEVRON_SIZE * Math.sin(a2) };
                if (isNaN(bp1.x) || isNaN(bp2.x)) {
                    currentDistance += CHEVRON_SPACING;
                    continue;
                }

                if (!firstChevronLogged && DETAILED_DEBUG) {
                    console.log(`[RM Memo Chevrons] Координаты первого шеврона: tip=(${tipPoint.x.toFixed(1)}, ${tipPoint.y.toFixed(1)})`);
                    firstChevronLogged = true;
                }

                allChevrons.push(
                    <Shape
                        key={`c-s${segmentIndex}-d${currentDistance.toFixed(0)}`}
                        sceneFunc={(ctx) => {
                            // !!! ЗАДАЕМ СТИЛЬ ПРЯМО ЗДЕСЬ !!!
                            ctx.strokeStyle = "red";
                            ctx.lineWidth = 2.5;
                            ctx.lineCap = "round";
                            ctx.lineJoin = "round";
                            ctx.beginPath();
                            ctx.moveTo(bp1.x, bp1.y);
                            ctx.lineTo(tipPoint.x, tipPoint.y);
                            ctx.lineTo(bp2.x, bp2.y);
                            ctx.stroke();
                        }}
                        listening={false}
                        perfectDrawEnabled={false}
                    />
                );
                chevronsInSegment++;
                currentDistance += CHEVRON_SPACING;
            }
            if (DETAILED_DEBUG) console.log(`[RM Memo Chevrons] Сегмент ${segmentIndex}: Сгенерировано ${chevronsInSegment} шевронов`);
        });

        const duration = performance.now() - startMemoTime;
        if (DETAILED_DEBUG) console.log(`%c[RM Memo Chevrons] Завершение (${duration.toFixed(1)}ms). Итого шевронов: ${allChevrons.length}`, 'color: #2a9d8f; font-weight: bold;');
        return allChevrons;
    }, [calculatedPath, graphData.nodeCoords, currentFloorIndex, errorMsg, buildRouteTrigger]);


    // --- Финальный рендер компонента ---
    if (isLoadingGraph) return null;
    if (errorMsg) {
        // Показываем ошибку
        return ( <Text x={20} y={50} text={`Ошибка маршрута: ${errorMsg}`} fill="darkred" fontSize={14} fontStyle="bold" listening={false} wrap="char" width={window.innerWidth ? window.innerWidth - 40 : 400} /> );
    }
    // Рендерим шевроны (или пустой фрагмент, если их нет)
    return <>{renderedPathChevrons}</>;
}

export default RouteMap;