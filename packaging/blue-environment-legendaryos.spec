Name: blue-environment
Version: @VERSION@
Release: 1%{?dist}
Summary: Blue Environment for LegendaryOS
License: GPL-3.0
%description
Blue Environment — Wayland desktop shell, LegendaryOS edition.
%install
mkdir -p %{buildroot}/usr/share/Blue-Environment/lib
mkdir -p %{buildroot}/usr/share/wayland-sessions
mkdir -p %{buildroot}/usr/share/applications
mkdir -p %{buildroot}/usr/local/bin
install -m755 %{_sourcedir}/blue-environment %{buildroot}/usr/share/Blue-Environment/blue-environment
install -m755 %{_sourcedir}/blue-compositor %{buildroot}/usr/share/Blue-Environment/lib/blue-compositor
install -m755 %{_sourcedir}/blue %{buildroot}/usr/local/bin/blue
printf '[Desktop Entry]\nName=Blue Environment (LegendaryOS)\nExec=/usr/share/Blue-Environment/lib/blue-compositor\nType=Application\nDesktopNames=Blue\n' > %{buildroot}/usr/share/wayland-sessions/blue-environment.desktop
printf '[Desktop Entry]\nName=Blue Environment\nExec=/usr/share/Blue-Environment/blue-environment\nIcon=/usr/share/LegendaryOS/icons/watermark.png\nType=Application\nCategories=System;\n' > %{buildroot}/usr/share/applications/blue-environment.desktop
%files
/usr/share/Blue-Environment/
/usr/share/wayland-sessions/blue-environment.desktop
/usr/share/applications/blue-environment.desktop
/usr/local/bin/blue
