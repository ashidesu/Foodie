import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../firebase';
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signInAnonymously,
    sendPasswordResetEmail
} from 'firebase/auth';
import './Auth.css';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [isFormValid, setIsFormValid] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        setIsFormValid(email && password);
    }, [email, password]);

    const handleEmailLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            navigate('/home');
        } catch (error) {
            setError(error.message);
        }
    };

    const handleGoogleLogin = async () => {
        setError('');

        try {
            const provider = new GoogleAuthProvider();
            await signInWithPopup(auth, provider);
            navigate('/home');
        } catch (error) {
            setError(error.message);
        }
    };

    const handleAnonymousLogin = async () => {
        setError('');

        try {
            await signInAnonymously(auth);
            navigate('/home');
        } catch (error) {
            setError(error.message);
        }
    };

    const handlePasswordReset = async () => {
        if (!email) {
            setError('Please enter your email address first');
            return;
        }

        try {
            await sendPasswordResetEmail(auth, email);
            alert('Password reset email sent! Check your inbox.');
        } catch (error) {
            setError(error.message);
        }
    };

    return (
        <div className = 'auth'>
            <div className="auth-wrapper">
                <div className="auth-container">
                    <h1>Log in</h1>

                    <form onSubmit={handleEmailLogin}>
                        <div className="field-label">
                            <span>Email or username</span>
                        </div>

                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            style={{ marginBottom: '16px' }}
                        />

                        <div className="field-label" style={{ marginBottom: '8px' }}>
                            <span>Password</span>
                        </div>

                        <div className="input-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                            <div
                                className="password-toggle"
                                onClick={() => setShowPassword(!showPassword)}
                            >
                                <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                    {showPassword ? (
                                        <>
                                            <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                            <line x1="3" y1="3" x2="21" y2="21" stroke="currentColor" strokeWidth="2" />
                                        </>
                                    ) : (
                                        <path d="M12 4.5C7 4.5 2.73 7.61 1 12c1.73 4.39 6 7.5 11 7.5s9.27-3.11 11-7.5c-1.73-4.39-6-7.5-11-7.5zM12 17c-2.76 0-5-2.24-5-5s2.24-5 5-5 5 2.24 5 5-2.24 5-5 5zm0-8c-1.66 0-3 1.34-3 3s1.34 3 3 3 3-1.34 3-3-1.34-3-3-3z" />
                                    )}
                                </svg>
                            </div>
                        </div>

                        <a href="#" className="forgot-password" onClick={handlePasswordReset}>
                            Forgot password?
                        </a>

                        {error && (
                            <div className="error-message show">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className={`auth-btn ${isFormValid ? 'active' : ''}`}
                            disabled={!isFormValid}
                        >
                            Log in
                        </button>
                    </form>

                    <div className="divider">Or</div>

                    <button className="google-auth-btn" onClick={handleGoogleLogin}>
                        <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                            <path fill="#4285F4" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z" />
                        </svg>
                        Continue with Google
                    </button>
                    <button className="anonymous-auth-btn" onClick={handleAnonymousLogin}>
                        <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 448 512">
                            <path fill="currentColor" d="M224 256A128 128 0 1 0 224 0a128 128 0 1 0 0 256zm-45.7 48C79.8 304 0 383.8 0 482.3C0 498.7 13.3 512 29.7 512H418.3c16.4 0 29.7-13.3 29.7-29.7C448 383.8 368.2 304 269.7 304H178.3z" />
                        </svg>
                        Continue as Guest
                    </button>

                    <div className="auth-switch">
                        Don't have an account? <Link to="/signup">Sign up</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Login;