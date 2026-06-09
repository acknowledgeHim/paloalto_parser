# HPE Alletra MP — Configuration Export Instructions

Export the Alletra MP configuration to a `.txt` file for use with `hp_alletra_analyzer.py`.

---

## Option 1 — SSH directly to the array (recommended)

Run this from your jump host. Replace `<alletra-mgmt-ip>` and `<username>` with your values.

### Single command export

```bash
ssh <username>@<alletra-mgmt-ip> "
showsys ;
showuser -d ;
showpasswordpolicy ;
showsnmp ;
showsyslog ;
showaudit ;
showtime -zone ;
shownet ;
showhost ;
showhost -chap ;
showhostset ;
showvlun ;
showvv -showcols Name,VSize,Prov,State ;
showport ;
showwsapi ;
showsshkey
" > alletra-export.txt
```

### Shell script export (recommended for repeatable audits)

Save as `collect_alletra.sh` on your jump host:

```bash
#!/bin/bash
HOST="<alletra-mgmt-ip>"
USER="admin"
OUT="alletra-export-$(date +%Y%m%d).txt"

CMDS=(
  "showsys"
  "showuser -d"
  "showpasswordpolicy"
  "showsnmp"
  "showsyslog"
  "showaudit"
  "showtime -zone"
  "shownet"
  "showhost"
  "showhost -chap"
  "showhostset"
  "showvlun"
  "showvv -showcols Name,VSize,Prov,State"
  "showport"
  "showwsapi"
  "showsshkey"
)

> "$OUT"
for CMD in "${CMDS[@]}"; do
  echo "=== $CMD ===" >> "$OUT"
  ssh -o StrictHostKeyChecking=no "$USER@$HOST" "$CMD" >> "$OUT" 2>&1
  echo "" >> "$OUT"
done

echo "Saved to $OUT"
```

Run it:

```bash
chmod +x collect_alletra.sh
./collect_alletra.sh
```

---

## Option 2 — HPE GreenLake Cloud Console (no VPN required)

1. Log in to **[greenlake.hpe.com](https://greenlake.hpe.com)**
2. Navigate to **Storage** → select your Alletra MP system
3. Click **Launch** → **Storage Management Console (SSMC)**
4. In SSMC: click the top-right menu → **Open CLI Terminal**
5. Run each command below and copy the output into a single `.txt` file:

```
showsys
showuser -d
showpasswordpolicy
showsnmp
showsyslog
showaudit
showtime -zone
shownet
showhost
showhost -chap
showhostset
showvlun
showvv -showcols Name,VSize,Prov,State
showport
showwsapi
showsshkey
```

> **Tip:** Paste output from each command into a text editor as you go. Save the final combined file as `alletra-export.txt`.

---

## Option 3 — SSMC Web UI (on-premises SSMC)

1. Open SSMC in your browser (default: `https://<ssmc-host>:8443`)
2. Log in and select your Alletra MP system
3. Go to **Activity** → **CLI Sessions** → **Open CLI**
4. Run the commands listed in Option 2 above
5. Copy and save output to `alletra-export.txt`

---

## Run the analyzer

Once you have the export file:

```bash
cd san
python3 hp_alletra_analyzer.py alletra-export.txt -o alletra-audit.xlsx
```

---

## Notes

- The export file does **not** need to be sanitized before running the analyzer — IP addresses and WWNs are parsed and included in the report.
- If SSH key-based auth is not set up, you will be prompted for a password for each command in the shell script. Use `sshpass` or configure SSH keys to automate.
- Commands requiring super or admin role: `showuser -d`, `showpasswordpolicy`, `showsnmp`, `showsshkey`. Run as `admin` or a super-role account.
- The `showwsapi` command may not be available on all firmware versions. If it errors, remove it from the command list.
