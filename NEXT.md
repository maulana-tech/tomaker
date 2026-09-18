# NEXT — apa yang harus dikerjakan

Runbook menuju submisi BOT Chain Build Week Vol.2.
**Deadline: Kamis, 25 September 2026, 23:59 WIB.**

Dokumen ini hanya berisi yang belum selesai. Yang sudah selesai ada di
`../botchain-hackathon/HACKATHON.md` bagian 8.

---

## 0. Dua keputusan yang belum diambil

Ambil keduanya hari ini. Keduanya mempengaruhi sisa pekerjaan.

### a. Orisinalitas

Basis kode ini turunan dari `guha-rahul/sidereal-hedera` (Apache-2.0, legal).
Perubahannya besar — ganti chain, hapus ATS, 90 berkas dibuang, tema dan font
baru — tapi arsitektur SY/PT/YT bukan karya sendiri. Juri menilai 20 poin
orisinalitas dan mensyaratkan kamu bisa menjelaskannya saat demo.

Dua jalan:

1. **Sebut terus terang di README** bahwa ini fork yang diport ke BOT Chain,
   lengkap dengan apa yang diubah. Jujur, dan biasanya dihargai.
2. **Bangun dari nol.** Masih cukup waktu untuk Time Capsule atau Asset
   Registry yang 100% milikmu. Contract-nya ~30 baris.

Jangan tunda keputusan ini lewat hari ke-6.

### b. Hosting

**GitHub Pages tidak bisa dipakai untuk aplikasi ini.** Ada tiga rute server
(`/api/faucet`, `/api/health`, `/api/privy/delegated-exit`), semuanya
`runtime = "nodejs"`. GitHub Pages hanya melayani berkas statis.

Rutenya sudah disiapkan untuk **Cloudflare Workers** lewat OpenNext, dan itu
yang direkomendasikan. Guidebook hanya mensyaratkan "live domain", tidak
mengharuskan GitHub Pages.

---

## 1. Hari ini — empat hal dengan waktu tunggu

Semuanya bergantung pada pihak lain atau pada waktu kalender, jadi tidak bisa
dikejar di akhir.

- [ ] **Akun X + post pertama.** Syaratnya 5 post dalam 30 hari sebelum submit.
      Ini satu-satunya item yang tidak bisa dikompres. 1 post/hari sampai submit.
- [ ] **Kirim alamat wallet ke organizer** untuk alokasi BOT mainnet. Tidak ada
      faucet mainnet. Draft pesannya ada di bagian 7a.
- [ ] **Klaim tBOT** di <https://faucet.botchain.ai/basic>. Batas **10 tBOT per
      alamat per 24 jam**, jadi kalau kurang kamu perlu klaim dua hari berturut.
- [ ] **Beli domain** ($1–1.5). Simpan struk, direimburse setelah submit.

---

## 2. Repo GitHub

Sekarang git lokal saja, belum ada remote.

```bash
git remote add origin https://github.com/<user>/tomaker.git
git push -u origin main
```

---

## 3. Deploy ke testnet (chain 968)

Jalankan sendiri — butuh private key, dan private key tidak boleh lewat
asisten.

```bash
cd contracts
export PATH="$HOME/.foundry/bin:$PATH"
export PRIVATE_KEY=0x...            # akun testnet, jangan pakai kunci bernilai
export GUEST_ADDRESS=0x...          # opsional: dompet kedua, ikut didanai + diverifikasi

forge script script/DeployBotChain.s.sol:DeployBotChain \
  --rpc-url https://rpc.bohr.life \
  --broadcast --slow
```

Satu transaksi men-deploy sebelas kontrak sekaligus, lalu menyemai AMM dan
order book, dan menjadwalkan satu kupon terdanai. Di anvil butuh **~24,8 juta
gas**. Kalau tBOT-nya kurang, bilang — script-nya bisa dipecah.

Hasilnya: `contracts/deployments/botchain-testnet.json`.

### Kalau gagal

- `NotEligible` → ada kontrak pemegang SY yang belum terverifikasi. Seharusnya
  sudah ditangani; laporkan kalau muncul.
- `InvalidSchedule` → jam sistem meleset jauh dari waktu chain.
- Kehabisan gas di tengah → Foundry menyimpan progres di `broadcast/`. Jangan
  jalankan ulang mentah-mentah; kirim outputnya.

---

## 4. Sambungkan app ke market

Setelah manifest ada:

```bash
cd web/app
pnpm check:env ../../contracts/deployments/botchain-testnet.json   # cetak saja
pnpm gen:env   ../../contracts/deployments/botchain-testnet.json --out .env.local
```

Lalu isi `web/app/lib/deployments.ts` dari manifest yang sama, supaya app tetap
jalan tanpa `.env.local` (mis. di build CI). Sekarang sengaja kosong.

**Ingat: setiap `NEXT_PUBLIC_*` dibakar ke bundle saat `next build`.** Mengubah
variabel di dashboard Cloudflare tanpa build ulang tidak mengubah apa pun.

---

## 5. Faucet — dan kenapa mungkin tidak perlu

Route `/api/faucet` butuh Privy **dan** database D1. Dua-duanya kerja setup
tambahan, dan `database_id` di `wrangler.jsonc` masih milik akun Cloudflare
pemilik repo asal — harus diganti dengan punyamu:

```bash
cd web/app
pnpm exec wrangler d1 create tomaker-faucet
# salin database_id ke wrangler.jsonc DAN ../../wrangler.jsonc (dua-duanya)
pnpm exec wrangler d1 migrations apply tomaker-faucet --remote
```

**Tapi pertimbangkan melewatinya.** Di market demo ini `TestERC20.mint` publik
tanpa akses kontrol, dan setter identity registry serta compliance juga
terbuka. Artinya siapa pun bisa mendanai dan memverifikasi dirinya sendiri
langsung dari explorer, tanpa server sama sekali. Untuk juri, `GUEST_ADDRESS`
di langkah 3 sudah cukup.

Kalau melewatinya: set `NEXT_PUBLIC_FAUCET_ENABLED=0` supaya tidak ada tombol
yang menjanjikan sesuatu lalu gagal.

> Catatan keamanan: setter yang terbuka itu disengaja untuk demo testnet dan
> ditandai `ponytail:` di script. Jangan dipakai untuk market bernilai nyata.

---

## 6. Deploy web

```bash
cd web
pnpm install --frozen-lockfile
pnpm --filter @tomaker/app cf:deploy
```

Worker-nya bernama `tomaker` di kedua `wrangler.jsonc`. Pasang custom domain
lewat dashboard Cloudflare → Workers → Custom Domains.

Verifikasi alamatnya benar-benar sampai ke browser:

```bash
rg -l "0x<alamat-sy>" web/app/.next/static/chunks/
```

Kosong berarti build tidak melihat env-nya.

---

## 7a. Mendapatkan BOT mainnet

### Berapa

Script deploy memakai **24.779.528 gas** (diukur dari run anvil yang sukses),
dan `eth_gasPrice` mengembalikan **20 gwei** di testnet maupun mainnet.

```
24.779.528 x 20 gwei = 0,4956 BOT
```

| | |
|---|---|
| Biaya dasar | 0,50 BOT |
| +30% buffer | 0,64 BOT |
| Dengan `--gas-estimate-multiplier 200` | 0,99 BOT |

**Minta 1,5 BOT.** Menutup deploy dengan multiplier penuh, plus sisa untuk
transaksi admin setelahnya (`fundCoupon` susulan, `setVerified` untuk dompet
juri) dan percobaan ulang. Kehabisan gas di tengah deploy sebelas kontrak jauh
lebih mahal daripada meminta berlebih.

Angka gas-nya dari anvil. BOT Chain memakai Proof of Staked Authority, jadi
jadwal gas-nya bisa sedikit berbeda dari EVM standar — selisihnya biasanya di
bawah 10%, dan buffer 3x sudah menutupinya. Yang tidak bisa diprediksi: apakah
20 gwei itu tetap atau mengambang saat jaringan ramai.

Testnet: deploy hanya memakai **5% dari jatah faucet harian** (0,5 dari 10
tBOT), jadi satu klaim cukup untuk deploy plus banyak percobaan.

### Cara

**Jalur utama — minta ke organizer.** Guidebook: *"Contact the organizer for a
BOT allocation to cover gas fees. Share your wallet address with the organizer
ahead of time."* Gratis. Ambil alamat dari MetaMask dengan mengklik nama akun.

Draft:

> Halo, saya peserta Build Week Vol.2 dengan proyek **toMaker** — protokol yang
> memisahkan principal dan yield dari sebuah tokenized bond.
>
> Saya mau minta alokasi BOT mainnet untuk gas deployment.
>
> Wallet: `0x...`
> Perkiraan kebutuhan: **~0,5 BOT** untuk deploy, minta **1,5 BOT** sebagai buffer.
>
> Perhitungan: script deploy saya memakai 24.779.528 gas (11 kontrak dalam satu
> transaksi), dan `eth_gasPrice` di `rpc.botchain.ai` mengembalikan 20 gwei
> sehingga 0,4956 BOT. Sisanya untuk transaksi admin setelah deploy dan
> percobaan ulang.
>
> Terima kasih.

Menyertakan angkanya membuat permintaan gampang disetujui — organizer tidak
perlu menebak.

**Jalur cadangan — B DEX.** Checklist guidebook menyebut *"via organizer
allocation or B DEX"*: <https://dex.botchain.ai/#/swap>. Ini pembelian dengan
uang sungguhan; jalankan sendiri.

> **Pakai wallet khusus deploy**, bukan wallet utama. Private key-nya masuk ke
> environment variable saat `forge script` jalan.

---

## 7. Mainnet (chain 677)

Setelah alokasi BOT dari organizer masuk:

```bash
cd contracts
export PRIVATE_KEY=0x...
forge script script/DeployBotChain.s.sol:DeployBotChain \
  --rpc-url https://rpc.botchain.ai \
  --broadcast --slow
```

Script mendeteksi chain id sendiri dan menulis
`contracts/deployments/botchain-mainnet.json`.

Contract itu **immutable**. Tes tuntas di testnet dulu.

---

## 8. Checklist submisi

Tujuh item, semua wajib. Kurang satu = tidak dinilai.

| # | Item | Status |
|---|---|---|
| 1 | Alamat contract dengan aktivitas on-chain | ⬜ butuh langkah 3 dan 7 |
| 2 | Website live di domain sendiri | ⬜ butuh langkah 1 dan 6 |
| 3 | Repo GitHub: `.sol` + README dengan section **Deployment** (alamat testnet **dan** mainnet) | ⬜ README belum ditulis ulang |
| 4 | Post X tag `@BOTChain_ai` | ⬜ |
| 5 | Akun X aktif, ≥5 post dalam 30 hari | ⬜ mulai hari ini |
| 6 | Launch write-up "launched on BOT Chain Mainnet" | ⬜ |
| 7 | Branding BOT Chain di situs + link `botchain.ai` dan explorer | ✅ `BotChainBadge` di ketiga footer |

---

## 9. Yang bisa saya kerjakan

Begitu manifest testnet ada, saya bisa langsung:

- isi `lib/deployments.ts`, generate env, verifikasi bundle
- tulis ulang README dengan section Deployment (item #3)
- draft launch write-up (item #6)
- draft naskah post X dan demo
- `cf:deploy` ke domainmu

Yang **tidak** bisa saya kerjakan: apa pun yang menyentuh private key, akun X,
pembelian domain, dan komunikasi dengan organizer.

---

## Referensi

| | |
|---|---|
| Testnet | chain 968 · `https://rpc.bohr.life` · <https://scan.bohr.life> · gas **tBOT** |
| Mainnet | chain 677 · `https://rpc.botchain.ai` · <https://scan.botchain.ai> · gas **BOT** |
| Faucet | <https://faucet.botchain.ai/basic> — 10 tBOT / alamat / 24 jam |
| Dev docs | <https://dev-docs.botchain.ai/docs/Developers/json-rpc-endpoint/> |

`eth_getLogs` dimatikan di endpoint mainnet. Proyek ini tidak memakainya —
jangan tambahkan fitur yang butuh itu.
