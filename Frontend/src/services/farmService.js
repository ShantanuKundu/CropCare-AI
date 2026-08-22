import axiosInstance from '../api/axios';

export const farmService = {
  getFarms: async () => {
    const response = await axiosInstance.get('/farms');
    // Backend returns { data: [...] } when farms exist, or { message: "..." } when empty
    const body = response.data;
    if (Array.isArray(body)) return body;               // future-proof if backend changes
    if (Array.isArray(body?.data)) return body.data;    // normal case: { data: [...] }
    return [];                                           // empty or message-only response
  },

  addFarm: async (farmData) => {
    const response = await axiosInstance.post('/farms', farmData);
    return response.data;
  },
};

