/** 🌐 Hands-on: computer networking — gets you ready for Cisco CCST Networking, CompTIA Network+ and the CCNA (format: ../mathLessonsParse.ts; right choice starred). */
export const HO_NETWORKING = `
@ net-certs | 🌐 Networking | 🎓 Networking certificates: CCST, Network+ and CCNA
Every business, school, hospital and home runs on networks — and someone has to build and fix them.

## Cisco CCST Networking (start here)
**Cisco Certified Support Technician — Networking.** Made for high-school students and beginners: how networks work, IP addresses, cabling, Wi-Fi, and troubleshooting. Many schools give it through **Certiport**. Cisco's free **Networking Academy** has courses that prepare you. (There's also **CCST Cybersecurity**.)

## CompTIA Network+
The most common vendor-neutral networking certificate: the OSI model, IP addressing and subnetting, routing, switching, wireless, security and troubleshooting. Good for **3 years**, then renewed.

## Cisco CCNA
**Cisco Certified Network Associate** — the big one for network technicians and engineers. Harder: lots of subnetting and configuring real routers and switches from the command line.

## Next steps
**CompTIA Security+** (security), cloud certificates, or jobs like help desk → network technician → network engineer.

## The rule for every network person
⚠️ Only test, scan or log into networks and computers **you own or have written permission** to work on. Breaking into others' systems is a crime under the **Computer Fraud and Abuse Act**, even "just to look."
? A good first networking certificate for a student is … | *Cisco CCST Networking | a driver's license | the CCNA only
? CompTIA Network+ is good for … | *3 years, then renewed | one week | forever
? You may test or scan a network only if … | *you own it or have written permission | it has no password | your friend dares you
? Cisco's free training program is the … | *Networking Academy | Plumbing Academy | Cisco Café

@ net-basics | 🌐 Networking | What a network is: LAN, WAN and the boxes that run it
A **network** is two or more devices connected so they can share data.

## Sizes
- **LAN** (local area network) — one home, school or building
- **WAN** (wide area network) — connects places far apart. **The internet** is the biggest WAN: millions of networks connected.

## The boxes
- **Modem** — connects your home to your **internet provider** (over cable, fiber, phone line or cell signal).
- **Router** — connects **different networks** together (your home LAN to the internet) and picks the path for each packet.
- **Switch** — connects devices **inside** one LAN with Ethernet cables; sends each frame only to the device it's for, using **MAC addresses**.
- **Access point** — gives devices Wi-Fi on the LAN.
- A home "Wi-Fi router" is usually a router + switch + access point (and sometimes the modem) in **one box**.

## Packets
Data is chopped into small **packets**. Each one has a **from** and **to** address. They can take different paths and get put back together at the end.
? A network inside one house or school is a … | *LAN | WAN | MAN-UP
? The device that connects different networks (like home to the internet) is the … | *router | monitor | keyboard
? A switch sends data to the right device using … | *MAC addresses | phone numbers | colors
? Big files travel across a network as … | *many small packets | one huge piece | radio jokes

@ net-ip | 🌐 Networking | IP addresses, subnet masks and gateways
Every device on a network needs an **IP address**, like a street address for mail.

## IPv4
Four numbers 0–255, separated by dots: **192.168.1.25**. That's **32 bits** (4 bytes).

## The subnet mask
The mask says which part of the address is the **network** and which part is the **device (host)**. **255.255.255.0** (also written **/24**) means the first three numbers are the network.
- 192.168.1.25 and 192.168.1.80 with /24 → **same network** — they can talk directly.
- 192.168.2.5 → **different network** — the traffic has to go through a **router**.
A /24 has 256 addresses, but the first (network) and last (**broadcast**) are saved, so **254** devices can use it.

## Private addresses
Homes and schools use **private** ranges that aren't used on the internet: **10.x.x.x**, **172.16–31.x.x**, and **192.168.x.x**. The router uses **NAT** to share one public address for everyone.

## More you need to know
- **Default gateway** — the router's address. "Not on my network? Send it here."
- **DHCP** — hands out IP addresses automatically when you join.
- An address starting with **169.254** means the device **couldn't reach DHCP**.
- **127.0.0.1** is "localhost" — the computer itself.
- **IPv6** addresses are much longer (128 bits), written in hex, like 2001:db8::1, because the world ran low on IPv4 addresses.
🧪 lab: subnet
? With mask 255.255.255.0, are 192.168.1.5 and 192.168.1.200 on the same network? | *Yes | No | Only on Tuesdays
? How many devices can use a /24 network? | *254 | 256 | 24
? The service that gives out IP addresses automatically is … | *DHCP | DNS | HTTP
? An address of 169.254.10.3 means … | *the device couldn't reach DHCP | it's the fastest | it's the router

@ net-dns | 🌐 Networking | DNS, ports and protocols
## DNS — the internet's phone book
People remember names like **example.com**; computers need IP addresses. **DNS** turns the name into the address. If DNS breaks, "the internet is down" even though it's not — you just can't find anything by name.

## Ports
One computer runs many services. A **port number** says which one a packet is for:
- **80** — HTTP (web)
- **443** — HTTPS (secure web — the padlock)
- **22** — SSH (secure remote command line)
- **53** — DNS
- **25** — SMTP (sending email)
- **3389** — RDP (Windows remote desktop)

## TCP and UDP
- **TCP** — makes sure every packet arrives, in order, and resends lost ones. Used for web pages, email and files.
- **UDP** — sends fast without checking. Used for video calls, live games and streaming, where a lost bit is better than waiting.

## HTTPS
The S means **encrypted** — nobody in between can read it. Never type a password on a site that isn't HTTPS.
? DNS turns … into … | *names into IP addresses | IP addresses into money | packets into pictures
? Secure websites (HTTPS) use port … | *443 | 80 | 22
? Live video calls usually use … because it's fast | *UDP | TCP | DNS
? The S in HTTPS means … | *secure (encrypted) | slow | simple

@ net-osi | 🌐 Networking | The OSI model: 7 layers
Network people use the **OSI model** to talk about where a problem is. From the bottom up:

1. **Physical** — cables, Wi-Fi signals, plugs, bits as electricity or light
2. **Data link** — frames between devices on one LAN; **MAC addresses**; **switches**
3. **Network** — **IP addresses** and **routers**; finding a path across networks
4. **Transport** — **TCP and UDP**, ports
5. **Session** — opening and closing conversations
6. **Presentation** — formats and encryption
7. **Application** — what the user's app speaks: HTTP, DNS, email

A trick to remember them, bottom to top: "**P**lease **D**o **N**ot **T**hrow **S**ausage **P**izza **A**way."

## Troubleshoot from the bottom
Is it plugged in, is the link light on (layer 1)? Does it have an IP address (layer 3)? Then check DNS and the app.
? Routers and IP addresses work at OSI layer … | *3 (network) | 1 (physical) | 7 (application)
? Cables and Wi-Fi signals are layer … | *1 (physical) | 4 (transport) | 6
? Switches and MAC addresses are layer … | *2 (data link) | 5 | 7
? TCP and UDP are at the … layer | *transport | physical | presentation

@ net-cables | 🌐 Networking | Cables and Wi-Fi
## Ethernet cable
- **Cat 5e** and **Cat 6** twisted-pair cables with **RJ45** plugs. 8 wires in 4 twisted pairs (the twist blocks interference).
- Maximum run: **100 meters** (328 feet) before you need a switch in between.
- Wired in the **T568B** color order (most common): white-orange, orange, white-green, blue, white-blue, green, white-brown, brown.
- Tools: **cable stripper**, **crimper**, a **cable tester**, and a **punch-down tool** for wall jacks.

## Fiber optic
Sends **light** through glass. Goes much **farther** and faster, and lightning and motors can't interfere with it. ⚠️ Never look into the end of a fiber — the laser light is invisible and can hurt your eyes.

## Wi-Fi
- **2.4 GHz** — goes farther and through walls better, but slower and more crowded
- **5 GHz** and **6 GHz** — faster, shorter range
- Use **WPA3** (or at least WPA2) security with a strong password. Never leave Wi-Fi open.
- Wi-Fi dead spots? Move the access point up high and central, or add **mesh** points.
? The longest normal Ethernet run is … | *100 meters | 10 meters | 10 miles
? Ethernet cables use … plugs | *RJ45 | USB-C | 3.5 mm
? Which Wi-Fi band goes through walls better? | *2.4 GHz | 6 GHz | 5 GHz
? Why never look into a fiber cable's end? | *Its laser light can hurt your eyes, even if you can't see it | it's sharp | it's hot

@ net-troubleshoot | 🌐 Networking | Network troubleshooting commands
Open a command prompt (Windows) or terminal (Mac, Linux, Raspberry Pi):

- **ipconfig** (Windows) / **ip addr** (Linux) — shows your IP address, mask and gateway
- **ping 8.8.8.8** — "are you there?" — tests if you can reach an address and how long it takes (in milliseconds)
- **ping example.com** — if pinging the number works but the name fails → it's a **DNS** problem
- **tracert** (Windows) / **traceroute** — shows each router a packet goes through, to see where it gets stuck
- **nslookup example.com** — asks DNS for a name's address

## A plan for "no internet"
1. Is it just you or everyone? (Everyone → the router or the internet provider.)
2. Cable plugged in / Wi-Fi connected? Link lights on?
3. Does it have a real IP address (not 169.254)?
4. Ping the **gateway** (your router). Works? Then ping 8.8.8.8 (out on the internet).
5. Ping a name. If numbers work but names don't, it's DNS.
6. Still stuck: restart the modem, then the router (wait for each to come up).
? ping is used to … | *test if you can reach another device | delete files | speed up Wi-Fi
? Pinging 8.8.8.8 works but pinging a website name fails. The problem is likely … | *DNS | the power cord | the monitor
? Which command shows the path packets take? | *tracert / traceroute | ipconfig | print
? On Windows, the command to see your IP address is … | *ipconfig | ip-see | showme

@ net-security | 🌐 Networking | Keeping networks safe
## For everyone
- **Long passwords** (a passphrase of 4+ random words) and a different one for each site. A **password manager** remembers them.
- **MFA (multi-factor authentication)** — a code or app approval as well as the password.
- **Updates** — patch computers, phones and routers; most attacks use old holes.
- **Phishing** — fake emails and texts that try to get you to click or log in. Check the sender and the link; when in doubt, go to the site yourself.

## For network techs
- Change the router's **default admin password**.
- A **firewall** blocks traffic that isn't allowed. Close ports you don't use.
- Put guests and smart gadgets on a **separate network** (guest Wi-Fi or a VLAN).
- **Backups** (the 3-2-1 rule: 3 copies, 2 kinds of storage, 1 kept somewhere else) beat ransomware.

## Ethics
Security pros ("white-hat" or **ethical hackers**) only test systems with **written permission**. Practice on your own gear or legal practice sites and capture-the-flag games.
? MFA means … | *a second check (like a code) as well as the password | a faster modem | a bigger password
? A fake email trying to get your password is … | *phishing | fishing for trout | a firewall
? A firewall … | *blocks traffic that isn't allowed | makes Wi-Fi faster | puts out fires
? The 3-2-1 backup rule says keep … | *3 copies, on 2 kinds of storage, 1 somewhere else | 3 passwords | 1 copy only
`;
