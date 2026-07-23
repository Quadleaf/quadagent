local wezterm = require 'wezterm'
local config = wezterm.config_builder()

config.default_prog = { 'C:\\Program Files\\Git\\bin\\bash.exe', '-l', '-i' }

config.launch_menu = {
  { label = 'Git Bash',   args = { 'C:\\Program Files\\Git\\bin\\bash.exe', '-l', '-i' } },
  { label = 'PowerShell', args = { 'powershell.exe', '-NoLogo' } },
}

config.keys = {
  -- Launcher menu — pick which profile to open
  {
    key = 'p',
    mods = 'CTRL|SHIFT',
    action = wezterm.action.ShowLauncherArgs { flags = 'LAUNCH_MENU_ITEMS|DOMAINS' },
  },
}

config.cursor_blink_rate = 0
config.force_reverse_video_cursor = true

return config