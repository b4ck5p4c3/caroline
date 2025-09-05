import type { Metric } from './exports'

export class MetricsFrame {
  private expiresAt: null | number = null
  private metrics: Metric[] = []

  constructor (public readonly id: string) {}

  private renderMetric (additionalLabels: Record<string, string>, metric: Metric): string {
    const labels = Object.entries({ ...additionalLabels, ...metric.labels })
      .map(([key, value]) => `${key}="${value}"`)
      .join(',')

    if (labels.length > 0) {
      return `${metric.name}{${labels}} ${metric.value}`
    }

    return `${metric.name} ${metric.value}`
  }

  add (
    name: string,
    labels: Record<string, string>,
    value: number
  ): void {
    this.metrics.push({ labels, name, value })
  }

  render (additionalLabels: Record<string, string>): string {
    // Lazy expiration
    if (this.expiresAt && Date.now() > this.expiresAt) {
      this.metrics = []
      return ''
    }

    return this.metrics
      .map(metric => this.renderMetric(additionalLabels, metric))
      .join('\n\n')
  }

  reset (): void {
    this.metrics = []
  }

  setExpiration (millis: number): void {
    this.expiresAt = Date.now() + millis
  }
}
