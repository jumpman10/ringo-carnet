import { User } from '../types';

export type { User };

const STORAGE_KEY_ADMIN_USER = 'ringo_admin_user';
const STORAGE_KEY_ADMIN_SESSION = 'ringo_admin_session';

export function getCurrentAdminUser(): User | null {
  const session = localStorage.getItem(STORAGE_KEY_ADMIN_SESSION);
  if (!session) return null;
  try {
    return JSON.parse(session) as User;
  } catch {
    return null;
  }
}

export async function signInAdmin(
  email: string,
  password: string
): Promise<{ data: { user: User | null; session: any }; error: Error | null }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  const storedRaw = localStorage.getItem(STORAGE_KEY_ADMIN_USER);
  if (storedRaw) {
    try {
      const stored = JSON.parse(storedRaw);
      if (stored.email === cleanEmail && stored.password === cleanPassword) {
        const user: User = { id: stored.id, email: stored.email, role: 'admin' };
        localStorage.setItem(STORAGE_KEY_ADMIN_SESSION, JSON.stringify(user));
        return { data: { user, session: { user } }, error: null };
      }
      return {
        data: { user: null, session: null },
        error: new Error('Contraseña o correo electrónico incorrecto.'),
      };
    } catch {
      // If parsing fails, allow initial login
    }
  }

  // Auto-bootstrap: First login registers the administrator
  const user: User = { id: 'admin-1', email: cleanEmail, role: 'admin' };
  localStorage.setItem(STORAGE_KEY_ADMIN_USER, JSON.stringify({ ...user, password: cleanPassword }));
  localStorage.setItem(STORAGE_KEY_ADMIN_SESSION, JSON.stringify(user));
  return { data: { user, session: { user } }, error: null };
}

export async function signUpAdmin(
  email: string,
  password: string
): Promise<{ data: { user: User | null; session: any }; error: Error | null }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanPassword = password.trim();

  const user: User = { id: 'admin-' + Date.now().toString(36), email: cleanEmail, role: 'admin' };
  localStorage.setItem(STORAGE_KEY_ADMIN_USER, JSON.stringify({ ...user, password: cleanPassword }));
  localStorage.setItem(STORAGE_KEY_ADMIN_SESSION, JSON.stringify(user));

  return { data: { user, session: { user } }, error: null };
}

export async function signOutAdmin(): Promise<void> {
  localStorage.removeItem(STORAGE_KEY_ADMIN_SESSION);
}
