import type { RepoInfo, SessionDetail } from '@om/shared';
import {
  useMutation,
  useQuery,
  useQueryClient,
  type UseMutationResult,
  type UseQueryResult,
} from '@tanstack/react-query';
import { useParams } from 'react-router';
import { addRepo, fetchRepo, getSession } from './api.ts';

/** TanStack Query key for a session's detail; shared so mutations can update the cached copy. */
export const sessionKey = (user: string, sessionId: string) =>
  ['session', user, sessionId] as const;

/** `user` and `sessionId` from the current route ('' when absent). */
export function useSessionParams(): { user: string; sessionId: string } {
  const { user = '', sessionId = '' } = useParams();
  return { user, sessionId };
}

/** Loads a session's detail; disabled until both `user` and `sessionId` are known. */
export function useSessionDetail(user: string, sessionId: string): UseQueryResult<SessionDetail> {
  return useQuery({
    queryKey: sessionKey(user, sessionId),
    queryFn: () => getSession(user, sessionId),
    enabled: user !== '' && sessionId !== '',
  });
}

/** Mutations exposed by {@link useRepoActions}. */
export type RepoActions = {
  add: UseMutationResult<RepoInfo, Error, string>;
  fetchLatest: UseMutationResult<RepoInfo, Error, string>;
};

/** Clone/fetch mutations that keep the cached session's repo list current. */
export function useRepoActions(user: string, sessionId: string): RepoActions {
  const queryClient = useQueryClient();
  const key = sessionKey(user, sessionId);

  const remember = (repo: RepoInfo) => {
    queryClient.setQueryData<SessionDetail>(
      key,
      (detail) =>
        detail && {
          ...detail,
          repos: detail.repos.some((r) => r.id === repo.id)
            ? detail.repos.map((r) => (r.id === repo.id ? repo : r))
            : [...detail.repos, repo],
        },
    );
    void queryClient.invalidateQueries({ queryKey: key });
  };

  const add = useMutation({
    mutationFn: (url: string) => addRepo(user, sessionId, url),
    onSuccess: remember,
  });
  const fetchLatest = useMutation({
    mutationFn: (repoId: string) => fetchRepo(user, sessionId, repoId),
    onSuccess: remember,
  });
  return { add, fetchLatest };
}
