import {
  Area,
  AreaChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
} from 'recharts'

export const NET_WORTH_SERIES = [
  { month: 'Jan', value: 82 },
  { month: 'Feb', value: 86 },
  { month: 'Mar', value: 84 },
  { month: 'Apr', value: 91 },
  { month: 'May', value: 95 },
  { month: 'Jun', value: 93 },
  { month: 'Jul', value: 101 },
  { month: 'Aug', value: 108 },
  { month: 'Sep', value: 112 },
  { month: 'Oct', value: 118 },
  { month: 'Nov', value: 124 },
  { month: 'Dec', value: 131 },
]

export const ALLOCATION_SLICES = [
  { name: 'Cash', value: 22, colorVar: 'var(--lp-slice-1)' },
  { name: 'Stocks', value: 34, colorVar: 'var(--lp-slice-2)' },
  { name: 'Crypto', value: 12, colorVar: 'var(--lp-slice-3)' },
  { name: 'Metals', value: 14, colorVar: 'var(--lp-slice-4)' },
  { name: 'Real estate', value: 18, colorVar: 'var(--lp-slice-5)' },
]

export const TICKER_SYMBOLS = [
  { symbol: 'WIG20', change: '+0.42%' },
  { symbol: 'EUR/PLN', change: '-0.08%' },
  { symbol: 'BTC', change: '+1.6%' },
  { symbol: 'SPX', change: '+0.31%' },
  { symbol: 'GOLD', change: '+0.19%' },
  { symbol: 'USD/PLN', change: '+0.05%' },
  { symbol: 'DAX', change: '-0.22%' },
  { symbol: 'ETH', change: '+0.9%' },
]

type DemoAreaChartProps = {
  className?: string
  height?: number
}

export function DemoAreaChart({ className, height = 160 }: DemoAreaChartProps) {
  return (
    <div className={className} aria-hidden style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={NET_WORTH_SERIES} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="lpDemoAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--lp-chart)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--lp-chart)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--lp-chart)"
            strokeWidth={2}
            fill="url(#lpDemoAreaFill)"
            isAnimationActive={false}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  )
}

type DemoAllocationDonutProps = {
  className?: string
  size?: number
}

export function DemoAllocationDonut({ className, size = 200 }: DemoAllocationDonutProps) {
  return (
    <div className={className} aria-hidden>
      <div style={{ width: size, height: size, margin: '0 auto' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={ALLOCATION_SLICES}
              dataKey="value"
              nameKey="name"
              innerRadius="58%"
              outerRadius="88%"
              paddingAngle={2}
              stroke="none"
              isAnimationActive={false}
            >
              {ALLOCATION_SLICES.map((slice) => (
                <Cell key={slice.name} fill={slice.colorVar} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
      <ul className="lp-donut-legend">
        {ALLOCATION_SLICES.map((slice) => (
          <li key={slice.name}>
            <span className="lp-donut-swatch" style={{ background: slice.colorVar }} />
            <span>{slice.name}</span>
            <span className="lp-donut-pct">{slice.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function DemoTickerTape({ className }: { className?: string }) {
  const doubled = [...TICKER_SYMBOLS, ...TICKER_SYMBOLS]
  return (
    <div className={className} aria-hidden>
      <div className="lp-ticker-track">
        {doubled.map((item, i) => (
          <span key={`${item.symbol}-${i}`} className="lp-ticker-item">
            <strong>{item.symbol}</strong>
            <span
              className={
                item.change.startsWith('-') ? 'lp-ticker-down' : 'lp-ticker-up'
              }
            >
              {item.change}
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
