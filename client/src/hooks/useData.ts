import { useQuery } from '@tanstack/react-query';
import { api } from '../api/axios.js';
import { useAuthStore } from '../store/useAuthStore.js';
export function useData(path: string, params: Record<string, unknown> = {}, enabled = true) {
  const user = useAuthStore(s => s.user);
  return useQuery({ queryKey: [path, params, user?.id || 'public'], queryFn: async () => (await api.get(path, { params })).data.data, enabled });
}
