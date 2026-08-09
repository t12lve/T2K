' T2K Assistant — lance le wizard SANS fenêtre noire (recommandé)
Option Explicit
Dim sh, fso, dir, rc
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)

rc = sh.Run("cmd /c where node >nul 2>&1", 0, True)
If rc <> 0 Then
  MsgBox "Node.js est requis pour T2K." & vbCrLf & vbCrLf & _
    "1. Installe Node LTS : https://nodejs.org/" & vbCrLf & _
    "2. Relance T2K-Assistant.vbs" & vbCrLf & vbCrLf & _
    "Astuce : T2K-Raid.bat ouvre une console (debug seulement).", _
    vbExclamation, "T2K"
  WScript.Quit 1
End If

' Fenêtre Node cachée ; le navigateur s'ouvre via raid-app.js
sh.Run "node """ & dir & "\cli\raid-app.js""", 0, False
