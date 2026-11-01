import type { ReactionKind } from '@heroes/shared';
import { api, type FeedPost } from '../../lib/api';

/** Адрес ленты свой у каждой роли, поэтому его передаёт страница */
export const fetchPosts = (path: string) => api<FeedPost[]>('GET', path);

export const createPost = (path: string, text: string, publishAt?: string) => api<FeedPost>('POST', path, { text, publishAt });

export const deletePost = (postId: string) => api('DELETE', `/teacher/posts/${postId}`);

export const setPinned = (path: string, postId: string, pinned: boolean) => api<FeedPost>('PUT', `${path}/${postId}/pin`, { pinned });

export const setReaction = (path: string, postId: string, kind: ReactionKind | null) =>
  api<FeedPost>('PUT', `${path}/${postId}/reaction`, { kind });

export const addComment = (path: string, postId: string, text: string) => api<FeedPost>('POST', `${path}/${postId}/comments`, { text });

export const deleteComment = (path: string, postId: string, commentId: string) =>
  api<FeedPost>('DELETE', `${path}/${postId}/comments/${commentId}`);

export const setFeedComments = (groupId: string, feedComments: boolean) => api('PATCH', `/teacher/groups/${groupId}`, { feedComments });
