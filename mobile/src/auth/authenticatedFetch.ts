import { createAppCheckFetch, type GetAppCheckToken } from '../appCheck/appCheckFetch';
import { getAuthSession, getAuthSessionRevision } from './session';
import type { NativeSessionUser } from './sessionLifecycle';

const AUTH_UNAVAILABLE = 'Authentication is unavailable.';

function requestHeaders(input: RequestInfo | URL, init?: RequestInit): Headers {
  const request = typeof Request !== 'undefined' && input instanceof Request ? input : undefined;
  return new Headers(init?.headers ?? request?.headers);
}

function withHeaders(input: RequestInfo | URL, init: RequestInit | undefined, headers: Headers) {
  if (typeof Request !== 'undefined' && input instanceof Request) {
    return [new Request(input, { ...init, headers }), undefined] as const;
  }
  return [input, { ...init, headers }] as const;
}

export function createAuthenticatedFetch(options: {
  readonly getCurrentUser: () => NativeSessionUser | null;
  readonly getAppCheckToken?: GetAppCheckToken | undefined;
  readonly fetchImplementation?: typeof fetch | undefined;
}): typeof fetch {
  const rawFetch = options.fetchImplementation ?? globalThis.fetch;
  const currentUser = (): NativeSessionUser | null => {
    try {
      return options.getCurrentUser();
    } catch {
      throw new Error(AUTH_UNAVAILABLE);
    }
  };
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const headers = requestHeaders(input, init);
    const authorization = headers.get('Authorization');
    if (authorization === null) {
      const dispatch =
        options.getAppCheckToken === undefined
          ? rawFetch
          : createAppCheckFetch(options.getAppCheckToken, rawFetch);
      return dispatch(input, init);
    }

    const revision = getAuthSessionRevision();
    const session = getAuthSession();
    const user = currentUser();
    if (
      session?.nativeUid === undefined ||
      authorization !== `Bearer ${session.credential}` ||
      user === null ||
      user.uid !== session.nativeUid
    )
      throw new Error(AUTH_UNAVAILABLE);

    const owner = session.nativeUid;
    let credential: string;
    try {
      const result = await user.getIdTokenResult();
      if (result.claims.sub !== owner) throw new Error(AUTH_UNAVAILABLE);
      credential = result.token;
    } catch {
      throw new Error(AUTH_UNAVAILABLE);
    }
    const isCurrent = () => {
      const current = getAuthSession();
      return (
        getAuthSessionRevision() === revision &&
        current?.nativeUid === owner &&
        current.credential === session.credential &&
        currentUser()?.uid === owner
      );
    };
    if (
      !isCurrent() ||
      credential.length === 0 ||
      credential.length > 4096 ||
      !/^[\x21-\x7e]+$/.test(credential)
    ) {
      throw new Error(AUTH_UNAVAILABLE);
    }
    headers.set('Authorization', `Bearer ${credential}`);
    const [nextInput, nextInit] = withHeaders(input, init, headers);
    const guardedRaw: typeof fetch = (finalInput, finalInit) => {
      if (!isCurrent()) throw new Error(AUTH_UNAVAILABLE);
      return rawFetch(finalInput, finalInit);
    };
    const dispatch =
      options.getAppCheckToken === undefined
        ? guardedRaw
        : createAppCheckFetch(options.getAppCheckToken, guardedRaw);
    return dispatch(nextInput, nextInit);
  };
}
