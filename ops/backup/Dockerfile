# Backup-Sidecar: teilt sich das Daten-Volume mit der App und laeuft per Cron.
FROM alpine:3.20

RUN apk add --no-cache sqlite tzdata age tini
ENV TZ=Europe/Berlin

COPY scripts/backup.sh /scripts/backup.sh
COPY scripts/restore.sh /scripts/restore.sh
RUN chmod +x /scripts/*.sh

# Taeglich 02:30 Uhr, Ausgabe in das Container-Log
RUN echo '30 2 * * * /scripts/backup.sh >> /proc/1/fd/1 2>&1' > /etc/crontabs/root

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["crond", "-f", "-l", "8"]
