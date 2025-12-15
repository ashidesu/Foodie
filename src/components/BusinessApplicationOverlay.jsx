import React, { useState, useEffect, useRef } from 'react';
import Select from 'react-select';
import '../styles/business-application.css';

const BusinessApplicationOverlay = ({ isOpen, onClose }) => {
  const [step, setStep] = useState(1);

  // Location selections
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedBarangay, setSelectedBarangay] = useState(null);
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

  // Upload modal states
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

  // Modal handlers
  const handleTakePhoto = async () => {
    // Determine which input ref to use (though we'll handle capture differently)
    const inputRef = currentUploadType === 'selfie'
      ? selfieRef
      : currentUploadType === 'valid-id'
        ? validIdRef
        : selfieWithIdRef;

    // Close the current modal
    setShowUploadModal(false);

    // Check if camera is supported and available
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      alert('Camera not supported on this device.');
      return;
    }

    try {
      // Request camera access (front for selfie/selfie-with-id, back for others)
      const constraints = {
        video: {
          facingMode: currentUploadType === 'selfie' || currentUploadType === 'selfie-with-id' ? 'user' : 'environment'
        }
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);

      // Create a popup overlay for the camera
      const popup = document.createElement('div');
      popup.className = 'camera-popup';
      document.body.appendChild(popup);

      // Create a video element to display the stream
      const video = document.createElement('video');
      video.className = 'camera-video';
      video.srcObject = stream;
      video.play();
      popup.appendChild(video);

      // Add a capture button
      const captureButton = document.createElement('button');
      captureButton.className = 'camera-capture-button';
      captureButton.textContent = 'Capture Photo';
      captureButton.onclick = () => {
        // Create a canvas to capture the image
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);

        // Convert to blob and create a File
        canvas.toBlob((blob) => {
          const file = new File([blob], 'captured-photo.jpg', { type: 'image/jpeg' });

          // Simulate setting the file to the input (this triggers onChange if set)
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          inputRef.current.files = dataTransfer.files;
          inputRef.current.dispatchEvent(new Event('change', { bubbles: true }));

          // Stop the stream and remove popup
          stream.getTracks().forEach(track => track.stop());
          document.body.removeChild(popup);
        }, 'image/jpeg');
      };
      popup.appendChild(captureButton);

      // Add a close button
      const closeButton = document.createElement('button');
      closeButton.className = 'camera-close-button';
      closeButton.textContent = 'Close';
      closeButton.onclick = () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(popup);
      };
      popup.appendChild(closeButton);

    } catch (error) {
      console.error('Error accessing camera:', error);
      if (error.name === 'NotReadableError') {
        alert('Camera is already in use or not accessible. Please close other apps using the camera and try again.');
      } else if (error.name === 'NotAllowedError') {
        alert('Camera access denied. Please grant permissions in your browser settings.');
      } else {
        alert('No camera detected or an error occurred. Please ensure your device has a camera.');
      }
    }
  };

  const handleUploadFromGallery = () => {
    const inputRef = currentUploadType === 'selfie' ? selfieRef : currentUploadType === 'valid-id' ? validIdRef : selfieWithIdRef;
    inputRef.current.removeAttribute('capture');
    inputRef.current.click();
    setShowUploadModal(false);
  };

  const closeModal = () => {
    setShowUploadModal(false);
    setCurrentUploadType('');
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

  const handleApply = () => {
    setStep(4);
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
            <div className="upload-box" onClick={() => displayPhotoRef.current.click()}>
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
                    <u>Click to upload</u> or drag and drop
                  </p>
                </>
              )}
            </div>

            <label htmlFor="cover-photo-upload" className="upload-label">
              Restaurant Cover Photo: *
            </label>
            <div className="upload-box" onClick={() => coverPhotoRef.current.click()}>
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
                    <u>Click to upload</u> or drag and drop
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
              styles={selectStyles}  // Uses the existing selectStyles, which now includes multiValue styles
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
                <div>
                  <p>{additionalProofsFiles.length} file(s) selected</p>
                  <ul>
                    {additionalProofsFiles.map((file, index) => (
                      <li key={index}>
                        {file.name}
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setAdditionalProofsFiles(prev => prev.filter((_, i) => i !== index));
                          }}
                          className="remove-file-button"
                          title="Remove file"
                        >
                          Remove
                        </button>
                      </li>
                    ))}
                  </ul>
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
            <button type="button" className="btn-apply" onClick={handleApply}>
              Submit Application
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
      {showUploadModal && (
        <div className="upload-modal-overlay" onClick={closeModal}>
          <div className="upload-modal" onClick={e => e.stopPropagation()}>
            <h3>Choose Upload Method</h3>
            <button className="modal-btn take-photo" onClick={handleTakePhoto}>
              Take Photo
            </button>
            <button className="modal-btn upload-gallery" onClick={handleUploadFromGallery}>
              Upload from Gallery
            </button>
            <button className="modal-btn cancel" onClick={closeModal}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default BusinessApplicationOverlay;
