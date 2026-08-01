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
  { name: 'Cash', value: 22, colorVar: 'var(--chart-1)' },
  { name: 'Stocks', value: 34, colorVar: 'var(--chart-2)' },
  { name: 'Crypto', value: 12, colorVar: 'var(--chart-3)' },
  { name: 'Metals', value: 14, colorVar: 'var(--chart-4)' },
  { name: 'Real estate', value: 18, colorVar: 'var(--chart-5)' },
]

type DemoAreaChartProps = {
  className?: string
  height?: number
}

export function DemoAreaChart({ className, height = 200 }: DemoAreaChartProps) {
  return (
    <div className={className} aria-hidden style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={NET_WORTH_SERIES} margin={{ top: 8, right: 0, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="hpDemoAreaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-accent)" stopOpacity={0.35} />
              <stop offset="100%" stopColor="var(--color-accent)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <Area
            type="monotone"
            dataKey="value"
            stroke="var(--color-accent)"
            strokeWidth={2}
            fill="url(#hpDemoAreaFill)"
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
      <ul className="hp-donut-legend">
        {ALLOCATION_SLICES.map((slice) => (
          <li key={slice.name}>
            <span className="hp-donut-swatch" style={{ background: slice.colorVar }} />
            <span>{slice.name}</span>
            <span className="hp-donut-pct">{slice.value}%</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
