export const COMMENT_MIN_LENGTH = 1;

// Shared validation for free-text comment fields across the assessment modules,
// so every module enforces the same rule: at least one non-whitespace character,
// with no maximum-length restriction. Trims first — whitespace-only input is not
// a valid comment.
export const isCommentValid = value =>
  typeof value === 'string' && value.trim().length >= COMMENT_MIN_LENGTH;

export const getCommentError = value => (isCommentValid(value) ? null : 'This field is required.');
