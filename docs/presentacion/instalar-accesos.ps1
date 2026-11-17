<#
.SYNOPSIS
  Crea en el menú Inicio (carpeta "Mesh") los accesos directos de la presentación,
  con su ícono, listos para anclar a la barra de tareas.

.DESCRIPTION
  Windows 11 no deja anclar un .cmd ni anclar nada por script: el anclaje lo hace
  la persona (clic derecho › Anclar a la barra de tareas). Este script deja todo
  preparado para que sea ese único clic.

  Cada acceso directo lleva su propio AppUserModelID: sin eso, como todos abren
  cmd.exe, Windows los toma como la misma app y no deja anclar más de uno.

  Volver a correrlo actualiza los accesos (por ejemplo, si se movió el repo).
  Con -Quitar los borra.
#>
param([switch]$Quitar)

$ErrorActionPreference = 'Stop'

Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;
using System.Runtime.InteropServices.ComTypes;
using System.Text;

[ComImport, Guid("000214F9-0000-0000-C000-000000000046"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IShellLinkW {
  void GetPath([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder f, int c, IntPtr fd, uint fl);
  void GetIDList(out IntPtr p);
  void SetIDList(IntPtr p);
  void GetDescription([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder s, int c);
  void SetDescription([MarshalAs(UnmanagedType.LPWStr)] string s);
  void GetWorkingDirectory([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder s, int c);
  void SetWorkingDirectory([MarshalAs(UnmanagedType.LPWStr)] string s);
  void GetArguments([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder s, int c);
  void SetArguments([MarshalAs(UnmanagedType.LPWStr)] string s);
  void GetHotkey(out short h);
  void SetHotkey(short h);
  void GetShowCmd(out int c);
  void SetShowCmd(int c);
  void GetIconLocation([Out, MarshalAs(UnmanagedType.LPWStr)] StringBuilder s, int c, out int i);
  void SetIconLocation([MarshalAs(UnmanagedType.LPWStr)] string s, int i);
  void SetRelativePath([MarshalAs(UnmanagedType.LPWStr)] string s, uint r);
  void Resolve(IntPtr h, uint f);
  void SetPath([MarshalAs(UnmanagedType.LPWStr)] string s);
}

[ComImport, Guid("886D8EEB-8CF2-4446-8D02-CDBA1DBDCF99"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IPropertyStore {
  void GetCount(out uint c);
  void GetAt(uint i, out ClaveDePropiedad k);
  void GetValue(ref ClaveDePropiedad k, out VarianteDePropiedad v);
  void SetValue(ref ClaveDePropiedad k, ref VarianteDePropiedad v);
  void Commit();
}

[StructLayout(LayoutKind.Sequential, Pack = 4)]
public struct ClaveDePropiedad { public Guid Formato; public uint Id; }

[StructLayout(LayoutKind.Explicit)]
public struct VarianteDePropiedad { [FieldOffset(0)] public ushort Tipo; [FieldOffset(8)] public IntPtr Valor; }

[ComImport, Guid("00021401-0000-0000-C000-000000000046")]
class ShellLink { }

public static class MeshAccesoDirecto {
  public static void Crear(string ruta, string destino, string argumentos, string carpeta, string icono, string descripcion, string appId) {
    var link = (IShellLinkW)new ShellLink();
    link.SetPath(destino);
    link.SetArguments(argumentos);
    link.SetWorkingDirectory(carpeta);
    link.SetIconLocation(icono, 0);
    link.SetDescription(descripcion);
    link.SetShowCmd(1);

    // System.AppUserModel.ID
    var clave = new ClaveDePropiedad { Formato = new Guid("9F4C2855-9F79-4B39-A8D0-E1D42DE1D5F3"), Id = 5 };
    var valor = new VarianteDePropiedad { Tipo = 31, Valor = Marshal.StringToCoTaskMemUni(appId) };   // VT_LPWSTR
    var props = (IPropertyStore)link;
    props.SetValue(ref clave, ref valor);
    props.Commit();
    Marshal.FreeCoTaskMem(valor.Valor);

    ((IPersistFile)link).Save(ruta, true);
  }
}
'@

$carpetaMenu = Join-Path ([Environment]::GetFolderPath('Programs')) 'Mesh'
$aqui = $PSScriptRoot

$accesos = @(
  @{ Nombre = 'Presentar Mesh por WiFi'; Cmd = 'Presentar por WiFi.cmd';  Icono = 'mesh-wifi.ico';   Id = 'UTN.Mesh.Presentacion.WiFi'
     Descripcion = 'Espeja los celulares por WiFi sobre el fondo de Mesh' },
  @{ Nombre = 'Presentar Mesh por hotspot del celular'; Cmd = 'Presentar por hotspot del celular.cmd'; Icono = 'mesh-wifi.ico'; Id = 'UTN.Mesh.Presentacion.Hotspot'
     Descripcion = 'Espeja los celulares por la red del hotspot de un celular (sin prender la zona de la notebook)' },
  @{ Nombre = 'Presentar Mesh por cable'; Cmd = 'Presentar por cable.cmd'; Icono = 'mesh-cable.ico';  Id = 'UTN.Mesh.Presentacion.Cable'
     Descripcion = 'Espeja los celulares enchufados por cable sobre el fondo de Mesh' },
  @{ Nombre = 'Cerrar presentación Mesh'; Cmd = 'Cerrar presentacion.cmd'; Icono = 'mesh-cerrar.ico'; Id = 'UTN.Mesh.Presentacion.Cerrar'
     Descripcion = 'Cierra espejos y fondo, y restaura No molestar en los celulares' }
)

if ($Quitar) {
  if (Test-Path $carpetaMenu) { Remove-Item $carpetaMenu -Recurse -Force }
  Write-Host 'Accesos directos de Mesh quitados del menú Inicio.' -ForegroundColor Green
  Write-Host 'Si estaban anclados, desanclalos de la barra de tareas (clic derecho › Desanclar).'
  exit 0
}

New-Item -ItemType Directory -Force $carpetaMenu | Out-Null
foreach ($a in $accesos) {
  $cmd = Join-Path $aqui $a.Cmd
  if (-not (Test-Path $cmd)) { throw "No encuentro $cmd" }
  $lnk = Join-Path $carpetaMenu ($a.Nombre + '.lnk')
  [MeshAccesoDirecto]::Crear($lnk, $env:ComSpec, "/c `"`"$cmd`"`"", $aqui,
    (Join-Path $aqui ('iconos\' + $a.Icono)), $a.Descripcion, $a.Id)
  Write-Host "  Creado: $lnk"
}

Write-Host "`nListo. Para anclar cada uno a la barra de tareas:" -ForegroundColor Green
Write-Host '  Inicio › escribí "Presentar Mesh" › clic derecho en el resultado › Anclar a la barra de tareas.'
