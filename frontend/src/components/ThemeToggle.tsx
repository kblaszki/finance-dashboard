import { useTheme, type ThemePreference } from '../state/theme'

const LABELS: Record<ThemePreference, string> = {
  light: 'Theme: Light',
  dark: 'Theme: Dark',
  system: 'Theme: System',
}

export function ThemeToggle() {
  const { preference, cyclePreference } = useTheme()

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cyclePreference}
      aria-label={`Current theme ${preference}. Click to cycle light, dark, system`}
    >
      {LABELS[preference]}
    </button>
  )
}
