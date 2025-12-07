
# Chatbot Training Website

This is a code bundle for Chatbot Training Website. 

## Running the code

Run `npm i` to install the dependencies.

Run `npm run dev` to start the development server.

## Deployment to GitHub Pages

Project ini sudah dikonfigurasi untuk deployment otomatis ke GitHub Pages menggunakan GitHub Actions.

### Cara Deploy:

1. **Pastikan repository GitHub Pages sudah diaktifkan:**
   - Buka repository di GitHub
   - Pergi ke Settings → Pages
   - Di bagian "Source", pilih "GitHub Actions"

2. **Push code ke branch main/master:**
   ```bash
   git add .
   git commit -m "Setup GitHub Pages deployment"
   git push origin main
   ```

3. **Workflow akan otomatis berjalan:**
   - GitHub Actions akan otomatis build dan deploy project
   - Tunggu sampai workflow selesai (bisa dilihat di tab Actions)
   - Website akan tersedia di: `https://[username].github.io/[repository-name]/`

### Catatan:

- Pastikan branch utama adalah `main` atau `master` (sesuai konfigurasi workflow)
- Build output akan berada di folder `dist/`
- Base path otomatis disesuaikan dengan nama repository

