// src/config/specialObjects.js

/**
 * Центральный конфигурационный файл для "особых" объектов.
 * Это единственный источник правды о том, какие объекты запускают новый флоу.
 * Ключ к расширяемости: для добавления нового типа объекта (например, "банкомат")
 * достаточно добавить новую запись в этот объект.
 */
export const SPECIAL_OBJECT_CONFIG = {
    'туалет': {
        // Ключевые слова, которые триггерят поиск этого типа объекта
        searchKeywords: ['туалет', 'wc', 'уборная', 'ту', 'туа', 'туал', 'туале'],
        // Идентификатор категории, для поиска в общем списке комнат (rooms).
        targetCategory: 'туалет',
        // Нужно ли отображать панель фильтров?
        isFilterable: true,
        // Описание самих фильтров
        filterProperties: [
            { id: 'male', label: 'М', searchKeyword: 'мужской' }, // Ключевое слово для этого фильтра
            { id: 'female', label: 'Ж', searchKeyword: 'женский' },
            { id: 'accessible', label: 'ОВЗ', searchKeyword: 'для лиц с' }, // Уточнено для поиска
        ]
    },
    'автомат с едой': {
        searchKeywords: ['автомат', 'авт', 'авто', 'автом', 'еда', 'вендинг', 'снеки', 'кофе', 'вода'],
        targetCategory: 'автомат',
        isFilterable: false,
    },
    'гардероб': {
        searchKeywords: ['гардероб', 'гар', 'гард', 'гарде', 'одежда', 'куртка', 'куртку'],
        targetCategory: 'гардероб',
        isFilterable: false,
    },
    'выход': {
        searchKeywords: ['выход', 'exit', 'вход', 'вы', 'вых', 'выхо', 'вх', 'вхо'],
        targetCategory: 'выход',
        isFilterable: false,
    }
};

/**
 * Хелпер для получения конфига по поисковому запросу.
 * @param {string} query - Поисковый запрос пользователя.
 * @returns {object|null} - Конфиг объекта или null, если не найдено.
 */
export const getSpecialConfigByQuery = (query) => {
    if (!query) return null;
    const lowerCaseQuery = query.toLowerCase().trim();
    // Ищем самое длинное совпадение, чтобы "туалет" был важнее чем "ту"
    let bestMatch = null;
    for (const key in SPECIAL_OBJECT_CONFIG) {
        const config = SPECIAL_OBJECT_CONFIG[key];
        for (const keyword of config.searchKeywords) {
            if (lowerCaseQuery.includes(keyword)) {
                if (!bestMatch || keyword.length > bestMatch.keyword.length) {
                    bestMatch = { ...config, key: key, keyword: keyword };
                }
            }
        }
    }
    return bestMatch;
};