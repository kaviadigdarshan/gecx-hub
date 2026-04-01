export interface GCPProject {
  projectId: string;
  displayName: string;
  projectNumber?: string;
}

export interface CESApp {
  name: string;
  displayName: string;
  state: string;
}
