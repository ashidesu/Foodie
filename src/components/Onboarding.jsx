// Onboarding.js
import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebase';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore';
import supabase from '../supabase'; // Assuming supabase is exported from supabase.js
import './Auth.css';

const Onboarding = () => {
    const [formData, setFormData] = useState({
        username: '',
        displayname: '',
        pronouns: '',
        city: '',
        province: '',
    });
    const [selectedFile, setSelectedFile] = useState(null);
    const [previewUrl, setPreviewUrl] = useState(null);
    const [isUploading, setIsUploading] = useState(false);
    const [isDragging, setIsDragging] = useState(false);
    const [usernameError, setUsernameError] = useState('');
    const [usernameWarning, setUsernameWarning] = useState('');
    const [isCheckingUsername, setIsCheckingUsername] = useState(false);
    const [error, setError] = useState('');
    const [isFormValid, setIsFormValid] = useState(false);
    const fileInputRef = useRef(null);
    const navigate = useNavigate();

    useEffect(() => {
        const hasRequiredFields = formData.username && formData.displayname && !usernameError && !usernameWarning;
        setIsFormValid(hasRequiredFields);
    }, [formData, usernameError, usernameWarning]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        if (name === 'username') {
            // Convert to lowercase and remove invalid characters
            const sanitized = value.toLowerCase().replace(/[^a-z0-9.]/g, '');
            setFormData((prev) => ({ ...prev, [name]: sanitized }));
            // Check for invalid characters in original value
            if (value !== sanitized) {
                setUsernameWarning('Only letters, numbers, and periods are allowed.');
            } else {
                setUsernameWarning('');
            }
            setUsernameError(''); // Reset error on change
        } else {
            setFormData((prev) => ({ ...prev, [name]: value }));
        }
    };

    const handleUsernameBlur = async () => {
        if (!formData.username.trim() || usernameWarning) return;
        setIsCheckingUsername(true);
        try {
            const q = query(collection(db, 'users'), where('username', '==', formData.username.trim()));
            const querySnapshot = await getDocs(q);
            const exists = querySnapshot.docs.length > 0;
            if (exists) {
                setUsernameError('Username already exists');
            } else {
                setUsernameError('');
            }
        } catch (error) {
            console.error('Error checking username:', error);
            setUsernameError('Error checking username');
        } finally {
            setIsCheckingUsername(false);
        }
    };

    const handleFileSelection = (file) => {
        if (file && file.type.startsWith('image/') && file.size <= 5 * 1024 * 1024) {
            setSelectedFile(file);
            setPreviewUrl(URL.createObjectURL(file));
        } else {
            alert('Please select a valid image file (max 5MB)');
        }
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDragOver = (e) => {
        e.preventDefault();
    };

    const handleDrop = (e) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files && files.length > 0) {
            handleFileSelection(files[0]);
        }
    };

    const handleButtonClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileInputChange = (e) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            handleFileSelection(files[0]);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');

        const user = auth.currentUser;
        if (!user) {
            setError('User not authenticated');
            return;
        }

        if (usernameError || usernameWarning) {
            setError('Please fix the username issues before saving.');
            return;
        }

        setIsUploading(true);
        try {
            let photoURL = null;

            if (selectedFile) {
                const fileExt = selectedFile.name.split('.').pop().toLowerCase();
                const fileName = `${user.uid}.${fileExt}`;
                const { error: uploadError } = await supabase.storage
                    .from('profile-pictures')
                    .upload(fileName, selectedFile, { upsert: true });
                if (uploadError) throw uploadError;

                const { data: { publicUrl } } = supabase.storage.from('profile-pictures').getPublicUrl(fileName);
                photoURL = publicUrl;
            }

            const userDocRef = doc(db, 'users', user.uid);
            // Create or update the user document
            await setDoc(userDocRef, {
                email: user.email,
                displayName: user.displayName,
                photoURL: user.photoURL,
                createdAt: new Date(),
                ...formData,
                photoURL: photoURL || user.photoURL,
                onboardedAt: new Date(),
            }, { merge: true });

            navigate('/home');
        } catch (error) {
            setError(error.message);
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className='auth'>
            <div className="auth-wrapper">
                <div className="auth-container">
                    <h1>Welcome! Let's set up your account</h1>

                    <form onSubmit={handleSubmit}>
                        <div className="form-group">
                            <label className="field-label">Profile photo</label>
                            <div
                                className={`image-upload-zone ${isDragging ? 'dragging' : ''}`}
                                onDragEnter={handleDragEnter}
                                onDragOver={handleDragOver}
                                onDragLeave={handleDragLeave}
                                onDrop={handleDrop}
                                onClick={handleButtonClick}
                            >
                                {previewUrl ? (
                                    <img src={previewUrl} alt="Profile preview" className="image-preview" />
                                ) : (
                                    <div className="upload-placeholder">No image</div>
                                )}
                                <div className="edit-icon" title="Edit profile photo">
                                    ✎
                                </div>
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept="image/*"
                                    onChange={handleFileInputChange}
                                    style={{ display: 'none' }}
                                />
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="field-label" htmlFor="username">Username</label>
                            <input
                                id="username"
                                type="text"
                                name="username"
                                value={formData.username}
                                onChange={handleInputChange}
                                onBlur={handleUsernameBlur}
                                placeholder="username"
                                autoComplete="off"
                                className={(usernameError || usernameWarning) ? 'error' : ''}
                                disabled={isCheckingUsername}
                            />
                            {isCheckingUsername && <div className="help-text">Checking username...</div>}
                            {usernameWarning && <div className="error-text">{usernameWarning}</div>}
                            {usernameError && <div className="error-text">{usernameError}</div>}
                            <div className="help-text">
                                Usernames can only contain letters, numbers, underscores, and periods.
                            </div>
                        </div>

                        <div className="form-group">
                            <label className="field-label" htmlFor="displayname">Name</label>
                            <input
                                id="displayname"
                                type="text"
                                name="displayname"
                                value={formData.displayname}
                                onChange={handleInputChange}
                                placeholder="display name"
                                autoComplete="off"
                            />
                        </div>

                        <div className="form-group">
                            <label className="field-label" htmlFor="pronouns">Pronouns</label>
                            <input
                                id="pronouns"
                                type="text"
                                name="pronouns"
                                value={formData.pronouns}
                                onChange={handleInputChange}
                                placeholder="e.g., he/him, she/her"
                                autoComplete="off"
                            />
                        </div>

                        <div className="form-group">
                            <label className="field-label" htmlFor="city">City</label>
                            <input
                                id="city"
                                type="text"
                                name="city"
                                value={formData.city}
                                onChange={handleInputChange}
                                placeholder="Enter city"
                                autoComplete="off"
                            />
                        </div>

                        <div className="form-group">
                            <label className="field-label" htmlFor="province">Province</label>
                            <input
                                id="province"
                                type="text"
                                name="province"
                                value={formData.province}
                                onChange={handleInputChange}
                                placeholder="Enter province"
                                autoComplete="off"
                            />
                        </div>

                        {error && (
                            <div className="error-message show">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            className={`auth-btn ${isFormValid ? 'active' : ''}`}
                            disabled={!isFormValid || isUploading}
                        >
                            {isUploading ? 'Saving...' : 'Complete Setup'}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default Onboarding;
