# install.ps1 - make this repo canonical for the machine's global Claude Code config.
#
# Windows counterpart of install.sh. For each file listed in $Mirrors, this
# replaces the live copy under the Claude config dir (default ~\.claude) with a
# symlink pointing into this repo. Anything already present at the target that
# is NOT already the correct symlink is backed up first, so nothing is lost.
#
# The script is idempotent: re-running it is a no-op for links that are already
# correct.
#
# Symlink creation on Windows needs either an elevated shell or Developer Mode
# (Settings > System > For developers). The script creates links via
# `cmd /c mklink`, which honors Developer Mode from a non-elevated shell
# (Windows PowerShell 5.1's New-Item -ItemType SymbolicLink does not).
#
# Usage:
#   .\install.ps1 [-DryRun]
#
# Env:
#   CLAUDE_CONFIG_DIR   Target config dir (default: $HOME\.claude)

[CmdletBinding()]
param(
  [switch]$DryRun
)

$ErrorActionPreference = 'Stop'

$RepoDir   = $PSScriptRoot
$ConfigDir = if ($env:CLAUDE_CONFIG_DIR) { $env:CLAUDE_CONFIG_DIR } else { Join-Path $HOME '.claude' }

# --- manifest: repo-relative paths that mirror into $ConfigDir at the same ----
# --- relative path. Keep in sync with MIRRORS in install.sh. ------------------
$Mirrors = @(
  'CLAUDE.md'
)

# --- helpers ------------------------------------------------------------------
function Invoke-Step {
  param([scriptblock]$Action, [string]$Describe)
  if ($DryRun) {
    Write-Output "  [dry-run] $Describe"
  } else {
    & $Action
  }
}

function Get-NormalizedPath {
  param([string]$Path)
  [System.IO.Path]::GetFullPath($Path).TrimEnd('\')
}

# Probe whether this session can create symlinks at all, before touching any
# live files. cmd handles the redirection so a failed probe stays quiet.
function Test-SymlinkCapability {
  $probe = Join-Path $env:TEMP ("quadagent-symlink-probe-" + [guid]::NewGuid())
  cmd /c "mklink ""$probe"" ""$PSCommandPath"" >nul 2>&1"
  if ($LASTEXITCODE -eq 0) {
    Remove-Item -LiteralPath $probe -Force
    return $true
  }
  return $false
}

# Called only once a link actually needs creating, so an all-linked re-run
# needs no symlink privilege. Probes once, then aborts (or warns, in dry-run)
# before any file has been moved.
$CanSymlink = $null
$WarnedSymlink = $false
function Assert-SymlinkCapability {
  if ($null -eq $script:CanSymlink) { $script:CanSymlink = Test-SymlinkCapability }
  if ($script:CanSymlink) { return }
  $msg = "This session cannot create symlinks. Enable Developer Mode " +
         "(Settings > System > For developers) or re-run from an elevated shell."
  if ($DryRun) {
    if (-not $script:WarnedSymlink) {
      Write-Output "WARN  $msg"
      $script:WarnedSymlink = $true
    }
  } else {
    Write-Error $msg
    exit 1
  }
}

$Ts = Get-Date -Format 'yyyyMMdd-HHmmss'
$BackupRoot = Join-Path $ConfigDir ".quad-agent-backups\$Ts"
$MadeBackupDir = $false

Write-Output "Repo (canonical): $RepoDir"
Write-Output "Config dir:       $ConfigDir"
if ($DryRun) { Write-Output "Mode:             DRY RUN (no changes will be made)" }
Write-Output ""

foreach ($rel in $Mirrors) {
  $src = Join-Path $RepoDir $rel
  $dst = Join-Path $ConfigDir $rel

  if (-not (Test-Path -LiteralPath $src)) {
    Write-Output "SKIP  $rel - missing in repo ($src)"
    continue
  }

  # Already the correct symlink? (-Force so hidden/broken links are still seen)
  $existing = Get-Item -LiteralPath $dst -Force -ErrorAction SilentlyContinue
  if ($existing -and $existing.LinkType -eq 'SymbolicLink') {
    $target = @($existing.Target)[0]
    if ($target -and ((Get-NormalizedPath $target) -ieq (Get-NormalizedPath $src))) {
      Write-Output "OK    $rel - already linked"
      continue
    }
  }

  # A link needs to be (re)created - confirm this session can before any
  # mutation happens.
  Assert-SymlinkCapability

  # Ensure parent dir of target exists.
  $dstParent = Split-Path -Parent $dst
  if (-not (Test-Path -LiteralPath $dstParent)) {
    Invoke-Step { New-Item -ItemType Directory -Force $dstParent | Out-Null } "mkdir $dstParent"
  }

  # Back up whatever is there (real file, dir, or a symlink pointing elsewhere).
  $backedUpTo = $null
  if ($existing) {
    if (-not $MadeBackupDir) {
      Invoke-Step { New-Item -ItemType Directory -Force $BackupRoot | Out-Null } "mkdir $BackupRoot"
      $MadeBackupDir = $true
    }
    $backupPath   = Join-Path $BackupRoot $rel
    $backupParent = Split-Path -Parent $backupPath
    Invoke-Step { New-Item -ItemType Directory -Force $backupParent | Out-Null } "mkdir $backupParent"
    Write-Output "BACK  $rel - moving existing copy to $backupPath"
    Invoke-Step { Move-Item -LiteralPath $dst -Destination $backupPath } "mv $dst $backupPath"
    $backedUpTo = $backupPath
  }

  Write-Output "LINK  $rel -> $src"
  try {
    Invoke-Step {
      # mklink needs /D for directory links; detect from the source.
      if (Test-Path -LiteralPath $src -PathType Container) {
        cmd /c mklink /D "$dst" "$src" | Out-Null
      } else {
        cmd /c mklink "$dst" "$src" | Out-Null
      }
      if ($LASTEXITCODE -ne 0) {
        throw "mklink failed for '$dst'."
      }
    } "mklink $dst $src"
  } catch {
    # Put the original back so a failed link never leaves the target missing.
    if ($backedUpTo -and -not $DryRun) {
      Write-Output "FAIL  $rel - link failed, restoring original from backup"
      Move-Item -LiteralPath $backedUpTo -Destination $dst
    }
    throw
  }
}

Write-Output ""
if ($MadeBackupDir) {
  Write-Output "Backups saved under: $BackupRoot"
}
Write-Output "Done."
exit 0
