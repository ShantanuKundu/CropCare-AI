import axiosInstance from '../api/axios';

export const yieldService = {
  /**
   * POST /predict-yield
   * Input: { crop, farming_type, season, farm_id?, irrigation_type?, nitrogen?, phosphorous?, potassium?, ph? }
   * Output: { yield_range, total_production, limiting_factors, comparison, model_inputs, ... }
   */
  predictYield: async (data) => {
    const response = await axiosInstance.post('/predict-yield', data);
    return response.data;
  },

  /**
   * GET /yield-supported-crops
   * Returns { supported_crops: string[] }
   */
  getSupportedCrops: async () => {
    const response = await axiosInstance.get('/yield-supported-crops');
    return response.data;
  },

  /**
   * GET /yield-history
   * Returns all past yield predictions for the current user.
   */
  getYieldHistory: async () => {
    const response = await axiosInstance.get('/yield-history');
    return response.data;
  },
};
