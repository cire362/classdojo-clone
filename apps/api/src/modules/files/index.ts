export { fileRoutes } from './routes.js';
export { teacherFileRoutes } from './teacher.routes.js';
export {
  addFileRows,
  addSchoolFileRows,
  expireArchivedFiles,
  filesExpireAt,
  prepareUpload,
  purgeDeletedFiles,
  view as fileView,
  writeUploads,
  type Upload,
} from './service.js';
