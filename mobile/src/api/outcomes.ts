/** Shared mobile API outcome shapes. Domain unions stay in each client. */

export type UnreachableOutcome = { readonly outcome: 'unreachable'; readonly reason: string };

export type EnvelopeOutcome<O extends string> = {
  readonly outcome: O;
  readonly httpStatus: number;
  readonly code: string;
  readonly message: string;
};
