// src/components/RouteMap.jsx

import React, {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {Shape, Text} from 'react-konva';
import useStore from './store.jsx';
import {buildGraph} from './graph.js';
import {findShortestPath} from './dijkstra.js';

function getPointAtDistance(points, distance) {
    if (!points || points.length < 2 || typeof distance !== 'number' || isNaN(distance) || distance < 0) return null;
    if (distance <= 1e-6) return points[0] ? {...points[0], segmentIndex: 0} : null;
    let cumulativeLength = 0;
    for (let i = 0; i < points.length - 1; i++) {
        const p1 = points[i];
        const p2 = points[i + 1];
        if (!p1 || !p2 || typeof p1.x !== 'number' || typeof p1.y !== 'number' || typeof p2.x !== 'number' || typeof p2.y !== 'number') continue;
        const dx = p2.x - p1.x;
        const dy = p2.y - p1.y;
        const segmentLength = Math.sqrt(dx * dx + dy * dy);
        if (segmentLength < 1e-6) continue;
        if (cumulativeLength + segmentLength >= distance - 1e-6) {
            const remainingDistance = distance - cumulativeLength;
            const ratio = remainingDistance / segmentLength;
            return {x: p1.x + dx * ratio, y: p1.y + dy * ratio};
        }
        cumulativeLength += segmentLength;
    }
    return points[points.length - 1];
}

function getTransitionVerb(fromIndex, toIndex) {
    if (fromIndex < toIndex) return "Поднимитесь";
    if (fromIndex > toIndex || toIndex === 4) return "Спуститесь";
    return "";
}

function getFloorDisplayName(floorIndex) {
    return String(floorIndex);
}

function RouteMap({currentFloorIndex, mapDataPath}) {
    const [isLoadingGraph, setIsLoadingGraph] = useState(true);
    const [errorMsg, setErrorMsg] = useState(null);
    const graphDataRef = useRef({graph: null, nodeCoords: null});

    const buildRouteTrigger = useStore((state) => state.buildRouteTrigger);
    const fromRoom = useStore((state) => state.fromRoom);
    const toRoom = useStore((state) => state.toRoom);
    const calculatedPath = useStore((state) => state.calculatedPath);

    const processedTriggerRef = useRef(null);

    useEffect(() => {
        let isMounted = true;
        const {
            setGraphData,
            setCalculatedPath,
            setIsRouteInstructionsVisible,
            setRouteInstructions
        } = useStore.getState();

        setIsLoadingGraph(true);
        setErrorMsg(null);
        setCalculatedPath(null);
        setIsRouteInstructionsVisible(false);
        setRouteInstructions([]);

        fetch(mapDataPath)
            .then(res => res.ok ? res.json() : Promise.reject(new Error(`HTTP ${res.status}`)))
            .then(data => {
                if (!isMounted || !data?.layers) return;
                const pLayers = data.layers.map((l, i) => ({...l, floorIndex: i}));
                const {graph, nodeCoords} = buildGraph(pLayers);
                if (!graph?.size) throw new Error("Граф пуст.");

                graphDataRef.current = {graph, nodeCoords};
                setGraphData(graph, nodeCoords);
            })
            .catch(error => {
                if (isMounted) setErrorMsg(`Ошибка данных: ${error.message}`);
            })
            .finally(() => {
                if (isMounted) setIsLoadingGraph(false);
            });

        return () => {
            isMounted = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [mapDataPath]);

    const getGraphNodeId = useCallback((item, nodeCoordsMap) => {
        if (!item?.id || !nodeCoordsMap?.size) return null;
        const {id, name} = item;
        const candidates = [`icon-${id}`, `icon-${id}_door`];
        for (const candidateId of candidates) {
            if (nodeCoordsMap.has(candidateId)) return candidateId;
        }
        setErrorMsg(`Точка входа для "${name || id}" не найдена.`);
        return null;
    }, []);

    useEffect(() => {
        if (isLoadingGraph) return;

        const { setIsRouteInstructionsVisible, setRouteInstructions, setCalculatedPath } = useStore.getState();

        if (buildRouteTrigger === null) {
            if (calculatedPath !== null) {
                setCalculatedPath(null);
                setErrorMsg(null);
                setIsRouteInstructionsVisible(false);
            }
            return;
        }

        if (processedTriggerRef.current === buildRouteTrigger) return;

        const { graph, nodeCoords } = graphDataRef.current;
        if (!graph) { setErrorMsg("Данные для маршрута не готовы."); return; }

        setCalculatedPath(null);
        setErrorMsg(null);
        setIsRouteInstructionsVisible(false);

        if (!fromRoom || !toRoom || fromRoom.id === toRoom.id) {
            processedTriggerRef.current = buildRouteTrigger;
            return;
        }

        const startNodeId = getGraphNodeId(fromRoom, nodeCoords);
        const endNodeId = getGraphNodeId(toRoom, nodeCoords);

        if (!startNodeId || !endNodeId) {
            processedTriggerRef.current = buildRouteTrigger;
            return;
        }

        const finalPath = findShortestPath(graph, nodeCoords, startNodeId, endNodeId);

        if (finalPath) {
            setCalculatedPath(finalPath);

            const instructions = [];
            let lastSignificantNodeIndex = 0;
            if (nodeCoords.has(startNodeId)) {
                for (let i = 1; i < finalPath.length; i++) {
                    const prevNodeData = nodeCoords.get(finalPath[i - 1]);
                    const currNodeData = nodeCoords.get(finalPath[i]);
                    if (!prevNodeData || !currNodeData) continue;
                    if (prevNodeData.floorIndex !== currNodeData.floorIndex) {
                        if (i - lastSignificantNodeIndex > 1) {
                            instructions.push({
                                text: `Следуйте по маршруту на ${getFloorDisplayName(prevNodeData.floorIndex)} этаже`,
                                nodeId: finalPath[lastSignificantNodeIndex] // Узел, с которого начинается сегмент
                            });
                        } else if (instructions.length === 0) {
                            instructions.push({
                                text: `Начните движение на ${getFloorDisplayName(prevNodeData.floorIndex)} этаже`,
                                nodeId: startNodeId // Первый узел
                            });
                        }

                        let finalTransitionNodeIndex = i;
                        let initialDirection = getTransitionVerb(prevNodeData.floorIndex, currNodeData.floorIndex);
                        let usesStairs = finalPath[i - 1].includes('ladder') || finalPath[i].includes('ladder');

                        while (finalTransitionNodeIndex + 1 < finalPath.length) {
                            const nextNodeData = nodeCoords.get(finalPath[finalTransitionNodeIndex + 1]);
                            const currentTransitionNodeData = nodeCoords.get(finalPath[finalTransitionNodeIndex]);
                            if (!nextNodeData || !currentTransitionNodeData) break;
                            if (currentTransitionNodeData.floorIndex !== nextNodeData.floorIndex) {
                                if (getTransitionVerb(currentTransitionNodeData.floorIndex, nextNodeData.floorIndex) === initialDirection) {
                                    finalTransitionNodeIndex++;
                                    if (finalPath[finalTransitionNodeIndex].includes('ladder')) usesStairs = true;
                                } else break;
                            } else break;
                        }
                        const targetFloorIndex = nodeCoords.get(finalPath[finalTransitionNodeIndex]).floorIndex;
                        const targetFloorName = getFloorDisplayName(targetFloorIndex);
                        const verb = getTransitionVerb(prevNodeData.floorIndex, targetFloorIndex);
                        if (verb) {
                            let step = `${verb} на ${targetFloorName} этаж`;
                            if (usesStairs) step += " по лестнице";
                            instructions.push({
                                text: step,
                                nodeId: finalPath[finalTransitionNodeIndex] // Узел, где переход заканчивается (лестница на новом этаже)
                            });
                        }
                        i = finalTransitionNodeIndex;
                        lastSignificantNodeIndex = finalTransitionNodeIndex;
                    }
                }
            }
            if (finalPath.length - 1 - lastSignificantNodeIndex > 0) {
                instructions.push({
                    text: `Следуйте до пункта назначения: ${toRoom.name || toRoom.description}`,
                    nodeId: endNodeId // Конечный узел
                });
            }

            setRouteInstructions(instructions.length > 0 ? instructions : [{ text: `Маршрут до ${toRoom.name || toRoom.description} построен.`, nodeId: endNodeId }]);
        } else {
            setErrorMsg("Маршрут не найден.");
        }

        processedTriggerRef.current = buildRouteTrigger;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [buildRouteTrigger, fromRoom, toRoom, isLoadingGraph, getGraphNodeId, calculatedPath]);

    const renderedPathChevrons = useMemo(() => {
        if (!calculatedPath || calculatedPath.length < 2 || errorMsg) return [];

        const {nodeCoords} = graphDataRef.current;
        if (!nodeCoords) return [];

        const CHEVRON_SIZE = 8;
        const CHEVRON_SPACING = 18;
        const CHEVRON_ANGLE_DEG = 38;
        const CHEVRON_ANGLE_RAD = CHEVRON_ANGLE_DEG * (Math.PI / 180);

        const polyline = calculatedPath.map(id => nodeCoords.get(id)).filter(Boolean);

        const segmentsByFloor = [];
        let currentSegment = [];
        for (let i = 0; i < polyline.length; i++) {
            const point = polyline[i];
            if (currentSegment.length === 0) {
                currentSegment.push(point);
            } else {
                if (point.floorIndex === currentSegment[0].floorIndex) {
                    currentSegment.push(point);
                } else {
                    if (currentSegment.length > 1) segmentsByFloor.push(currentSegment);
                    currentSegment = [point];
                }
            }
        }
        if (currentSegment.length > 1) segmentsByFloor.push(currentSegment);

        const segmentsOnCurrentFloor = segmentsByFloor.filter(segment =>
            segment.length > 0 && segment[0].floorIndex === currentFloorIndex
        );

        const allChevrons = [];
        segmentsOnCurrentFloor.forEach((points, segmentIdx) => {
            let totalLength = 0;
            const segmentLengths = [];
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const len = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
                segmentLengths.push(len);
                totalLength += len;
            }

            if (totalLength < CHEVRON_SPACING) return;

            let cumulativeLength = 0;
            for (let i = 0; i < points.length - 1; i++) {
                const p1 = points[i];
                const p2 = points[i + 1];
                const segmentLength = segmentLengths[i];

                let distanceInSegment = (cumulativeLength === 0) ? CHEVRON_SPACING / 2 : CHEVRON_SPACING - (cumulativeLength % CHEVRON_SPACING);

                while (distanceInSegment < segmentLength) {
                    const point = getPointAtDistance([p1, p2], distanceInSegment);
                    if (!point) break;

                    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);

                    const bp1 = {
                        x: point.x - CHEVRON_SIZE * Math.cos(angle - CHEVRON_ANGLE_RAD),
                        y: point.y - CHEVRON_SIZE * Math.sin(angle - CHEVRON_ANGLE_RAD)
                    };
                    const bp2 = {
                        x: point.x - CHEVRON_SIZE * Math.cos(angle + CHEVRON_ANGLE_RAD),
                        y: point.y - CHEVRON_SIZE * Math.sin(angle + CHEVRON_ANGLE_RAD)
                    };

                    allChevrons.push(
                        <Shape
                            key={`chevron-${segmentIdx}-${i}-${distanceInSegment}`}
                            sceneFunc={(ctx, shape) => {
                                ctx.beginPath();
                                ctx.moveTo(bp1.x, bp1.y);
                                ctx.lineTo(point.x, point.y);
                                ctx.lineTo(bp2.x, bp2.y);
                                ctx.strokeShape(shape);
                            }}
                            stroke="#D6322D"
                            strokeWidth={3}
                            lineCap="round"
                            lineJoin="round"
                            listening={false}
                            perfectDrawEnabled={false}
                        />
                    );
                    distanceInSegment += CHEVRON_SPACING;
                }
                cumulativeLength += segmentLength;
            }
        });

        return allChevrons;
    }, [calculatedPath, currentFloorIndex, errorMsg]);

    if (isLoadingGraph) return null;
    return (
        <>
            {errorMsg && <Text x={20} y={50} text={`Ошибка: ${errorMsg}`} fill="darkred" fontSize={16}/>}
            {!errorMsg && renderedPathChevrons}
        </>
    );
}

export default RouteMap;