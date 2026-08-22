import axiosInstance from '../api/axios';

export const predictionService = {
  predictDisease: async (imageFile) => {
    const formData = new FormData();
    formData.append('file', imageFile);

    const response = await axiosInstance.post('/predict', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getPredictionHistory: async () => {
    const response = await axiosInstance.get('/prediction-history');
    return response.data;
  },
};
