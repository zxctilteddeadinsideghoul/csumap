import React, { useState } from 'react';
import Select from 'react-select';
import useStore from './store.jsx';
import '../Header.css';

function Header() {
    const [searchQuery, setSearchQuery] = useState(null);
    const rooms = useStore((state) => state.rooms);
    const { setSelectedSearchRoom } = useStore();

    const roomOptions = rooms
        .filter(room => room.name !== null && room.name !== undefined && room.name !== '')
        .map((room) => ({
            value: room.id,
            label: room.name || room.id,
        }));

    const handleSearchChange = (selectedOption) => {
        setSearchQuery(selectedOption);
        if (selectedOption) {
            const room = rooms.find(r => r.id === selectedOption.value);
            setSelectedSearchRoom(room);
        }
    };

    return (
        <header className="header">
            <svg className="csulogo" width="165" height="38" viewBox="0 0 165 38" fill="none"
                 xmlns="http://www.w3.org/2000/svg">
                <g id="csulogo_2">
                    <path
                        d="M153.91 18.907H154.851L159.925 7.00489H165L153.91 31.739H149.188L151.927 25.602L143.055 7.00489H148.297L153.91 18.907Z"
                        fill="#D6322D"/>
                    <path d="M141.71 11.0792H131.656V31.863H126.867V6.13703H141.71V11.0792Z" fill="#D6322D"/>
                    <path
                        d="M106.927 24.9821C106.143 27.7716 104.966 30.6542 104.434 31.739H110.035C110.932 30.2247 111.576 27.4927 111.996 24.4551L112.589 15.9015H118.828V31.7018H123.966V11.245H107.442C107.442 11.245 107.711 22.1925 106.927 24.9821Z"
                        fill="#D6322D"/>
                    <path
                        d="M93.0622 10.6003C95.0144 10.6003 96.684 10.9603 98.071 11.6802C99.4838 12.4002 100.575 13.4428 101.346 14.8082C102.117 16.1736 102.502 17.8493 102.502 19.8353L102.39 22.5165H88.3232C88.3745 24.0805 89.0282 25.4831 89.9272 26.3768C90.8519 27.2705 92.5614 27.5436 94.1796 27.5436C95.5409 27.5436 96.7739 27.4195 97.8784 27.1712C98.9829 26.8981 100.126 26.4885 101.307 25.9424V30.2247C100.28 30.7212 99.1884 31.0812 98.0325 31.3046C96.9023 31.5529 95.5281 31.677 93.9099 31.677C91.8036 31.677 89.9414 31.3046 88.3232 30.5599C86.7049 29.7903 85.4335 28.6359 84.5088 27.0967C83.5841 25.5576 83.1217 23.6212 83.1217 21.2876C83.1217 18.9044 83.5327 16.9308 84.3547 15.3668C85.2023 13.778 86.371 12.5864 87.8608 11.7919C89.3506 10.9975 91.0844 10.6003 93.0622 10.6003ZM93.1008 14.5475C91.9963 14.5475 91.0716 14.8951 90.3267 15.5902C89.6075 16.2853 89.1836 17.3652 89.0552 18.8299H97.1078C97.1078 18.0107 96.9537 17.2783 96.6454 16.6329C96.3629 15.9874 95.9262 15.4785 95.3355 15.1061C94.7447 14.7337 93.9998 14.5475 93.1008 14.5475Z"
                        fill="#D6322D"/>
                    <path
                        d="M61.6692 6.13703H66.7938V13.3279C66.7938 13.8684 66.8052 14.2796 66.8281 14.5616C66.8511 14.8436 66.9543 15.2079 67.1377 15.6544C67.3211 16.0773 67.5733 16.4063 67.8943 16.6413C68.2383 16.8528 68.7427 17.0526 69.4076 17.2406C70.0955 17.4051 70.9324 17.4873 71.9184 17.4873C73.4317 17.4873 74.8418 17.2993 76.1487 16.9233V6.13703H81.2733V31.3051H76.1487V21.5762C74.4749 21.9757 72.6521 22.1755 70.6802 22.1755C69.2815 22.1755 68.0548 22.0815 67.0001 21.8935C65.9683 21.682 65.1314 21.3765 64.4894 20.977C63.8474 20.554 63.32 20.1193 62.9073 19.6728C62.5175 19.2263 62.2309 18.6623 62.0475 17.9808C61.887 17.2758 61.7838 16.6648 61.7379 16.1478C61.6921 15.6309 61.6692 14.9611 61.6692 14.1386V6.13703Z"
                        fill="#D6322D"/>
                    <path
                        d="M46.7257 18.0712C42.9288 26.1112 39.5777 29.2312 33.3049 33.3531L32.4102 30.9495C36.6677 26.3099 38.5956 23.2488 41.0416 16.7952C43.5093 10.3174 43.7692 6.66538 44.0678 0.148368H50.8835C51.501 2.61128 50.1255 11.3629 46.7257 18.0712Z"
                        fill="#D6322D"/>
                    <path
                        d="M39.6469 15.4896C37.8011 22.1963 35.99 25.076 31.8313 29.7033L31.6734 29.8516L30.6471 28.3383C32.9881 23.5184 33.5881 20.4986 34.3049 14.9555C34.6281 9.1179 34.3822 5.84259 33.8839 0H41.5416C41.5517 5.99407 41.5416 8.60534 39.6469 15.4896Z"
                        fill="#D6322D"/>
                    <path
                        d="M32.4365 18.2196C31.9426 22.056 31.3107 24.0548 29.7787 27.4481L28.6471 26.3501C28.9114 24.7107 29.113 23.7899 29.1471 22.1365C29.1967 19.7432 28.9897 18.4182 28.6471 16.0534C27.2357 9.58464 25.9243 6.22349 23.8577 0H31.3839L32.147 7.59644C32.7268 11.7476 32.6456 14.0728 32.4365 18.2196Z"
                        fill="#D6322D"/>
                    <path
                        d="M27.0682 16.2018C27.6104 19.8871 27.8213 21.9538 27.4366 25.638L25.3577 24.4214C25.2505 20.6477 24.5658 18.5382 23.1472 14.7774C22.567 13.0409 21.9366 12.053 20.9368 10.2967C18.4305 6.22931 16.8005 3.98649 13.8053 0H21.042C23.9304 6.19414 25.5411 9.66848 27.0682 16.2018Z"
                        fill="#D6322D"/>
                    <path
                        d="M0.741725 18.546C-2.91605 28.3383 6.8861 45.8172 31.6734 34.095C30.2462 30.1621 28.5152 28.5875 25.0542 26.6172C20.528 32.4926 13.8703 33.6927 10.5019 32.3442C6.05465 30.5638 3.89451 26.7359 4.31784 22.3442C4.71257 18.2493 7.50198 14.7774 10.8966 14.0059C14.2913 13.2344 17.7677 15.5786 18.715 18.2196C19.6624 20.8605 19.3992 23.3828 17.0309 25.638C14.6625 27.8932 10.6773 27.4481 9.9493 24.8665C9.22129 22.2849 10.2942 20.6528 12.3966 19.911C13.4492 19.911 13.9492 20.6528 13.4492 21.3947C12.9492 22.1365 11.8467 21.1869 11.2941 22.1365C10.5047 22.997 10.4277 26.372 14.3204 25.905C18.2131 25.4381 19.9754 17.5964 14.765 15.7567C9.55453 13.9169 5.92633 17.9822 5.58097 22.3442C4.4231 31.3056 15.3467 34.3323 20.636 28.3383C25.9254 22.3442 22.1097 13.1157 17.5835 10.5341C13.0573 7.95252 4.00484 8.33828 0.741725 18.546Z"
                        fill="#D6322D"/>
                </g>
            </svg>
            <div className="search-container">
                <Select
                    placeholder="Поиск кабинета"
                    options={roomOptions}
                    value={searchQuery}
                    onChange={handleSearchChange}
                    className="header-select"
                    classNamePrefix="header-select"
                />
            </div>
        </header>
    );
}

export default Header;
