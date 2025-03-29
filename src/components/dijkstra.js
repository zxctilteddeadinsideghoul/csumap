// src/components/map/pathfinding/dijkstra.js
import TinyQueue from 'tinyqueue'; // Потребуется установить: npm install tinyqueue

export function findShortestPath(graph, nodeCoords, startNodeId, endNodeId) {
    if (!graph.has(startNodeId) || !graph.has(endNodeId)) {
        console.error("Start or end node not found in graph");
        return null; // Стартовый или конечный узел не найдены
    }

    const distances = new Map(); // Расстояния от startNodeId до каждого узла
    const previousNodes = new Map(); // Предыдущий узел на кратчайшем пути
    const queue = new TinyQueue([], (a, b) => a.distance - b.distance); // Очередь с приоритетом

    // Инициализация
    graph.forEach((_, nodeId) => {
        distances.set(nodeId, Infinity);
        previousNodes.set(nodeId, null);
    });

    distances.set(startNodeId, 0);
    queue.push({ nodeId: startNodeId, distance: 0 });

    while (queue.length > 0) {
        const { nodeId: currentNodeId, distance: currentDistance } = queue.pop();

        // Если мы уже нашли более короткий путь к этому узлу, пропускаем
        if (currentDistance > distances.get(currentNodeId)) {
            continue;
        }

        // Если достигли цели
        if (currentNodeId === endNodeId) {
            break;
        }

        // Рассматриваем соседей
        const neighbors = graph.get(currentNodeId);
        if (neighbors) {
            neighbors.forEach((weight, neighborId) => {
                const distanceToNeighbor = currentDistance + weight;

                // Если нашли более короткий путь к соседу
                if (distanceToNeighbor < distances.get(neighborId)) {
                    distances.set(neighborId, distanceToNeighbor);
                    previousNodes.set(neighborId, currentNodeId);
                    queue.push({ nodeId: neighborId, distance: distanceToNeighbor });
                }
            });
        }
    }

    // Восстановление пути
    const path = [];
    let current = endNodeId;
    if (distances.get(current) === Infinity) {
        return null; // Путь не найден
    }

    while (current !== null) {
        path.unshift(current); // Добавляем в начало
        current = previousNodes.get(current);
        if (!current && path[0] !== startNodeId) {
            console.error("Path reconstruction failed. Start node not reached.");
            return null; // Ошибка восстановления пути
        }
    }

    return path.length > 1 ? path : null; // Возвращаем путь, если он состоит более чем из 1 узла
}