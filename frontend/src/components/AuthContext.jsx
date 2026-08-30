import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axiosInstance from '../services/api';
import SessionTimeoutPrompt from './SessionTimeoutPrompt';

const STORAGE_KEYS = {
    token: 'access_token',
    user: 'user',
};

const IDLE_TIMEOUT_MS = 5 * 60 * 1000;
const IDLE_PROMPT_COUNTDOWN_SECONDS = 30;

const ROLE_ID_TO_NAME = {
    1: 'ADMIN',
    2: 'STAFF',
    3: 'HEAD_DEPT',
    4: 'LECTURER',
    5: 'STUDENT',
};

const ADMIN_ROLE_NAMES = new Set(['ADMIN', 'STAFF', 'HEAD_DEPT']);

export const resolveRoleName = (user) => {
    if (!user) {
        return null;
    }

    const normalized = (value) => (typeof value === 'string' ? value.toUpperCase() : null);

    return (
        normalized(user.role_name) ||
        normalized(user.role?.name) ||
        normalized(user.role?.role_name) ||
        normalized(user.role) ||
        ROLE_ID_TO_NAME[user.role_id || user.role?.role_id] ||
        null
    );
};

export const getDefaultDashboardPath = (user) => {
    const roleName = resolveRoleName(user);
    if (roleName && ADMIN_ROLE_NAMES.has(roleName)) {
        return '/admin';
    }
    if (roleName === 'LECTURER') {
        return '/lecturer';
    }
    return '/student';
};

const AuthContext = createContext();

const canUseStorage = () => typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';

const buildScopedKey = (baseKey, user) => {
    const identifier = user?.user_id || user?.email || user?.id;
    return identifier ? `${baseKey}_${identifier}` : null;
};

const readScopedJson = (baseKey, user) => {
    if (!canUseStorage()) {
        return null;
    }
    const scopedKey = buildScopedKey(baseKey, user);
    const scopedRaw = scopedKey ? window.localStorage.getItem(scopedKey) : null;
    const raw = scopedRaw || window.localStorage.getItem(baseKey);
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw);
        if (!scopedRaw && parsed && parsed._owner && user?.email && parsed._owner !== user.email) {
            return null;
        }
        return parsed;
    } catch (_err) {
        return null;
    }
};

const readScopedValue = (baseKey, user) => {
    if (!canUseStorage()) {
        return null;
    }
    const scopedKey = buildScopedKey(baseKey, user);
    return (scopedKey && window.localStorage.getItem(scopedKey)) || window.localStorage.getItem(baseKey);
};

const parseUser = (value) => {
    if (!value) return null;
    try {
        return JSON.parse(value);
    } catch (_err) {
        return null;
    }
};

const extractErrorMessage = (err, fallback) => {
    const detail = err?.response?.data?.detail;
    if (Array.isArray(detail)) {
        return detail
            .map((item) => item?.msg || item?.message || JSON.stringify(item))
            .join(', ');
    }
    if (typeof detail === 'string') {
        return detail;
    }
    if (detail && typeof detail === 'object') {
        return detail?.msg || detail?.message || JSON.stringify(detail);
    }
    return fallback;
};

const readStoredSession = () => {
    if (!canUseStorage()) {
        return { token: null, user: null };
    }
    const storedToken = window.localStorage.getItem(STORAGE_KEYS.token);
    const storedUserRaw = window.localStorage.getItem(STORAGE_KEYS.user);
    const storedUser = parseUser(storedUserRaw);
    if (!storedUser && storedUserRaw) {
        window.localStorage.removeItem(STORAGE_KEYS.user);
    }
    if (storedUser) {
        const profile = readScopedJson('user_profile', storedUser);
        const avatarUrl = readScopedValue('user_avatar', storedUser);
        if (profile?.name) {
            storedUser.full_name = profile.name;
        }
        if (profile?.email) {
            storedUser.email = profile.email;
        }
        if (avatarUrl) {
            storedUser.avatar_url = avatarUrl;
        }
    }
    return { token: storedToken, user: storedUser };
};

const persistSession = (nextToken, nextUser) => {
    if (!canUseStorage()) {
        return;
    }
    if (nextToken) {
        window.localStorage.setItem(STORAGE_KEYS.token, nextToken);
    } else {
        window.localStorage.removeItem(STORAGE_KEYS.token);
    }

    if (nextUser) {
        window.localStorage.setItem(STORAGE_KEYS.user, JSON.stringify(nextUser));
    } else {
        window.localStorage.removeItem(STORAGE_KEYS.user);
    }
};

export const AuthProvider = ({ children }) => {
    const navigate = useNavigate();
    const location = useLocation();
    const [user, setUser] = useState(null);
    const [token, setToken] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [isAuthReady, setIsAuthReady] = useState(false);
    const [idlePromptVisible, setIdlePromptVisible] = useState(false);
    const [idleCountdown, setIdleCountdown] = useState(0);

    const idleTimerRef = useRef(null);
    const countdownTimerRef = useRef(null);

    const clearError = useCallback(() => setError(null), []);

    const clearIdleTimer = useCallback(() => {
        if (!idleTimerRef.current) {
            return;
        }
        const timerId = idleTimerRef.current;
        idleTimerRef.current = null;
        if (typeof window !== 'undefined') {
            window.clearTimeout(timerId);
        } else {
            clearTimeout(timerId);
        }
    }, []);

    const clearCountdownTimer = useCallback(() => {
        if (!countdownTimerRef.current) {
            return;
        }
        const timerId = countdownTimerRef.current;
        countdownTimerRef.current = null;
        if (typeof window !== 'undefined') {
            window.clearInterval(timerId);
        } else {
            clearInterval(timerId);
        }
    }, []);

    const dismissIdlePrompt = useCallback(() => {
        setIdlePromptVisible(false);
        setIdleCountdown(0);
    }, []);

    const startIdleTimer = useCallback(() => {
        if (!user || !token) {
            return;
        }
        if (typeof window === 'undefined') {
            return;
        }
        clearIdleTimer();
        idleTimerRef.current = window.setTimeout(() => {
            setIdlePromptVisible(true);
        }, IDLE_TIMEOUT_MS);
    }, [user, token, clearIdleTimer]);

    const registerUserActivity = useCallback(() => {
        if (!user || !token) {
            return;
        }
        dismissIdlePrompt();
        startIdleTimer();
    }, [user, token, dismissIdlePrompt, startIdleTimer]);

    useEffect(() => {
        const storedSession = readStoredSession();
        if (storedSession.token) {
            setToken(storedSession.token);
        }
        if (storedSession.user) {
            setUser(storedSession.user);
        }
        setIsAuthReady(true);
    }, []);

    useEffect(() => {
        if (!isAuthReady) {
            return;
        }
        persistSession(token, user);
    }, [token, user, isAuthReady]);

    useEffect(() => {
        if (!canUseStorage()) {
            return undefined;
        }
        const handleStorage = (event) => {
            if (event.key === STORAGE_KEYS.token) {
                setToken(event.newValue);
            }
            if (event.key === STORAGE_KEYS.user) {
                setUser(parseUser(event.newValue));
            }
        };

        window.addEventListener('storage', handleStorage);
        return () => window.removeEventListener('storage', handleStorage);
    }, []);

    useEffect(() => {
        clearError();
    }, [location.pathname, clearError]);

    const logout = useCallback(() => {
        // Clear ALL localStorage to prevent data leakage between users
        if (canUseStorage()) {
            window.localStorage.clear();
        }
        persistSession(null, null);
        setToken(null);
        setUser(null);
        clearError();
        dismissIdlePrompt();
        clearIdleTimer();
        clearCountdownTimer();
        navigate('/login', { replace: true });
    }, [navigate, clearError, dismissIdlePrompt, clearIdleTimer, clearCountdownTimer]);

    useEffect(() => {
        if (!idlePromptVisible) {
            clearCountdownTimer();
            return undefined;
        }
        if (typeof window === 'undefined') {
            return undefined;
        }
        setIdleCountdown(IDLE_PROMPT_COUNTDOWN_SECONDS);
        clearCountdownTimer();
        countdownTimerRef.current = window.setInterval(() => {
            setIdleCountdown((prev) => {
                if (prev <= 1) {
                    clearCountdownTimer();
                    logout();
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);
        return () => clearCountdownTimer();
    }, [idlePromptVisible, logout, clearCountdownTimer]);

    useEffect(() => {
        if (!user || !token) {
            clearIdleTimer();
            dismissIdlePrompt();
            return undefined;
        }
        if (typeof window === 'undefined' || typeof document === 'undefined') {
            return undefined;
        }
        const activityEvents = ['mousemove', 'mousedown', 'keydown', 'scroll', 'touchstart', 'wheel'];
        const handleActivity = () => registerUserActivity();
        const handleVisibility = () => {
            if (!document.hidden) {
                registerUserActivity();
            }
        };

        activityEvents.forEach((event) => window.addEventListener(event, handleActivity));
        document.addEventListener('visibilitychange', handleVisibility);
        registerUserActivity();

        return () => {
            activityEvents.forEach((event) => window.removeEventListener(event, handleActivity));
            document.removeEventListener('visibilitychange', handleVisibility);
            clearIdleTimer();
        };
    }, [user, token, registerUserActivity, clearIdleTimer, dismissIdlePrompt]);

    const handleStayActive = useCallback(() => {
        registerUserActivity();
    }, [registerUserActivity]);

    const login = async (email, password) => {
        setLoading(true);
        clearError();
        try {
            const params = new URLSearchParams();
            params.append('username', email);
            params.append('password', password);
            params.append('grant_type', 'password');
            const res = await axiosInstance.post('/auth/login', params, {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            });

            const accessToken = res.data.access_token;
            setToken(accessToken);
            persistSession(accessToken, null);

            const profileRes = await axiosInstance.get('/users/me', {
                headers: { Authorization: `Bearer ${accessToken}` },
            });

            const sessionUser = profileRes.data;
            setUser(sessionUser);
            persistSession(accessToken, sessionUser);

            navigate(getDefaultDashboardPath(sessionUser), { replace: true });
        } catch (err) {
            setError(extractErrorMessage(err, 'Login failed'));
        } finally {
            setLoading(false);
        }
    };

    const register = async (registerData) => {
        setLoading(true);
        clearError();
        try {
            await axiosInstance.post('/auth/register', registerData);
            navigate('/login', { replace: true });
        } catch (err) {
            setError(extractErrorMessage(err, 'Registration failed'));
        } finally {
            setLoading(false);
        }
    };

    const updateUser = useCallback((updates) => {
        setUser((prev) => {
            if (!prev) {
                return prev;
            }
            const nextUser = { ...prev, ...updates };
            persistSession(token, nextUser);
            return nextUser;
        });
    }, [token]);

    return (
        <AuthContext.Provider value={{ user, token, loading, error, login, register, logout, isAuthReady, clearError, updateUser }}>
            {children}
            {idlePromptVisible && (
                <SessionTimeoutPrompt
                    secondsRemaining={idleCountdown}
                    onStayActive={handleStayActive}
                    onSignOut={logout}
                />
            )}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
