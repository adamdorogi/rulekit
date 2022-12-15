const bounds = [50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000]

export class Metrics {
  private readonly outcomes = { allow: 0, deny: 0, review: 0 }
  private readonly buckets = bounds.map(() => 0)
  private count = 0
  private durationSum = 0
  private hits = 0

  record(outcome: keyof Metrics['outcomes'], durationUs: number, cacheHit: boolean): void {
    this.outcomes[outcome]++
    this.count++
    this.durationSum += durationUs
    if (cacheHit) this.hits++
    bounds.forEach((bound, index) => {
      if (durationUs <= bound) this.buckets[index]++
    })
  }

  render(): string {
    return [
      '# TYPE rulekit_evaluations_total counter',
      ...Object.entries(this.outcomes).map(([outcome, count]) => `rulekit_evaluations_total{outcome="${outcome}"} ${count}`),
      '# TYPE rulekit_cache_hit_ratio gauge',
      `rulekit_cache_hit_ratio ${this.count ? this.hits / this.count : 0}`,
      '# TYPE rulekit_evaluation_duration_microseconds histogram',
      ...bounds.map((bound, index) => `rulekit_evaluation_duration_microseconds_bucket{le="${bound}"} ${this.buckets[index]}`),
      `rulekit_evaluation_duration_microseconds_bucket{le="+Inf"} ${this.count}`,
      `rulekit_evaluation_duration_microseconds_sum ${this.durationSum}`,
      `rulekit_evaluation_duration_microseconds_count ${this.count}`,
      '',
    ].join('\n')
  }
}
