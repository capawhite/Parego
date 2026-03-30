/**
 * Stable codes for match submit failures (API + server action).
 * Use with `localization/messages.*.json` under `submitErrors.<code>`.
 */
export type SubmitErrorCode =
  | "MISSING_AUTH"
  | "SIGN_IN_REQUIRED_TO_SUBMIT"
  | "GUEST_PLAYER_CANNOT_SUBMIT"
  | "MISSING_SUPABASE_URL"
  | "SERVER_MISCONFIGURED_NO_SERVICE_ROLE"
  | "MATCH_NOT_FOUND"
  | "TOURNAMENT_NOT_ACTIVE"
  | "MATCH_ALREADY_COMPLETED"
  | "NOT_A_PLAYER_IN_MATCH"
  | "SAVE_RESULT_FAILED"
  | "SUBMISSION_NOT_PERSISTED"
  | "BAD_REQUEST_MISSING_FIELDS"
  | "BAD_REQUEST_GUEST_NO_PLAYER_ID"
  | "INVALID_RESULT"
  | "INTERNAL_ERROR"
