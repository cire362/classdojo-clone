import { api, type FeedPost } from '../../lib/api';

/** Адрес ленты свой у каждой роли, поэтому его передаёт страница */
export const fetchPosts = (path: string) => api<FeedPost[]>('GET', path);

export const createPost = (path: string, text: string) => api<FeedPost>('POST', path, { text });

export const deletePost = (postId: string) => api('DELETE', `/teacher/posts/${postId}`);
