import { api, type ImportPlan, type ImportResult } from '../../lib/api';

const form = (file: File) => {
  const body = new FormData();
  body.append('file', file);
  return body;
};

export const previewSchoolImport = (file: File) => api<ImportPlan>('POST', '/admin/school-import/preview', form(file));

export const applySchoolImport = (file: File) => api<ImportResult>('POST', '/admin/school-import', form(file));
