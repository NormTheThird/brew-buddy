# Deploying Brew Buddy to AWS

One small always-on VM (brief §2). Target: ≤ ~$8/month all-in. These steps are the
parts only the account owner can do, plus the commands to run once you're on the box.

## 1. One-time AWS setup (you, in the browser)

1. **Lightsail instance**: AWS Console → Lightsail → Create instance →
   Linux, **Ubuntu 24.04 LTS**, the **$5/month plan** (1 GB RAM) is enough.
   Name it `brew-buddy`. Create.
2. **Static IP**: Lightsail → Networking → Create static IP → attach to the instance.
   (Without this, the IP changes on reboot and DNS breaks.)
3. **Open ports**: on the instance → Networking → add firewall rules for
   **HTTP (80)** and **HTTPS (443)**. SSH (22) is already open.
4. **Domain**: buy one anywhere (Route 53, Namecheap, Cloudflare — ~$10/yr).
   Add an **A record** pointing your chosen hostname (e.g. `brew.example.com`)
   at the static IP.
5. **S3 backup bucket**: S3 → Create bucket (e.g. `brew-buddy-backups-<something>`),
   private, default settings.
6. **Instance role for backups**: Lightsail can't attach IAM roles directly — create
   an IAM user `brew-buddy-backup` with a policy allowing `s3:PutObject`/`s3:ListBucket`
   on that bucket only, create an access key, and note it for step 3 below.

## 2. On the instance (SSH from Lightsail's browser terminal)

```bash
# Docker
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker ubuntu && exit   # reconnect after this

# App
git clone https://github.com/NormTheThird/brew-buddy.git
cd brew-buddy

# Config — never commit this file
cat > .env <<'EOF'
DOMAIN=brew.example.com
ANTHROPIC_API_KEY=sk-ant-...
EOF

docker compose up -d --build
```

Caddy fetches the HTTPS certificate automatically the first time the domain resolves
to the instance. Then create the schema and the admin account — the standalone
runtime image doesn't ship the dev tooling, so run the seed from the checkout with
Node installed on the host:

```bash
sudo apt-get install -y nodejs npm
npm ci
DB=/var/lib/docker/volumes/brew-buddy_app-data/_data/brewbuddy.db
sudo -E env DATABASE_PATH=$DB npm run db:push
sudo -E env DATABASE_PATH=$DB ADMIN_PASSWORD='choose-a-strong-one' npm run db:seed
docker compose restart app
```

## 3. Backups

```bash
aws configure   # the brew-buddy-backup access key from step 1.6
crontab -e
# add:
0 9 * * * BACKUP_BUCKET=s3://your-bucket /home/ubuntu/brew-buddy/scripts/backup-to-s3.sh >> /var/log/brewbuddy-backup.log 2>&1
```

Restore = copy the `.db` file back into the volume and `docker compose restart app`.

## 4. Phone install (PWA)

Open `https://brew.example.com` on your phone → sign in → browser menu →
**Add to Home Screen**. Requires HTTPS, which Caddy provides.

## 5. Updating

```bash
cd brew-buddy && git pull && docker compose up -d --build
```

## Security checklist before going live

- [ ] Admin password is NOT the dev default
- [ ] `.env` exists only on the instance (gitignored everywhere)
- [ ] Regenerate the Anthropic API key if it was ever shared in chat/screenshots
- [ ] Ports open: 22, 80, 443 only
