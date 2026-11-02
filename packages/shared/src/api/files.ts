/** Сведения о загруженном файле. Содержимое отдаёт GET /api/files/:id */
export interface FileInfo {
  id: string;
  name: string;
  mime: string;
  size: number;
  createdAt: string;
}
