// Re-export API client from services for backward compatibility
export { api, type ApiClient } from '@/services/api';
export { authApi, conversationsApi, messagesApi, sessionsApi, contactsApi, webhooksApi, apiKeysApi } from '@/services/api';

// Default export for modules that use `import api from`
import { api } from '@/services/api';
export default api;
