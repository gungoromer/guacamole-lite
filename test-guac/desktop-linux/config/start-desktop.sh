#!/usr/bin/env bash
set -e
export DISPLAY=:0

# Fix permissions for shared upload directory (allow guacd to write)
# guacd runs as uid 1000, so we make sure the directory is writable by 1000
if [ -d "/mnt/guac-uploads" ]; then
    chown -R 1000:1000 /mnt/guac-uploads
    chmod 777 /mnt/guac-uploads
fi

Xvfb :0 -screen 0 1280x720x24 &
XVFB_PID=$!

# run XFCE inside its own dbus session on :0
su -l "$USERNAME" -c "DISPLAY=:0 dbus-run-session -- xfce4-session" &
XFCE_PID=$!

x11vnc  -noxdamage -display :0 -forever -shared \
        -rfbport 5900 -passwd "$PASSWORD" &

/usr/sbin/xrdp-sesman &
exec /usr/sbin/xrdp -nodaemon
