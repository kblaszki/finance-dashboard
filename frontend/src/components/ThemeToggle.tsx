import { useTheme } from '../state/theme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Enable dark mode' : 'Enable light mode'}
    >
      {theme === 'light' ? 'Dark mode' : 'Light mode'}
    </button>
  )
}
