import axiosInstance from '../api/axios';

export const authService = {
  register: async (name, email, password) => {
    const response = await axiosInstance.post('/register', {
      name,
      email,
      password,
      confirm_password: password,
    });
    return response.data;
  },

  login: async (email, password) => {
    // FastAPI OAuth2PasswordRequestForm expects form data
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    const response = await axiosInstance.post('/login', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  },

  getCurrentUser: async () => {
    const response = await axiosInstance.get('/users/me');
    return response.data;
  },
};
