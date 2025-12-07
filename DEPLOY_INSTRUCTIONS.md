# Instruksi Setup GitHub Pages Deployment

## Masalah yang terjadi:
GitHub menolak push workflow file karena credential tidak memiliki scope `workflow`.

## Solusi: Menggunakan Personal Access Token

### Langkah 1: Buat Personal Access Token
1. Buka: https://github.com/settings/tokens
2. Klik **"Generate new token"** → **"Generate new token (classic)"**
3. Beri nama token (misalnya: "GitHub Pages Deployment")
4. **Centang scope:** `workflow` (dalam bagian "repo")
5. Klik **"Generate token"**
6. **SALIN TOKEN** (hanya muncul sekali, jangan tutup halaman sebelum menyalin!)

### Langkah 2: Update Git Remote dengan Token

Setelah mendapat token, jalankan command berikut (ganti `YOUR_TOKEN` dengan token Anda):

```powershell
git remote set-url origin https://YOUR_TOKEN@github.com/NathanDaud123/Chatbottrainingwebsite.git
```

**ATAU** jika Anda tidak ingin token ada di URL (lebih aman), gunakan Windows Credential Manager:

```powershell
# Setup credential helper
git config --global credential.helper manager-core

# Lalu saat push, masukkan:
# Username: NathanDaud123
# Password: [paste token Anda di sini]
git push origin main
```

### Langkah 3: Push Ulang

```powershell
git push origin main
```

### Langkah 4: Aktifkan GitHub Pages
1. Buka: https://github.com/NathanDaud123/Chatbottrainingwebsite/settings/pages
2. Di bagian **"Source"**, pilih **"GitHub Actions"**
3. Simpan

### Langkah 5: Monitor Deployment
1. Buka tab **Actions** di repository
2. Workflow "Deploy to GitHub Pages" akan otomatis berjalan
3. Tunggu sampai selesai (2-3 menit)
4. Website akan tersedia di: `https://nathandaud123.github.io/Chatbottrainingwebsite/`

---

## Alternatif: Upload Workflow File via GitHub Web

Jika masih ada masalah dengan push, Anda bisa:
1. Buka repository di GitHub
2. Klik tombol **"Add file"** → **"Create new file"**
3. Ketik: `.github/workflows/deploy.yml`
4. Copy-paste isi file `.github/workflows/deploy.yml` yang ada di folder project
5. Commit file tersebut
6. Workflow akan otomatis berjalan

