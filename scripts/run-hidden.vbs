Option Explicit

If WScript.Arguments.Count <> 2 Then WScript.Quit 2

Dim shell, files, node, server, command
Set shell = CreateObject("WScript.Shell")
Set files = CreateObject("Scripting.FileSystemObject")
node = WScript.Arguments(0)
server = WScript.Arguments(1)
shell.CurrentDirectory = files.GetParentFolderName(server)
command = Chr(34) & node & Chr(34) & " " & Chr(34) & server & Chr(34) & " --watch-parent"
WScript.Quit shell.Run(command, 0, True)
