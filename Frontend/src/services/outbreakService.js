import axiosInstance from '../api/axios';

export const outbreakService = {
  getRadar: async ({ farmId, radiusKm = 25, days = 30, cropFilter = '' }) => {
    const params = { radius_km: radiusKm, days };
    if (farmId)     params.farm_id     = farmId;
    if (cropFilter) params.crop_filter = cropFilter;
    const res = await axiosInstance.get('/outbreak-radar', { params });
    return res.data;
  },
};
