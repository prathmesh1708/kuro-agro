import { create } from 'zustand';

const getInitialState = () => {
  try {
    const saved = localStorage.getItem('user-current-location');
    if (saved) {
      const parsed = JSON.parse(saved);
      if (parsed && parsed.locationName) {
        return {
          locationName: parsed.locationName,
          latitude: parsed.latitude || null,
          longitude: parsed.longitude || null,
          city: parsed.city || '',
          state: parsed.state || '',
          pincode: parsed.pincode || '',
          isManualSelection: Boolean(parsed.isManualSelection),
          selectedAddressId: parsed.selectedAddressId || null,
        };
      }
    }
  } catch (e) {
    console.error('Error reading initial location', e);
  }
  return {
    locationName: 'Fetching location...',
    latitude: null,
    longitude: null,
    city: '',
    state: '',
    pincode: '',
    isManualSelection: false,
    selectedAddressId: null,
  };
};

const initialState = getInitialState();

export const useLocationStore = create((set, get) => ({
  locationName: initialState.locationName,
  latitude: initialState.latitude,
  longitude: initialState.longitude,
  city: initialState.city,
  state: initialState.state,
  pincode: initialState.pincode,
  isManualSelection: initialState.isManualSelection,
  selectedAddressId: initialState.selectedAddressId,
  isLoading: false,
  error: null,
  hasFetched: false,

  setLocationFromAddress: (addressObj) => {
    if (!addressObj) return;

    const label = addressObj.name || '';
    const street = addressObj.address || addressObj.fullName || '';
    const city = addressObj.city || addressObj.state || '';

    let displayName = '';
    if (street && city) {
      if (street.toLowerCase().includes(city.toLowerCase())) {
        displayName = label ? `${label} (${street})` : street;
      } else {
        displayName = label ? `${label} - ${street}, ${city}` : `${street}, ${city}`;
      }
    } else if (street) {
      displayName = label ? `${label} - ${street}` : street;
    } else if (city) {
      displayName = label ? `${label} - ${city}` : city;
    } else {
      displayName = label || 'Selected Location';
    }

    const newState = {
      locationName: displayName,
      city: addressObj.city || '',
      state: addressObj.state || '',
      pincode: addressObj.zipCode || addressObj.pincode || '',
      isManualSelection: true,
      selectedAddressId: addressObj.id || addressObj._id || null,
      isLoading: false,
      error: null,
      hasFetched: true,
    };

    set(newState);

    localStorage.setItem(
      'user-current-location',
      JSON.stringify({
        locationName: displayName,
        city: addressObj.city || '',
        state: addressObj.state || '',
        pincode: addressObj.zipCode || addressObj.pincode || '',
        isManualSelection: true,
        selectedAddressId: addressObj.id || addressObj._id || null,
      })
    );
  },

  fetchCurrentLocation: async (force = false) => {
    // Do not overwrite user's custom address selection on auto-mount unless explicitly forced
    if (!force && get().isManualSelection && get().locationName && get().locationName !== 'Fetching location...') {
      return;
    }

    if (!navigator.geolocation) {
      set({
        error: 'Geolocation is not supported by your browser',
        isLoading: false,
        locationName: get().locationName !== 'Fetching location...' ? get().locationName : 'Location unavailable',
      });
      return;
    }

    set({ isLoading: true, error: null });

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const lat = position.coords.latitude;
        const lng = position.coords.longitude;

        try {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), 6000);

          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`,
            {
              headers: {
                'Accept-Language': 'en',
              },
              signal: controller.signal,
            }
          );

          clearTimeout(timeoutId);

          if (res.ok) {
            const data = await res.json();
            const addr = data.address || {};

            const road =
              addr.suburb ||
              addr.neighbourhood ||
              addr.residential ||
              addr.road ||
              addr.subdistrict ||
              addr.locality;
            const city =
              addr.city ||
              addr.town ||
              addr.village ||
              addr.county ||
              addr.state_district ||
              addr.municipality;

            let displayName = '';
            if (road && city) {
              displayName = `${road}, ${city}`;
            } else if (road) {
              displayName = road;
            } else if (city) {
              displayName = city;
            } else if (data.display_name) {
              displayName = data.display_name.split(',').slice(0, 2).join(',');
            } else {
              displayName = `Location (${lat.toFixed(2)}, ${lng.toFixed(2)})`;
            }

            const newState = {
              locationName: displayName,
              latitude: lat,
              longitude: lng,
              city: city || '',
              state: addr.state || '',
              pincode: addr.postcode || '',
              isManualSelection: false,
              selectedAddressId: null,
              isLoading: false,
              error: null,
              hasFetched: true,
            };

            set(newState);

            localStorage.setItem(
              'user-current-location',
              JSON.stringify({
                locationName: displayName,
                latitude: lat,
                longitude: lng,
                city: city || '',
                state: addr.state || '',
                pincode: addr.postcode || '',
                isManualSelection: false,
                selectedAddressId: null,
              })
            );
            return;
          }
        } catch (e) {
          console.warn('Reverse geocoding fetch failed/timed out, using coordinates', e);
        }

        const fallbackName = `Near ${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
        set({
          locationName: fallbackName,
          latitude: lat,
          longitude: lng,
          isManualSelection: false,
          selectedAddressId: null,
          isLoading: false,
          error: null,
          hasFetched: true,
        });
      },
      (err) => {
        console.warn('Geolocation error:', err.message);
        const currentName = get().locationName;
        const fallback = currentName && currentName !== 'Fetching location...' ? currentName : 'Select Location';
        set({
          isLoading: false,
          error: err.message,
          locationName: fallback,
        });
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000,
      }
    );
  },
}));
