import axiosInstance from '../api/axios';

export const soilService = {
  extractSoilData: async (imageFile) => {
    const formData = new FormData();
    formData.append('file', imageFile);

    const response = await axiosInstance.post('/extract_shc', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getSoilHistory: async () => {
    const response = await axiosInstance.get('/soil-history');
    return response.data;
  },
};
