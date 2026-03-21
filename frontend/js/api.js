const API_BASE = 'http://localhost:5000/api';

export async function apiRequest(method, endpoint, body = null) {
  const token = localStorage.getItem('accessToken');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };

  try {
    const res = await fetch(`${API_BASE}${endpoint}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    if (res.status === 401) {
      // Unauthenticated - token expired or missing. 
      // In a more robust implementation we'd try to refresh here.
      // For this spec, we redirect to login to keep it simple and fulfill the requirement.
      if (!endpoint.includes('/auth/login')) {
         localStorage.removeItem('accessToken');
         localStorage.removeItem('refreshToken');
         window.location.href = 'index.html';
      }
    }

    const data = await res.json();
    if (!res.ok) throw data;
    return data;
  } catch (error) {
    if (error.error) throw error; 
    throw { error: 'Network error or unable to reach API.' };
  }
}

export const api = {
  auth: {
    login: (credentials) => apiRequest('POST', '/auth/login', credentials),
    logout: () => apiRequest('POST', '/auth/logout')
  },
  dashboard: { 
    stats: () => apiRequest('GET', '/dashboard/stats') 
  },
  routes: {
    list: () => apiRequest('GET', '/routes'),
    get: (id) => apiRequest('GET', `/routes/${id}`),
    create: (data) => apiRequest('POST', '/routes', data),
    update: (id, data) => apiRequest('PUT', `/routes/${id}`, data),
    delete: (id) => apiRequest('DELETE', `/routes/${id}`),
    toggleFavorite: (id) => apiRequest('PATCH', `/routes/${id}/favorite`)
  },
  stops: {
    list: () => apiRequest('GET', '/stops'),
    get: (id) => apiRequest('GET', `/stops/${id}`),
    create: (data) => apiRequest('POST', '/stops', data),
    update: (id, data) => apiRequest('PUT', `/stops/${id}`, data),
    delete: (id) => apiRequest('DELETE', `/stops/${id}`)
  },
  buses: {
    list: () => apiRequest('GET', '/buses'),
    get: (id) => apiRequest('GET', `/buses/${id}`),
    create: (data) => apiRequest('POST', '/buses', data),
    update: (id, data) => apiRequest('PUT', `/buses/${id}`, data),
    delete: (id) => apiRequest('DELETE', `/buses/${id}`)
  },
  schedules: {
    list: () => apiRequest('GET', '/schedules'),
    get: (id) => apiRequest('GET', `/schedules/${id}`),
    create: (data) => apiRequest('POST', '/schedules', data),
    update: (id, data) => apiRequest('PUT', `/schedules/${id}`, data),
    delete: (id) => apiRequest('DELETE', `/schedules/${id}`)
  },
  depots: {
    list: () => apiRequest('GET', '/depots'),
    get: (id) => apiRequest('GET', `/depots/${id}`),
    create: (data) => apiRequest('POST', '/depots', data),
    update: (id, data) => apiRequest('PUT', `/depots/${id}`, data),
    delete: (id) => apiRequest('DELETE', `/depots/${id}`)
  },
  drivers: {
    list: (params = '') => apiRequest('GET', `/drivers${params}`),
    get: (id) => apiRequest('GET', `/drivers/${id}`),
    create: (data) => apiRequest('POST', '/drivers', data),
    update: (id, data) => apiRequest('PUT', `/drivers/${id}`, data),
    delete: (id) => apiRequest('DELETE', `/drivers/${id}`),
    updateStatus: (id, data) => apiRequest('PATCH', `/drivers/${id}/status`, data),
    assignRoute: (id, data) => apiRequest('PATCH', `/drivers/${id}/assign-route`, data),
    assignBus: (id, data) => apiRequest('PATCH', `/drivers/${id}/assign-bus`, data),
    stats: () => apiRequest('GET', '/drivers/stats'),
    expiring: (days = 30) => apiRequest('GET', `/drivers/licenses/expiring?days=${days}`)
  }
};
