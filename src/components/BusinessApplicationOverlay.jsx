import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import UploadModal from './UploadModal'; // Import the new modal component
import '../styles/business-application.css';
// Imports for Firebase (for metadata), Supabase (for storage), and UUID
import { db, auth } from '../firebase'; // Adjust path if needed (for Firestore and auth)
import { collection, addDoc, doc, setDoc } from 'firebase/firestore';
import { v4 as uuidv4 } from 'uuid';
import supabase from '../supabase'; // Assuming Supabase client is configured and exported

const BusinessApplicationOverlay = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);
  const [isUploading, setIsUploading] = useState(false);
  // Location selections
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [selectedRegion, setSelectedRegion] = useState(''); // Add this line here
  const [street, setStreet] = useState('');


  // JSON data and loading state
  const [locationData, setLocationData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  // Owner Details
  const [ownerName, setOwnerName] = useState('');
  const [sex, setSex] = useState('');
  const [age, setAge] = useState('');
  const [civilStatus, setCivilStatus] = useState('');
  const [birthdate, setBirthdate] = useState('');
  const [nationality, setNationality] = useState('');
  const [occupation, setOccupation] = useState('');

  // File states
  const [selfieFile, setSelfieFile] = useState(null);
  const [validIdFile, setValidIdFile] = useState(null);
  const [selfieWithIdFile, setSelfieWithIdFile] = useState(null);
  const [certificationFile, setCertificationFile] = useState(null);
  const [fileError, setFileError] = useState('');

  // Upload modal states (kept for controlling the modal)
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [currentUploadType, setCurrentUploadType] = useState('');

  // Refs for file inputs
  const selfieRef = useRef();
  const validIdRef = useRef();
  const selfieWithIdRef = useRef();
  const certificationRef = useRef();

  // Personal details
  const [phone, setPhone] = useState('');

  // Restaurant Details (new for Step 3)
  const [restaurantName, setRestaurantName] = useState('');
  const [averageIncome, setAverageIncome] = useState('');
  const [displayPhotoFile, setDisplayPhotoFile] = useState(null);
  const [coverPhotoFile, setCoverPhotoFile] = useState(null);
  const [additionalProofsFiles, setAdditionalProofsFiles] = useState([]);
  const [openHours, setOpenHours] = useState({});
  const [deliveryAreas, setDeliveryAreas] = useState([]);

  // Refs for new file inputs
  const displayPhotoRef = useRef();
  const coverPhotoRef = useRef();
  const additionalProofsRef = useRef();

  // Days of week for business hours
  const daysOfWeek = [
    { key: 'monday', label: 'Monday' },
    { key: 'tuesday', label: 'Tuesday' },
    { key: 'wednesday', label: 'Wednesday' },
    { key: 'thursday', label: 'Thursday' },
    { key: 'friday', label: 'Friday' },
    { key: 'saturday', label: 'Saturday' },
    { key: 'sunday', label: 'Sunday' },
  ];

  // Initialize openHours on mount
  useEffect(() => {
    const initialOpenHours = {};
    daysOfWeek.forEach(({ key }) => {
      initialOpenHours[key] = {
        enabled: true,
        open: '09:00',
        close: '17:30',
      };
    });
    setOpenHours(initialOpenHours);
  }, []);

  // Fetch location data once on mount
  useEffect(() => {
    const fetchLocationData = async () => {
      try {
        const response = await fetch('/philippine_provinces_cities_municipalities_and_barangays_2019v2.json');
        if (!response.ok) throw new Error('Failed to fetch location data');
        const data = await response.json();
        setLocationData(data);
      } catch (error) {
        console.error('Error fetching location data:', error);
        alert('Unable to load location data. Please check your connection.');
      } finally {
        setLoadingData(false);
      }
    };
    fetchLocationData();
  }, []);

  // Handlers for Select changes
  const handleProvinceChange = (option) => {
    setSelectedProvince(option);
    setSelectedCity(null);
    setSelectedBarangay(null);
  };

  const handleCityChange = (option) => {
    setSelectedCity(option);
    setSelectedBarangay(null);
  };

  const handleBarangayChange = (option) => {
    setSelectedBarangay(option);
  };

  // File change handler with validation
  const onFileChange = (e, type) => {
    const file = e.target.files[0];
    if (file) {
      let validTypes = ['image/jpeg', 'image/png'];
      if (type === 'certification' || type === 'additional-proofs') {
        validTypes = ['image/jpeg', 'image/png', 'application/pdf'];
      }
      if (!validTypes.includes(file.type)) {
        setFileError(`Unsupported file type for ${type}. Please upload a JPEG, PNG${type === 'certification' || type === 'additional-proofs' ? ', or PDF' : ''}.`);
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setFileError('File size exceeds 5MB.');
        return;
      }
      setFileError('');
      if (type === 'selfie') setSelfieFile(file);
      else if (type === 'valid-id') setValidIdFile(file);
      else if (type === 'selfie-with-id') setSelfieWithIdFile(file);
      else if (type === 'certification') setCertificationFile(file);
      else if (type === 'display-photo') setDisplayPhotoFile(file);
      else if (type === 'cover-photo') setCoverPhotoFile(file);
    }
  };

  // Handle multiple files for additional proofs
  const onAdditionalProofsChange = (e) => {
    const files = Array.from(e.target.files);
    const validFiles = [];
    for (const file of files) {
      if (['image/jpeg', 'image/png', 'application/pdf'].includes(file.type) && file.size <= 5 * 1024 * 1024) {
        validFiles.push(file);
      } else {
        setFileError('Some files are invalid (unsupported type or size > 5MB). Only valid files were added.');
      }
    }
    setAdditionalProofsFiles(prev => [...prev, ...validFiles]);
    setFileError('');
  };

  // Helper to get the correct ref based on type
  const getRefByType = (type) => {
    if (type === 'selfie') return selfieRef;
    if (type === 'valid-id') return validIdRef;
    if (type === 'selfie-with-id') return selfieWithIdRef;
    if (type === 'display-photo') return displayPhotoRef;
    if (type === 'cover-photo') return coverPhotoRef;
    return null;
  };

  // Business hours handlers
  const handleToggleOpen = (dayKey, enabled) => {
    setOpenHours(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        enabled,
      },
    }));
  };

  const handleTimeChange = (dayKey, field, value) => {
    setOpenHours(prev => ({
      ...prev,
      [dayKey]: {
        ...prev[dayKey],
        [field]: value,
      },
    }));
  };

  // Convert 24h time string "HH:MM" to 12h format with AM/PM
  const convertTo12Hour = (time24) => {
    if (!time24) return '';
    const [hourStr, minute] = time24.split(':');
    let hour = parseInt(hourStr, 10);
    const ampm = hour >= 12 ? 'PM' : 'AM';
    hour = hour % 12 || 12;
    return `${hour}:${minute} ${ampm}`;
  };

  // Delivery areas handlers
  const toggleDeliveryArea = (barangay) => {
    setDeliveryAreas(prev =>
      prev.includes(barangay) ? prev.filter(b => b !== barangay) : [...prev, barangay]
    );
  };

  const selectAllDeliveryAreas = () => {
    if (deliveryAreas.length === barangayOptions.length) {
      setDeliveryAreas([]);
    } else {
      setDeliveryAreas(barangayOptions.map(option => option.value));
    }
  };
  const handleDeliveryAreasChange = (selectedOptions) => {
    setDeliveryAreas(selectedOptions ? selectedOptions.map(option => option.value) : []);
  };

  // Step Navigation with validation
  const handleNext = () => {
    if (step === 1) {
      if (!selectedProvince || !selectedCity || !selectedBarangay || !street.trim()) {
        alert('Please fill in the required address fields: Province, City/Municipality, Barangay, and Street.');
        return;
      }
    }
    if (step === 2) {
      if (ownerName.trim() === '' || sex === '' || age.trim() === '' || civilStatus === '' || birthdate === '' || !selfieFile || !validIdFile || !selfieWithIdFile) {
        alert('Please fill in all required owner details and upload all required documents.');
        return;
      }
    }
    if (step === 3) {
      if (phone.trim() === '') {
        alert('Please enter your phone number.');
        return;
      }
      if (restaurantName.trim() === '') {
        alert('Please enter the restaurant name.');
        return;
      }
      if (averageIncome.trim() === '' || isNaN(averageIncome) || parseFloat(averageIncome) < 0) {
        alert('Please enter a valid average income (must be a non-negative number).');
        return;
      }
      if (!displayPhotoFile || !coverPhotoFile) {
        alert('Please upload both display and cover photos for the restaurant.');
        return;
      }
    }
    setStep(prev => prev + 1);
  };

  const handleBack = () => {
    setStep(prev => Math.max(prev - 1, 1));
  };

  // Updated handleApply: Upload files to Supabase Storage and submit metadata to Firestore (styled like UploadPage's handleUpload)
  const handleApply = async () => {
    if (!selectedProvince || !selectedCity || !selectedBarangay || !street.trim() ||
      !ownerName.trim() || !sex || !age.trim() || !civilStatus || !birthdate ||
      !selfieFile || !validIdFile || !selfieWithIdFile || !phone.trim() ||
      !restaurantName.trim() || !averageIncome.trim() || !displayPhotoFile || !coverPhotoFile) {
      alert('Please fill in all required fields and upload all required files');
      return;
    }
    const user = auth.currentUser;
    if (!user) {
      alert('You must be logged in to submit');
      return;
    }

    setIsUploading(true);

    try {
      const applicationId = uuidv4();

      // Upload files to Supabase Storage (adapted from UploadPage's upload logic)
      const uploadPromises = [
        selfieFile ? supabase.storage.from('applications').upload(`${applicationId}/selfie.jpg`, selfieFile) : Promise.resolve({ data: null }),
        validIdFile ? supabase.storage.from('applications').upload(`${applicationId}/validId.jpg`, validIdFile) : Promise.resolve({ data: null }),
        selfieWithIdFile ? supabase.storage.from('applications').upload(`${applicationId}/selfieWithId.jpg`, selfieWithIdFile) : Promise.resolve({ data: null }),
        displayPhotoFile ? supabase.storage.from('applications').upload(`${applicationId}/display.jpg`, displayPhotoFile) : Promise.resolve({ data: null }),
        coverPhotoFile ? supabase.storage.from('applications').upload(`${applicationId}/cover.jpg`, coverPhotoFile) : Promise.resolve({ data: null }),
        ...additionalProofsFiles.map((file, index) => supabase.storage.from('applications').upload(`${applicationId}/additional${index}.${file.name.split('.').pop()}`, file)),
      ];

      const uploadResults = await Promise.all(uploadPromises);

      // Extract public URLs from Supabase (assuming public bucket; adjust if private)
      const getPublicURL = (path) => supabase.storage.from('applications').getPublicUrl(path).data.publicUrl;

      const [
        selfieResult,
        validIdResult,
        selfieWithIdResult,
        displayResult,
        coverResult,
        ...additionalResults
      ] = uploadResults;

      const selfieURL = selfieResult.data ? getPublicURL(selfieResult.data.path) : '';
      const validIdURL = validIdResult.data ? getPublicURL(validIdResult.data.path) : '';
      const selfieWithValidIdURL = selfieWithIdResult.data ? getPublicURL(selfieWithIdResult.data.path) : '';
      const displayURL = displayResult.data ? getPublicURL(displayResult.data.path) : '';
      const coverURL = coverResult.data ? getPublicURL(coverResult.data.path) : '';
      const additionalURLs = additionalResults.map(result => result.data ? getPublicURL(result.data.path) : '');

      // Store metadata in Firebase Firestore (like UploadPage stores in Firestore)
      await addDoc(collection(db, 'applications'), {
        folderId: applicationId,
        uploaderId: user.uid,
        address: {
          street,
          barangay: selectedBarangay.value,
          city: selectedCity.value,
          province: selectedProvince.value,
          region: selectedRegion,
        },
        fullName: ownerName,
        sex,
        civilStatus,
        birthdate,
        nationality,
        occupation,
        photoURLs: {
          selfieURL,
          validIdURL,
          selfieWithValidIdURL,
          displayURL,
          coverURL,
        },
        additionalFileURLs: additionalURLs,
        businessHours: openHours,
        restaurantName,
        phone,
        averageIncome: parseFloat(averageIncome),
        deliveryAreas,
        submittedAt: new Date(),
        status: "pending"
      });
      console.log('Updating user document for UID:', user.uid);
      await setDoc(doc(db, 'users', user.uid), { applicationActive: true }, { merge: true });
      console.log('User document updated successfully');

      alert('Application submitted successfully!');
      setStep(4);
    } catch (error) {
      console.error('Submission failed:', error);
      alert('Submission failed. Please try again.');
    } finally {
      setIsUploading(false);
    }

  };

  // Sorting regions numerically ascending by their keys ("01", "02", ...)
  const sortedRegionsKeys = locationData ? Object.keys(locationData).sort((a, b) => Number(a) - Number(b)) : [];

  // Prepare province options sorted by region number and region name for grouping (optional)
  const provinceOptions = [];
  if (locationData) {
    for (const regionKey of sortedRegionsKeys) {
      const region = locationData[regionKey];
      const provinces = Object.keys(region.province_list).sort();
      for (const provinceName of provinces) {
        provinceOptions.push({
          value: provinceName,
          label: `${provinceName} (${region.region_name})`
        });
      }
    }
  }

  // Get city options based on selected province
  const cityOptions = [];
  if (selectedProvince && locationData) {
    outerLoop:
    for (const regionKey of sortedRegionsKeys) {
      const region = locationData[regionKey];
      for (const provinceName in region.province_list) {
        if (provinceName === selectedProvince.value) {
          const municipalities = region.province_list[provinceName].municipality_list || {};
          for (const cityName in municipalities) {
            cityOptions.push({ value: cityName, label: cityName });
          }
          break outerLoop;
        }
      }
    }
  }

  // Get barangay options based on selected city (municipality)
  const barangayOptions = [];
  if (selectedCity && locationData) {
    outerLoop:
    for (const regionKey of sortedRegionsKeys) {
      const region = locationData[regionKey];
      for (const provinceName in region.province_list) {
        const municipalities = region.province_list[provinceName].municipality_list || {};
        if (municipalities[selectedCity.value]) {
          const barangays = municipalities[selectedCity.value].barangay_list || [];
          for (const barangay of barangays) {
            barangayOptions.push({ value: barangay, label: barangay });
          }
          break outerLoop;
        }
      }
    }
  }

  // Filtered barangay options for delivery areas based on search
  // Dark mode styles for React-Select with new primary color
  const selectStyles = {
    control: (provided, state) => ({
      ...provided,
      backgroundColor: '#333',
      borderColor: state.isFocused ? '#fe2c55' : '#444',
      borderRadius: '8px',
      color: '#fff',
      boxShadow: state.isFocused ? '0 0 7px rgba(254, 44, 85, 0.5)' : 'none',
      '&:hover': {
        borderColor: '#fe2c55',
      },
    }),
    placeholder: (provided) => ({
      ...provided,
      color: '#bbb',
    }),
    singleValue: (provided) => ({
      ...provided,
      color: '#fff',
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: '#333',
      border: '1px solid #444',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected ? '#fe2c55' : state.isFocused ? '#fe2c55' : '#333',
      color: state.isSelected || state.isFocused ? 'white' : '#fff',
      cursor: 'pointer',
    }),
    input: (provided) => ({
      ...provided,
      color: '#fff',
    }),
    multiValue: (provided) => ({
      ...provided,
      backgroundColor: '#fe2c55',
      color: '#fff',
    }),
    multiValueLabel: (provided) => ({
      ...provided,
      color: '#fff',
    }),
    multiValueRemove: (provided) => ({
      ...provided,
      color: '#fff',
      ':hover': {
        backgroundColor: '#d0244a',
        color: '#fff',
      },
    }),
  };

  if (!isOpen) return null;

  return (
    <div className="business-application-overlay" onClick={onClose}>
      <div
        className="business-application-content"
        onClick={e => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="business-application-title"
        tabIndex={-1}
      >
        {/* Header and Close */}
        <div className="ba-header">
          <h2 id="business-application-title">Business Permit Application</h2>
          <button className="close-btn" onClick={onClose} aria-label="Close Application">
            ×
          </button>
        </div>

        {/* Step Indicators */}
        <div className="ba-steps">
          <div className="progress-fill" style={{ width: `${Math.min((step / 3) * 100, 100)}%` }}></div>
          <div className={`ba-step ${step === 1 ? 'active' : step > 1 ? 'completed' : ''}`}>
            <span>1</span> Business Location
          </div>
          <div className={`ba-step ${step === 2 ? 'active' : step > 2 ? 'completed' : ''}`}>
            <span>2</span> Owner Details
          </div>
          <div className={`ba-step ${step === 3 ? 'active' : step > 3 ? 'completed' : ''}`}>
            <span>3</span> Restaurant Details
          </div>
        </div>

        {/* Step 1: Location */}
        {step === 1 && (
          <div className="ba-step-content">
            <label htmlFor="province-select">Province: *</label>
            <Select
              inputId="province-select"
              value={selectedProvince}
              onChange={handleProvinceChange}
              options={provinceOptions}
              placeholder={loadingData ? 'Loading provinces...' : 'Select province'}
              isDisabled={loadingData}
              isSearchable
              required
              styles={selectStyles}
            />

            <label htmlFor="city-select">City/Municipality: *</label>
            <Select
              inputId="city-select"
              value={selectedCity}
              onChange={handleCityChange}
              options={cityOptions}
              placeholder={loadingData ? 'Loading cities...' : 'Select city'}
              isDisabled={!selectedProvince || loadingData}
              isSearchable
              required
              styles={selectStyles}
            />

            <label htmlFor="barangay-select">Barangay: *</label>
            <Select
              inputId="barangay-select"
              value={selectedBarangay}
              onChange={handleBarangayChange}
              options={barangayOptions}
              placeholder={loadingData ? 'Loading barangays...' : 'Select barangay'}
              isDisabled={!selectedCity || loadingData}
              isSearchable
              required
              styles={selectStyles}
            />

            <label htmlFor="street-input">Street: *</label>
            <input
              id="street-input"
              type="text"
              placeholder="e.g., Rizal Avenue"
              value={street}
              onChange={e => setStreet(e.target.value)}
              autoComplete="off"
              required
            />
          </div>
        )}

        {/* Step 2: Owner Details */}
        {step === 2 && (
          <div className="ba-step-content">
            <label htmlFor="owner-name">Full Name: *</label>
            <input
              id="owner-name"
              type="text"
              placeholder="e.g., Juan dela Cruz"
              value={ownerName}
              onChange={e => setOwnerName(e.target.value)}
              required
            />

            <label htmlFor="sex-select">Sex: *</label>
            <select
              id="sex-select"
              value={sex}
              onChange={e => setSex(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #444',
                fontSize: '14px',
                color: '#fff',
                background: '#333',
                transition: 'border-color 0.3s ease',
              }}
            >
              <option value="" disabled>Select sex</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="other">Other</option>
            </select>

            <label htmlFor="age-input">Age: *</label>
            <input
              id="age-input"
              type="number"
              placeholder="e.g., 30"
              value={age}
              onChange={e => setAge(e.target.value)}
              min="18"
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #444',
                fontSize: '14px',
                color: '#fff',
                background: '#333',
                transition: 'border-color 0.3s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = '#fe2c55'}
              onBlur={(e) => e.target.style.borderColor = '#444'}
            />

            <label htmlFor="civil-status-select">Civil Status: *</label>
            <select
              id="civil-status-select"
              value={civilStatus}
              onChange={e => setCivilStatus(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #444',
                fontSize: '14px',
                color: '#fff',
                background: '#333',
                transition: 'border-color 0.3s ease',
              }}
            >
              <option value="" disabled>Select civil status</option>
              <option value="single">Single</option>
              <option value="married">Married</option>
              <option value="divorced">Divorced</option>
              <option value="widowed">Widowed</option>
            </select>

            <label htmlFor="birthdate-input">Birthdate: *</label>
            <input
              id="birthdate-input"
              type="date"
              value={birthdate}
              onChange={e => setBirthdate(e.target.value)}
              required
              style={{
                width: '100%',
                padding: '12px 14px',
                borderRadius: '8px',
                border: '1px solid #444',
                fontSize: '14px',
                color: '#fff',
                background: '#333',
                transition: 'border-color 0.3s ease',
              }}
              onFocus={(e) => e.target.style.borderColor = '#fe2c55'}
              onBlur={(e) => e.target.style.borderColor = '#444'}
            />

            <label htmlFor="nationality-input">Nationality:</label>
            <input
              id="nationality-input"
              type="text"
              placeholder="e.g., Filipino"
              value={nationality}
              onChange={e => setNationality(e.target.value)}
            />

            <label htmlFor="occupation-input">Occupation:</label>
            <input
              id="occupation-input"
              type="text"
              placeholder="e.g., Entrepreneur"
              value={occupation}
              onChange={e => setOccupation(e.target.value)}
            />

            <p style={{ fontSize: '14px', color: '#b0b0b0', marginBottom: '12px' }}>
              <strong>Note:</strong> Please upload the following required documents: a selfie of yourself, a valid ID, and a selfie of yourself holding the valid ID. These are necessary for verification purposes. You can upload from your gallery or use your device camera.
            </p>

            <label htmlFor="selfie-upload" className="upload-label">
              Selfie: *
            </label>
            <div
              className={`upload-box ${selfieFile ? 'uploaded' : ''}`}
              onClick={() => { setCurrentUploadType('selfie'); setShowUploadModal(true); }}
            >
              <input
                ref={selfieRef}
                id="selfie-upload"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => onFileChange(e, 'selfie')}
                required
              />
              {selfieFile ? (
                <div className="upload-preview-container">
                  <img
                    src={URL.createObjectURL(selfieFile)}
                    alt="Selfie Preview"
                    className="upload-preview-image"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelfieFile(null);
                      selfieRef.current.value = '';
                    }}
                    className="remove-image-button"
                    title="Remove image"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    fill="none"
                    stroke="#fe2c55"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="feather feather-camera"
                    aria-hidden="true"
                  >
                    <path d="M23 19a5 5 0 1 0-10 0 5 5 0 0 0 10 0z" />
                    <path d="M1 19V9a2 2 0 0 1 2-2h2l2-3h8l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" />
                  </svg>
                  <p>
                    <u>Click to upload or take photo</u>
                  </p>
                </>
              )}
            </div>

            <label htmlFor="valid-id-upload" className="upload-label">
              Valid ID: *
            </label>
            <div
              className={`upload-box ${validIdFile ? 'uploaded' : ''}`}
              onClick={() => { setCurrentUploadType('valid-id'); setShowUploadModal(true); }}
            >
              <input
                ref={validIdRef}
                id="valid-id-upload"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => onFileChange(e, 'valid-id')}
                required
              />
              {validIdFile ? (
                <div className="upload-preview-container">
                  <img
                    src={URL.createObjectURL(validIdFile)}
                    alt="Valid ID Preview"
                    className="upload-preview-image"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setValidIdFile(null);
                      validIdRef.current.value = '';
                    }}
                    className="remove-image-button"
                    title="Remove image"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    fill="none"
                    stroke="#fe2c55"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="feather feather-camera"
                    aria-hidden="true"
                  >
                    <path d="M23 19a5 5 0 1 0-10 0 5 5 0 0 0 10 0z" />
                    <path d="M1 19V9a2 2 0 0 1 2-2h2l2-3h8l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" />
                  </svg>
                  <p>
                    <u>Click to upload or take photo</u>
                  </p>
                </>
              )}
            </div>

            <label htmlFor="selfie-with-id-upload" className="upload-label">
              Selfie Holding Valid ID: *
            </label>
            <div
              className={`upload-box ${selfieWithIdFile ? 'uploaded' : ''}`}
              onClick={() => { setCurrentUploadType('selfie-with-id'); setShowUploadModal(true); }}
            >
              <input
                ref={selfieWithIdRef}
                id="selfie-with-id-upload"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => onFileChange(e, 'selfie-with-id')}
                required
              />
              {selfieWithIdFile ? (
                <div className="upload-preview-container">
                  <img
                    src={URL.createObjectURL(selfieWithIdFile)}
                    alt="Selfie with ID Preview"
                    className="upload-preview-image"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelfieWithIdFile(null);
                      selfieWithIdRef.current.value = '';
                    }}
                    className="remove-image-button"
                    title="Remove image"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    fill="none"
                    stroke="#fe2c55"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="feather feather-camera"
                    aria-hidden="true"
                  >
                    <path d="M23 19a5 5 0 1 0-10 0 5 5 0 0 0 10 0z" />
                    <path d="M1 19V9a2 2 0 0 1 2-2h2l2-3h8l2 3h2a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2z" />
                  </svg>
                  <p>
                    <u>Click to upload or take photo</u>
                  </p>
                </>
              )}
            </div>
            {fileError && <p className="error-text">{fileError}</p>}
          </div>
        )}

        {/* Step 3: Restaurant Details */}
        {step === 3 && (
          <div className="ba-step-content">
            <label htmlFor="restaurant-name">Restaurant Name: *</label>
            <input
              id="restaurant-name"
              type="text"
              placeholder="e.g., Juan's Kitchen"
              value={restaurantName}
              onChange={e => setRestaurantName(e.target.value)}
              required
            />

            <label htmlFor="average-income">Average Income (Monthly): *</label>
            <input
              id="average-income"
              type="number"
              placeholder="e.g., 50000"
              value={averageIncome}
              onChange={e => setAverageIncome(e.target.value)}
              min="0"
              required
            />

            <label htmlFor="phone-number">Phone:</label>
            <input
              id="phone-number"
              type="tel"
              placeholder="e.g., +63 912 345 6789"
              value={phone}
              onChange={e => setPhone(e.target.value)}
            />

            <label htmlFor="display-photo-upload" className="upload-label">
              Restaurant Display Photo: *
            </label>
            <div className="upload-box" onClick={() => { setCurrentUploadType('display-photo'); setShowUploadModal(true); }}>
              <input
                ref={displayPhotoRef}
                id="display-photo-upload"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => onFileChange(e, 'display-photo')}
                required
              />
              {displayPhotoFile ? (
                <div className="upload-preview-container">
                  <img
                    src={URL.createObjectURL(displayPhotoFile)}
                    alt="Display Photo Preview"
                    className="upload-preview-image"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDisplayPhotoFile(null);
                      displayPhotoRef.current.value = '';
                    }}
                    className="remove-image-button"
                    title="Remove image"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    fill="none"
                    stroke="#fe2c55"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="feather feather-upload"
                    aria-hidden="true"
                  >
                    <path d="M21 15v12M12 24l9-9 9 9" />
                    <path d="M12 3v18" />
                  </svg>
                  <p>
                    <u>Click to upload or take photo</u>
                  </p>
                </>
              )}
            </div>

            <label htmlFor="cover-photo-upload" className="upload-label">
              Restaurant Cover Photo: *
            </label>
            <div className="upload-box" onClick={() => { setCurrentUploadType('cover-photo'); setShowUploadModal(true); }}>
              <input
                ref={coverPhotoRef}
                id="cover-photo-upload"
                type="file"
                accept="image/*"
                style={{ display: 'none' }}
                onChange={(e) => onFileChange(e, 'cover-photo')}
                required
              />
              {coverPhotoFile ? (
                <div className="upload-preview-container">
                  <img
                    src={URL.createObjectURL(coverPhotoFile)}
                    alt="Cover Photo Preview"
                    className="upload-preview-image"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setCoverPhotoFile(null);
                      coverPhotoRef.current.value = '';
                    }}
                    className="remove-image-button"
                    title="Remove image"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      fill="none"
                      stroke="#fff"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      viewBox="0 0 24 24"
                    >
                      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                    </svg>
                  </button>
                </div>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    fill="none"
                    stroke="#fe2c55"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="feather feather-upload"
                    aria-hidden="true"
                  >
                    <path d="M21 15v12M12 24l9-9 9 9" />
                    <path d="M12 3v18" />
                  </svg>
                  <p>
                    <u>Click to upload or take photo</u>
                  </p>
                </>
              )}
            </div>

            <label>Delivery Areas (Barangays in {selectedCity?.label || 'Selected City'}):</label>
            <Select
              isMulti
              value={barangayOptions.filter(option => deliveryAreas.includes(option.value))}
              onChange={handleDeliveryAreasChange}
              options={barangayOptions}
              placeholder="Select barangays for delivery..."
              isSearchable
              styles={selectStyles}
              closeMenuOnSelect={false}
              blurInputOnSelect={false}
            />
            <button
              type="button"
              onClick={selectAllDeliveryAreas}
              style={{
                marginBottom: '12px',
                padding: '8px 16px',
                background: '#fe2c55',
                color: '#fff',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
              }}
            >
              {deliveryAreas.length === barangayOptions.length ? 'Deselect All' : 'Select All'}
            </button>

            <label>Business Hours:</label>
            <div className="business-hours-container">
              {daysOfWeek.map(({ key, label }) => {
                const day = openHours[key] || { enabled: false, open: '09:00', close: '17:30' };

                return (
                  <div key={key} className="business-hour-row">
                    <label className="switch">
                      <input
                        type="checkbox"
                        checked={day.enabled}
                        onChange={(e) => handleToggleOpen(key, e.target.checked)}
                      />
                      <span className="slider round"></span>
                    </label>
                    <span className="day-label">{label}</span>
                    {day.enabled ? (
                      <div className="time-inputs">
                        <label className="time-label" htmlFor={`${key}-open`}>From</label>
                        <input
                          type="time"
                          id={`${key}-open`}
                          value={day.open}
                          onChange={(e) => handleTimeChange(key, 'open', e.target.value)}
                          required={day.enabled}
                        />
                        <span className="ampm-label">{convertTo12Hour(day.open)}</span>
                        <label className="time-label" htmlFor={`${key}-close`}>To</label>
                        <input
                          type="time"
                          id={`${key}-close`}
                          value={day.close}
                          onChange={(e) => handleTimeChange(key, 'close', e.target.value)}
                          required={day.enabled}
                        />
                        <span className="ampm-label">{convertTo12Hour(day.close)}</span>
                      </div>
                    ) : (
                      <div className="closed-label" title="Closed">
                        <span role="img" aria-label="closed" style={{ marginRight: 6 }}>🕒</span>
                        Closed
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <label htmlFor="additional-proofs-upload" className="upload-label">
              Additional Proofs of Legitimacy (optional, multiple files)
            </label>
            <div className="upload-box" onClick={() => additionalProofsRef.current.click()}>
              <input
                ref={additionalProofsRef}
                id="additional-proofs-upload"
                type="file"
                accept=".jpg,.jpeg,.png,.pdf"
                multiple
                style={{ display: 'none' }}
                onChange={onAdditionalProofsChange}
              />
              {additionalProofsFiles.length > 0 ? (
                <div className="additional-proofs-previews">
                  {additionalProofsFiles.map((file, index) => (
                    <div key={index} className="proof-preview-item">
                      {file.type.startsWith('image/') ? (
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Proof ${index + 1}`}
                          className="proof-preview-image"
                        />
                      ) : (
                        <div className="proof-preview-pdf">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="48"
                            height="48"
                            fill="none"
                            stroke="#fe2c55"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            className="feather feather-file-text"
                            aria-hidden="true"
                          >
                            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                            <polyline points="14,2 14,8 20,8" />
                            <line x1="16" y1="13" x2="8" y2="13" />
                            <line x1="16" y1="17" x2="8" y2="17" />
                            <polyline points="10,9 9,9 8,9" />
                          </svg>
                          <p>{file.name}</p>
                        </div>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setAdditionalProofsFiles(prev => prev.filter((_, i) => i !== index));
                        }}
                        className="remove-image-button"
                        title="Remove file"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="16"
                          height="16"
                          fill="none"
                          stroke="#fff"
                          strokeWidth="2"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          viewBox="0 0 24 24"
                        >
                          <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M10 11v6M14 11v6" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="48"
                    height="48"
                    fill="none"
                    stroke="#fe2c55"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="feather feather-upload"
                    aria-hidden="true"
                  >
                    <path d="M21 15v12M12 24l9-9 9 9" />
                    <path d="M12 3v18" />
                  </svg>
                  <p>
                    <u>Click to upload</u> or drag and drop
                  </p>
                </>
              )}
            </div>
          </div>
        )}

        {/* Step 4: Confirmation */}
        {step === 4 && (
          <div className="ba-step-content confirmation">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="72"
              height="72"
              fill="none"
              stroke="#fe2c55"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="feather feather-thumbs-up"
              aria-hidden="true"
            >
              <path d="M14 9v12a3 3 0 003 3h7a3 3 0 003-3v-4l3 1v-7a2 2 0 00-2-2H14z" />
              <path d="M7 22h-4v-7a3 3 0 013-3h1" />
            </svg>
            <h3>We’ve received your application!</h3>
            <p>We will process it and reach out to you in a few days.</p>
          </div>
        )}

        {/* Navigation Buttons */}
        <div className="ba-navigation">
          {step > 1 && step < 4 && (
            <button type="button" className="btn-back" onClick={handleBack}>
              Back
            </button>
          )}
          {step < 3 && (
            <button type="button" className="btn-next" onClick={handleNext}>
              Next
            </button>
          )}
          {step === 3 && (
            <button type="button" className="btn-apply" onClick={handleApply} disabled={isUploading}>
              {isUploading ? 'Submitting...' : 'Submit Application'}
            </button>
          )}
          {step === 4 && (
            <button type="button" className="btn-close" onClick={onClose}>
              Close
            </button>
          )}
        </div>
      </div>

      {/* Upload Modal */}
      <UploadModal
        isOpen={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        inputRef={getRefByType(currentUploadType)}
        type={currentUploadType}
      />
    </div>
  );
};

export default BusinessApplicationOverlay;