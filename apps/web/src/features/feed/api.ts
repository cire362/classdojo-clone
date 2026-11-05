import type { ReactionKind } from '@heroes/shared';
import { api, type FeedPost } from '../../lib/api';

/** Адрес ленты свой у каждой роли, поэтому его передаёт страница */
export const fetchPosts = (path: string) => api<FeedPost[]>('GET', path);

/** Фото записи, уже уменьшенные, и одно видео с обложкой, если браузер смог её снять */
export type PostFiles = { photos: Blob[]; video?: { file: File; poster: Blob | null } };

/** Запись с файлами уходит одним запросом multipart: сервер сохранит её целиком или никак */
export function createPost(path: string, text: string, publishAt?: string, files: PostFiles = { photos: [] }) {
  if (!files.photos.length && !files.video) return api<FeedPost>('POST', path, { text, publishAt });
  const data = new FormData();
  data.append('text', text);
  if (publishAt) data.append('publishAt', publishAt);
  if (files.video) {
    data.append('video', files.video.file, files.video.file.name);
    if (files.video.poster) data.append('poster', files.video.poster, 'poster.jpg');
  }
  files.photos.forEach((photo, i) => data.append('photo', photo, `photo-${i + 1}.jpg`));
  return api<FeedPost>('POST', path, data);
}

export const deletePost = (postId: string) => api('DELETE', `/teacher/posts/${postId}`);

export const setPinned = (path: string, postId: string, pinned: boolean) => api<FeedPost>('PUT', `${path}/${postId}/pin`, { pinned });

export const setReaction = (path: string, postId: string, kind: ReactionKind | null) =>
  api<FeedPost>('PUT', `${path}/${postId}/reaction`, { kind });

export const addComment = (path: string, postId: string, text: string) => api<FeedPost>('POST', `${path}/${postId}/comments`, { text });

export const deleteComment = (path: string, postId: string, commentId: string) =>
  api<FeedPost>('DELETE', `${path}/${postId}/comments/${commentId}`);

export const setFeedComments = (groupId: string, feedComments: boolean) => api('PATCH', `/teacher/groups/${groupId}`, { feedComments });
