import type { RepoInfo, SessionDetail } from '@om/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useParams } from 'react-router';
import { addRepo, fetchRepo, getSession } from './api.ts';

export const sessionKey = (user: string, sessionId: string) =>
  ['session', user, sessionId] as const;

export function useSessionParams() {
  const { user = '', sessionId = '' } = useParams();
  return { user, sessionId };
}

export function useSessionDetail(user: string, sessionId: string) {
  return useQuery({
    queryKey: sessionKey(user, sessionId),
    queryFn: () => getSession(user, sessionId),
    enabled: Boolean(user && sessionId),
  });
}

/** Clone/fetch mutations that keep the cached session's repo list current. */
export function useRepoActions(user: string, sessionId: string) {
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
