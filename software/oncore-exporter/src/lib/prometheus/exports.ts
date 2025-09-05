export interface Metric {
  labels: Record<string, string>;
  name: string;
  value: number;
}

export interface MetricMeta {
  description?: string;
  type?: 'counter' | 'gauge' | 'histogram' | 'summary';
}

export interface Frame {
  expiresAt: null | number;
  id: string;
  metrics: Metric[];
}

export interface ExporterOptions {
  globalLabels?: Record<string, string>;
}
