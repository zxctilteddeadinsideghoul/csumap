// src/components/map/pathfinding/graph.js

// --- Вспомогательные функции ---
function distance(x1, y1, x2, y2) {
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

// Находит ближайшую точку на отрезке (x1,y1) - (x2,y2) к точке (px,py)
function getClosestPointOnSegment(px, py, x1, y1, x2, y2) {
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

// --- Основная функция построения графа ---
export function buildGraph(layers) {
    const graph = new Map(); // Adjacency list: Map<nodeId, Map<neighborId, weight>>
    const nodeCoords = new Map(); // Map<nodeId, {x, y, floorIndex}>
    const roadEndpoints = new Map(); // Храним конечные точки дорог для связывания: Map<floorIndex, Array<{id, x, y}>>
    const stairs = new Map(); // Храним лестницы для связывания: Map<logicalId, Array<{id, x, y, floorIndex}>>
    const virtualNodesOnRoads = new Map();

    const ROOM_CONNECTION_THRESHOLD_SQ = 150 * 150; // Квадрат макс. расстояния от комнаты/лестницы до дороги
    const INTERSECTION_THRESHOLD_SQ = 10 * 10; // Квадрат макс. расстояния для соединения конечных точек дорог
    const STAIR_FLOOR_CHANGE_WEIGHT = 1000; // "Стоимость" перехода по лестнице

    function addEdge(node1, node2, weight) {
        if (!graph.has(node1)) graph.set(node1, new Map());
        if (!graph.has(node2)) graph.set(node2, new Map());
        // Добавляем ребра в обе стороны, если вес > 0 (или если это пересечение)
        if (weight >= 0) {
            graph.get(node1).set(node2, weight);
            graph.get(node2).set(node1, weight);
        }
    }

    // 1. Обработка дорог и лестниц, сбор узлов
    layers.forEach((layer, floorIndex) => {
        roadEndpoints.set(floorIndex, []); // Инициализация массива для этажа

        // Дороги
        (layer.roads || []).forEach(road => {
            const startNodeId = `road-${road.id}-start`;
            const endNodeId = `road-${road.id}-end`;
            const weight = distance(road.x1, road.y1, road.x2, road.y2);

            nodeCoords.set(startNodeId, { x: road.x1, y: road.y1, floorIndex });
            nodeCoords.set(endNodeId, { x: road.x2, y: road.y2, floorIndex });
            // Изначально соединяем концы дороги
            addEdge(startNodeId, endNodeId, weight);

            // Сохраняем конечные точки для поиска пересечений
            roadEndpoints.get(floorIndex).push({ id: startNodeId, x: road.x1, y: road.y1 });
            roadEndpoints.get(floorIndex).push({ id: endNodeId, x: road.x2, y: road.y2 });

            // Инициализируем массив для виртуальных узлов этой дороги
            if (!virtualNodesOnRoads.has(road.id)) {
                virtualNodesOnRoads.set(road.id, []);
            }
        });

        // Комнаты и Лестницы: создаем узлы
        (layer.rooms || []).forEach(room => {
            let entryX, entryY;
            let nodeId;
            if (room.type === 'stair') {
                nodeId = `stair-${room.id}`;
                entryX = room.x + (room.width ? room.width / 2 : 0);
                entryY = room.y + (room.height ? room.height / 2 : 0);
                // Группировка лестниц
                const logicalId = room.id.replace(/_floor\d+$/, '');
                if (!stairs.has(logicalId)) stairs.set(logicalId, []);
                stairs.get(logicalId).push({ id: nodeId, x: entryX, y: entryY, floorIndex });
            } else if (room.type === 'room') {
                nodeId = `room-${room.id}`;
                entryX = room.x + room.width / 2;
                entryY = room.y + room.height / 2;
            } else if (room.type === 'room_vectorized' || (room.x === undefined && room.data)) {
                nodeId = `room-${room.id}`;
                const points = room.data?.match(/M\s*([-+]?\d*\.?\d+)\s*[,\s]\s*([-+]?\d*\.?\d+)/i);
                if (points && points.length >= 3) {
                    entryX = parseFloat(points[1]);
                    entryY = parseFloat(points[2]);
                } else {
                    console.warn(`Cannot parse entry point for Path room ${room.id}. Skipping node creation.`);
                    return; // Пропускаем комнату, если не можем найти точку входа
                }
            } else {
                console.warn(`Unknown room type or insufficient data for room ${room.id}. Skipping.`);
                return;
            }

            nodeCoords.set(nodeId, { x: entryX, y: entryY, floorIndex });
            if (!graph.has(nodeId)) graph.set(nodeId, new Map());
        });
    });

    // 2. Соединение пересечений дорог на каждом этаже
    layers.forEach((_, floorIndex) => {
        const endpoints = roadEndpoints.get(floorIndex) || [];
        for (let i = 0; i < endpoints.length; i++) {
            for (let j = i + 1; j < endpoints.length; j++) {
                const p1 = endpoints[i];
                const p2 = endpoints[j];
                const distSq = distance(p1.x, p1.y, p2.x, p2.y) ** 2;
                if (distSq < INTERSECTION_THRESHOLD_SQ) {
                    // Соединяем близкие конечные точки дорог нулевым весом
                    addEdge(p1.id, p2.id, 0);
                }
            }
        }
    });

// 3. Соединение комнат и лестниц с ближайшими дорогами
    nodeCoords.forEach((nodeInfo, nodeId) => {
        // Обрабатываем только узлы комнат и лестниц
        if (nodeId.startsWith('room-') || nodeId.startsWith('stair-')) {
            let closestRoadPointInfo = null; // Храним информацию о ближайшей точке и дороге
            let minDistanceSq = ROOM_CONNECTION_THRESHOLD_SQ; // Используем квадрат порога

            // --- ИСПРАВЛЕНИЕ: Находим правильный слой для текущего узла ---
            const currentLayer = layers.find(l => l.floorIndex === nodeInfo.floorIndex);

            // Проверяем, что слой и дороги на нем существуют
            if (currentLayer && currentLayer.roads) {
                // Итерируем по дорогам ТОЛЬКО текущего слоя
                currentLayer.roads.forEach(road => {
                    // Находим ближайшую точку на текущем отрезке дороги
                    const closestOnSeg = getClosestPointOnSegment(
                        nodeInfo.x, nodeInfo.y, // Координаты комнаты/лестницы
                        road.x1, road.y1,       // Начало дороги
                        road.x2, road.y2        // Конец дороги
                    );

                    // Если эта точка ближе, чем найденная ранее, и в пределах порога
                    if (closestOnSeg.distSq < minDistanceSq) {
                        minDistanceSq = closestOnSeg.distSq;
                        // Сохраняем всю необходимую информацию о ближайшей точке и её дороге
                        closestRoadPointInfo = {
                            x: closestOnSeg.x,           // Координата X ближайшей точки на дороге
                            y: closestOnSeg.y,           // Координата Y ближайшей точки на дороге
                            roadId: road.id,             // ID дороги, на которой нашли точку
                            roadStartNodeId: `road-${road.id}-start`, // ID узла начала этой дороги
                            roadEndNodeId: `road-${road.id}-end`,   // ID узла конца этой дороги
                            roadStartX: road.x1,           // Координаты начала дороги
                            roadStartY: road.y1,
                            roadEndX: road.x2,             // Координаты конца дороги
                            roadEndY: road.y2,
                        };
                    }
                });
            }
            // --- КОНЕЦ ИСПРАВЛЕНИЯ ---

            // Если нашли достаточно близкую точку на какой-либо дороге этого этажа
            if (closestRoadPointInfo) {
                const { roadId, x, y, roadStartX, roadStartY, roadEndX, roadEndY, roadStartNodeId, roadEndNodeId } = closestRoadPointInfo;
                const distToClosest = Math.sqrt(minDistanceSq); // Реальное расстояние до точки

                // Создаем ID для "виртуального" узла на дороге в ближайшей точке
                const virtualNodeId = `virt-${nodeId}-on-${closestRoadPointInfo.roadId}`;
                const distFromStart = distance(x, y, roadStartX, roadStartY); // Расстояние от начала дороги до вирт. узла

                // Добавляем координаты виртуального узла
                nodeCoords.set(virtualNodeId, { x, y, floorIndex: nodeInfo.floorIndex });
                if (!graph.has(virtualNodeId)) graph.set(virtualNodeId, new Map());


                // 1. Добавляем ребра: комната/лестница <--> виртуальный узел
                addEdge(nodeId, virtualNodeId, distToClosest);


                // 2. Вставляем виртуальный узел в "цепочку" узлов на дороге
                const existingVirtuals = virtualNodesOnRoads.get(roadId); // Получаем список уже существующих вирт. узлов на этой дороге

                // Добавляем новый узел в список и сортируем по расстоянию от начала дороги
                const newVirtualInfo = { id: virtualNodeId, x, y, distFromStart };
                existingVirtuals.push(newVirtualInfo);
                existingVirtuals.sort((a, b) => a.distFromStart - b.distFromStart);

                // Формируем полную цепочку узлов для этой дороги: [start, ...sortedVirtuals, end]
                const fullChain = [
                    { id: roadStartNodeId, distFromStart: 0 }, // Добавляем узел начала дороги
                    ...existingVirtuals,
                    { id: roadEndNodeId, distFromStart: distance(roadStartX, roadStartY, roadEndX, roadEndY) } // Добавляем узел конца дороги
                ];

                // 3. Перестраиваем ребра вдоль дороги
                for (let i = 0; i < fullChain.length - 1; i++) {
                    const nodeA = fullChain[i];
                    const nodeB = fullChain[i + 1];
                    // Рассчитываем вес ребра как разницу расстояний от начала дороги
                    const weight = Math.abs(nodeB.distFromStart - nodeA.distFromStart);

                    // Удаляем старые связи между этими узлами (если они были, особенно start <-> end)
                    graph.get(nodeA.id)?.delete(nodeB.id);
                    graph.get(nodeB.id)?.delete(nodeA.id);

                    // Добавляем новое ребро между соседними узлами в цепочке
                    addEdge(nodeA.id, nodeB.id, weight);
                }
            } else {
                // Если комната/лестница слишком далеко, логируем это
                // console.log(`Node ${nodeId} on floor ${nodeInfo.floorIndex} is too far from any road.`);
            }
        }
    }); // Конец nodeCoords.forEach


    // 4. Соединение лестниц между этажами
    stairs.forEach((stairNodes) => {
        if (stairNodes.length > 1) {
            // Сортируем по этажу на всякий случай
            stairNodes.sort((a, b) => a.floorIndex - b.floorIndex);
            for (let i = 0; i < stairNodes.length - 1; i++) {
                const s1 = stairNodes[i];
                const s2 = stairNodes[i + 1];
                // Соединяем только соседние этажи для одной и той же лестницы
                if (Math.abs(s1.floorIndex - s2.floorIndex) === 1) {
                    addEdge(s1.id, s2.id, STAIR_FLOOR_CHANGE_WEIGHT);
                }
            }
        }
    });

    return { graph, nodeCoords };
}