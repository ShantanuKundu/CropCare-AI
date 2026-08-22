import axiosInstance from '../api/axios';

export const cropService = {
  /**
   * POST /recommend-crop  — triggers ML inference and stores result to DB.
   * Returns: { season, weather, recommendations: Array | string }
   */
  getRecommendation: async (lat, lon, season, farmId) => {
    let url = `/recommend-crop?lat=${lat}&lon=${lon}&season=${encodeURIComponent(season)}`;
    if (farmId !== undefined && farmId !== null) {
      url += `&farm_id=${farmId}`;
    }
    const response = await axiosInstance.post(url);
    return response.data;
  },

  /**
   * GET /latest-crop-recommendation  — fetches most recent saved recommendation from DB.
   * Returns: { season, weather, recommendations: string (JSON) }
   * NOTE: recommendations field is a JSON string here — always normalise before use.
   */
  getLatestCropRecommendation: async () => {
    const response = await axiosInstance.get('/latest-crop-recommendation');
    return response.data;
  },
};
