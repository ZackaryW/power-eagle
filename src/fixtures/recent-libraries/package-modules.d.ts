declare module '*.js' {
  export const manifest: {
    id: string;
    name: string;
    version: string;
    stateVersion: number;
    type: string;
    keywords?: string[];
    description?: string;
  };

  const moduleValue: any;
  export default moduleValue;
}