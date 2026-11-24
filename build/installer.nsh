!macro customInstall
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$$bin = $\'$INSTDIR\resources\bin$\'; $$curr = [Environment]::GetEnvironmentVariable($\'Path$\', $\'User$\'); $$parts = @(); if ($$curr) { $$parts = $$curr -split $\';$\' | Where-Object { $$_ -and $$_.Trim() -ne $\'$\' } }; if (-not ($$parts | Where-Object { $$_.TrimEnd($\'\\$\') -ieq $$bin.TrimEnd($\'\\$\') })) { [Environment]::SetEnvironmentVariable($\'Path$\', (($$parts + $$bin) -join $\';$\'), $\'User$\') }"'
!macroend

!macro customUnInstall
  nsExec::ExecToLog 'powershell.exe -NoProfile -ExecutionPolicy Bypass -Command "$$bin = $\'$INSTDIR\resources\bin$\'; $$curr = [Environment]::GetEnvironmentVariable($\'Path$\', $\'User$\'); if ($$curr) { $$parts = $$curr -split $\';$\' | Where-Object { $$_ -and $$_.Trim() -ne $\'$\' -and $$_.TrimEnd($\'\\$\') -ine $$bin.TrimEnd($\'\\$\') }; [Environment]::SetEnvironmentVariable($\'Path$\', ($$parts -join $\';$\'), $\'User$\') }"'
!macroend
