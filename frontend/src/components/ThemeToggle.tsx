import { useTheme } from '../state/theme'

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={toggleTheme}
      aria-label={theme === 'light' ? 'Włącz tryb ciemny' : 'Włącz tryb jasny'}
    >
      {theme === 'light' ? 'Tryb ciemny' : 'Tryb jasny'}
    </button>
  )
}
