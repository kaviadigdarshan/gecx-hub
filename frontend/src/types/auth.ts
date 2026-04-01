export interface User {
  id: string;
  email: string;
  name: string;
  picture: string | null;
}

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
}
