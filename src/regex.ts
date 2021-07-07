/**
 * Extract piece, from, to, and promotion from a move string. This should also parse invalid SAN like Pe2-e4, Rc1c4, Qf3xf7
 */
export const REGEXP_MOVE = /(?:(?:([pnbrqkPNBRQK])??([a-h]?[1-8]?)?x?\-?([a-h][1-8])=?([qrbnQRBN])?)|O-O(?:-O)?)+([+#])?/

/**
 * Extract key from header
 */
export const REGEXP_HEADER_KEY = /^\[([A-Z][A-Za-z]*)\s.*\]$/

/**
 * Extract value from header
 */
export const REGEXP_HEADER_VAL = /^\[[A-Za-z]+\s"(.*)" *\]$/

/**
 * Extract nag
 */
export const REGEXP_NAG = /([?!]+)/

/**
 * Match move number
 */
export const REGEXP_MOVE_NUMBER = /[0-9]+\.+$/

/**
 * Match semicolon comment
 */
export const REGEXP_SEMI_COMMENT = /(;[^}]+)$/
