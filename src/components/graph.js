// src/components/map/pathfinding/graph.js

// Функции distance, getClosestPointOnSegment, getIconCoords, parseSvgPathRoad - без изменений (берем из предыдущего ответа)
function distance(x1, y1, x2, y2) {
    if (typeof x1 !== 'number' || typeof y1 !== 'number' || typeof x2 !== 'number' || typeof y2 !== 'number' ||
        isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) { return NaN; }
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
}

function getClosestPointOnSegment(px, py, x1, y1, x2, y2) {
    if (typeof px !== 'number' || typeof py !== 'number' || typeof x1 !== 'number' || typeof y1 !== 'number' || typeof x2 !== 'number' || typeof y2 !== 'number' ||
        isNaN(px) || isNaN(py) || isNaN(x1) || isNaN(y1) || isNaN(x2) || isNaN(y2)) { return { x: NaN, y: NaN, distSq: Infinity }; }
    const dx = x2 - x1, dy = y2 - y1, lenSq = dx * dx + dy * dy;
    if (lenSq < 1e-9) { const dSq = distance(px, py, x1, y1)**2; return { x: x1, y: y1, distSq: isNaN(dSq)?Infinity:dSq }; }
    let t = ((px - x1) * dx + (py - y1) * dy) / lenSq;
    if (isNaN(t) || !isFinite(t)) { return { x: NaN, y: NaN, distSq: Infinity }; }
    t = Math.max(0, Math.min(1, t));
    const closestX = x1 + t * dx, closestY = y1 + t * dy;
    if (isNaN(closestX) || isNaN(closestY)) { return { x: NaN, y: NaN, distSq: Infinity }; }
    const distSq = distance(px, py, closestX, closestY)**2;
    return { x: closestX, y: closestY, distSq: isNaN(distSq)?Infinity:distSq };
}

function getIconCoords(vector) {
    if (!vector || !vector.data) return null;
    const match = vector.data.match(/M\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)\s*[,\s]\s*([-+]?\d*\.?\d+(?:[eE][-+]?\d+)?)/i);
    if (match && match.length >= 3) {
        const x = parseFloat(match[1]); const y = parseFloat(match[2]);
        if (!isNaN(x) && !isNaN(y)) return { x, y };
    }
    return null;
}

function parseSvgPathRoad(roadData, roadId, floorIndex) {
    const segments = []; const points = [];
    const commands = roadData.match(/[MLHVCSQTAZ][^MLHVCSQTAZ]*/gi) || [];
    let currentX = NaN, currentY = NaN; let startX = NaN, startY = NaN;

    commands.forEach((cmd) => {
        const type = cmd[0].toUpperCase();
        const argsStr = cmd.slice(1).trim();
        const args = (argsStr.match(/[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?/g) || []).map(parseFloat);
        let nextX = currentX, nextY = currentY; const isCurrentValid = !isNaN(currentX) && !isNaN(currentY);

        switch (type) {
            case 'M': {
                if (args.length >= 2 && !isNaN(args[0]) && !isNaN(args[1])) {
                    if (cmd[0] === 'm' && isCurrentValid) { nextX = currentX + args[0]; nextY = currentY + args[1]; }
                    else { nextX = args[0]; nextY = args[1]; }
                    if (!isNaN(nextX) && !isNaN(nextY)) {
                        if (!isCurrentValid) { points.push({ x: nextX, y: nextY }); startX = nextX; startY = nextY; }
                        else { points.push({ x: nextX, y: nextY }); }
                        currentX = nextX; currentY = nextY;
                        for (let i = 2; i < args.length; i += 2) {
                            if (args.length > i+1 && !isNaN(args[i]) && !isNaN(args[i+1])) {
                                let pointX, pointY;
                                if (cmd[0] === 'm' && !isNaN(currentX)) { pointX = currentX + args[i]; pointY = currentY + args[i + 1]; }
                                else { pointX = args[i]; pointY = args[i + 1]; }
                                if (!isNaN(pointX) && !isNaN(pointY) && !isNaN(currentX)) { segments.push({ x1: currentX, y1: currentY, x2: pointX, y2: pointY, roadId, floorIndex }); points.push({ x: pointX, y: pointY }); currentX = pointX; currentY = pointY; }
                            }
                        }
                    }
                } break; }
            case 'L': { if (!isCurrentValid) break;
                for (let i = 0; i < args.length; i += 2) {
                    if (args.length > i+1 && !isNaN(args[i]) && !isNaN(args[i+1])) {
                        let pointX, pointY;
                        if (cmd[0] === 'l') { pointX = currentX + args[i]; pointY = currentY + args[i + 1]; }
                        else { pointX = args[i]; pointY = args[i + 1]; }
                        if (!isNaN(pointX) && !isNaN(pointY)) { segments.push({ x1: currentX, y1: currentY, x2: pointX, y2: pointY, roadId, floorIndex }); points.push({ x: pointX, y: pointY }); currentX = pointX; currentY = pointY; }
                    } } break; }
            case 'H': { if (!isCurrentValid) break;
                for(const arg of args){ if (!isNaN(arg)) { let pointX; if (cmd[0] === 'h') { pointX = currentX + arg; } else { pointX = arg; } if (!isNaN(pointX)) { segments.push({ x1: currentX, y1: currentY, x2: pointX, y2: currentY, roadId, floorIndex }); points.push({ x: pointX, y: currentY }); currentX = pointX; } } } break; }
            case 'V': { if (!isCurrentValid) break;
                for(const arg of args){ if (!isNaN(arg)) { let pointY; if (cmd[0] === 'v') { pointY = currentY + arg; } else { pointY = arg; } if (!isNaN(pointY)) { segments.push({ x1: currentX, y1: currentY, x2: currentX, y2: pointY, roadId, floorIndex }); points.push({ x: currentX, y: pointY }); currentY = pointY; } } } break; }
            case 'Z': { if (isCurrentValid && !isNaN(startX) && !isNaN(startY)) { if (Math.abs(currentX - startX) > 1e-6 || Math.abs(currentY - startY) > 1e-6) { segments.push({ x1: currentX, y1: currentY, x2: startX, y2: startY, roadId, floorIndex }); currentX = startX; currentY = startY; } } break; }
            case 'C': case 'S': case 'Q': case 'T': case 'A': {
                const lastCoordIndex = args.length >= 2 ? args.length - 2 : -1;
                if (lastCoordIndex >= 0 && !isNaN(args[lastCoordIndex]) && !isNaN(args[lastCoordIndex + 1])) { let tempX = NaN, tempY = NaN; if (cmd[0] === cmd[0].toLowerCase() && isCurrentValid) { tempX = currentX + args[lastCoordIndex]; tempY = currentY + args[lastCoordIndex + 1]; } else { tempX = args[lastCoordIndex]; tempY = args[lastCoordIndex + 1]; } if (!isNaN(tempX) && !isNaN(tempY)) { currentX = tempX; currentY = tempY; } } break; } }
    });
    const uniquePoints = points.filter((p, i, arr) => { if (isNaN(p.x) || isNaN(p.y)) return false; if (i === 0) return true; const prev = arr[i - 1]; if (isNaN(prev.x) || isNaN(prev.y)) return true; return Math.abs(p.x - prev.x) > 1e-6 || Math.abs(p.y - prev.y) > 1e-6; });
    const uniqueSegments = [];
    if (uniquePoints.length > 1) { for (let i = 0; i < uniquePoints.length - 1; i++) { const p1 = uniquePoints[i]; const p2 = uniquePoints[i + 1]; if(!isNaN(p1.x) && !isNaN(p1.y) && !isNaN(p2.x) && !isNaN(p2.y)) { if (Math.abs(p1.x - p2.x) > 1e-6 || Math.abs(p1.y - p2.y) > 1e-6) { uniqueSegments.push({ x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y, roadId, floorIndex }); } } } }
    return { segments: uniqueSegments, points: uniquePoints };
}


export function buildGraph(layers) {
    console.log("--- Начинаем построение графа ---");
    const graph = new Map();
    const nodeCoords = new Map(); // Map<nodeId, {x, y, floorIndex, roadId?}>
    const roadEndpoints = new Map(); // Map<floorIndex, Array<{id, x, y, roadId}>>
    const allRoadSegments = []; // Array<{x1, y1, x2, y2, startNodeId, endNodeId, roadId, floorIndex, weight}>
    const stairIconsMap = new Map(); // Map<logicalId, Array<{id, x, y, floorIndex}>>
    const nodeToRoadIdMap = new Map(); // Map<nodeId, roadId> // НОВОЕ: Для отслеживания принадлежности узла дороге

    // === ПОРОГИ ===
    // Увеличен порог для соединения иконок с дорогами, т.к. иконки могут быть не точно на линии
    const CONNECTION_THRESHOLD_SQ = 70*70; // 70 пикселей - довольно много, можно уменьшить если будут нелогичные соединения
    // Порог для соединения КОНЦОВ сегментов (перекрестки) - должен быть маленьким для точности
    const INTERSECTION_THRESHOLD_SQ = 10*10 ; // 10 пикселей
    // !!! НОВЫЙ ПОРОГ !!! для соединения ЛЮБЫХ близких точек на РАЗНЫХ дорогах
    // Должен быть достаточно маленьким, чтобы не соединять через стены, но позволять "срезать" углы коридоров
    const PROXIMITY_CONNECTION_THRESHOLD_SQ = 30 * 30; // 30 пикселей - НАСТРАИВАЕМЫЙ ПАРАМЕТР
    // ================

    const STAIR_FLOOR_CHANGE_WEIGHT = 500;

    function addEdge(node1, node2, weight) {
        if (isNaN(weight) || weight < 0 || !node1 || !node2 || node1 === node2) return;
        if (!graph.has(node1)) graph.set(node1, new Map());
        if (!graph.has(node2)) graph.set(node2, new Map());
        if (!graph.get(node1).has(node2) || weight < graph.get(node1).get(node2)) {
            graph.get(node1).set(node2, weight);
            graph.get(node2).set(node1, weight);
        }
    }
    function removeEdge(node1, node2) {
        let removed = false;
        if (graph.has(node1) && graph.get(node1).delete(node2)) removed = true;
        if (graph.has(node2) && graph.get(node2).delete(node1)) removed = true;
        return removed;
    }

    // ==================================================
    // Этап 1: Сбор узлов и базовых ребер
    // ==================================================
    console.log("--- Этап 1: Сбор узлов и базовых ребер ---");
    layers.forEach((layer, floorIndex) => {
        if (!layer || typeof layer !== 'object') return;
        console.log(`Обработка этажа ${floorIndex}`);
        roadEndpoints.set(floorIndex, []);

        // 1а: Простые дороги
        (layer.roads || []).filter(road => road && !isNaN(road.x1) && !isNaN(road.y1) && !isNaN(road.x2) && !isNaN(road.y2))
            .forEach((road, roadIndex) => {
                const roadId = road.id || `road-${floorIndex}-${roadIndex}`;
                const startNodeId = `road-${roadId}-start`, endNodeId = `road-${roadId}-end`;
                const weight = distance(road.x1, road.y1, road.x2, road.y2);
                if (isNaN(weight) || weight < 1e-6) return;

                nodeCoords.set(startNodeId, { x: road.x1, y: road.y1, floorIndex });
                nodeCoords.set(endNodeId, { x: road.x2, y: road.y2, floorIndex });
                nodeToRoadIdMap.set(startNodeId, roadId); // Запоминаем принадлежность
                nodeToRoadIdMap.set(endNodeId, roadId);   // Запоминаем принадлежность
                addEdge(startNodeId, endNodeId, weight);

                roadEndpoints.get(floorIndex).push({ id: startNodeId, x: road.x1, y: road.y1, roadId: roadId });
                roadEndpoints.get(floorIndex).push({ id: endNodeId, x: road.x2, y: road.y2, roadId: roadId });
                allRoadSegments.push({ x1: road.x1, y1: road.y1, x2: road.x2, y2: road.y2, startNodeId, endNodeId, roadId, floorIndex, weight });
            });

        // 1б: Дороги из SVG path
        (layer.roads || []).filter(road => road && road.data && typeof road.data === 'string')
            .forEach((road, roadIndex) => {
                const roadId = road.id || `pathroad-${floorIndex}-${roadIndex}`;
                try {
                    const { segments, points } = parseSvgPathRoad(road.data, roadId, floorIndex);
                    if (points.length > 1 && segments.length > 0) {
                        const nodeIdsMap = new Map();
                        const validPathNodeIds = [];

                        points.forEach((p, i) => {
                            if(isNaN(p.x) || isNaN(p.y)) return;
                            const nodeId = `path-${roadId}-node-${i}`;
                            nodeCoords.set(nodeId, { x: p.x, y: p.y, floorIndex });
                            nodeToRoadIdMap.set(nodeId, roadId); // Запоминаем принадлежность
                            if (!graph.has(nodeId)) graph.set(nodeId, new Map());
                            nodeIdsMap.set(i, nodeId);
                            validPathNodeIds.push(nodeId);
                        });

                        if(validPathNodeIds.length < 2) return;

                        segments.forEach((seg) => {
                            const p1Index = points.findIndex(p => Math.abs(p.x - seg.x1) < 1e-6 && Math.abs(p.y - seg.y1) < 1e-6);
                            const p2Index = points.findIndex(p => Math.abs(p.x - seg.x2) < 1e-6 && Math.abs(p.y - seg.y2) < 1e-6);
                            if (p1Index !== -1 && p2Index !== -1) {
                                const id1 = nodeIdsMap.get(p1Index);
                                const id2 = nodeIdsMap.get(p2Index);
                                if (id1 && id2 && id1 !== id2) {
                                    const w = distance(seg.x1, seg.y1, seg.x2, seg.y2);
                                    if (!isNaN(w) && w > 1e-6) {
                                        addEdge(id1, id2, w);
                                        allRoadSegments.push({ ...seg, startNodeId: id1, endNodeId: id2, weight: w });
                                    }
                                }
                            }
                        });

                        const startNodeId = validPathNodeIds[0];
                        const endNodeId = validPathNodeIds[validPathNodeIds.length - 1];
                        const startPoint = nodeCoords.get(startNodeId);
                        const endPoint = nodeCoords.get(endNodeId);
                        if(startPoint) roadEndpoints.get(floorIndex).push({ id: startNodeId, x: startPoint.x, y: startPoint.y, roadId });
                        if(endPoint && startNodeId !== endNodeId) roadEndpoints.get(floorIndex).push({ id: endNodeId, x: endPoint.x, y: endPoint.y, roadId });
                    }
                } catch (e) { console.error(`Ошибка парсинга SVG дороги ${roadId}:`, e); }
            });

        // 1в: Иконки и лестницы
        (layer.vectors || []).filter(v => v && v.type === 'icon' && v.id).forEach(icon => {
            const nodeId = `icon-${icon.id}`;
            const coords = getIconCoords(icon);
            if (coords && !isNaN(coords.x) && !isNaN(coords.y)) {
                nodeCoords.set(nodeId, { x: coords.x, y: coords.y, floorIndex });
                if (!graph.has(nodeId)) graph.set(nodeId, new Map());
                nodeToRoadIdMap.set(nodeId, `icon_${floorIndex}`); // Принадлежность иконки условна
                const stairMatch = icon.id.match(/^ladder(\d+)_(\d+)$/);
                if (stairMatch) {
                    const logicalId = stairMatch[1];
                    const currentFloorActualIndex = floorIndex;
                    if (!stairIconsMap.has(logicalId)) stairIconsMap.set(logicalId, []);
                    stairIconsMap.get(logicalId).push({ id: nodeId, x: coords.x, y: coords.y, floorIndex: currentFloorActualIndex });
                }
            }
        });
    }); // Конец Этапа 1

    // ==================================================
    // Этап 2: Соединение ТОЧНЫХ пересечений (концов дорог)
    // ==================================================
    console.log("--- Этап 2: Соединение точных пересечений (концов дорог) ---");
    layers.forEach((_, floorIndex) => {
        const endpoints = roadEndpoints.get(floorIndex) || [];
        const connectedPairs = new Set();
        for (let i = 0; i < endpoints.length; i++) {
            for (let j = i + 1; j < endpoints.length; j++) {
                const p1 = endpoints[i]; const p2 = endpoints[j];
                if (p1.roadId === p2.roadId || isNaN(p1.x) || isNaN(p1.y) || isNaN(p2.x) || isNaN(p2.y)) continue;
                const pairKey = [p1.id, p2.id].sort().join('--');
                if (connectedPairs.has(pairKey)) continue;
                const distSq = (p1.x - p2.x)**2 + (p1.y - p2.y)**2;
                if (!isNaN(distSq) && distSq < INTERSECTION_THRESHOLD_SQ) { // Маленький порог для концов
                    // console.log(`   -> Соединяем ТОЧНОЕ пересечение F${floorIndex}: ${p1.id}(${p1.roadId}) <-> ${p2.id}(${p2.roadId})`);
                    addEdge(p1.id, p2.id, 0); // Нулевой вес для точного совпадения
                    connectedPairs.add(pairKey);
                }
            }
        }
    }); // Конец Этапа 2

    // ==================================================
    // Этап 3: Соединение ИКОНОК с дорогами (создание вирт. узлов)
    // ==================================================
    console.log("--- Этап 3: Соединение Иконок с Дорогами ---");
    const virtualNodeMap = new Map();
    const nodesToProcessForProximity = []; // Собираем все узлы для этапа 4

    nodeCoords.forEach((nodeInfo, nodeId) => {
        // Добавляем все узлы дорог и иконок в список для проверки близости
        if (nodeId.startsWith('road-') || nodeId.startsWith('path-') || nodeId.startsWith('icon-')) {
            nodesToProcessForProximity.push(nodeId);
        }

        if (nodeId.startsWith('icon-')) {
            if (isNaN(nodeInfo.x) || isNaN(nodeInfo.y)) return;
            let closestDistSq = CONNECTION_THRESHOLD_SQ;
            let connectionCandidate = null;
            const currentFloor = nodeInfo.floorIndex;

            // 3a. Ищем ближайший существующий узел дороги
            nodeCoords.forEach((roadNodeInfo, roadNodeId) => {
                if ((roadNodeId.startsWith('road-') || roadNodeId.startsWith('path-')) && roadNodeInfo.floorIndex === currentFloor) {
                    if (isNaN(roadNodeInfo.x) || isNaN(roadNodeInfo.y)) return;
                    const distSq = (nodeInfo.x - roadNodeInfo.x)**2 + (nodeInfo.y - roadNodeInfo.y)**2;
                    if (!isNaN(distSq) && distSq < closestDistSq) {
                        closestDistSq = distSq;
                        connectionCandidate = { type: 'node', id: roadNodeId, point: { x: roadNodeInfo.x, y: roadNodeInfo.y }, distSq: distSq };
                    }
                }
            });

            // 3b. Ищем ближайшую точку на сегменте дороги
            allRoadSegments.filter(seg => seg.floorIndex === currentFloor).forEach((segment) => {
                if (isNaN(segment.x1) || isNaN(segment.y1) || isNaN(segment.x2) || isNaN(segment.y2) || !segment.startNodeId || !segment.endNodeId) return;
                const closestOnSeg = getClosestPointOnSegment(nodeInfo.x, nodeInfo.y, segment.x1, segment.y1, segment.x2, segment.y2);
                if (isNaN(closestOnSeg.distSq) || closestOnSeg.distSq === Infinity) return;
                if (closestOnSeg.distSq < closestDistSq) {
                    closestDistSq = closestOnSeg.distSq;
                    connectionCandidate = { type: 'segment', id: { startNodeId: segment.startNodeId, endNodeId: segment.endNodeId }, point: { x: closestOnSeg.x, y: closestOnSeg.y }, distSq: closestOnSeg.distSq, segmentData: segment };
                }
            });

            // 3c. Создаем соединение
            if (connectionCandidate) {
                const dist = Math.sqrt(connectionCandidate.distSq);
                if (isNaN(dist)) return;
                let targetNodeId = '';
                let connectionWeight = dist;

                if (connectionCandidate.type === 'node') {
                    targetNodeId = connectionCandidate.id;
                } else { // 'segment'
                    const { x, y } = connectionCandidate.point;
                    const { startNodeId: segStartId, endNodeId: segEndId, weight: segWeight, x1: sx1, y1: sy1, x2: sx2, y2: sy2, roadId: _segRoadId } = connectionCandidate.segmentData;
                    if (isNaN(x) || isNaN(y) || !segStartId || !segEndId || isNaN(sx1) || isNaN(sy1) || isNaN(sx2) || isNaN(sy2) || isNaN(segWeight)) return;
                    const vNodeKey = `${x.toFixed(2)},${y.toFixed(2)},${currentFloor}`;

                    if (virtualNodeMap.has(vNodeKey)) {
                        targetNodeId = virtualNodeMap.get(vNodeKey);
                    } else {
                        const sanitizedIconId = nodeId.replace(/^icon-/, '').replace(/[^a-zA-Z0-9-_]/g, '_');
                        let counter = 0;
                        let potentialVNodeId = `virt-${sanitizedIconId}-on-${segStartId.split('-').pop()}-${segEndId.split('-').pop()}`;
                        targetNodeId = potentialVNodeId;
                        while (nodeCoords.has(targetNodeId)) targetNodeId = `${potentialVNodeId}-${counter++}`;

                        nodeCoords.set(targetNodeId, { x, y, floorIndex: currentFloor });
                        nodeToRoadIdMap.set(targetNodeId, _segRoadId); // Вирт. узел принадлежит дороге сегмента
                        if (!graph.has(targetNodeId)) graph.set(targetNodeId, new Map());
                        virtualNodeMap.set(vNodeKey, targetNodeId);
                        nodesToProcessForProximity.push(targetNodeId); // Добавляем вирт. узел для проверки близости

                        const weightStartToVirtual = distance(sx1, sy1, x, y);
                        const weightVirtualToEnd = distance(x, y, sx2, sy2);

                        if (!isNaN(weightStartToVirtual) && !isNaN(weightVirtualToEnd) && weightStartToVirtual >= 0 && weightVirtualToEnd >= 0 &&
                            (segWeight < 1e-6 || Math.abs(weightStartToVirtual + weightVirtualToEnd - segWeight) < 1e-3))
                        {
                            const _oldEdgeRemoved = removeEdge(segStartId, segEndId); // Гарантированно удаляем старое ребро
                            // if (!_oldEdgeRemoved) console.warn(`   - Старое ребро ${segStartId} <-> ${segEndId} НЕ НАЙДЕНО для удаления при создании ${targetNodeId}`);
                            addEdge(segStartId, targetNodeId, weightStartToVirtual);
                            addEdge(targetNodeId, segEndId, weightVirtualToEnd);
                        } else {
                            console.warn(`Невалидные веса при разбиении сегмента ${segStartId}-${segEndId} -> ${targetNodeId}. Пропуск перестроения.`);
                            // Если не удалось перестроить, не устанавливаем targetNodeId, чтобы иконка не повисла в воздухе
                            targetNodeId = '';
                        }
                    }
                }

                if (targetNodeId) {
                    addEdge(nodeId, targetNodeId, connectionWeight);
                }
            }
        }
    }); // Конец Этапа 3

    // ==================================================
    // !!! НОВЫЙ ЭТАП 3.5: Соединение БЛИЗКИХ точек на РАЗНЫХ дорогах !!!
    // ==================================================
    console.log("--- Этап 3.5: Соединение близких точек разных дорог ---");
    layers.forEach((_, floorIndex) => {
        // Фильтруем узлы для текущего этажа
        const floorNodes = nodesToProcessForProximity.filter(nodeId => nodeCoords.get(nodeId)?.floorIndex === floorIndex);
        console.log(`  Этаж ${floorIndex}: ${floorNodes.length} узлов для проверки близости.`);
        const connectedProximityPairs = new Set();

        for (let i = 0; i < floorNodes.length; i++) {
            for (let j = i + 1; j < floorNodes.length; j++) {
                const id1 = floorNodes[i];
                const id2 = floorNodes[j];

                const node1Info = nodeCoords.get(id1);
                const node2Info = nodeCoords.get(id2);

                // Получаем roadId для каждого узла (иконки имеют условный roadId)
                const roadId1 = nodeToRoadIdMap.get(id1);
                const roadId2 = nodeToRoadIdMap.get(id2);

                // Соединяем только если узлы принадлежат РАЗНЫМ дорогам
                // И не соединяем две иконки напрямую (они должны идти через дороги)
                if (!roadId1 || !roadId2 || roadId1 === roadId2 || (id1.startsWith('icon-') && id2.startsWith('icon-'))) {
                    continue;
                }

                if (!node1Info || !node2Info || isNaN(node1Info.x) || isNaN(node1Info.y) || isNaN(node2Info.x) || isNaN(node2Info.y)) {
                    continue; // Пропускаем невалидные узлы
                }

                const pairKey = [id1, id2].sort().join('--');
                if (connectedProximityPairs.has(pairKey)) continue;

                const distSq = (node1Info.x - node2Info.x)**2 + (node1Info.y - node2Info.y)**2;

                if (!isNaN(distSq) && distSq < PROXIMITY_CONNECTION_THRESHOLD_SQ) {
                    const weight = Math.sqrt(distSq);
                    // console.log(`   -> Соединяем близкие точки F${floorIndex}: ${id1}(${roadId1}) <-> ${id2}(${roadId2}), dist=${weight.toFixed(2)}`);
                    addEdge(id1, id2, weight); // Вес равен фактическому расстоянию
                    connectedProximityPairs.add(pairKey);
                }
            }
        }
    }); // Конец Этапа 3.5

    // ==================================================
    // Этап 4: Соединение иконок ЛЕСТНИЦ между этажами
    // ==================================================
    console.log("--- Этап 4: Соединение иконок лестниц ---");
    stairIconsMap.forEach((stairNodesGroup) => {
        if (stairNodesGroup.length > 1) {
            const nodesByFloor = new Map();
            stairNodesGroup.forEach(node => {
                if (!nodeCoords.has(node.id)) return;
                if (!nodesByFloor.has(node.floorIndex)) nodesByFloor.set(node.floorIndex, []);
                nodesByFloor.get(node.floorIndex).push(node);
            });
            const sortedFloors = Array.from(nodesByFloor.keys()).sort((a, b) => a - b);
            for (let i = 0; i < sortedFloors.length - 1; i++) {
                const floorN_idx = sortedFloors[i];
                const floorN1_idx = sortedFloors[i + 1];
                if (floorN1_idx === floorN_idx + 1) {
                    const nodesFloorN = nodesByFloor.get(floorN_idx);
                    const nodesFloorN1 = nodesByFloor.get(floorN1_idx);
                    if (nodesFloorN && nodesFloorN1) {
                        nodesFloorN.forEach(s1 => {
                            nodesFloorN1.forEach(s2 => {
                                if (isNaN(s1.x) || isNaN(s1.y) || isNaN(s2.x) || isNaN(s2.y)) return;
                                // console.log(`     > Соединение лестницы: ${s1.id} <-> ${s2.id}`);
                                addEdge(s1.id, s2.id, STAIR_FLOOR_CHANGE_WEIGHT);
                            }); }); } } } }
    }); // Конец Этапа 4

    console.log("--- Построение графа завершено --- Размер графа:", graph.size, "Координат узлов:", nodeCoords.size);
    return { graph, nodeCoords };
}