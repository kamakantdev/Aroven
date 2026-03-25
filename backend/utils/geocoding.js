const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const USER_AGENT = process.env.GEOCODER_USER_AGENT || 'SwastikHealthApp/1.0 (global-geocoding)';

const buildAddressParts = (value) => {
  if (!value || typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

const buildProviderAddress = (provider = {}) => {
  return [
    buildAddressParts(provider.address),
    buildAddressParts(provider.city),
    buildAddressParts(provider.state),
    buildAddressParts(provider.pincode),
    buildAddressParts(provider.country),
  ].filter(Boolean).join(', ');
};

const geocodeAddress = async (address, options = {}) => {
  if (!address || address.trim().length < 4) return null;

  const params = new URLSearchParams({
    q: address.trim(),
    format: 'json',
    limit: '1',
  });

  if (options.countryCode) {
    params.set('countrycodes', options.countryCode);
  }

  const response = await fetch(`${NOMINATIM_URL}?${params.toString()}`, {
    headers: { 'User-Agent': USER_AGENT },
    signal: options.signal,
  });

  if (!response.ok) {
    throw new Error(`Geocoder returned HTTP ${response.status}`);
  }

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) {
    return null;
  }

  return {
    latitude: Number.parseFloat(data[0].lat),
    longitude: Number.parseFloat(data[0].lon),
    displayName: data[0].display_name || address,
  };
};

const geocodeProvider = async (provider, options = {}) => {
  const address = buildProviderAddress(provider);
  if (!address) return null;
  return geocodeAddress(address, options);
};

const maybeGeocodeLocationUpdates = async (existingProvider = {}, updates = {}) => {
  const mergedProvider = { ...existingProvider, ...updates };
  const addressFieldsChanged = ['address', 'city', 'state', 'pincode', 'country']
    .some((field) => updates[field] !== undefined);
  const hasExplicitCoordinates = updates.latitude !== undefined || updates.longitude !== undefined;
  const alreadyGeocoded = mergedProvider.latitude != null && mergedProvider.longitude != null;

  if (hasExplicitCoordinates || alreadyGeocoded || !addressFieldsChanged) {
    return updates;
  }

  const geo = await geocodeProvider(mergedProvider);
  if (!geo) return updates;

  return {
    ...updates,
    latitude: geo.latitude,
    longitude: geo.longitude,
  };
};

module.exports = {
  buildProviderAddress,
  geocodeAddress,
  geocodeProvider,
  maybeGeocodeLocationUpdates,
};
