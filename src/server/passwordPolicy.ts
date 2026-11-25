export const BCRYPT_COST = 12;

export function validatePassword(password: unknown, previousPassword?: string): string | null {
  if (
    typeof password !== 'string' ||
    password.length < 10 ||
    !/\p{L}/u.test(password) ||
    !/[0-9]/.test(password)
  ) {
    return 'Le mot de passe doit comporter au moins 10 caractères, une lettre et un chiffre.';
  }
  if (previousPassword !== undefined && password === previousPassword) {
    return 'Le nouveau mot de passe doit être différent de l’ancien.';
  }
  return null;
}
