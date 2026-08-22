import axiosInstance from '../api/axios';

export const fertilizerService = {
  /**
   * POST /recommend-fertilizer
   * Input: { farming_type, crop?, nitrogen?, phosphorous?, potassium?, ph? }
   * Output: { soil_analysis, summary, primary_recommendation, ph_correction }
   */
  getFertilizerRecommendation: async (data) => {
    const response = await axiosInstance.post('/recommend-fertilizer', data);
    return response.data;
  },

  /**
   * GET /fertilizer-history
   * Returns ALL past fertilizer recommendations for the current user.
   */
  getFertilizerHistory: async () => {
    const response = await axiosInstance.get('/fertilizer-history');
    return response.data;
  },

  /**
   * GET /fertilizer-history/latest
   * Returns the single latest fertilizer recommendation.
   */
  getLatestFertilizer: async () => {
    const response = await axiosInstance.get('/fertilizer-history/latest');
    return response.data;
  },
};
