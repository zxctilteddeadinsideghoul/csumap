// src/components/map/pathfinding/graph.js

// --- Вспомогательные функции ---
function distance(x1, y1, x2, y2) {
    // Проверка на валидные числа, возврат 0 если нет
    if (isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
        console.warn(`Invalid coordinates for distance calculation: (${x1},${y1}) to (${x2},${y2})`);
        return 0;
    }
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Находит ближайшую точку на отрезке (x1,y1) - (x2,y2) к точке (px,py)
function getClosestPointOnSegment(px, py, x1, y1, x2, y2) {
    // Проверка на валидные числа
    if (isNaN(px) || isNaN(py) || isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) {
        console.warn(`Invalid coordinates for getClosestPointOnSegment: p=(${px},${py}), seg=(${x1},${y1})-(${x2},${y2})`);
        // Возвращаем точку начала отрезка как запасной вариант
        return { x: x1, y: y1, distSq: distance(px, py, x1, y1)**2 };
    }

    const dx = x2 - x1;
    const dy = y2 - y1;
    const lenSq = dx * dx + dy * dy;

    // Если отрезок - точка
    if (lenSq < 0.000001) return { x: x1, y: y1, distSq: distance(px, py, x1, y1)**2 };

    // Проекция точки P на прямую, содержащую отрезок AB
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    t = Math.max(0, Math.min(1, t)); // Ограничиваем проекцию рамками отрезка

    const closestX = x1 + t * dx;
    const closestY = y1 + t * dy;
    const distSq = distance(px, py, closestX, closestY)**2;

    return { x: closestX, y: closestY, distSq };
}

// --- НОВАЯ Вспомогательная функция для парсинга координат иконки ---
function getIconCoords(vector) {
    if (!vector || !vector.data) {
        console.warn(`Icon ${vector?.id} has no data for coordinate parsing.`);
        return null;
    }
    // Ищем первую команду M (MoveTo) с координатами
    const match = vector.data.match(/M\s*([-+]?\d*\.?\d+)\s*[,\s]\s*([-+]?\d*\.?\d+)/i);
    if (match && match.length >= 3) {
        const x = parseFloat(match[1]);
        const y = parseFloat(match[2]);
        if (!isNaN(x) && !isNaN(y)) {
            return { x, y };
        }
    }
    console.warn(`Cannot parse entry point for icon ${vector.id}. Data: ${vector.data.substring(0, 50)}...`);
    return null; // Не удалось извлечь координаты
}


// --- Основная функция построения графа ---
export function buildGraph(layers) {
    console.log("Building graph with layers:", layers); // Лог входных данных
    const graph = new Map(); // Adjacency list: Map<nodeId, Map<neighborId, weight>>
    const nodeCoords = new Map(); // Map<nodeId, {x, y, floorIndex}>
    const roadEndpoints = new Map(); // Храним конечные точки дорог для связывания: Map<floorIndex, Array<{id, x, y}>>
    const stairs = new Map(); // Храним лестницы для связывания: Map<logicalId, Array<{id, x, y, floorIndex}>>
    // --- ИЗМЕНЕНИЕ: Map для хранения виртуальных узлов *для каждой дороги* ---
    const virtualNodesOnRoads = new Map(); // Map<roadId, Array<{id, x, y, distFromStart}>>

    const CONNECTION_THRESHOLD_SQ = 150 * 150; // Квадрат макс. расстояния от иконки/лестницы до дороги
    const INTERSECTION_THRESHOLD_SQ = 10 * 10; // Квадрат макс. расстояния для соединения конечных точек дорог
    const STAIR_FLOOR_CHANGE_WEIGHT = 1000; // "Стоимость" перехода по лестнице

    function addEdge(node1, node2, weight) {
        // Проверка на NaN перед добавлением ребра
        if (isNaN(weight)) {
            console.warn(`Attempted to add edge with NaN weight between ${node1} and ${node2}`);
            return;
        }
        if (weight < 0) { // Не добавляем ребра с отрицательным весом
            console.warn(`Attempted to add edge with negative weight (${weight}) between ${node1} and ${node2}`);
            return;
        }
        if (!graph.has(node1)) graph.set(node1, new Map());
        if (!graph.has(node2)) graph.set(node2, new Map());
        // Добавляем ребра в обе стороны
        graph.get(node1).set(node2, weight);
        graph.get(node2).set(node1, weight);

    }

    // 1. Обработка дорог, лестниц и ИКОНОК, сбор узлов
    layers.forEach((layer, floorIndex) => {
        roadEndpoints.set(floorIndex, []); // Инициализация массива для этажа

        // Дороги
        (layer.roads || []).forEach(road => {
            const startNodeId = `road-${road.id}-start`;
            const endNodeId = `road-${road.id}-end`;

            // Проверяем координаты дороги
            if (isNaN(road.x1) || isNaN(road.y1) || isNaN(road.x2) || isNaN(road.y2)) {
                console.warn(`Road ${road.id} has invalid coordinates. Skipping.`);
                return; // Пропускаем дорогу с невалидными координатами
            }

            const weight = distance(road.x1, road.y1, road.x2, road.y2);

            nodeCoords.set(startNodeId, { x: road.x1, y: road.y1, floorIndex });
            nodeCoords.set(endNodeId, { x: road.x2, y: road.y2, floorIndex });

            // --- ИЗМЕНЕНИЕ: Инициализируем массив для виртуальных узлов этой дороги ---
            if (!virtualNodesOnRoads.has(road.id)) {
                virtualNodesOnRoads.set(road.id, []);
            }

            // Изначально соединяем концы дороги, если вес валидный
            if (!isNaN(weight) && weight >= 0) {
                addEdge(startNodeId, endNodeId, weight);
            } else {
                console.warn(`Invalid weight (${weight}) calculated for road ${road.id}. Edge not added initially.`);
            }


            // Сохраняем конечные точки для поиска пересечений
            roadEndpoints.get(floorIndex).push({ id: startNodeId, x: road.x1, y: road.y1, roadId: road.id });
            roadEndpoints.get(floorIndex).push({ id: endNodeId, x: road.x2, y: road.y2, roadId: road.id });
        });

        // Лестницы: создаем узлы
        (layer.rooms || []).filter(r => r.type === 'stair').forEach(stair => {
            const nodeId = `stair-${stair.id}`;
            // Проверяем координаты лестницы
            if (isNaN(stair.x) || isNaN(stair.y)) {
                console.warn(`Stair ${stair.id} has invalid coordinates. Skipping node creation.`);
                return;
            }
            const entryX = stair.x + (stair.width ? stair.width / 2 : 0);
            const entryY = stair.y + (stair.height ? stair.height / 2 : 0);
            nodeCoords.set(nodeId, { x: entryX, y: entryY, floorIndex });
            if (!graph.has(nodeId)) graph.set(nodeId, new Map());

            // Группировка лестниц
            const logicalId = stair.id.replace(/_floor\d+$/, '');
            if (!stairs.has(logicalId)) stairs.set(logicalId, []);
            stairs.get(logicalId).push({ id: nodeId, x: entryX, y: entryY, floorIndex });
        });

        // --- НОВОЕ: Иконки: создаем узлы ---
        (layer.vectors || []).filter(v => v.type === 'icon').forEach(icon => {
            if (!icon.id) {
                console.warn("Found an icon without an ID, skipping node creation:", icon);
                return;
            }
            const nodeId = `icon-${icon.id}`;
            const coords = getIconCoords(icon);
            if (coords) {
                nodeCoords.set(nodeId, { x: coords.x, y: coords.y, floorIndex });
                if (!graph.has(nodeId)) graph.set(nodeId, new Map());
            } else {
                console.warn(`Could not get coordinates for icon ${nodeId}. Node not added.`);
            }
        });
    }); // Конец layers.forEach (этап 1)

    // 2. Соединение пересечений дорог на каждом этаже
    layers.forEach((_, floorIndex) => {
        const endpoints = roadEndpoints.get(floorIndex) || [];
        const connectedPairs = new Set(); // Отслеживаем уже соединенные пары

        for (let i = 0; i < endpoints.length; i++) {
            for (let j = i + 1; j < endpoints.length; j++) {
                const p1 = endpoints[i];
                const p2 = endpoints[j];

                // --- ДОБАВЛЕНО: Не соединяем конечные точки одной и той же дороги ---
                if (p1.roadId === p2.roadId) {
                    continue;
                }

                // Ключ для отслеживания пары
                const pairKey = [p1.id, p2.id].sort().join('-');
                if (connectedPairs.has(pairKey)) {
                    continue; // Пропускаем, если уже соединили
                }

                // Проверка координат перед вычислением расстояния
                if (isNaN(p1.x) || isNaN(p1.y) || isNaN(p2.x) || isNaN(p2.y)) {
                    console.warn(`Skipping intersection check due to invalid coordinates: ${p1.id} or ${p2.id}`);
                    continue;
                }

                const distSq = distance(p1.x, p1.y, p2.x, p2.y) ** 2;

                if (!isNaN(distSq) && distSq < INTERSECTION_THRESHOLD_SQ) {
                    // Соединяем близкие конечные точки дорог нулевым весом
                    addEdge(p1.id, p2.id, 0);
                    connectedPairs.add(pairKey); // Отмечаем пару как соединенную
                    // console.log(`Connecting intersection: ${p1.id} <-> ${p2.id}`); // Лог соединения
                }
            }
        }
    }); // Конец layers.forEach (этап 2)

    // 3. Соединение ИКОНОК и ЛЕСТНИЦ с ближайшими дорогами
    nodeCoords.forEach((nodeInfo, nodeId) => {
        // --- ИЗМЕНЕНИЕ: Обрабатываем только узлы ИКОНОК и ЛЕСТНИЦ ---
        if (nodeId.startsWith('icon-') || nodeId.startsWith('stair-')) {
            // Проверка координат узла
            if (isNaN(nodeInfo.x) || isNaN(nodeInfo.y)) {
                console.warn(`Node ${nodeId} has invalid coordinates. Skipping road connection.`);
                return;
            }

            let closestRoadPointInfo = null;
            let minDistanceSq = CONNECTION_THRESHOLD_SQ;

            const currentLayer = layers.find(l => l.floorIndex === nodeInfo.floorIndex);

            if (currentLayer && currentLayer.roads) {
                currentLayer.roads.forEach(road => {
                    // Проверяем координаты дороги перед использованием
                    if (isNaN(road.x1) || isNaN(road.y1) || isNaN(road.x2) || isNaN(road.y2)) {
                        // console.warn(`Skipping connection check for node ${nodeId} to road ${road.id} due to invalid road coordinates.`);
                        return; // Пропускаем эту дорогу
                    }

                    const closestOnSeg = getClosestPointOnSegment(
                        nodeInfo.x, nodeInfo.y,
                        road.x1, road.y1,
                        road.x2, road.y2
                    );

                    // Проверяем результат getClosestPointOnSegment
                    if (isNaN(closestOnSeg.distSq)) {
                        // console.warn(`NaN distance calculated for node ${nodeId} to road ${road.id}. Skipping this road segment.`);
                        return;
                    }


                    if (closestOnSeg.distSq < minDistanceSq) {
                        minDistanceSq = closestOnSeg.distSq;
                        closestRoadPointInfo = {
                            x: closestOnSeg.x,
                            y: closestOnSeg.y,
                            roadId: road.id,
                            roadStartNodeId: `road-${road.id}-start`,
                            roadEndNodeId: `road-${road.id}-end`,
                            roadStartX: road.x1,
                            roadStartY: road.y1,
                            roadEndX: road.x2,
                            roadEndY: road.y2,
                        };
                    }
                });
            }


            if (closestRoadPointInfo) {
                const { roadId, x, y, roadStartX, roadStartY, roadEndX, roadEndY, roadStartNodeId, roadEndNodeId } = closestRoadPointInfo;

                // Проверка координат ближайшей точки и концов дороги
                if (isNaN(x) || isNaN(y) || isNaN(roadStartX) || isNaN(roadStartY) || isNaN(roadEndX) || isNaN(roadEndY)) {
                    console.warn(`Invalid coordinates involved in connecting node ${nodeId} to road ${roadId}. Skipping connection.`);
                    return;
                }


                const distToClosest = Math.sqrt(minDistanceSq);
                // Создаем ID для "виртуального" узла
                // Заменяем недопустимые символы (например, '/') на '_' в nodeId для создания virtualNodeId
                const sanitizedNodeId = nodeId.replace(/[^a-zA-Z0-9-_]/g, '_');
                const virtualNodeId = `virt-${sanitizedNodeId}-on-${roadId}`;


                const distFromStart = distance(x, y, roadStartX, roadStartY);

                // Проверка рассчитанных расстояний
                if (isNaN(distToClosest) || isNaN(distFromStart)) {
                    console.warn(`NaN distance calculated for node ${nodeId} connection to road ${roadId}. Skipping connection. distToClosest=${distToClosest}, distFromStart=${distFromStart}`);
                    return;
                }


                nodeCoords.set(virtualNodeId, { x, y, floorIndex: nodeInfo.floorIndex });
                if (!graph.has(virtualNodeId)) graph.set(virtualNodeId, new Map());

                // 1. Соединяем иконку/лестницу с виртуальным узлом
                addEdge(nodeId, virtualNodeId, distToClosest);
                // console.log(`Connecting node ${nodeId} to virtual node ${virtualNodeId} on road ${roadId} with weight ${distToClosest}`); // Лог

                // 2. Вставляем виртуальный узел в цепочку дороги
                const existingVirtuals = virtualNodesOnRoads.get(roadId);
                if (!existingVirtuals) {
                    console.error(`Could not find virtual node list for road ${roadId} when connecting ${nodeId}`);
                    return; // Должен существовать, так как инициализировали ранее
                }

                // Проверяем, существует ли уже такой виртуальный узел (по координатам или ID)
                const alreadyExists = existingVirtuals.some(v => v.id === virtualNodeId || (Math.abs(v.x - x) < 0.1 && Math.abs(v.y - y) < 0.1));

                if (!alreadyExists) {
                    const newVirtualInfo = { id: virtualNodeId, x, y, distFromStart };
                    existingVirtuals.push(newVirtualInfo);
                    existingVirtuals.sort((a, b) => a.distFromStart - b.distFromStart); // Сортируем

                    // 3. Перестраиваем ребра вдоль дороги
                    const startNodeData = nodeCoords.get(roadStartNodeId);
                    const endNodeData = nodeCoords.get(roadEndNodeId);

                    if (!startNodeData || !endNodeData) {
                        console.warn(`Missing start/end node data for road ${roadId} when rebuilding edges.`);
                        return;
                    }

                    // Полная цепочка: [start, ...sortedVirtuals, end]
                    const fullChain = [
                        { id: roadStartNodeId, x: startNodeData.x, y: startNodeData.y, distFromStart: 0 },
                        ...existingVirtuals, // Уже отсортированные виртуальные узлы
                        { id: roadEndNodeId, x: endNodeData.x, y: endNodeData.y, distFromStart: distance(startNodeData.x, startNodeData.y, endNodeData.x, endNodeData.y) }
                    ];

                    // Удаляем старое ребро между началом и концом (если оно было напрямую)
                    graph.get(roadStartNodeId)?.delete(roadEndNodeId);
                    graph.get(roadEndNodeId)?.delete(roadStartNodeId);

                    // Добавляем новые ребра между соседними узлами в цепочке
                    for (let i = 0; i < fullChain.length - 1; i++) {
                        const nodeA = fullChain[i];
                        const nodeB = fullChain[i + 1];

                        // Проверка координат перед расчетом веса
                        if (isNaN(nodeA.x) || isNaN(nodeA.y) || isNaN(nodeB.x) || isNaN(nodeB.y)) {
                            console.warn(`Invalid coordinates for edge weight calculation between ${nodeA.id} and ${nodeB.id} on road ${roadId}. Skipping edge.`);
                            continue;
                        }

                        // Вес - прямое расстояние между точками A и B
                        const weight = distance(nodeA.x, nodeA.y, nodeB.x, nodeB.y);

                        // Удаляем старые связи между этими узлами (особенно между виртуальными)
                        graph.get(nodeA.id)?.delete(nodeB.id);
                        graph.get(nodeB.id)?.delete(nodeA.id);

                        // Добавляем новое ребро
                        addEdge(nodeA.id, nodeB.id, weight);
                        // console.log(`Rebuilding edge: ${nodeA.id} <-> ${nodeB.id} on road ${roadId} with weight ${weight}`); // Лог
                    }
                } else {
                    // Если виртуальный узел уже существует, просто добавляем ребро от icon/stair к нему
                    addEdge(nodeId, virtualNodeId, distToClosest);
                    // console.log(`Node ${nodeId} connects to existing virtual node ${virtualNodeId} on road ${roadId}`); // Лог
                }


            } // else {
            // console.log(`Node ${nodeId} on floor ${nodeInfo.floorIndex} is too far from any road.`);
            //}
        }
    }); // Конец nodeCoords.forEach (этап 3)


    // 4. Соединение лестниц между этажами
    stairs.forEach((stairNodes) => {
        if (stairNodes.length > 1) {
            stairNodes.sort((a, b) => a.floorIndex - b.floorIndex);
            for (let i = 0; i < stairNodes.length - 1; i++) {
                const s1 = stairNodes[i];
                const s2 = stairNodes[i + 1];
                if (Math.abs(s1.floorIndex - s2.floorIndex) === 1) {
                    // Проверка координат перед добавлением ребра лестницы
                    if (isNaN(s1.x) || isNaN(s1.y) || isNaN(s2.x) || isNaN(s2.y)) {
                        console.warn(`Invalid coordinates for stair connection between ${s1.id} and ${s2.id}. Skipping edge.`);
                        continue;
                    }
                    addEdge(s1.id, s2.id, STAIR_FLOOR_CHANGE_WEIGHT);
                    // console.log(`Connecting stairs: ${s1.id} (floor ${s1.floorIndex}) <-> ${s2.id} (floor ${s2.floorIndex})`); // Лог
                }
            }
        }
    });
    console.log("Graph construction finished. Graph size:", graph.size, "Node coords size:", nodeCoords.size); // Финальный лог
    return { graph, nodeCoords };
}