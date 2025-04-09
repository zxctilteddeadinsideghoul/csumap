import { useEffect, useState } from 'react';
import './App.css';
import MapRedactor from "./components/MapRedactor.jsx";

// Простая форма логина
function LoginForm({ onLogin }) {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    const handleLogin = async () => {
        try {
            const res = await fetch('https://staticstorm.ru/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ username : username, password : password }),
            });

            if (!res.ok) throw new Error('Ошибка авторизации');

            const data = await res.json();
            localStorage.setItem('token', data["access_token"]);
            onLogin();
        } catch (err) {
            setError('Неверный логин или пароль');
        }
    };

    return (
        <div>
            <h2>Авторизация</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <input
                type="text"
                placeholder="Логин"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
            />
            <br />
            <input
                type="password"
                placeholder="Пароль"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
            />
            <br />
            <button onClick={handleLogin}>Войти</button>
        </div>
    );
}

function App() {
    const [isAuthorized, setIsAuthorized] = useState(false);

    const checkToken = () => {
        const token = localStorage.getItem('token');
        if (!token) return false;

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload.role === 'manager';
        } catch (e) {
            return false;
        }
    };

    useEffect(() => {
        if (checkToken()) {
            setIsAuthorized(true);
        }
    }, []);

    return (
        <>
            {isAuthorized ? <MapRedactor /> : <LoginForm onLogin={() => setIsAuthorized(checkToken())} />}
        </>
    );
}

export default App;