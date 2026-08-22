import axiosInstance from '../api/axios';

export const toolsService = {
  // ── Irrigation Advisory ─────────────────────────────────────────
  getIrrigationAdvisory: async (data) => {
    const response = await axiosInstance.post('/irrigation-advisory', data);
    return response.data;
  },

  getSupportedIrrigationCrops: async () => {
    const response = await axiosInstance.get('/irrigation-supported-crops');
    return response.data;
  },

  // ── Crop Calendar ───────────────────────────────────────────────
  getCropCalendar: async ({ state, zone, season_filter } = {}) => {
    const params = {};
    if (state)         params.state = state;
    if (zone)          params.zone = zone;
    if (season_filter) params.season_filter = season_filter;
    const response = await axiosInstance.get('/crop-calendar', { params });
    return response.data;
  },

  getCropCalendarZones: async () => {
    const response = await axiosInstance.get('/crop-calendar/zones');
    return response.data;
  },

  // ── Mandi Prices ────────────────────────────────────────────────
  getMandiSupportedCrops: async () => {
    const response = await axiosInstance.get('/mandi-supported-crops');
    return response.data;
  },

  getMandiPrices: async ({ crop, state, district } = {}) => {
    const params = {};
    if (state)    params.state = state;
    if (district) params.district = district;
    const response = await axiosInstance.get(`/mandi-prices/${encodeURIComponent(crop)}`, { params });
    return response.data;
  },

  // ── Scheme Eligibility ──────────────────────────────────────────
  checkSchemeEligibility: async (data) => {
    const response = await axiosInstance.post('/scheme-eligibility', data);
    return response.data;
  },
};
