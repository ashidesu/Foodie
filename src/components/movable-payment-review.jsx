import React, { useState, useEffect, useRef } from 'react';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import Select from 'react-select';
import PayPalPayment from './PayPalPayment'; // Import the PayPal component
import '../styles/payment-review.css'; // Your CSS file for styling

const MovablePaymentReview = ({ cart, cartTotal, deliveryFee = 50, onConfirm, onCancel }) => {
  const [collapsed, setCollapsed] = useState(false);
  const [position, setPosition] = useState({ x: window.innerWidth - 350, y: 100 });
  const [dragging, setDragging] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState('COD');
  const [deliveryAddress, setDeliveryAddress] = useState('');
  const [isLoadingAddress, setIsLoadingAddress] = useState(true);
  const [addressError, setAddressError] = useState('');
  const [showChangeAddressModal, setShowChangeAddressModal] = useState(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const reviewRef = useRef(null);

  // Address change states
  const [selectedProvince, setSelectedProvince] = useState(null);
  const [selectedCity, setSelectedCity] = useState(null);
  const [selectedBarangay, setSelectedBarangay] = useState(null);
  const [street, setStreet] = useState('');
  const [locationData, setLocationData] = useState(null);
  const [loadingData, setLoadingData] = useState(true);

  // Modal dragging states
  const [modalPosition, setModalPosition] = useState({ x: (window.innerWidth - 400) / 2, y: (window.innerHeight - 500) / 2 }); // Center the modal
  const [modalDragging, setModalDragging] = useState(false);
  const modalDragOffset = useRef({ x: 0, y: 0 });
  const modalRef = useRef(null);

  const grandTotal = cartTotal + deliveryFee;

  // Fetch user address from Firebase
  useEffect(() => {
    const fetchUserAddress = async () => {
      try {
        setIsLoadingAddress(true);

        const auth = getAuth();
        const user = auth.currentUser;

        if (!user) {
          setAddressError('User not logged in');
          setIsLoadingAddress(false);
          return;
        }

        const userId = user.uid;

        const db = getFirestore();
        const userDoc = await getDoc(doc(db, 'users', userId));

        if (userDoc.exists()) {
          const userData = userDoc.data();
          const address = userData.address;
          if (address && typeof address === 'object') {
            const formattedAddress = `${address.Street || ''}, ${address.Barangay || ''}, ${address['City/Municipality'] || ''}, ${address.Province || ''}`.trim();
            setDeliveryAddress(formattedAddress || 'No address found');
            // Pre-fill the change form with existing data
            setSelectedProvince(address.Province ? { value: address.Province, label: address.Province } : null);
            setSelectedCity(address['City/Municipality'] ? { value: address['City/Municipality'], label: address['City/Municipality'] } : null);
            setSelectedBarangay(address.Barangay ? { value: address.Barangay, label: address.Barangay } : null);
            setStreet(address.Street || '');
          } else {
            setDeliveryAddress(address || 'No address found');
          }
        } else {
          setAddressError('User data not found');
        }
      } catch (error) {
        console.error('Error fetching address:', error);
        setAddressError('Failed to load address');
      } finally {
        setIsLoadingAddress(false);
      }
    };

    fetchUserAddress();
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

  // Save new address
  const handleSaveAddress = async () => {
    if (!selectedProvince || !selectedCity || !selectedBarangay || !street.trim()) {
      alert('Please fill in all address fields.');
      return;
    }

    try {
      const auth = getAuth();
      const user = auth.currentUser;
      if (!user) {
        alert('User not logged in');
        return;
      }

      const userId = user.uid;
      const db = getFirestore();
      const newAddress = {
        Street: street,
        Barangay: selectedBarangay.value,
        'City/Municipality': selectedCity.value,
        Province: selectedProvince.value,
      };
      await updateDoc(doc(db, 'users', userId), { address: newAddress });

      const formattedAddress = `${street}, ${selectedBarangay.value}, ${selectedCity.value}, ${selectedProvince.value}`;
      setDeliveryAddress(formattedAddress);
      setShowChangeAddressModal(false);
      alert('Address updated successfully!');
    } catch (error) {
      console.error('Error updating address:', error);
      alert('Failed to update address. Please try again.');
    }
  };

  // Drag event handlers for main review (unchanged)
  const onMouseDown = (e) => {
    if (e.button !== 0) return; // Left-click only
    setDragging(true);
    const rect = reviewRef.current.getBoundingClientRect();
    dragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.preventDefault();
  };

  const onMouseMove = (e) => {
    if (!dragging) return;
    const newX = Math.min(window.innerWidth - reviewRef.current.offsetWidth, Math.max(0, e.clientX - dragOffset.current.x));
    const newY = Math.min(window.innerHeight - reviewRef.current.offsetHeight, Math.max(0, e.clientY - dragOffset.current.y));
    setPosition({ x: newX, y: newY });
  };

  const onMouseUp = () => {
    setDragging(false);
  };

  useEffect(() => {
    if (dragging) {
      window.addEventListener('mousemove', onMouseMove);
      window.addEventListener('mouseup', onMouseUp);
    } else {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [dragging]);

  // Drag event handlers for modal
  const onModalMouseDown = (e) => {
    if (e.button !== 0) return; // Left-click only
    setModalDragging(true);
    const rect = modalRef.current.getBoundingClientRect();
    modalDragOffset.current = {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
    e.preventDefault();
  };

  const onModalMouseMove = (e) => {
    if (!modalDragging) return;
    const newX = Math.min(window.innerWidth - modalRef.current.offsetWidth, Math.max(0, e.clientX - modalDragOffset.current.x));
    const newY = Math.min(window.innerHeight - modalRef.current.offsetHeight, Math.max(0, e.clientY - modalDragOffset.current.y));
    setModalPosition({ x: newX, y: newY });
  };

  const onModalMouseUp = () => {
    setModalDragging(false);
  };

  useEffect(() => {
    if (modalDragging) {
      window.addEventListener('mousemove', onModalMouseMove);
      window.addEventListener('mouseup', onModalMouseUp);
    } else {
      window.removeEventListener('mousemove', onModalMouseMove);
      window.removeEventListener('mouseup', onModalMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', onModalMouseMove);
      window.removeEventListener('mouseup', onModalMouseUp);
    };
  }, [modalDragging]);

  const handleConfirm = () => {
    onConfirm(cart, grandTotal, selectedPayment, deliveryAddress);
  };

  // Prepare province options sorted by region number and region name for grouping (optional)
  const provinceOptions = [];
  if (locationData) {
    const sortedRegionsKeys = Object.keys(locationData).sort((a, b) => Number(a) - Number(b));
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
    const sortedRegionsKeys = Object.keys(locationData).sort((a, b) => Number(a) - Number(b));
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
    const sortedRegionsKeys = Object.keys(locationData).sort((a, b) => Number(a) - Number(b));
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

  // Dark mode styles for React-Select with new primary color
  const selectStyles = {
    control: (provided, state) => ({
      ...provided,
      backgroundColor: '#2a2a2a',
      borderColor: state.isFocused ? '#dc3545' : '#333',
      borderRadius: '8px',
      color: '#e0e0e0',
      boxShadow: state.isFocused ? '0 0 7px rgba(220, 53, 69, 0.5)' : 'none',
      '&:hover': {
        borderColor: '#dc3545',
      },
    }),
    placeholder: (provided) => ({
      ...provided,
      color: '#888888',
    }),
    singleValue: (provided) => ({
      ...provided,
      color: '#e0e0e0',
    }),
    menu: (provided) => ({
      ...provided,
      backgroundColor: '#1a1a1a',
      border: '1px solid #333',
      borderRadius: '8px',
      boxShadow: '0 4px 12px rgba(0, 0, 0, 0.5)',
    }),
    option: (provided, state) => ({
      ...provided,
      backgroundColor: state.isSelected ? '#dc3545' : state.isFocused ? '#dc3545' : '#2a2a2a',
      color: state.isSelected || state.isFocused ? '#ffffff' : '#e0e0e0',
      cursor: 'pointer',
    }),
    input: (provided) => ({
      ...provided,
      color: '#e0e0e0',
    }),
  };

  return (
    <>
      <div
        className={`movable-payment-review ${collapsed ? 'collapsed' : 'expanded'}`}
        style={{ top: position.y, left: position.x }}
        ref={reviewRef}
        role="dialog"
        aria-label="Review Payment Method"
      >
        <div
          className="review-header"
          onMouseDown={onMouseDown}
          aria-grabbed={dragging}
          tabIndex={0}
          aria-label="Drag payment review panel"
          role="button"
          onKeyDown={e => {
            if (e.key === 'Enter' || e.key === ' ') setCollapsed(!collapsed);
          }}
        >
          <span>Review Payment Method</span>
          <button
            aria-label={collapsed ? 'Expand review' : 'Collapse review'}
            onClick={() => setCollapsed(!collapsed)}
            className="collapse-btn"
            type="button"
          >
            {collapsed ? (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M7 10L12 15L17 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            ) : (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M17 14L12 9L7 14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        </div>

        {!collapsed && (
          <div className="review-content">
            <h3>Order Summary</h3>
            <ul className="review-items-list">
              {cart.map(({ id, name, quantity, price }) => (
                <li key={id} className="review-item">
                  <span className="item-name">{name} x{quantity}</span>
                  <span className="item-subtotal">₱ {(quantity * price).toFixed(2)}</span>
                </li>
              ))}
            </ul>
            <div className="review-totals">
              <div className="subtotal">
                <span>Subtotal:</span>
                <span>₱ {cartTotal.toFixed(2)}</span>
              </div>
              <div className="delivery-fee">
                <span>Delivery Fee:</span>
                <span>₱ {deliveryFee.toFixed(2)}</span>
              </div>
              <div className="grand-total">
                <span>Total:</span>
                <span>₱ {grandTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="delivery-address-section">
              <h4>Delivery Address</h4>
              {isLoadingAddress ? (
                <p className="address-loading">Loading address...</p>
              ) : addressError ? (
                <p className="address-error">{addressError}</p>
              ) : (
                <div className="address-display">
                  <p>{deliveryAddress}</p>
                  <button
                    type="button"
                    className="change-address-btn"
                    aria-label="Change delivery address"
                    onClick={() => setShowChangeAddressModal(true)}
                  >
                    Change Address
                  </button>
                </div>
              )}
            </div>

            <div className="payment-options">
              <h4>Select Payment Method</h4>
              <label>
                <input
                  type="radio"
                  value="COD"
                  checked={selectedPayment === 'COD'}
                  onChange={(e) => setSelectedPayment(e.target.value)}
                />
                Cash on Delivery (COD)
              </label>
              <label>
                <input
                  type="radio"
                  value="PayPal"
                  checked={selectedPayment === 'PayPal'}
                  onChange={(e) => setSelectedPayment(e.target.value)}
                />
                PayPal (Sandbox)
              </label>
            </div>

            {selectedPayment === 'PayPal' && (
              <div className="paypal-payment-section">
                <h4>Complete Payment</h4>
                <PayPalPayment
                  amount={grandTotal}
                  onSuccess={(paymentData) => {
                    // Handle successful payment
                    console.log('PayPal payment successful:', paymentData);
                    handleConfirm(); // Proceed with order confirmation
                  }}
                  onError={(error) => {
                    alert('Payment failed. Please try again.');
                    console.error('PayPal error:', error);
                  }}
                  onCancel={() => {
                    alert('Payment cancelled.');
                  }}
                />
              </div>
            )}

            <div className="review-actions">
              <button
                className="cancel-review-btn"
                type="button"
                onClick={onCancel}
                aria-label="Cancel review"
              >
                Cancel
              </button>
              {selectedPayment === 'COD' && (
                <button
                  className="confirm-order-btn"
                  type="button"
                  onClick={handleConfirm}
                  aria-label="Confirm and place order"
                >
                  Place Order
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      // {/* Change Address Modal */}
{showChangeAddressModal && (
  <div className="change-address-overlay" onClick={() => setShowChangeAddressModal(false)}>
    <div
      className="change-address-content"
      onClick={e => e.stopPropagation()}
      style={{ top: modalPosition.y, left: modalPosition.x, position: 'fixed' }}
      ref={modalRef}
      role="dialog"
      aria-label="Change Delivery Address"
    >
      <div
        className="modal-header"
        onMouseDown={onModalMouseDown}
        aria-grabbed={modalDragging}
        tabIndex={0}
        aria-label="Drag change address modal"
        role="button"
      >
        <span>Change Delivery Address</span>
        <button
          aria-label="Close change address modal"
          onClick={() => setShowChangeAddressModal(false)}
          className="close-modal-btn"
          type="button"
        >
          ×
        </button>
      </div>
      <h2>Update Your Address</h2>
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

      <div className="modal-actions">
        <button
          type="button"
          onClick={() => setShowChangeAddressModal(false)}
          className="cancel-btn"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSaveAddress}
          className="save-btn"
        >
          Save Address
        </button>
      </div>
    </div>
  </div>
)}
</>
);
};

export default MovablePaymentReview;
