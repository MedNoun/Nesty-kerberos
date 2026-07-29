# Nesty-kerberos

A from-scratch implementation of the Kerberos three-legged ticket flow on NestJS.

## Contents

- [Architecture](#architecture)
- [Protocol](#protocol)
- [Prerequisites](#prerequisites)
- [Installation](#installation)
- [Configuration](#configuration)
- [Running it](#running-it)
- [Tests](#tests)
- [Security properties](#security-properties)
- [Known gaps](#known-gaps)

## Architecture

Two independently deployable NestJS applications:

| Application | Port | Contains |
|---|---|---|
| `kdc/` | 5000 | Key Distribution Centre: the Authentication Service (`POST /as/:realm`) and the Ticket Granting Service (`POST /tgs/:realm`) |
| `service/` | 3001 | An application service (`POST /tickets-manager/:realm`) plus principal registration (`POST /user/dh`, `POST /user/:realm`) |

Redis holds the keytab, the realm lifetime policy and the replay cache. PostgreSQL
holds principal records. Both come from `docker-compose.yml`, along with Adminer
for inspection.

Everything is namespaced by realm. Two realms ship configured, `insat` and `enit`.

## Protocol

1. **Registration.** The client runs an ephemeral Diffie-Hellman exchange
   (`POST /user/dh`, MODP group 15 or above), encrypts its password under the
   derived secret and registers (`POST /user/:realm`). The server derives the
   principal's long-term key with PBKDF2-HMAC-SHA256 and stores only that.
2. **AS exchange.** The client proves it holds the long-term key by sending a
   pre-authenticator, `{ username, timestamp }` encrypted under that key. The AS
   returns a ticket-granting ticket encrypted under the TGS's key, plus a
   challenge encrypted under the client's key carrying a fresh session key.
3. **TGS exchange.** The client presents the TGT and an authenticator encrypted
   under the TGT's session key. The TGS validates both and issues a service
   ticket for the target principal.
4. **AP exchange.** The client presents the service ticket and a new
   authenticator to the application service, which replies with an AP_REP
   echoing the client's own timestamp under the session key.

The nested-encryption step is a NestJS interceptor: it decrypts the incoming
ticket under the receiving principal's long-term key, recovers the session key
from inside that ticket, and uses it to decrypt the client's authenticator. So
the server proves the client holds a key that was never transmitted.

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- Docker with Compose

## Installation

```bash
git clone https://github.com/MedNoun/Nesty-kerberos.git
cd Nesty-kerberos
(cd kdc && npm ci)
(cd service && npm ci)
```

## Configuration

Three `.env` files, none of them committed. Copy each example and fill it in:

```bash
cp .env.example .env                  # docker-compose credentials
cp kdc/.env.example kdc/.env
cp service/.env.example service/.env
```

Generate the credentials:

```bash
openssl rand -hex 24    # REDIS_PASSWORD, POSTGRES_PASSWORD
openssl rand -hex 32    # one per principal key
```

Both applications need the **same** principal keys (`INSAT_TGS_KEY`,
`INSAT_SERVICE_1_KEY`, and so on). The KDC seeds them into the Redis keytab at
boot and is the only writer; the application service reads its own key back out.
If the two files disagree, nothing decrypts.

`SERVICE_NAME` in `service/.env` must name a principal that exists in the realm
config, for example `service_1`.

If ports 6379, 5432 or 8080 are taken on your machine, set `REDIS_PORT`,
`POSTGRES_PORT` or `ADMINER_PORT` in the root `.env`.

## Running it

```bash
docker compose up -d
(cd kdc && npm run start:dev) &
(cd service && npm run start:dev) &
```

The KDC logs `Seeded 4 principals for realm insat` once the keytab is in place.
`scripts/walk.mjs` runs the whole four-step flow against both running
applications and prints each leg.

## Tests

```bash
(cd kdc && npm test)          # unit
(cd service && npm test)
(cd kdc && npm run test:e2e)  # needs docker compose up
(cd service && npm run test:e2e)
```

## Secret scanning

This repository committed its Redis and Postgres passwords for two years, so the
check is wired in twice: a gitleaks pre-commit hook, and a GitHub Actions
workflow that scans both the full history and the working tree on every push and
pull request.

```bash
pip install pre-commit && pre-commit install
pre-commit run --all-files
```

`.gitleaksignore` holds the reviewed dismissals, one line per finding, with the
reason above it. Two entries, both the `nest new` scaffold README's placeholder
CircleCI badge token.

## Security properties

- **AES-256-GCM** everywhere, with a fresh 96-bit IV per message and the tag
  verified on decrypt. The algorithm is fixed server-side rather than read from
  the envelope, so a caller cannot choose the mode or the key length.
- **Passwords are never stored.** `string2key` derives the long-term key with
  PBKDF2-HMAC-SHA256 at 600,000 iterations, salted with realm plus username per
  RFC 4120.
- **AS pre-authentication.** A ticket is only issued to a caller that can encrypt
  a fresh timestamp under the principal's long-term key.
- **Replay defence.** Authenticators are recorded under their own identity with
  `SET NX`, so the check and the write are one atomic operation, and the entry
  lives exactly as long as the clock-skew window in which a replay could still
  be accepted.
- **Clock skew** is measured against the server's clock, tolerance 120 seconds.
- **Ticket binding.** Source IP, username inside the ticket against username in
  the authenticator, expiry, and the principal the ticket was issued for are all
  checked. A service ticket can never outlive the TGT that authorised it.
- **Lifetimes** are clamped to a per-realm minimum and maximum, 2 to 10 hours.

## Known gaps

Named deliberately rather than left for a reader to find.

- **Registration is unauthenticated.** Anyone can register a principal, and the
  Diffie-Hellman exchange that protects the password has no server
  authentication, so it is exposed to a machine-in-the-middle. Real Kerberos
  provisions principals out of band.
- **The principal key is stored as-is** in PostgreSQL. A production KDC encrypts
  its database under a master key.
- **No authorisation.** The application service authenticates a client and stops
  there; the `role` on a principal is not consulted.
- **No cross-realm referrals**, no ticket renewal or forwarding, no PKINIT.
- **Schema sync** is enabled outside production, which rebuilds columns on boot.
  There are no migrations.
