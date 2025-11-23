import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import {
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signInAnonymously
} from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import emailjs from '@emailjs/browser'; // Import EmailJS
import './Auth.css';
import '../App.css';

const Signup = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [verificationCode, setVerificationCode] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [isFormValid, setIsFormValid] = useState(false);
    const [verificationCodeSent, setVerificationCodeSent] = useState('');
    const [countdown, setCountdown] = useState(0);
    const [newsletter, setNewsletter] = useState(false);
    const [birthday, setBirthday] = useState({
        month: '',
        day: '',
        year: ''
    });

    const navigate = useNavigate();

    useEffect(() => {
        validateForm();
    }, [email, password, verificationCode, birthday]);

    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const validateForm = () => {
        const isValid = birthday.month && birthday.day && birthday.year &&
            email && password.length >= 6 && verificationCode.length === 6;
        setIsFormValid(isValid);
    };

    const validateEmail = (email) => {
        const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return re.test(email);
    };

    const generateVerificationCode = () => {
        return Math.floor(100000 + Math.random() * 900000).toString();
    };

    // Replace simulateEmailSend with actual EmailJS send
    const sendVerificationCode = async () => {
        if (!email) {
            setError('Please enter your email address first');
            return;
        }

        if (!validateEmail(email)) {
            setError('Please enter a valid email address');
            return;
        }

        try {
            const code = generateVerificationCode();
            setVerificationCodeSent(code);

            // Replace with your actual EmailJS IDs (consider using env variables for security)
            const serviceId = 'service_8i5jp4s'; // e.g., 'service_abc123'
            const templateId = 'template_pw47ihy'; // e.g., 'template_xyz789'
            const publicKey = 'JDcWYxv2OVg57asfF'; // e.g., 'abcd1234efgh'

            console.log('Sending email with:', { serviceId, templateId, publicKey, to_email: email, code }); // Debug log

            const result = await emailjs.send(
                serviceId,
                templateId,
                {
                    to_email: email, // Must match your template's placeholder
                    code: code, // Must match your template's placeholder
                },
                publicKey
            );

            console.log('EmailJS result:', result); // Debug log for success
            setSuccess(`Verification code sent to ${email}. Please check your email.`);
            setError('');
            setCountdown(60);
        } catch (error) {
            console.error('EmailJS error details:', error); // Detailed error log
            setError(`Error sending verification code: ${error.text || error.message}. Please try again.`);
        }
    };

    const signupWithEmail = async (e) => {
        e.preventDefault();
        setError('');

        if (!birthday.month || !birthday.day || !birthday.year) {
            setError('Please select your birthday');
            return;
        }

        if (!email) {
            setError('Please enter your email address');
            return;
        }

        if (password.length < 6) {
            setError('Password must be at least 6 characters');
            return;
        }

        if (!verificationCodeSent) {
            setError('Please send verification code first');
            return;
        }

        if (verificationCode !== verificationCodeSent) {
            setError('Invalid verification code. Please check and try again.');
            return;
        }

        try {
            const userCredential = await createUserWithEmailAndPassword(auth, email, password);
            const user = userCredential.user;

            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                birthday: {
                    month: birthday.month,
                    day: birthday.day,
                    year: birthday.year,
                    fullDate: `${birthday.year}-${birthday.month}-${birthday.day}`
                },
                newsletter: newsletter,
                createdAt: new Date(),
                authProvider: 'email'
            });

            setSuccess('Account created successfully! Redirecting...');
            setTimeout(() => {
                navigate('/home');
            }, 2000);
        } catch (error) {
            console.error('Signup error:', error);
            let errorMessage = '';
            switch (error.code) {
                case 'auth/email-already-in-use':
                    errorMessage = 'This email is already registered. Try logging in instead.';
                    break;
                case 'auth/invalid-email':
                    errorMessage = 'Please enter a valid email address.';
                    break;
                case 'auth/weak-password':
                    errorMessage = 'Password should be at least 6 characters.';
                    break;
                case 'auth/operation-not-allowed':
                    errorMessage = 'Email/password signup is not enabled. Please contact support.';
                    break;
                default:
                    errorMessage = error.message;
            }
            setError(errorMessage);
        }
    };

    const signupWithGoogle = async () => {
        if (!birthday.month || !birthday.day || !birthday.year) {
            setError('Please select your birthday first');
            return;
        }

        const provider = new GoogleAuthProvider();

        try {
            const result = await signInWithPopup(auth, provider);
            const user = result.user;
            // Safely access isNewUser (as previously fixed)
            const isNewUser = result.additionalUserInfo?.isNewUser || false;
            console.log('Is new user:', isNewUser); // Debug log

            // Always create/update the document with birthday using merge
            // This ensures the birthday is stored for both new and existing users
            await setDoc(doc(db, 'users', user.uid), {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                birthday: {
                    month: birthday.month,
                    day: birthday.day,
                    year: birthday.year,
                    fullDate: `${birthday.year}-${birthday.month}-${birthday.day}`
                },
                newsletter: newsletter,
                createdAt: new Date(),
                authProvider: 'google'
            }, { merge: true }); // Merge option: Updates existing fields without overwriting others

            setSuccess('Signed in with Google successfully! Redirecting...');
            setTimeout(() => {
                navigate('/home');
            }, 2000);
        } catch (error) {
            console.error('Google signup error:', error);
            let errorMessage = '';
            switch (error.code) {
                case 'auth/popup-closed-by-user':
                    errorMessage = 'Sign-in popup was closed. Please try again.';
                    break;
                case 'auth/popup-blocked':
                    errorMessage = 'Popup was blocked by browser. Please allow popups for this site.';
                    break;
                case 'auth/account-exists-with-different-credential':
                    errorMessage = 'An account already exists with this email using a different sign-in method.';
                    break;
                default:
                    errorMessage = error.message;
            }
            setError(errorMessage);
        }
    };

    const signupAnonymously = async () => {
        if (!birthday.month || !birthday.day || !birthday.year) {
            setError('Please select your birthday first');
            return;
        }

        try {
            const result = await signInAnonymously(auth);
            const user = result.user;

            await setDoc(doc(db, 'users', user.uid), {
                birthday: {
                    month: birthday.month,
                    day: birthday.day,
                    year: birthday.year,
                    fullDate: `${birthday.year}-${birthday.month}-${birthday.day}`
                },
                newsletter: newsletter,
                createdAt: new Date(),
                authProvider: 'anonymous',
                isAnonymous: true
            });

            setSuccess('Signed in as guest! Redirecting...');
            setTimeout(() => {
                navigate('/home');
            }, 2000);
        } catch (error) {
            console.error('Anonymous signup error:', error);
            setError('Error signing in anonymously: ' + error.message);
        }
    };

    const days = Array.from({ length: 31 }, (_, i) => i + 1);
    const years = Array.from({ length: 101 }, (_, i) => new Date().getFullYear() - i);
    const months = [
        { value: '01', label: 'January' },
        { value: '02', label: 'February' },
        { value: '03', label: 'March' },
        { value: '04', label: 'April' },
        { value: '05', label: 'May' },
        { value: '06', label: 'June' },
        { value: '07', label: 'July' },
        { value: '08', label: 'August' },
        { value: '09', label: 'September' },
        { value: '10', label: 'October' },
        { value: '11', label: 'November' },
        { value: '12', label: 'December' }
    ];

    return (
        <div className='auth'>
            <div className="auth-wrapper">
                <div className="auth-container">
                    <h1>Sign up</h1>

                    <form onSubmit={signupWithEmail}>
                        <label className="birthday-label">When's your birthday?</label>
                        <div className="birthday-group">
                            <select
                                value={birthday.month}
                                onChange={(e) => setBirthday({ ...birthday, month: e.target.value })}
                            >
                                <option value="">Month</option>
                                {months.map(month => (
                                    <option key={month.value} value={month.value}>{month.label}</option>
                                ))}
                            </select>
                            <select
                                value={birthday.day}
                                onChange={(e) => setBirthday({ ...birthday, day: e.target.value })}
                            >
                                <option value="">Day</option>
                                {days.map(day => (
                                    <option key={day} value={day < 10 ? '0' + day : day}>{day}</option>
                                ))}
                            </select>
                            <select
                                value={birthday.year}
                                onChange={(e) => setBirthday({ ...birthday, year: e.target.value })}
                            >
                                <option value="">Year</option>
                                {years.map(year => (
                                    <option key={year} value={year}>{year}</option>
                                ))}
                            </select>
                        </div>
                        <div className="birthday-info">Your birthday won't be shown publicly.</div>

                        <div className="field-label">
                            <span>Email</span>
                        </div>

                        <input
                            type="email"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />

                        <div className="input-wrapper">
                            <input
                                type={showPassword ? "text" : "password"}
                                placeholder="Password (min 6 characters)"
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

                        <div className="code-input-group">
                            <input
                                type="text"
                                maxLength="6"
                                placeholder="Enter 6-digit code"
                                value={verificationCode}
                                onChange={(e) => setVerificationCode(e.target.value)}
                            />
                            <button
                                type="button"
                                className="send-code-btn"
                                onClick={sendVerificationCode}
                                disabled={countdown > 0}
                            >
                                {countdown > 0 ? `Resend (${countdown}s)` : 'Send code'}
                            </button>
                        </div>

                        <div className="checkbox-group">
                            <input
                                type="checkbox"
                                id="newsletter"
                                checked={newsletter}
                                onChange={(e) => setNewsletter(e.target.checked)}
                            />
                            <label htmlFor="newsletter">
                                Get trending content, newsletters, promotions, recommendations, and account updates sent to your email
                            </label>
                        </div>

                        {error && (
                            <div className="error-message show">
                                {error}
                            </div>
                        )}

                        {success && (
                            <div className="success-message show">
                                {success}
                            </div>
                        )}

                        <button
                            type="submit"
                            className={`auth-btn ${isFormValid ? 'active' : ''}`}
                            disabled={!isFormValid}
                        >
                            Sign up
                        </button>
                    </form>

                    <div className="divider">Or</div>

                    <button className="google-auth-btn" onClick={signupWithGoogle}>
                        <svg width="18" height="18" viewBox="0 0 18 18" style={{ marginRight: '8px' }} xmlns="http://www.w3.org/2000/svg" >
                            <path fill="#4285F4"
                                d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z" />
                            <path fill="#34A853"
                                d="M9 18c2.43 0 4.467-.806 5.956-2.184l-2.908-2.258c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z" />
                            <path fill="#FBBC05"
                                d="M3.964 10.707c-.18-.54-.282-1.117-.282-1.707 0-.593.102-1.17.282-1.709V4.958H.957C.347 6.173 0 7.548 0 9c0 1.452.348 2.827.957 4.042l3.007-2.335z" />
                            <path fill="#EA4335"
                                d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z" />
                        </svg>
                        Continue with Google
                    </button>
                    <button className="anonymous-auth-btn" onClick={signupAnonymously}>
                        Continue as Guest
                    </button>
                    <div className="auth-switch">
                        Already have an account? <Link to="/login">Log in</Link>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Signup;
