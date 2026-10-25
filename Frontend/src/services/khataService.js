import axiosInstance from '../api/axios';

export const khataService = {
  getSummary: async (farmId = null, crop = null) => {
    const params = {};
    if (farmId) params.farm_id = farmId;
    if (crop) params.crop = crop;
    const response = await axiosInstance.get('/khata/summary', { params });
    return response.data;
  },

  getEntries: async (farmId = null, crop = null) => {
    const params = {};
    if (farmId) params.farm_id = farmId;
    if (crop) params.crop = crop;
    const response = await axiosInstance.get('/khata/entries', { params });
    return Array.isArray(response.data) ? response.data : [];
  },

  addEntry: async (entryData) => {
    const response = await axiosInstance.post('/khata/entry', entryData);
    return response.data;
  },

  deleteEntry: async (entryId) => {
    const response = await axiosInstance.delete(`/khata/${entryId}`);
    return response.data;
  },
};
