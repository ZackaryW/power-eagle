export type HostTab = 'installed' | 'buckets' | 'url';

export interface HostEvent {
  id: number;
  title: string;
  description?: string;
}

export interface BucketPluginRecord {
  id: string;
  name: string;
  version: string;
  type: string;
  keywords: string[];
  description: string;
}

export interface HostBucketRecord {
  id: string;
  name: string;
  url: string;
  branch: string;
  lastSync: string;
  status: 'ok';
  plugins: BucketPluginRecord[];
  isLocal?: boolean;
}

export interface InstalledPluginRecord extends BucketPluginRecord {
  enabled: boolean;
  source: 'local' | 'bucket' | 'url';
  bucketId: string | null;
  url?: string;
}