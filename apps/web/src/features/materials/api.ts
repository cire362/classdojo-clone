import { api, type MaterialItem } from '../../lib/api';

export const fetchMaterials = () => api<MaterialItem[]>('GET', '/teacher/materials');

export function uploadMaterial(file: File, meta: { title: string; description: string; shared: boolean }) {
  const body = new FormData();
  body.append('file', file);
  body.append('title', meta.title);
  body.append('description', meta.description);
  body.append('shared', String(meta.shared));
  return api<MaterialItem>('POST', '/teacher/materials', body);
}

export const deleteMaterial = (id: string) => api('DELETE', `/teacher/materials/${id}`);

export const materialViewUrl = (id: string) => `/api/teacher/materials/${id}/view`;

export const materialFileUrl = (id: string) => `/api/teacher/materials/${id}/file`;
