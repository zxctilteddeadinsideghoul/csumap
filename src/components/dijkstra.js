// src/components/dijkstra.js
import TinyQueue from 'tinyqueue'; // Потребуется установить: npm install tinyqueue

export function findShortestPath(graph, nodeCoords, startNodeId, endNodeId) {
    // Проверка существования узлов в графе (основная проверка)
    if (!graph.has(startNodeId)) {
        console.error(`[Dijkstra] Стартовый узел '${startNodeId}' не найден в графе.`);
        return null;
    }
    if (!graph.has(endNodeId)) {
        console.error(`[Dijkstra] Конечный узел '${endNodeId}' не найден в графе.`);
        return null;
    }
    // Доп. проверка координат (на всякий случай)
    if (!nodeCoords.has(startNodeId) || !nodeCoords.has(endNodeId)) {
        console.error(`[Dijkstra] Координаты для узла '${startNodeId}' или '${endNodeId}' не найдены.`);
        return null;
    }

    const distances = new Map(); // Расстояния от startNodeId до каждого узла
    const previousNodes = new Map(); // Предыдущий узел на кратчайшем пути
    // Очередь с приоритетом (min-heap) для выбора узла с наименьшим расстоянием
    const queue = new TinyQueue([], (a, b) => a.distance - b.distance);

    // Инициализация: устанавливаем расстояние до всех узлов как бесконечность,
    // кроме стартового узла (расстояние 0).
    graph.forEach((_, nodeId) => {
        distances.set(nodeId, Infinity);
        previousNodes.set(nodeId, null);
    });

    distances.set(startNodeId, 0);
    queue.push({ nodeId: startNodeId, distance: 0 });

    while (queue.length > 0) {
        // Извлекаем узел с наименьшим расстоянием из очереди
        const { nodeId: currentNodeId, distance: currentDistance } = queue.pop();

        // Если мы уже обработали этот узел с меньшим расстоянием, пропускаем
        if (currentDistance > distances.get(currentNodeId)) {
            continue;
        }

        // Если достигли целевого узла, можно остановиться (оптимизация)
        if (currentNodeId === endNodeId) {
            // console.log(`[Dijkstra] Цель ${endNodeId} достигнута с расстоянием ${currentDistance}`);
            break;
        }

        // Рассматриваем всех соседей текущего узла
        const neighbors = graph.get(currentNodeId);
        if (neighbors) {
            neighbors.forEach((weight, neighborId) => {
                // Пропускаем соседа, если он не существует в карте координат (маловероятно, но безопасно)
                if (!nodeCoords.has(neighborId)) {
                    // console.warn(`[Dijkstra] Сосед '${neighborId}' узла '${currentNodeId}' не найден в nodeCoords.`);
                    return;
                }

                // Проверяем валидность веса ребра
                if (isNaN(weight) || weight < 0) {
                    console.warn(`[Dijkstra] Невалидный вес (${weight}) ребра между ${currentNodeId} и ${neighborId}. Пропускаем соседа.`);
                    return;
                }

                const distanceToNeighbor = currentDistance + weight;

                // Если нашли более короткий путь к соседу...
                if (distanceToNeighbor < distances.get(neighborId)) {
                    distances.set(neighborId, distanceToNeighbor); // Обновляем расстояние
                    previousNodes.set(neighborId, currentNodeId); // Запоминаем предыдущий узел
                    // Добавляем/обновляем соседа в очереди с новым расстоянием
                    queue.push({ nodeId: neighborId, distance: distanceToNeighbor });
                }
            });
        }
    }

    // --- Восстановление пути ---
    const path = [];
    let current = endNodeId;

    // Если расстояние до конечного узла осталось бесконечным, значит путь не найден
    if (distances.get(current) === Infinity) {
        console.log(`[Dijkstra] Путь от ${startNodeId} до ${endNodeId} не найден (расстояние Infinity).`);
        return null;
    }

    // Идем обратно от конечного узла к начальному по карте previousNodes
    while (current !== null) {
        path.unshift(current); // Добавляем узел в начало массива пути
        // Проверка на зацикливание (если узел ссылается сам на себя)
        const previous = previousNodes.get(current);
        if (previous === current) {
            console.error("[Dijkstra] Ошибка восстановления пути: обнаружено зацикливание на узле", current);
            return null;
        }
        current = previous;
        // Добавим проверку на случай, если что-то пошло не так и мы не дошли до startNodeId
        if (path.length > graph.size) { // Произвольная большая проверка глубины
            console.error("[Dijkstra] Ошибка восстановления пути: превышена максимальная длина пути. Возможно, граф имеет циклы или ошибка в previousNodes.");
            return null;
        }
    }

    // Проверяем, что путь начинается со стартового узла (на всякий случай)
    if (path.length === 0 || path[0] !== startNodeId) {
        console.error(`[Dijkstra] Ошибка восстановления пути. Путь не начинается со стартового узла ${startNodeId}. Полученный путь:`, path);
        return null;
    }

    // Возвращаем путь, только если он состоит более чем из одного узла (т.е. не просто старт = конец)
    return path.length > 1 ? path : null;
}