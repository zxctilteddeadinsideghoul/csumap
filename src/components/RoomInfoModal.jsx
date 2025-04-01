import React, {useEffect, useState} from "react";
import '../RoomInfoModal.css';
import useStore from './store.jsx';

function RoomInfoModal({room, onClose}) {
    const [isVisible, setIsVisible] = useState(false);
    const {setActiveMenu, setFromRoom, setToRoom} = useStore();

    useEffect(() => {
        if (room) {
            setIsVisible(true);
        } else {
            setIsVisible(false);
        }
    }, [room]);

    const handleFromClick = () => {
        if (room) {
            setFromRoom(room);
            setActiveMenu('route');
            onClose();
        }
    };

    const handleToClick = () => {
        if (room) {
            setToRoom(room);
            setActiveMenu('route');
            onClose();
        }
    };

    // Проверяем, является ли помещение техническим
    const isTechnicalRoom = room?.type === 'technical' ||
        room?.description?.toLowerCase().includes('техническое') ||
        room?.name?.toLowerCase().includes('техническое');

    if (!room) return null;

    return (
        <div className={`modal-overlay ${isVisible ? 'visible' : ''}`}>
            <div className="modal-content">
                <button className="close-button" onClick={onClose}>
                    <svg width="15" height="15" viewBox="0 0 15 15" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path id="close" d="M7.5 8.3685L1.06477 14.8037C0.950278 14.9182 0.809617 14.9796 0.642787 14.9877C0.475956 14.9959 0.327118 14.9346 0.196271 14.8037C0.0654234 14.6729 0 14.5281 0 14.3695C0 14.2108 0.0654234 14.0661 0.196271 13.9352L6.6315 7.5L0.196271 1.06477C0.0817793 0.950278 0.0204446 0.809617 0.0122666 0.642787C0.00408867 0.475956 0.0654234 0.327118 0.196271 0.196271C0.327118 0.0654234 0.471868 0 0.63052 0C0.789172 0 0.933922 0.0654234 1.06477 0.196271L7.5 6.6315L13.9352 0.196271C14.0497 0.0817793 14.1908 0.0204446 14.3584 0.0122666C14.5245 0.00408867 14.6729 0.0654234 14.8037 0.196271C14.9346 0.327118 15 0.471868 15 0.63052C15 0.789172 14.9346 0.933922 14.8037 1.06477L8.3685 7.5L14.8037 13.9352C14.9182 14.0497 14.9796 14.1908 14.9877 14.3584C14.9959 14.5245 14.9346 14.6729 14.8037 14.8037C14.6729 14.9346 14.5281 15 14.3695 15C14.2108 15 14.0661 14.9346 13.9352 14.8037L7.5 8.3685Z" fill="#343434"/>
                    </svg>
                </button>
                {room?.type === "icon" ? (
                    <div className="info-grid">
                        {room?.name && (
                            <>
                                <span className="info-label">Название</span>
                                <span className="info-value">{room.name}</span>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="info-grid">
                        {room?.name && (
                            <>
                                <span className="info-label">Помещение</span>
                                <span className="info-value">{room.id}</span>
                            </>
                        )}
                        {room?.description && (
                            <>
                                <span className="info-label">Информация</span>
                                <span className="info-value">{room.description}</span>
                            </>
                        )}
                        {room?.workingTime && (
                            <>
                                <span className="info-label">Часы работы</span>
                                <span className="info-value">{room.workingTime}</span>
                            </>
                        )}
                    </div>
                )}

                {!isTechnicalRoom && (
                    <div className="route-buttons-container">
                        <button className="route-button from-button" onClick={handleFromClick}>
                            <svg width="108" height="40" viewBox="0 0 167 58" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path id="&#208;&#190;&#209;&#130;&#208;&#186;&#209;&#131;&#208;&#180;&#208;&#176;" d="M29.76 40.384C27.456 40.384 25.5467 39.6373 24.032 38.144C22.5387 36.6507 21.792 34.7733 21.792 32.512C21.792 30.2507 22.5387 28.3733 24.032 26.88C25.5467 25.3867 27.456 24.64 29.76 24.64C32.0853 24.64 33.9947 25.3867 35.488 26.88C37.0027 28.3733 37.76 30.2507 37.76 32.512C37.76 34.7733 37.0027 36.6507 35.488 38.144C33.9947 39.6373 32.0853 40.384 29.76 40.384ZM29.76 38.528C31.4667 38.528 32.8427 37.9627 33.888 36.832C34.9333 35.68 35.456 34.24 35.456 32.512C35.456 30.784 34.9333 29.344 33.888 28.192C32.8427 27.04 31.4667 26.464 29.76 26.464C28.0747 26.464 26.7093 27.04 25.664 28.192C24.6187 29.344 24.096 30.784 24.096 32.512C24.096 34.2187 24.6187 35.648 25.664 36.8C26.7093 37.952 28.0747 38.528 29.76 38.528ZM45.2355 40V26.848H39.8275V25.024H52.8195V26.848H47.4115V40H45.2355ZM56.4128 40V25.024H58.5888V32.096H58.6848L65.5968 25.024H68.7328L61.1808 32.192L69.5008 40H66.3008L58.6848 32.448H58.5888V40H56.4128ZM72.7253 47.68C72.0639 47.68 71.4133 47.616 70.7733 47.488L70.9973 45.504C71.5093 45.6747 72.0426 45.76 72.5973 45.76C73.3013 45.76 73.8666 45.536 74.2933 45.088C74.7413 44.6613 75.1359 44 75.4773 43.104L76.6933 39.968L70.2933 25.024H72.7253L77.8133 37.664H77.8773L82.5173 25.024H84.8853L77.4293 43.872C76.9386 45.1307 76.3306 46.08 75.6053 46.72C74.9013 47.36 73.9413 47.68 72.7253 47.68ZM85.6118 44.864V38.112H87.3398C88.9398 36.064 89.7398 33.024 89.7398 28.992V25.024H100.62V38.112H103.02V44.864H101.004V40H87.6278V44.864H85.6118ZM89.8038 38.112H98.4758V26.848H91.8518V29.6C91.8518 32.8213 91.1691 35.6587 89.8038 38.112ZM111.069 40.384C109.725 40.384 108.52 40.0107 107.453 39.264C106.408 38.496 105.885 37.3547 105.885 35.84C105.885 35.0933 106.013 34.4427 106.269 33.888C106.525 33.312 106.909 32.8427 107.421 32.48C107.933 32.1173 108.488 31.8293 109.085 31.616C109.682 31.3813 110.418 31.2107 111.293 31.104C112.168 30.976 112.978 30.9013 113.725 30.88C114.493 30.8373 115.4 30.816 116.445 30.816V30.336C116.445 27.7547 115.112 26.464 112.445 26.464C110.653 26.464 109.17 27.0507 107.997 28.224L106.781 26.784C108.21 25.3547 110.173 24.64 112.669 24.64C114.376 24.64 115.773 25.1093 116.861 26.048C117.949 26.9867 118.493 28.3307 118.493 30.08V36.64C118.493 37.984 118.578 39.104 118.749 40H116.797C116.648 39.1467 116.573 38.336 116.573 37.568H116.509C115.208 39.4453 113.394 40.384 111.069 40.384ZM111.645 38.592C113.117 38.592 114.28 38.112 115.133 37.152C116.008 36.192 116.445 35.0187 116.445 33.632V32.512H115.805C114.781 32.512 113.864 32.5547 113.053 32.64C112.264 32.704 111.464 32.8427 110.653 33.056C109.864 33.2693 109.245 33.6 108.797 34.048C108.349 34.496 108.125 35.0613 108.125 35.744C108.125 36.7253 108.466 37.4507 109.149 37.92C109.832 38.368 110.664 38.592 111.645 38.592Z" fill="white"/>
                                <path id="Vector" d="M144.957 31.8775C145.065 31.7642 145.196 31.6732 145.34 31.6102C145.485 31.5471 145.641 31.5132 145.8 31.5104C145.958 31.5077 146.115 31.5362 146.262 31.5942C146.409 31.6523 146.543 31.7387 146.655 31.8482C146.767 31.9578 146.855 32.0883 146.914 32.232C146.973 32.3757 147.003 32.5296 147 32.6845C146.997 32.8395 146.962 32.9923 146.898 33.1338C146.833 33.2753 146.74 33.4027 146.625 33.5084L140.334 39.6625C140.112 39.8786 139.813 40 139.5 40C139.187 40 138.888 39.8786 138.666 39.6625L132.375 33.5084C132.26 33.4027 132.167 33.2753 132.102 33.1338C132.038 32.9923 132.003 32.8395 132 32.6845C131.997 32.5296 132.027 32.3757 132.086 32.232C132.145 32.0883 132.233 31.9578 132.345 31.8482C132.457 31.7387 132.591 31.6523 132.738 31.5942C132.885 31.5362 133.042 31.5077 133.2 31.5104C133.359 31.5132 133.515 31.5471 133.66 31.6102C133.804 31.6732 133.935 31.7642 134.043 31.8775L138.32 36.0624V21.1539C138.32 20.8479 138.445 20.5544 138.666 20.338C138.887 20.1216 139.187 20 139.5 20C139.813 20 140.113 20.1216 140.334 20.338C140.555 20.5544 140.68 20.8479 140.68 21.1539V36.0624L144.957 31.8775Z" fill="white"/>
                            </svg>
                        </button>
                        <button className="route-button to-button" onClick={handleToClick}>
                            <svg width="108" height="40" viewBox="0 0 167 58" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path id="&#208;&#186;&#209;&#131;&#208;&#180;&#208;&#176;" d="M39.944 40V25.024H42.12V32.096H42.216L49.128 25.024H52.264L44.712 32.192L53.032 40H49.832L42.216 32.448H42.12V40H39.944ZM56.2565 47.68C55.5952 47.68 54.9445 47.616 54.3045 47.488L54.5285 45.504C55.0405 45.6747 55.5738 45.76 56.1285 45.76C56.8325 45.76 57.3978 45.536 57.8245 45.088C58.2725 44.6613 58.6672 44 59.0085 43.104L60.2245 39.968L53.8245 25.024H56.2565L61.3445 37.664H61.4085L66.0485 25.024H68.4165L60.9605 43.872C60.4698 45.1307 59.8618 46.08 59.1365 46.72C58.4325 47.36 57.4725 47.68 56.2565 47.68ZM69.143 44.864V38.112H70.871C72.471 36.064 73.271 33.024 73.271 28.992V25.024H84.151V38.112H86.551V44.864H84.535V40H71.159V44.864H69.143ZM73.335 38.112H82.007V26.848H75.383V29.6C75.383 32.8213 74.7003 35.6587 73.335 38.112ZM94.6003 40.384C93.2563 40.384 92.0509 40.0107 90.9843 39.264C89.9389 38.496 89.4163 37.3547 89.4163 35.84C89.4163 35.0933 89.5443 34.4427 89.8003 33.888C90.0563 33.312 90.4403 32.8427 90.9523 32.48C91.4643 32.1173 92.0189 31.8293 92.6163 31.616C93.2136 31.3813 93.9496 31.2107 94.8243 31.104C95.6989 30.976 96.5096 30.9013 97.2563 30.88C98.0243 30.8373 98.9309 30.816 99.9763 30.816V30.336C99.9763 27.7547 98.6429 26.464 95.9763 26.464C94.1843 26.464 92.7016 27.0507 91.5283 28.224L90.3123 26.784C91.7416 25.3547 93.7043 24.64 96.2003 24.64C97.9069 24.64 99.3043 25.1093 100.392 26.048C101.48 26.9867 102.024 28.3307 102.024 30.08V36.64C102.024 37.984 102.11 39.104 102.28 40H100.328C100.179 39.1467 100.104 38.336 100.104 37.568H100.04C98.7389 39.4453 96.9256 40.384 94.6003 40.384ZM95.1763 38.592C96.6483 38.592 97.8109 38.112 98.6643 37.152C99.5389 36.192 99.9763 35.0187 99.9763 33.632V32.512H99.3363C98.3123 32.512 97.3949 32.5547 96.5843 32.64C95.7949 32.704 94.9949 32.8427 94.1843 33.056C93.3949 33.2693 92.7763 33.6 92.3283 34.048C91.8803 34.496 91.6562 35.0613 91.6562 35.744C91.6562 36.7253 91.9976 37.4507 92.6803 37.92C93.3629 38.368 94.1949 38.592 95.1763 38.592Z" fill="white"/>
                                <path id="Vector" d="M117.043 28.1225C116.935 28.2358 116.804 28.3268 116.66 28.3898C116.515 28.4529 116.359 28.4868 116.2 28.4896C116.042 28.4923 115.885 28.4638 115.738 28.4058C115.591 28.3477 115.457 28.2613 115.345 28.1518C115.233 28.0422 115.145 27.9117 115.086 27.768C115.027 27.6243 114.997 27.4704 115 27.3155C115.003 27.1605 115.038 27.0077 115.102 26.8662C115.167 26.7247 115.26 26.5973 115.375 26.4916L121.666 20.3375C121.888 20.1214 122.187 20 122.5 20C122.813 20 123.112 20.1214 123.334 20.3375L129.625 26.4916C129.74 26.5973 129.833 26.7247 129.898 26.8662C129.962 27.0077 129.997 27.1605 130 27.3155C130.003 27.4704 129.973 27.6243 129.914 27.768C129.855 27.9117 129.767 28.0422 129.655 28.1518C129.543 28.2613 129.409 28.3477 129.262 28.4058C129.115 28.4638 128.958 28.4923 128.8 28.4896C128.641 28.4868 128.485 28.4529 128.34 28.3898C128.196 28.3268 128.065 28.2358 127.957 28.1225L123.68 23.9376V38.8461C123.68 39.1521 123.555 39.4456 123.334 39.662C123.113 39.8784 122.813 40 122.5 40C122.187 40 121.887 39.8784 121.666 39.662C121.445 39.4456 121.32 39.1521 121.32 38.8461V23.9376L117.043 28.1225Z" fill="white"/>
                            </svg>

                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}

export default RoomInfoModal;